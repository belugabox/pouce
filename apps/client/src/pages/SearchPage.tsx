import {
    ActionIcon,
    Anchor,
    Box,
    Button,
    Container,
    Group,
    Loader,
    Menu,
    NativeSelect,
    Paper,
    Stack,
    Tabs,
    Text,
    TextInput,
    Title,
    UnstyledButton,
} from '@mantine/core';
import { useDebouncedValue, useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
    IconChevronDown,
    IconChevronUp,
    IconDots,
    IconInfoCircle,
    IconPlayerPlayFilled,
    IconPlayerStopFilled,
    IconSearch,
    IconStar,
    IconStarFilled,
    IconSunMoon,
    IconTrash,
    IconUpload,
} from '@tabler/icons-react';
import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import {
    type CatalogEntry,
    type CatalogHit,
    GENRES,
    type Genre,
    LEVELS,
    type Level,
    SORTS,
    type Sort,
} from '@server/types';

import { AboutModal } from '@/components/AboutModal';
import { COLOR_SCHEME_OPTIONS, useAppearance } from '@/components/theme';
import { estimateDifficulty } from '@/core/difficulty';
import { importFile } from '@/core/importFile';
import { indexScore, parseXml } from '@/core/musicxml';
import { playNotes } from '@/core/playback';
import { matches } from '@/core/search';
import { LEVEL_COLORS, formatDuration } from '@/editor/format';
import { Player } from '@/editor/player';
import { type CatalogQuery, fetchCatalog, fetchScore } from '@/services/api';
import { useQuery } from '@/services/useQuery';
import {
    type PieceSource,
    addImport,
    countAnnotations,
    deleteImport,
    getImport,
    getLibraryPiece,
    getSettings,
    keepLibraryPiece,
    listFavorites,
    listImports,
    pieceKey,
    setFavorite,
} from '@/storage/db';

/** Autres bibliothèques, avec la recherche pré-remplie. */
const ELSEWHERE: [string, (q: string) => string][] = [
    [
        'Mutopia',
        (q) =>
            `https://www.mutopiaproject.org/cgibin/make-table.cgi?Instrument=Piano&searchingfor=${encodeURIComponent(q)}`,
    ],
    [
        'IMSLP',
        (q) =>
            `https://imslp.org/index.php?title=Special:Search&search=${encodeURIComponent(q)}`,
    ],
    [
        'MuseScore',
        (q) =>
            `https://musescore.com/sheetmusic?text=${encodeURIComponent(`${q} piano`)}&license=to_share%2Cto_modify_commercially`,
    ],
];

const SORT_LABELS: Record<Sort, string> = {
    relevance: 'Pertinence',
    popular: 'Popularité',
    easy: 'Plus faciles d’abord',
    title: 'Titre',
};

/** Résultats chargés à la fois. */
const PAGE = 30;

const plural = (n: number, word: string) =>
    `${n.toLocaleString('fr-FR')} ${word}${n > 1 ? 's' : ''}`;

/** Logo : la main et ses cinq doigts numérotés. */
const Hand = () => (
    <Group gap={3} align="flex-end" pb={9} wrap="nowrap" aria-hidden>
        {[26, 38, 44, 39, 30].map((height, i) => (
            <Box
                key={height}
                // Plus petite sur téléphone : le logo tient sur une ligne.
                w={{ base: 16, xs: 20 }}
                h={{ base: Math.round(height * 0.8), xs: height }}
                pt={{ base: 3, xs: 5 }}
                ta="center"
                c="white"
                fz={{ base: 10, xs: 12 }}
                fw={700}
                lh={1}
                style={{
                    borderRadius: '10px 10px 4px 4px',
                    background: 'var(--pouce-rh)',
                    fontFamily: "'Bricolage Grotesque', sans-serif",
                }}
            >
                {i + 1}
            </Box>
        ))}
    </Group>
);

