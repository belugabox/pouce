import {
    ActionIcon,
    Box,
    Button,
    Group,
    Text,
    Title,
    UnstyledButton,
} from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
    IconChevronLeft,
    IconDownload,
    IconMinus,
    IconPlus,
} from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';

import { PageLoader } from '@/components/PageLoader';
import { buildExport, slug } from '@/core/exportXml';
import {
    assignFinger,
    clearSuggestions,
    handOf,
    suggestAll,
} from '@/core/fingering/suggest';
import { indexScore, parseXml } from '@/core/musicxml';
import { FingerDock } from '@/editor/FingerDock';
import { ScoreView } from '@/editor/ScoreView';
import { buildOrder, otherHand, step } from '@/editor/navigation';
import type { Positions } from '@/editor/osmd';
import { useAnnotations } from '@/editor/useAnnotations';
import { fetchScore } from '@/services/api';
import { useQuery } from '@/services/useQuery';
import { type PieceSource, getImport, pieceKey } from '@/storage/db';

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 1.6;

const loadPiece = async (source: PieceSource, id: string) => {
    if (source === 'catalogue') return fetchScore(id);
    const piece = await getImport(id);
    if (!piece) throw new Error('Cette partition n’est plus sur cet appareil.');
    return piece;
};

/** Télécharge un texte dans un fichier. */
const download = (text: string, fileName: string) => {
    const url = URL.createObjectURL(
        new Blob([text], { type: 'application/vnd.recordare.musicxml+xml' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const Dot = ({ color }: { color: string }) => (
    <Box
        component="i"
        display="inline-block"
        w={11}
        h={11}
        mr={6}
        style={{ borderRadius: '50%', background: color, verticalAlign: -1 }}
    />
);

const EditorPage = () => {
    const params = useParams();
    const source: PieceSource =
        params.source === 'import' ? 'import' : 'catalogue';
    const id = params.id ?? '';
    const piece = useQuery(() => loadPiece(source, id), [source, id]);
    const xml = piece.data?.xml;
    const index = useMemo(
        () => (xml ? indexScore(parseXml(xml)) : null),
        [xml],
    );
    const { annotations, update } = useAnnotations(pieceKey(source, id), index);

    const [zoom, setZoom] = useLocalStorage({
        key: 'pouce:zoom',
        defaultValue: window.innerWidth < 600 ? 0.7 : 0.9,
        getInitialValueInEffect: false,
    });
    const [positions, setPositions] = useState<Positions>(new Map());
    const [selected, setSelected] = useState<string | null>(null);

    const order = useMemo(
        () => buildOrder(index?.notes ?? [], (key) => positions.has(key)),
        [index, positions],
    );
    const selectedNote = selected ? index?.byKey.get(selected) : undefined;

    useEffect(() => window.scrollTo(0, 0), [source, id]);

    const assign = (finger: number) => {
        if (!selectedNote) return;
        update((a) => assignFinger(a, selectedNote.key, finger));
        // Saisie : on passe à la note suivante de la même main.
        if (finger)
            setSelected(step(order, selectedNote, 1) ?? selectedNote.key);
    };

    const suggest = () => {
        if (!index || !annotations) return;
        const { annotations: next, added } = suggestAll(
            index.notes,
            annotations,
        );
        update(() => next);
        notifications.show({
            message: added
                ? `${plural(added, 'doigté')} suggéré${added > 1 ? 's' : ''} (tempo ♩ = ${Math.round(index.tempo)}, liaisons et silences pris en compte)`
                : 'Toutes les notes ont déjà un doigté.',
        });
    };

    const clearAuto = () => {
        update(clearSuggestions);
        notifications.show({ message: 'Suggestions retirées' });
    };

    const exportScore = () => {
        if (!xml || !annotations || !piece.data) return;
        const { text, count } = buildExport(xml, annotations.f);
        download(text, `${slug(piece.data.title)}-doigtes.musicxml`);
        notifications.show({
            message: `Exporté avec ${plural(count, 'doigté')}`,
        });
    };

    // Raccourcis clavier : 1 à 5, effacer, flèches, Échap.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (
                e.ctrlKey ||
                e.metaKey ||
                e.altKey ||
                target?.closest('input, textarea, [contenteditable="true"]')
            ) {
                return;
            }
            if (/^[1-5]$/.test(e.key)) {
                assign(Number(e.key));
            } else if (['Backspace', 'Delete', '0'].includes(e.key)) {
                assign(0);
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                setSelected(
                    selectedNote
                        ? (step(
                              order,
                              selectedNote,
                              e.key === 'ArrowRight' ? 1 : -1,
                          ) ?? selectedNote.key)
                        : (order[1][0] ?? order[2][0] ?? null),
                );
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                if (!selectedNote) return;
                const key = otherHand(
                    order,
                    selectedNote,
                    (k) => positions.get(k)?.x ?? 0,
                    (k) => index?.byKey.get(k)?.measure ?? 0,
                );
                if (key) setSelected(key);
            } else if (e.key === 'Escape') {
                setSelected(null);
            } else {
                return;
            }
            e.preventDefault();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    if (piece.error) {
        return (
            <Box p="xl" ta="center">
                <Text mb="md">{piece.error.message}</Text>
                <Button component={Link} to="/" variant="default">
                    Retour à la recherche
                </Button>
            </Box>
        );
    }
    if (!piece.data || !index || !annotations) return <PageLoader />;

    const count = Object.keys(annotations.f).length;
    const autoCount = Object.keys(annotations.auto).length;
    const hand = selectedNote
        ? handOf(selectedNote.staff) === 1
            ? 'rh'
            : 'lh'
        : null;
    const hint = selectedNote
        ? `${hand === 'rh' ? 'Main droite' : 'Main gauche'}, mesure ${selectedNote.measure + 1} — choisis un doigt`
        : positions.size
          ? 'Touche une note pour la sélectionner.'
          : '';

    return (
        <Box pb={150}>
            <Box
                pos="sticky"
                top="env(safe-area-inset-top, 0px)"
                bg="var(--mantine-color-body)"
                style={{
                    zIndex: 6,
                    borderBottom:
                        '1px solid var(--mantine-color-default-border)',
                }}
            >
                <Group
                    maw={1100}
                    mx="auto"
                    px={18}
                    py={10}
                    gap={10}
                    wrap="nowrap"
                >
                    <ActionIcon
                        component={Link}
                        to="/"
                        variant="default"
                        size={44}
                        aria-label="Retour à la recherche"
                    >
                        <IconChevronLeft size={22} />
                    </ActionIcon>
                    <Box flex={1} miw={0}>
                        <Title order={2} fz="lg" lineClamp={1}>
                            {piece.data.title}
                        </Title>
                        <Text fz="sm" c="dimmed" truncate>
                            {piece.data.composer}
                        </Text>
                    </Box>
                    <Group gap={6} wrap="nowrap">
                        <ActionIcon
                            variant="default"
                            size={44}
                            aria-label="Dézoomer"
                            disabled={zoom <= ZOOM_MIN}
                            onClick={() =>
                                setZoom((z) =>
                                    Math.max(ZOOM_MIN, +(z - 0.1).toFixed(1)),
                                )
                            }
                        >
                            <IconMinus size={18} />
                        </ActionIcon>
                        <ActionIcon
                            variant="default"
                            size={44}
                            aria-label="Zoomer"
                            disabled={zoom >= ZOOM_MAX}
                            onClick={() =>
                                setZoom((z) =>
                                    Math.min(ZOOM_MAX, +(z + 0.1).toFixed(1)),
                                )
                            }
                        >
                            <IconPlus size={18} />
                        </ActionIcon>
                        <Button
                            variant="default"
                            h={44}
                            px={12}
                            leftSection={<IconDownload size={18} />}
                            onClick={exportScore}
                            aria-label="Exporter en MusicXML"
                        >
                            <Text span visibleFrom="xs" inherit>
                                Exporter
                            </Text>
                        </Button>
                    </Group>
                </Group>
            </Box>

            <Group
                maw={1100}
                mx="auto"
                px={18}
                pt={10}
                pb={4}
                gap="6px 14px"
                c="dimmed"
                fz="sm"
            >
                <span>
                    <Dot color="var(--pouce-rh)" />
                    Main droite (portée du haut)
                </span>
                <span>
                    <Dot color="var(--pouce-lh)" />
                    Main gauche (portée du bas)
                </span>
                {count > 0 && (
                    <span>
                        {plural(count, 'doigté')}
                        {autoCount > 0 &&
                            `, dont ${autoCount} suggéré${autoCount > 1 ? 's' : ''} (en clair)`}
                    </span>
                )}
                <Group gap={8} ml="auto">
                    {autoCount > 0 && (
                        <UnstyledButton
                            c="dimmed"
                            td="underline"
                            py={6}
                            onClick={clearAuto}
                        >
                            Retirer les suggestions
                        </UnstyledButton>
                    )}
                    <Button onClick={suggest}>Suggérer les doigtés</Button>
                </Group>
            </Group>

            <ScoreView
                xml={piece.data.xml}
                notes={index.notes}
                annotations={annotations}
                selected={selected}
                zoom={zoom}
                onSelect={setSelected}
                onLayout={setPositions}
            />

            <FingerDock hand={hand} hint={hint} onPick={assign} />
        </Box>
    );
};

export default EditorPage;
