import {
    ActionIcon,
    Anchor,
    Badge,
    Box,
    Button,
    Chip,
    Container,
    Group,
    Loader,
    Menu,
    NativeSelect,
    Paper,
    ScrollArea,
    Stack,
    Text,
    TextInput,
    Title,
    UnstyledButton,
} from '@mantine/core';
import { useDebouncedValue, useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
    IconDots,
    IconInfoCircle,
    IconSearch,
    IconSunMoon,
    IconTrash,
    IconUpload,
} from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import {
    type CatalogEntry,
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
import { matches } from '@/core/search';
import { LEVEL_COLORS, formatDuration } from '@/editor/format';
import { fetchCatalog } from '@/services/api';
import { useQuery } from '@/services/useQuery';
import {
    type PieceSource,
    addImport,
    countAnnotations,
    deleteImport,
    forgetLibraryPiece,
    listImports,
    listLibrary,
    pieceKey,
} from '@/storage/db';

/** Bibliothèques libres, avec la recherche pré-remplie. */
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
/** Partitions de l'appareil montrées avant « Tout afficher ». */
const MINE = 5;

const plural = (n: number, word: string) =>
    `${n.toLocaleString('fr-FR')} ${word}${n > 1 ? 's' : ''}`;

/** Logo : la main et ses cinq doigts numérotés. */
const Hand = () => (
    <Group gap={3} align="flex-end" pb={9} aria-hidden>
        {[26, 38, 44, 39, 30].map((height, i) => (
            <Box
                key={height}
                w={20}
                h={height}
                pt={5}
                ta="center"
                c="white"
                fz={12}
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

const ThemeMenu = () => {
    const { colorScheme, setColorScheme } = useAppearance();
    return (
        <Menu position="bottom-end">
            <Menu.Target>
                <ActionIcon
                    variant="default"
                    size={44}
                    aria-label="Thème de l’affichage"
                >
                    <IconSunMoon size={20} />
                </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
                <Menu.Label>Thème</Menu.Label>
                {COLOR_SCHEME_OPTIONS.map((option) => (
                    <Menu.Item
                        key={option.value}
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
    level?: Level | null;
    duration?: number | null;
    /** Badge quand il n'y a pas de niveau (« Importée »). */
    label?: string;
}

const LevelBadge = ({ item }: { item: Item }) =>
    item.level ? (
        <Badge
            variant="light"
            color={LEVEL_COLORS[item.level]}
            tt="none"
            fw={600}
            style={{ flexShrink: 0 }}
        >
            {item.level}
        </Badge>
    ) : item.label ? (
        <Badge
            variant="outline"
            color="gray"
            tt="none"
            fw={400}
            style={{ flexShrink: 0 }}
        >
            {item.label}
        </Badge>
    ) : null;

const PieceRow = ({
    item,
    count,
    onRemove,
}: {
    item: Item;
    count: number;
    onRemove?: (item: Item) => void;
}) => {
    const navigate = useNavigate();
    const details = [
        item.composer || 'Compositeur inconnu',
        item.duration ? formatDuration(item.duration) : null,
        count > 0 ? plural(count, 'doigté') : null,
    ].filter(Boolean);
    return (
        <Group
            component="li"
            gap={4}
            wrap="nowrap"
            style={{
                borderBottom: '1px solid var(--mantine-color-default-border)',
            }}
        >
            <UnstyledButton
                flex={1}
                py="sm"
                px={4}
                miw={0}
                onClick={() => navigate(`/partition/${item.source}/${item.id}`)}
            >
                <Group wrap="nowrap" gap="sm">
                    <Box flex={1} miw={0}>
                        <Text fw={700} fz="lg" truncate>
                            {item.title}
                        </Text>
                        <Text c="dimmed" fz="sm" truncate>
                            {details.join(' · ')}
                        </Text>
                    </Box>
                    <LevelBadge item={item} />
                </Group>
            </UnstyledButton>
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
                            {item.source === 'import'
                                ? 'Supprimer de cet appareil'
                                : 'Retirer de cet appareil'}
                        </Menu.Item>
                    </Menu.Dropdown>
                </Menu>
            )}
        </Group>
    );
};

const List = ({ children }: { children: React.ReactNode }) => (
    <Box
        component="ul"
        m={0}
        p={0}
        style={{
            listStyle: 'none',
            borderTop: '1px solid var(--mantine-color-default-border)',
        }}
    >
        {children}
    </Box>
);

const toItem = (e: CatalogEntry): Item => ({
    source: 'catalogue',
    id: e.id,
    title: e.title,
    composer: e.composer,
    level: e.level,
    duration: e.duration,
    label: 'Libre',
});

export const SearchPage = () => {
    const navigate = useNavigate();
    // Recherche, niveau et tri : état local (immédiat), recopié dans
    // l'adresse pour le retour arrière et le partage d'un lien.
    const [params, setParams] = useSearchParams();
    const [query, setQuery] = useState(() => params.get('q') ?? '');
    const [level, setLevel] = useState<Level | undefined>(() =>
        LEVELS.find((l) => l === params.get('niveau')),
    );
    const [sort, setSort] = useState<Sort | undefined>(() =>
        SORTS.find((s) => s === params.get('tri')),
    );
    useEffect(() => {
        const next = new URLSearchParams();
        if (query) next.set('q', query);
        if (level) next.set('niveau', level);
        if (sort) next.set('tri', sort);
        setParams(next, { replace: true });
        // Seulement quand l'état change.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, level, sort]);

    const [debounced] = useDebouncedValue(query.trim(), 250);
    const search = { q: debounced, level, sort, limit: PAGE };
    const catalog = useQuery(
        () => fetchCatalog(search),
        [debounced, level, sort],
        { cacheKey: `catalog:${debounced}|${level}|${sort}` },
    );
    // Pages suivantes, ajoutées par « Afficher plus ».
    const [more, setMore] = useState<CatalogEntry[]>([]);
    const [loadingMore, setLoadingMore] = useState(false);
    useEffect(() => setMore([]), [debounced, level, sort]);

    const imports = useQuery(listImports, []);
    const library = useQuery(listLibrary, []);
    const counts = useQuery(countAnnotations, []);
    const [showAllMine, setShowAllMine] = useState(false);
    const [aboutOpen, about] = useDisclosure(false);

    const fileInput = useRef<HTMLInputElement>(null);
    const [importError, setImportError] = useState('');
    const [importing, setImporting] = useState(false);

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
        if (item.source === 'import') await deleteImport(item.id);
        else await forgetLibraryPiece(item.id);
        imports.reload();
        library.reload();
        counts.reload();
        notifications.show({ message: `« ${item.title} » retirée` });
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

    // Sur cet appareil : imports et partitions du catalogue déjà ouvertes
    // (celles-ci restent disponibles hors ligne).
    const mine: Item[] = [
        ...(imports.data ?? []).map((p): Item => ({
            source: 'import',
            id: p.id,
            title: p.title,
            composer: p.composer,
            level: p.level,
            label: 'Importée',
        })),
        ...(library.data ?? []).map((p): Item => ({
            ...toItem(p),
            label: undefined,
        })),
    ].filter(
        (p) =>
            matches(p, query) &&
            (!level || p.level === level || p.source === 'import'),
    );
    const shownMine = showAllMine ? mine : mine.slice(0, MINE);

    const page = catalog.data;
    const shared = page ? [...page.items, ...more].map(toItem) : [];
    const offline = !!catalog.error && !page;

    return (
        <Container size={760} px={18} pb={60}>
            <Group
                component="header"
                pt={34}
                pb={18}
                justify="space-between"
                align="flex-start"
                wrap="nowrap"
            >
                <Box>
                    <Group gap={14} align="flex-end">
                        <Title
                            order={1}
                            fz="clamp(2.4rem, 9vw, 3.6rem)"
                            style={{ letterSpacing: '-0.02em' }}
                        >
                            Pouce
                        </Title>
                        <Hand />
                    </Group>
                    <Text c="dimmed" maw="52ch" mt={10}>
                        Trouve une partition de piano libre de droits, puis note
                        tes doigtés directement sur les notes.
                    </Text>
                </Box>
                <Group gap={8} wrap="nowrap">
                    <ActionIcon
                        variant="default"
                        size={44}
                        aria-label="À propos de Pouce"
                        onClick={about.open}
                    >
                        <IconInfoCircle size={20} />
                    </ActionIcon>
                    <ThemeMenu />
                </Group>
            </Group>

            <Box
                py={12}
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
                        catalog.loading && page ? <Loader size="xs" /> : null
                    }
                    value={query}
                    onChange={(e) => setQuery(e.currentTarget.value)}
                    autoComplete="off"
                />
                <ScrollArea type="never" mt={10} aria-label="Niveau">
                    <Chip.Group
                        value={level ?? 'tous'}
                        onChange={(v) => setLevel(LEVELS.find((l) => l === v))}
                    >
                        <Group gap={6} wrap="nowrap">
                            <Chip value="tous" size="sm" variant="light">
                                Tous
                            </Chip>
                            {LEVELS.map((l) => (
                                <Chip
                                    key={l}
                                    value={l}
                                    size="sm"
                                    variant="light"
                                    color={LEVEL_COLORS[l]}
                                >
                                    {l}
                                    {page ? ` ${page.levels[l]}` : ''}
                                </Chip>
                            ))}
                        </Group>
                    </Chip.Group>
                </ScrollArea>
            </Box>

            {mine.length > 0 && (
                <Box component="section" mt="lg">
                    <Title order={2} fz="md" c="dimmed" mb={8}>
                        Sur cet appareil
                    </Title>
                    <List>
                        {shownMine.map((item) => (
                            <PieceRow
                                key={`${item.source}/${item.id}`}
                                item={item}
                                count={
                                    counts.data?.get(
                                        pieceKey(item.source, item.id),
                                    ) ?? 0
                                }
                                onRemove={onRemove}
                            />
                        ))}
                    </List>
                    {mine.length > MINE && (
                        <Button
                            variant="subtle"
                            mt={6}
                            onClick={() => setShowAllMine((v) => !v)}
                        >
                            {showAllMine
                                ? 'Afficher moins'
                                : `Tout afficher (${mine.length})`}
                        </Button>
                    )}
                </Box>
            )}

            <Box component="section" mt="lg">
                <Group justify="space-between" mb={8} gap={8}>
                    <Title order={2} fz="md" c="dimmed">
                        Bibliothèque libre de droits
                    </Title>
                    <Group gap={10} wrap="nowrap">
                        {page && (
                            <Text
                                fz="sm"
                                c="dimmed"
                                style={{ whiteSpace: 'nowrap' }}
                            >
                                {plural(page.total, 'partition')}
                            </Text>
                        )}
                        <NativeSelect
                            size="xs"
                            aria-label="Trier par"
                            value={
                                sort ?? (debounced ? 'relevance' : 'popular')
                            }
                            onChange={(e) =>
                                setSort(
                                    SORTS.find(
                                        (s) => s === e.currentTarget.value,
                                    ),
                                )
                            }
                            data={SORTS.map((s) => ({
                                value: s,
                                label: SORT_LABELS[s],
                            }))}
                            w={170}
                            style={{ flexShrink: 0 }}
                        />
                    </Group>
                </Group>
                {offline ? (
                    <Text c="dimmed" py="sm" role="status">
                        La bibliothèque n’est pas joignable (hors ligne ?). Les
                        partitions déjà ouvertes restent disponibles ci-dessus.
                    </Text>
                ) : !page ? (
                    <Group justify="center" py="xl">
                        <Loader size="sm" />
                    </Group>
                ) : (
                    <>
                        <List>
                            {shared.length === 0 && (
                                <Text component="li" c="dimmed" py="sm" px={4}>
                                    Aucun résultat pour cette recherche.
                                </Text>
                            )}
                            {shared.map((item) => (
                                <PieceRow
                                    key={item.id}
                                    item={item}
                                    count={
                                        counts.data?.get(
                                            pieceKey('catalogue', item.id),
                                        ) ?? 0
                                    }
                                />
                            ))}
                        </List>
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
                )}
            </Box>

            <Paper
                withBorder
                p="lg"
                mt={30}
                radius="lg"
                bg="var(--mantine-color-default)"
            >
                <Stack gap="sm">
                    <Title order={2} fz="xl">
                        Ta partition n’est pas là ?
                    </Title>
                    <Text c="dimmed">
                        Cherche-la sur une bibliothèque libre, télécharge-la au
                        format MusicXML (.mxl, .musicxml ou .xml), puis
                        importe-la ici. Elle restera sur cet appareil.
                    </Text>
                    <Group gap={8}>
                        {ELSEWHERE.map(([name, url]) => (
                            <Anchor
                                key={name}
                                href={url(query.trim() || 'piano')}
                                target="_blank"
                                rel="noopener"
                                fw={700}
                                underline="never"
                                px={14}
                                py={7}
                                style={{
                                    border: '1px solid var(--mantine-color-default-border)',
                                    borderRadius: 999,
                                }}
                            >
                                {name}
                            </Anchor>
                        ))}
                    </Group>
                    <Box>
                        <Button
                            size="md"
                            leftSection={<IconUpload size={18} />}
                            loading={importing}
                            onClick={() => fileInput.current?.click()}
                        >
                            Importer un fichier MusicXML
                        </Button>
                    </Box>
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
                        <Text c="red" role="alert">
                            {importError}
                        </Text>
                    )}
                </Stack>
            </Paper>

            <Group justify="center" mt="xl">
                <Anchor
                    component="button"
                    c="dimmed"
                    fz="sm"
                    onClick={about.open}
                >
                    À propos de Pouce et des partitions
                </Anchor>
            </Group>
            <AboutModal opened={aboutOpen} onClose={about.close} />
        </Container>
    );
};