/** À propos et thème, dans un seul menu (l'en-tête tient sur un téléphone). */
const MoreMenu = ({ onAbout }: { onAbout: () => void }) => {
    const { colorScheme, setColorScheme } = useAppearance();
    return (
        <Menu position="bottom-end">
            <Menu.Target>
                <ActionIcon variant="default" size={44} aria-label="Menu">
                    <IconDots size={20} />
                </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
                <Menu.Item
                    leftSection={<IconInfoCircle size={16} />}
                    onClick={onAbout}
                >
                    À propos de Pouce
                </Menu.Item>
                <Menu.Divider />
                <Menu.Label>Thème</Menu.Label>
                {COLOR_SCHEME_OPTIONS.map((option) => (
                    <Menu.Item
                        key={option.value}
                        leftSection={<IconSunMoon size={16} />}
                        onClick={() => setColorScheme(option.value)}
                        fw={colorScheme === option.value ? 700 : undefined}
                    >
                        {option.label}
                    </Menu.Item>
                ))}
            </Menu.Dropdown>
        </Menu>
    );
};

interface Item {
    source: PieceSource;
    id: string;
    title: string;
    composer: string;
    arranger?: string;
    /** Morceau et nombre de versions (bibliothèque). */
    group?: string;
    versions?: number;
    level?: Level | null;
    duration?: number | null;
    /** Précision en fin de ligne (« Importée » dans les favoris). */
    label?: string;
}

/** MusicXML d'une partition de la liste (la copie gardée, hors ligne). */
const loadXml = async (item: Item) => {
    if (item.source === 'import') {
        const piece = await getImport(item.id);
        if (!piece) throw new Error('Partition introuvable sur cet appareil.');
        return piece.xml;
    }
    try {
        return (await fetchScore(item.id)).xml;
    } catch (err) {
        const kept = await getLibraryPiece(item.id);
        if (kept) return kept.xml;
        throw err;
    }
};

interface Preview {
    /** Partition qui joue, ou qui se charge (`pieceKey`). */
    playing: string | null;
    loading: string | null;
    toggle: (item: Item) => void;
}

const PreviewContext = createContext<Preview | null>(null);

/** Écoute depuis la liste : une partition à la fois, du début. */
const usePreview = (): Preview => {
    const player = useMemo(() => new Player(), []);
    const [playing, setPlaying] = useState<string | null>(null);
    const [loading, setLoading] = useState<string | null>(null);
    /** Dernière demande : un clic plus récent annule les précédentes. */
    const request = useRef(0);
    useEffect(() => () => player.stop(), [player]);

    const toggle = async (item: Item) => {
        const key = pieceKey(item.source, item.id);
        const ticket = ++request.current;
        player.stop();
        if (playing === key || loading === key) {
            setPlaying(null);
            setLoading(null);
            return;
        }
        player.unlock();
        setPlaying(null);
        setLoading(key);
        try {
            const [xml, settings] = await Promise.all([
                loadXml(item),
                getSettings(key),
            ]);
            if (ticket !== request.current) return;
            const index = indexScore(parseXml(xml));
            const notes = playNotes(index.notes, {
                factor: settings.tempo ? settings.tempo / index.tempo : 1,
            });
            // Chargement des sons de piano, puis lecture.
            await player.play(notes, {
                onEnd: () => {
                    if (ticket === request.current) setPlaying(null);
                },
            });
            if (ticket !== request.current) return;
            setLoading(null);
            setPlaying(key);
        } catch (err) {
            if (ticket !== request.current) return;
            setLoading(null);
            notifications.show({
                color: 'red',
                message: (err as Error).message || 'Écoute impossible.',
            });
        }
    };
    return { playing, loading, toggle };
};

const PreviewButton = ({ item }: { item: Item }) => {
    const preview = useContext(PreviewContext);
    if (!preview) return null;
    const key = pieceKey(item.source, item.id);
    const playing = preview.playing === key;
    return (
        <ActionIcon
            variant={playing ? 'filled' : 'light'}
            radius="xl"
            size={38}
            style={{ flexShrink: 0 }}
            loading={preview.loading === key}
            aria-label={
                playing
                    ? `Arrêter « ${item.title} »`
                    : `Écouter « ${item.title} »`
            }
            onClick={() => preview.toggle(item)}
        >
            {playing ? (
                <IconPlayerStopFilled size={16} />
            ) : (
                <IconPlayerPlayFilled size={16} />
            )}
        </ActionIcon>
    );
};

interface Favorites {
    /** `pieceKey` des favoris. */
    keys: Set<string>;
    toggle: (item: Item) => void;
}

const FavoritesContext = createContext<Favorites | null>(null);

