import {
    ActionIcon,
    Anchor,
    Badge,
    Box,
    Button,
    Container,
    Group,
    Menu,
    Paper,
    Stack,
    Text,
    TextInput,
    Title,
    UnstyledButton,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
    IconDots,
    IconSearch,
    IconSunMoon,
    IconTrash,
    IconUpload,
} from '@tabler/icons-react';
import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { COLOR_SCHEME_OPTIONS, useAppearance } from '@/components/theme';
import { importFile } from '@/core/importFile';
import { matches } from '@/core/search';
import { fetchCatalog } from '@/services/api';
import { useQuery } from '@/services/useQuery';
import {
    type PieceSource,
    addImport,
    countAnnotations,
    deleteImport,
    listImports,
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

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

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
    label: string;
}

const PieceList = ({
    title,
    items,
    counts,
    searching,
    onDelete,
}: {
    title: string;
    items: Item[];
    counts: Map<string, number> | undefined;
    searching: boolean;
    onDelete?: (item: Item) => void;
}) => {
    const navigate = useNavigate();
    return (
        <Box component="section" mt="lg">
            <Title order={2} fz="md" c="dimmed" mb={8}>
                {title}
            </Title>
            <Box
                component="ul"
                m={0}
                p={0}
                style={{
                    listStyle: 'none',
                    borderTop: '1px solid var(--mantine-color-default-border)',
                }}
            >
                {items.length === 0 && (
                    <Text component="li" c="dimmed" py="sm" px={4}>
                        {searching
                            ? 'Aucun résultat pour cette recherche.'
                            : 'Rien pour l’instant.'}
                    </Text>
                )}
                {items.map((item) => {
                    const n = counts?.get(pieceKey(item.source, item.id)) ?? 0;
                    return (
                        <Group
                            component="li"
                            key={item.id}
                            gap={4}
                            wrap="nowrap"
                            style={{
                                borderBottom:
                                    '1px solid var(--mantine-color-default-border)',
                            }}
                        >
                            <UnstyledButton
                                flex={1}
                                py="sm"
                                px={4}
                                miw={0}
                                onClick={() =>
                                    navigate(
                                        `/partition/${item.source}/${item.id}`,
                                    )
                                }
                            >
                                <Group wrap="nowrap" gap="sm">
                                    <Box flex={1} miw={0}>
                                        <Text fw={700} fz="lg" truncate>
                                            {item.title}
                                        </Text>
                                        <Text c="dimmed" fz="sm" truncate>
                                            {item.composer ||
                                                'Compositeur inconnu'}
                                            {n > 0 &&
                                                ` — ${plural(n, 'doigté')}`}
                                        </Text>
                                    </Box>
                                    <Badge
                                        variant="outline"
                                        color="gray"
                                        tt="none"
                                        fw={400}
                                    >
                                        {item.label}
                                    </Badge>
                                </Group>
                            </UnstyledButton>
                            {onDelete && (
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
                                            leftSection={
                                                <IconTrash size={16} />
                                            }
                                            onClick={() => onDelete(item)}
                                        >
                                            Supprimer de cet appareil
                                        </Menu.Item>
                                    </Menu.Dropdown>
                                </Menu>
                            )}
                        </Group>
                    );
                })}
            </Box>
        </Box>
    );
};

export const SearchPage = () => {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const query = params.get('q') ?? '';
    const setQuery = (q: string) =>
        setParams(q ? { q } : {}, { replace: true });

    const catalog = useQuery(fetchCatalog, [], { cacheKey: 'catalog' });
    const imports = useQuery(listImports, []);
    const counts = useQuery(countAnnotations, []);

    const fileInput = useRef<HTMLInputElement>(null);
    const [importError, setImportError] = useState('');
    const [importing, setImporting] = useState(false);

    const onFile = async (file: File | undefined) => {
        setImportError('');
        if (!file) return;
        setImporting(true);
        try {
            const score = await importFile(file, file.name);
            const saved = await addImport(score);
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

    const onDelete = async (item: Item) => {
        await deleteImport(item.id);
        imports.reload();
        counts.reload();
        notifications.show({ message: `« ${item.title} » supprimée` });
    };

    const mine: Item[] = (imports.data ?? [])
        .filter((p) => matches(p, query))
        .map((p) => ({
            source: 'import',
            id: p.id,
            title: p.title,
            composer: p.composer,
            label: 'Importée',
        }));
    const shared: Item[] = (catalog.data ?? [])
        .filter((p) => matches(p, query))
        .map((p) => ({
            source: 'catalogue',
            id: p.id,
            title: p.title,
            composer: p.composer,
            label: p.level ?? 'Libre',
        }));

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
                <ThemeMenu />
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
                    value={query}
                    onChange={(e) => setQuery(e.currentTarget.value)}
                    autoComplete="off"
                />
            </Box>

            {mine.length > 0 && (
                <PieceList
                    title="Mes partitions importées"
                    items={mine}
                    counts={counts.data}
                    searching={!!query}
                    onDelete={onDelete}
                />
            )}
            {catalog.error && !catalog.data ? (
                <Text c="dimmed" mt="lg">
                    La bibliothèque n’est pas disponible pour l’instant.{' '}
                    {catalog.error.message}
                </Text>
            ) : (
                <PieceList
                    title="Bibliothèque libre de droits"
                    items={shared}
                    counts={counts.data}
                    searching={!!query}
                />
            )}

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
                        importe-la ici.
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
        </Container>
    );
};