const FavoriteButton = ({ item }: { item: Item }) => {
    const favorites = useContext(FavoritesContext);
    if (!favorites) return null;
    const on = favorites.keys.has(pieceKey(item.source, item.id));
    return (
        <ActionIcon
            variant="subtle"
            color={on ? 'yellow' : 'gray'}
            size={44}
            style={{ flexShrink: 0 }}
            aria-pressed={on}
            aria-label={
                on
                    ? `Retirer « ${item.title} » des favoris`
                    : `Ajouter « ${item.title} » aux favoris`
            }
            onClick={() => favorites.toggle(item)}
        >
            {on ? <IconStarFilled size={20} /> : <IconStar size={20} />}
        </ActionIcon>
    );
};

/** Niveau, en couleur, en tête de la ligne de détails. */
const LevelText = ({ level }: { level: Level }) => (
    <>
        <Text
            span
            inherit
            fw={600}
            style={{
                color: `var(--mantine-color-${LEVEL_COLORS[level]}-text)`,
            }}
        >
            {level}
        </Text>
        {' · '}
    </>
);

const PieceRow = ({
    item,
    count,
    onRemove,
    search,
    nested = false,
}: {
    item: Item;
    count: number;
    onRemove?: (item: Item) => void;
    /** Recherche en cours, pour lister les versions du morceau. */
    search?: CatalogQuery;
    /** Ligne d'une version, sous son morceau. */
    nested?: boolean;
}) => {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const versions = item.versions ?? 1;
    const details = [
        nested
            ? item.arranger || item.composer || 'Auteur inconnu'
            : item.composer || 'Compositeur inconnu',
        item.duration ? formatDuration(item.duration) : null,
        versions > 1 ? `${versions} versions` : null,
        count > 0 ? plural(count, 'doigté') : null,
        item.label,
    ].filter(Boolean);
    return (
        <Box
            component="li"
            style={{
                borderBottom: nested
                    ? undefined
                    : '1px solid var(--mantine-color-default-border)',
            }}
        >
            <Group gap={4} wrap="nowrap" pl={nested ? 12 : 0}>
                <PreviewButton item={item} />
                <UnstyledButton
                    flex={1}
                    py={nested ? 8 : 'sm'}
                    pl={6}
                    pr={4}
                    miw={0}
                    onClick={() =>
                        navigate(`/partition/${item.source}/${item.id}`)
                    }
                >
                    <Text fw={700} fz={nested ? 'md' : 'lg'} truncate>
                        {item.title}
                    </Text>
                    <Text c="dimmed" fz="sm" truncate>
                        {item.level && <LevelText level={item.level} />}
                        {details.join(' · ')}
                    </Text>
                </UnstyledButton>
                <FavoriteButton item={item} />
                {versions > 1 && item.group && search && (
                    <ActionIcon
                        variant="subtle"
                        color="gray"
                        size={44}
                        aria-expanded={open}
                        aria-label={
                            open
                                ? 'Masquer les versions'
                                : `Voir les ${versions} versions`
                        }
                        onClick={() => setOpen((v) => !v)}
                    >
                        {open ? (
                            <IconChevronUp size={18} />
                        ) : (
                            <IconChevronDown size={18} />
                        )}
                    </ActionIcon>
                )}
                {onRemove && (
                    <Menu position="bottom-end">
                        <Menu.Target>
                            <ActionIcon
                                variant="subtle"
                                color="gray"
                                size={44}
                                aria-label={`Actions pour ${item.title}`}
                            >
                                <IconDots size={18} />
                            </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                            <Menu.Item
                                color="red"
                                leftSection={<IconTrash size={16} />}
                                onClick={() => onRemove(item)}
                            >
                                Supprimer de cet appareil
                            </Menu.Item>
                        </Menu.Dropdown>
                    </Menu>
                )}
            </Group>
            {open && item.group && search && (
                <Versions group={item.group} search={search} />
            )}
        </Box>
    );
};

/** Les versions d'un morceau, de la plus facile à la plus difficile. */
const Versions = ({
    group,
    search,
}: {
    group: string;
    search: CatalogQuery;
}) => {
    const versions = useQuery(
        () => fetchCatalog({ ...search, group, sort: 'easy', limit: 100 }),
        [group],
    );
    const counts = useQuery(countAnnotations, []);
    if (versions.error) {
        return (
            <Text c="red" fz="sm" pl={18} pb="sm">
                {versions.error.message}
            </Text>
        );
    }
    if (!versions.data) {
        return (
            <Group pl={18} pb="sm">
                <Loader size="xs" />
            </Group>
        );
    }
    return (
        <Box
            component="ul"
            m={0}
            mb={8}
            ml={12}
            p={0}
            aria-label="Versions"
            style={{
                listStyle: 'none',
                borderLeft: '3px solid var(--mantine-color-default-border)',
            }}
        >
            {versions.data.items.map((e) => (
                <PieceRow
                    key={e.id}
                    item={{ ...toItem(e), versions: 1 }}
                    count={counts.data?.get(pieceKey('catalogue', e.id)) ?? 0}
                    nested
                />
            ))}
        </Box>
    );
};

const List = ({ children }: { children: React.ReactNode }) => (
    <Box
        component="ul"
        m={0}
        p={0}
        style={{
            listStyle: 'none',
        }}
    >
        {children}
    </Box>
);

/** Onglets de l'accueil (`vue` dans l'adresse). */
const VIEWS = ['bibliotheque', 'favoris', 'imports'] as const;
type View = (typeof VIEWS)[number];

const count = (n: number) => n.toLocaleString('fr-FR');

/** Menu de filtre, mis en valeur quand il filtre. */
const Filter = ({
    label,
    value,
    active,
    data,
    onChange,
}: {
    label: string;
    value: string;
    active: boolean;
    data: { value: string; label: string }[];
    onChange: (value: string) => void;
}) => (
    <NativeSelect
        size="sm"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        data={data}
        flex="1 1 0"
        miw={0}
        maw={220}
        styles={{
            input: active
                ? {
                      borderColor: 'var(--mantine-primary-color-filled)',
                      fontWeight: 600,
                  }
                : undefined,
        }}
    />
);

/** Liens vers d'autres bibliothèques, et l'import. */
const Elsewhere = ({
    query,
    onImport,
    importing,
}: {
    query: string;
    onImport: () => void;
    importing: boolean;
}) => (
    <Paper
        withBorder
        p="lg"
        mt={30}
        radius="lg"
        bg="var(--mantine-color-default)"
    >
        <Stack gap="sm">
            <Title order={2} fz="lg">
                Ta partition n’est pas là ?
            </Title>
            <Text c="dimmed" fz="sm">
                Cherche-la ailleurs, télécharge-la en MusicXML (.mxl, .musicxml
                ou .xml), puis importe-la : elle restera sur cet appareil.
            </Text>
            <Group gap={8}>
                {ELSEWHERE.map(([name, url]) => (
                    <Anchor
                        key={name}
                        href={url(query.trim() || 'piano')}
                        target="_blank"
                        rel="noopener"
                        fw={700}
                        fz="sm"
                        underline="never"
                        px={12}
                        py={5}
                        style={{
                            border: '1px solid var(--mantine-color-default-border)',
                            borderRadius: 999,
                        }}
                    >
                        {name}
                    </Anchor>
                ))}
                <Button
                    variant="light"
                    radius="xl"
                    size="sm"
                    leftSection={<IconUpload size={16} />}
                    loading={importing}
                    onClick={onImport}
                >
                    Importer un fichier
                </Button>
            </Group>
        </Stack>
    </Paper>
);

const toItem = (e: CatalogEntry | CatalogHit): Item => ({
    source: 'catalogue',
    id: e.id,
    title: e.title,
    composer: e.composer,
    arranger: e.arranger,
    level: e.level,
    duration: e.duration,
    ...('group' in e ? { group: e.group, versions: e.versions } : {}),
});

export const SearchPage = () => {
    const navigate = useNavigate();
    // Onglet, recherche, filtres et tri : état local (immédiat), recopié
    // dans l'adresse pour le retour arrière et le partage d'un lien.
    const [params, setParams] = useSearchParams();
    const [view, setView] = useState<View>(
        () => VIEWS.find((v) => v === params.get('vue')) ?? 'bibliotheque',
    );
    const [query, setQuery] = useState(() => params.get('q') ?? '');
    const [level, setLevel] = useState<Level | undefined>(() =>
        LEVELS.find((l) => l === params.get('niveau')),
    );
    const [sort, setSort] = useState<Sort | undefined>(() =>
        SORTS.find((s) => s === params.get('tri')),
    );
    const [genre, setGenre] = useState<Genre | undefined>(() =>
        GENRES.find((g) => g === params.get('genre')),
    );
    useEffect(() => {
        const next = new URLSearchParams();
        if (view !== 'bibliotheque') next.set('vue', view);
        if (query) next.set('q', query);
        if (level) next.set('niveau', level);
        if (genre) next.set('genre', genre);
        if (sort) next.set('tri', sort);
        setParams(next, { replace: true });
        // Seulement quand l'état change.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view, query, level, genre, sort]);

    const [debounced] = useDebouncedValue(query.trim(), 250);
    const search: CatalogQuery = {
        q: debounced,
        level,
        genre,
        sort,
        limit: PAGE,
    };
    const catalog = useQuery(
        () => fetchCatalog(search),
        [debounced, level, genre, sort],
        { cacheKey: `catalog:${debounced}|${level}|${genre}|${sort}` },
    );
    // Pages suivantes, ajoutées par « Afficher plus ».
    const [more, setMore] = useState<CatalogHit[]>([]);
    const [loadingMore, setLoadingMore] = useState(false);
    useEffect(() => {
        setMore([]);
    }, [debounced, level, genre, sort]);

    const imports = useQuery(listImports, []);
    const favorites = useQuery(listFavorites, []);
    const counts = useQuery(countAnnotations, []);
    const [aboutOpen, about] = useDisclosure(false);

    const fileInput = useRef<HTMLInputElement>(null);
    const [importError, setImportError] = useState('');
    const [importing, setImporting] = useState(false);
    const pickFile = () => fileInput.current?.click();

    const onFile = async (file: File | undefined) => {
        setImportError('');
        if (!file) return;
        setImporting(true);
        try {
            const score = await importFile(file, file.name);
            let estimate: ReturnType<typeof estimateDifficulty> | null = null;
            try {
                estimate = estimateDifficulty(indexScore(parseXml(score.xml)));
            } catch (err) {
                console.error(err);
            }
            const saved = await addImport({
                ...score,
                level: estimate?.level ?? null,
                difficulty: estimate?.score ?? null,
            });
            navigate(`/partition/import/${saved.id}`);
        } catch (err) {
            setImportError(
                err instanceof Error && err.message
                    ? err.message
                    : 'Import impossible.',
            );
        } finally {
            setImporting(false);
        }
    };

    const onRemove = async (item: Item) => {
        await deleteImport(item.id);
        imports.reload();
        favorites.reload();
        counts.reload();
        notifications.show({ message: `« ${item.title} » supprimée` });
    };

    const favoriteKeys = new Set((favorites.data ?? []).map((f) => f.piece));
    const toggleFavorite = async (item: Item) => {
        const on = !favoriteKeys.has(pieceKey(item.source, item.id));
        try {
            await setFavorite(item, on);
        } catch (err) {
            notifications.show({
                color: 'red',
                message: (err as Error).message,
            });
        }
        favorites.reload();
        // Copie pour le hors-ligne, si elle n'est pas déjà gardée.
        if (on && item.source === 'catalogue') {
            getLibraryPiece(item.id)
                .then(
                    async (kept) =>
                        kept ?? keepLibraryPiece(await fetchScore(item.id)),
                )
                .catch(() => undefined);
        }
    };

    const loadMore = async () => {
        if (!catalog.data) return;
        setLoadingMore(true);
        try {
            const page = await fetchCatalog({
                ...search,
                offset: catalog.data.items.length + more.length,
            });
            setMore((m) => [...m, ...page.items]);
        } catch (err) {
            notifications.show({
                color: 'red',
                message: (err as Error).message,
            });
        } finally {
            setLoadingMore(false);
        }
    };

    // Favoris (disponibles hors ligne) et imports, filtrés par la recherche.
    const shown = (item: Item) =>
        matches(item, query) &&
        (!level || item.level === level || item.source === 'import');
    const favoriteItems = (favorites.data ?? [])
        .map((f): Item => ({
            source: f.source,
            id: f.id,
            title: f.title,
            composer: f.composer,
            arranger: f.arranger,
            level: f.level,
            duration: f.duration,
            label: f.source === 'import' ? 'Importée' : undefined,
        }))
        .filter(shown);
    const importItems = (imports.data ?? [])
        .map((p): Item => ({
            source: 'import',
            id: p.id,
            title: p.title,
            composer: p.composer,
            level: p.level,
        }))
        .filter(shown);

    const page = catalog.data;
    const shared = page ? [...page.items, ...more].map(toItem) : [];
    const offline = !!catalog.error && !page;
    const preview = usePreview();
    const filtered = !!(query.trim() || level);
    const library = view === 'bibliotheque';

    const rows = (items: Item[], withSearch = false) => (
        <List>
            {items.map((item) => (
                <PieceRow
                    key={`${item.source}/${item.id}`}
                    item={item}
                    search={withSearch ? search : undefined}
                    count={
                        counts.data?.get(pieceKey(item.source, item.id)) ?? 0
                    }
                    onRemove={item.source === 'import' ? onRemove : undefined}
                />
            ))}
        </List>
    );
    const empty = (text: string) => (
        <Text c="dimmed" py="lg" px={4} ta="center">
            {text}
        </Text>
    );

    return (
        <PreviewContext.Provider value={preview}>
            <FavoritesContext.Provider
                value={{ keys: favoriteKeys, toggle: toggleFavorite }}
            >
                <Container size={760} px={18} pb={60}>
                    <Group
                        component="header"
                        pt={24}
                        pb={14}
                        justify="space-between"
                        align="center"
                        wrap="nowrap"
                    >
                        <Box miw={0}>
                            <Group gap={10} align="flex-end" wrap="nowrap">
                                <Title
                                    order={1}
                                    fz="clamp(2rem, 7vw, 2.8rem)"
                                    style={{ letterSpacing: '-0.02em' }}
                                >
                                    Pouce
                                </Title>
                                <Hand />
                            </Group>
                            <Text c="dimmed" fz="sm" mt={4} visibleFrom="xs">
                                Trouve une partition de piano et note tes
                                doigtés sur les notes.
                            </Text>
                        </Box>
                        <Group gap={8} wrap="nowrap">
                            <Button
                                variant="default"
                                h={44}
                                px={12}
                                leftSection={<IconUpload size={18} />}
                                loading={importing}
                                onClick={pickFile}
                                aria-label="Importer un fichier MusicXML"
                            >
                                <Text span inherit visibleFrom="xs">
                                    Importer
                                </Text>
                            </Button>
                            <MoreMenu onAbout={about.open} />
                        </Group>
                    </Group>
                    <input
                        ref={fileInput}
                        type="file"
                        hidden
                        accept=".xml,.musicxml,.mxl,application/vnd.recordare.musicxml+xml,application/vnd.recordare.musicxml"
                        data-testid="import-input"
                        onChange={(e) => {
                            const file = e.currentTarget.files?.[0];
                            e.currentTarget.value = '';
                            void onFile(file);
                        }}
                    />
                    {importError && (
                        <Text c="red" role="alert" mb="sm">
                            {importError}
                        </Text>
                    )}

                    {/* Recherche et filtres : restent en haut au défilement. */}
                    <Box
                        py={10}
                        style={{
                            position: 'sticky',
                            top: 'env(safe-area-inset-top, 0px)',
                            zIndex: 5,
                            background: 'var(--mantine-color-body)',
                        }}
                    >
                        <TextInput
                            type="search"
                            size="lg"
                            placeholder="Titre, compositeur…"
                            aria-label="Rechercher une partition"
                            leftSection={<IconSearch size={20} />}
                            rightSection={
                                catalog.loading && page ? (
                                    <Loader size="xs" />
                                ) : null
                            }
                            value={query}
                            onChange={(e) => setQuery(e.currentTarget.value)}
                            autoComplete="off"
                        />
                        <Group gap={8} mt={10} wrap="nowrap">
                            <Filter
                                label="Niveau"
                                value={level ?? ''}
                                active={!!level}
                                onChange={(v) =>
                                    setLevel(LEVELS.find((l) => l === v))
                                }
                                data={[
                                    { value: '', label: 'Niveau' },
                                    ...LEVELS.map((l) => ({
                                        value: l,
                                        label:
                                            library && page
                                                ? `${l} (${count(page.levels[l])})`
                                                : l,
                                    })),
                                ]}
                            />
                            {library && (
                                <>
                                    <Filter
                                        label="Genre"
                                        value={genre ?? ''}
                                        active={!!genre}
                                        onChange={(v) =>
                                            setGenre(
                                                GENRES.find((g) => g === v),
                                            )
                                        }
                                        data={[
                                            { value: '', label: 'Genre' },
                                            ...GENRES.filter(
                                                (g) =>
                                                    !page ||
                                                    page.genres[g] > 0 ||
                                                    g === genre,
                                            ).map((g) => ({
                                                value: g,
                                                label: page
                                                    ? `${g} (${count(page.genres[g])})`
                                                    : g,
                                            })),
                                        ]}
                                    />
                                    <Filter
                                        label="Trier par"
                                        value={
                                            sort ??
                                            (debounced
                                                ? 'relevance'
                                                : 'popular')
                                        }
                                        active={false}
                                        onChange={(v) =>
                                            setSort(SORTS.find((s) => s === v))
                                        }
                                        data={SORTS.map((s) => ({
                                            value: s,
                                            label: SORT_LABELS[s],
                                        }))}
                                    />
                                </>
                            )}
                        </Group>
                    </Box>

                    <Tabs
                        value={view}
                        onChange={(v) =>
                            setView(
                                VIEWS.find((x) => x === v) ?? 'bibliotheque',
                            )
                        }
                        mt={6}
                        mb={4}
                    >
                        <Tabs.List grow>
                            <Tabs.Tab
                                value="bibliotheque"
                                rightSection={
                                    page && (
                                        <TabCount>{count(page.total)}</TabCount>
                                    )
                                }
                            >
                                Bibliothèque
                            </Tabs.Tab>
                            <Tabs.Tab
                                value="favoris"
                                rightSection={
                                    favoriteItems.length > 0 && (
                                        <TabCount>
                                            {favoriteItems.length}
                                        </TabCount>
                                    )
                                }
                            >
                                Favoris
                            </Tabs.Tab>
                            <Tabs.Tab
                                value="imports"
                                rightSection={
                                    importItems.length > 0 && (
                                        <TabCount>
                                            {importItems.length}
                                        </TabCount>
                                    )
                                }
                            >
                                Imports
                            </Tabs.Tab>
                        </Tabs.List>
                    </Tabs>

                    {view === 'bibliotheque' &&
                        (offline ? (
                            <Text c="dimmed" py="lg" px={4} role="status">
                                La bibliothèque n’est pas joignable (hors ligne
                                ?). Tes favoris et tes imports restent
                                disponibles dans leurs onglets.
                            </Text>
                        ) : !page ? (
                            <Group justify="center" py="xl">
                                <Loader size="sm" />
                            </Group>
                        ) : (
                            <>
                                {shared.length === 0
                                    ? empty(
                                          'Aucun résultat pour cette recherche.',
                                      )
                                    : rows(shared, true)}
                                {shared.length < page.total && (
                                    <Group justify="center" mt="md">
                                        <Button
                                            variant="default"
                                            loading={loadingMore}
                                            onClick={loadMore}
                                        >
                                            Afficher plus
                                        </Button>
                                    </Group>
                                )}
                            </>
                        ))}

                    {view === 'favoris' &&
                        (favoriteItems.length
                            ? rows(favoriteItems)
                            : empty(
                                  filtered && favorites.data?.length
                                      ? 'Aucun favori pour cette recherche.'
                                      : 'Touche l’étoile d’une partition pour la retrouver ici, même hors ligne.',
                              ))}

                    {view === 'imports' &&
                        (importItems.length
                            ? rows(importItems)
                            : empty(
                                  filtered && imports.data?.length
                                      ? 'Aucun import pour cette recherche.'
                                      : 'Tes fichiers MusicXML importés s’afficheront ici. Ils restent sur cet appareil.',
                              ))}

                    {view !== 'favoris' && (
                        <Elsewhere
                            query={query}
                            onImport={pickFile}
                            importing={importing}
                        />
                    )}
                    <AboutModal opened={aboutOpen} onClose={about.close} />
                </Container>
            </FavoritesContext.Provider>
        </PreviewContext.Provider>
    );
};

/** Nombre de résultats d'un onglet. */
const TabCount = ({ children }: { children: React.ReactNode }) => (
    <Text span fz="xs" c="dimmed" fw={500}>
        {children}
    </Text>
);
