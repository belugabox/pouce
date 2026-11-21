import {
    ActionIcon,
    Box,
    Button,
    Divider,
    Group,
    Menu,
    Text,
    Title,
    Tooltip,
    UnstyledButton,
} from '@mantine/core';
import { useDisclosure, useLocalStorage } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
    IconAdjustmentsHorizontal,
    IconArrowBackUp,
    IconArrowForwardUp,
    IconChevronLeft,
    IconDots,
    IconDownload,
    IconInfoCircle,
    IconMinus,
    IconPlayerPlay,
    IconPlayerStop,
    IconPlus,
    IconPrinter,
    IconStar,
    IconStarFilled,
} from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';

import { PageLoader } from '@/components/PageLoader';
import { buildExport, slug } from '@/core/exportXml';
import { handResolver, listStaves } from '@/core/fingering/hands';
import {
    assignFinger,
    clearSuggestions,
    suggestAll,
} from '@/core/fingering/suggest';
import { indexScore, parseXml, readPartNames } from '@/core/musicxml';
import { playNotes } from '@/core/playback';
import { FingerDock } from '@/editor/FingerDock';
import { PieceInfo, type PieceMeta } from '@/editor/PieceInfo';
import { ScoreView } from '@/editor/ScoreView';
import { SuggestSettings } from '@/editor/SuggestSettings';
import { buildOrder, handIn, otherHand, step } from '@/editor/navigation';
import type { Positions } from '@/editor/osmd';
import { Player } from '@/editor/player';
import { useAnnotations, usePieceSettings } from '@/editor/useAnnotations';
import { fetchScore } from '@/services/api';
import { useQuery } from '@/services/useQuery';
import {
    type PieceSource,
    getImport,
    getLibraryPiece,
    isFavorite,
    keepLibraryPiece,
    pieceKey,
    setFavorite,
} from '@/storage/db';

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 1.6;

type LoadedPiece = PieceMeta & { xml: string; offline?: boolean };

/**
 * Partition du catalogue : depuis le serveur, gardée sur l'appareil pour la
 * rouvrir hors ligne ; sinon la copie gardée. Import : depuis l'appareil.
 */
const loadPiece = async (
    source: PieceSource,
    id: string,
): Promise<LoadedPiece> => {
    if (source === 'catalogue') {
        try {
            const piece = await fetchScore(id);
            keepLibraryPiece(piece).catch((err: unknown) => console.error(err));
            return piece;
        } catch (err) {
            const kept = await getLibraryPiece(id).catch(() => undefined);
            if (kept) return { ...kept, offline: true };
            throw err;
        }
    }
    const piece = await getImport(id);
    if (!piece) throw new Error('Cette partition n’est plus sur cet appareil.');
    return { ...piece, level: piece.level ?? null };
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

const ToolIcon = ({
    label,
    children,
    ...props
}: {
    label: string;
    children: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
}) => (
    <Tooltip label={label} openDelay={500}>
        <ActionIcon variant="default" size={40} aria-label={label} {...props}>
            {children}
        </ActionIcon>
    </Tooltip>
);

const EditorPage = () => {
    const params = useParams();
    const source: PieceSource =
        params.source === 'import' ? 'import' : 'catalogue';
    const id = params.id ?? '';
    const key = pieceKey(source, id);
    const piece = useQuery(() => loadPiece(source, id), [source, id]);
    const xml = piece.data?.xml;
    const parsed = useMemo(() => {
        if (!xml) return null;
        const doc = parseXml(xml);
        return { index: indexScore(doc), partNames: readPartNames(doc) };
    }, [xml]);
    const index = parsed?.index ?? null;
    const { annotations, update, undo, redo, canUndo, canRedo } =
        useAnnotations(key, index);
    const [settings, setSettings] = usePieceSettings(key);
    const [settingsOpen, settingsModal] = useDisclosure(false);
    const [infoOpen, infoModal] = useDisclosure(false);

    const [zoom, setZoom] = useLocalStorage({
        key: 'pouce:zoom',
        defaultValue: window.innerWidth < 600 ? 0.7 : 0.9,
        getInitialValueInEffect: false,
    });
    const [positions, setPositions] = useState<Positions>(new Map());
    const [selected, setSelected] = useState<string | null>(null);

    const staves = useMemo(() => listStaves(index?.notes ?? []), [index]);
    const handOf = useMemo(
        () => handResolver(index?.notes ?? [], settings.hands),
        [index, settings.hands],
    );
    const order = useMemo(
        () => buildOrder(index?.notes ?? [], (k) => positions.has(k), handOf),
        [index, positions, handOf],
    );
    const selectedNote = selected ? index?.byKey.get(selected) : undefined;
    const selectedHand = selected ? handIn(order, selected) : null;

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [source, id]);
    useEffect(() => {
        if (piece.data?.title) document.title = `${piece.data.title} — Pouce`;
        return () => {
            document.title = 'Pouce';
        };
    }, [piece.data?.title]);

    /** Sélection au toucher : seulement les notes d'une portée jouée. */
    const select = (k: string | null) =>
        setSelected(k && handIn(order, k) ? k : null);

    const assign = (finger: number) => {
        if (!selectedNote || !selectedHand) return;
        update((a) => assignFinger(a, selectedNote.key, finger));
        // Saisie : on passe à la note suivante de la même main.
        if (finger)
            setSelected(step(order, selectedNote, 1) ?? selectedNote.key);
    };

    const tempo = settings.tempo ?? index?.tempo ?? 100;

    const favorite = useQuery(() => isFavorite(key), [key]);
    const toggleFavorite = async () => {
        if (!piece.data) return;
        const on = !favorite.data;
        try {
            await setFavorite({ ...piece.data, source, id }, on);
            notifications.show({
                message: on ? 'Ajoutée aux favoris' : 'Retirée des favoris',
            });
        } catch (err) {
            notifications.show({
                color: 'red',
                message: (err as Error).message,
            });
        }
        favorite.reload();
    };

    // Écoute : depuis la note sélectionnée, au tempo de la suggestion ; la
    // sélection suit la main droite.
    const player = useMemo(() => new Player(), []);
    const [playing, setPlaying] = useState(false);
    useEffect(() => {
        setPlaying(false);
        return () => player.stop();
    }, [player, source, id]);
    const togglePlay = () => {
        if (!index) return;
        // L'état de l'écran, pas celui du lecteur : il peut encore charger
        // ses sons.
        if (playing) {
            player.stop();
            setPlaying(false);
            return;
        }
        const notes = playNotes(index.notes, {
            from: selectedNote?.t ?? 0,
            factor: tempo / index.tempo,
        });
        const rightHand = order[1].length > 0;
        setPlaying(true);
        void player.play(notes, {
            onNote: (n) => {
                const h = handIn(order, n.key);
                if (h === 1 || (h && !rightHand)) setSelected(n.key);
            },
            onEnd: () => setPlaying(false),
        });
    };

    const suggest = () => {
        if (!index || !annotations) return;
        const { annotations: next, added } = suggestAll(
            index.notes,
            annotations,
            {
                hands: settings.hands,
                tempo: settings.tempo,
                scoreTempo: index.tempo,
            },
        );
        if (added) update(() => next);
        notifications.show({
            message: added
                ? `${plural(added, 'doigté')} suggéré${added > 1 ? 's' : ''} (tempo ♩ = ${Math.round(tempo)}, liaisons et silences pris en compte)`
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

    const zoomBy = (delta: number) =>
        setZoom((z) =>
            Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +(z + delta).toFixed(1))),
        );

    // Raccourcis clavier : 1 à 5, effacer, flèches, Échap, annuler.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (
                target?.closest(
                    'input, textarea, select, [contenteditable="true"], [role="dialog"]',
                )
            ) {
                return;
            }
            if ((e.ctrlKey || e.metaKey) && !e.altKey) {
                const k = e.key.toLowerCase();
                if (k === 'z' && !e.shiftKey) undo();
                else if ((k === 'z' && e.shiftKey) || k === 'y') redo();
                else return;
                e.preventDefault();
                return;
            }
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (e.key === ' ') {
                // Un bouton qui a le focus réagit déjà à la barre d'espace.
                if (target?.closest('button')) return;
                togglePlay();
            } else if (/^[1-5]$/.test(e.key)) {
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
                const k = otherHand(
                    order,
                    selectedNote,
                    (n) => positions.get(n)?.x ?? 0,
                    (n) => index?.byKey.get(n)?.measure ?? 0,
                );
                if (k) setSelected(k);
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
    if (!piece.data || !index || !annotations || !parsed) {
        return <PageLoader />;
    }

    const count = Object.keys(annotations.f).length;
    const autoCount = Object.keys(annotations.auto).length;
    const hand = selectedHand === 1 ? 'rh' : selectedHand === 2 ? 'lh' : null;
    const hint = selectedNote
        ? `${hand === 'rh' ? 'Main droite' : 'Main gauche'}, mesure ${selectedNote.measure + 1} — choisis un doigt`
        : positions.size
          ? 'Touche une note pour la sélectionner.'
          : '';

    return (
        <Box pb={150}>
            <Box
                className="no-print"
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
                    <UnstyledButton
                        flex={1}
                        miw={0}
                        onClick={infoModal.open}
                        aria-label="Fiche de la partition"
                    >
                        <Title order={2} fz="lg" lineClamp={1}>
                            {piece.data.title}
                        </Title>
                        <Text fz="sm" c="dimmed" truncate>
                            {piece.data.composer}
                            {piece.data.offline && ' — copie sur l’appareil'}
                        </Text>
                    </UnstyledButton>
                    <ActionIcon
                        variant="default"
                        size={44}
                        color={favorite.data ? 'yellow' : undefined}
                        aria-pressed={!!favorite.data}
                        aria-label={
                            favorite.data
                                ? 'Retirer des favoris'
                                : 'Ajouter aux favoris'
                        }
                        onClick={toggleFavorite}
                    >
                        {favorite.data ? (
                            <IconStarFilled
                                size={20}
                                color="var(--mantine-color-yellow-6)"
                            />
                        ) : (
                            <IconStar size={20} />
                        )}
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
                    <Menu position="bottom-end">
                        <Menu.Target>
                            <ActionIcon
                                variant="default"
                                size={44}
                                aria-label="Plus d’actions"
                            >
                                <IconDots size={20} />
                            </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                            <Menu.Item
                                leftSection={<IconInfoCircle size={16} />}
                                onClick={infoModal.open}
                            >
                                Fiche de la partition
                            </Menu.Item>
                            <Menu.Item
                                leftSection={
                                    <IconAdjustmentsHorizontal size={16} />
                                }
                                onClick={settingsModal.open}
                            >
                                Réglages de la suggestion
                            </Menu.Item>
                            <Menu.Item
                                leftSection={<IconPrinter size={16} />}
                                onClick={() => {
                                    setSelected(null);
                                    setTimeout(() => window.print(), 50);
                                }}
                            >
                                Imprimer avec les doigtés
                            </Menu.Item>
                        </Menu.Dropdown>
                    </Menu>
                </Group>
            </Box>

            <Group
                className="no-print"
                maw={1100}
                mx="auto"
                px={18}
                pt={10}
                gap="8px 14px"
                wrap="wrap"
            >
                <Group gap={6} wrap="nowrap">
                    <ToolIcon
                        label="Annuler"
                        onClick={undo}
                        disabled={!canUndo}
                    >
                        <IconArrowBackUp size={18} />
                    </ToolIcon>
                    <ToolIcon
                        label="Rétablir"
                        onClick={redo}
                        disabled={!canRedo}
                    >
                        <IconArrowForwardUp size={18} />
                    </ToolIcon>
                    <Divider orientation="vertical" mx={2} />
                    <ToolIcon
                        label="Dézoomer"
                        onClick={() => zoomBy(-0.1)}
                        disabled={zoom <= ZOOM_MIN}
                    >
                        <IconMinus size={18} />
                    </ToolIcon>
                    <ToolIcon
                        label="Zoomer"
                        onClick={() => zoomBy(0.1)}
                        disabled={zoom >= ZOOM_MAX}
                    >
                        <IconPlus size={18} />
                    </ToolIcon>
                    <Divider orientation="vertical" mx={2} />
                    <ToolIcon
                        label={
                            playing
                                ? 'Arrêter (espace)'
                                : selectedNote
                                  ? 'Écouter depuis la note choisie (espace)'
                                  : 'Écouter (espace)'
                        }
                        onClick={togglePlay}
                    >
                        {playing ? (
                            <IconPlayerStop size={18} />
                        ) : (
                            <IconPlayerPlay size={18} />
                        )}
                    </ToolIcon>
                </Group>
                <Group gap="6px 12px" ml="auto" wrap="wrap" justify="flex-end">
                    {autoCount > 0 && (
                        <UnstyledButton
                            c="dimmed"
                            td="underline"
                            fz="sm"
                            py={6}
                            style={{ whiteSpace: 'nowrap' }}
                            onClick={clearAuto}
                        >
                            Retirer les suggestions
                        </UnstyledButton>
                    )}
                    <Button.Group>
                        <Button onClick={suggest}>Suggérer les doigtés</Button>
                        <Button
                            px={10}
                            onClick={settingsModal.open}
                            aria-label="Réglages de la suggestion"
                            style={{
                                borderLeft:
                                    '1px solid rgba(255, 255, 255, 0.35)',
                            }}
                        >
                            <IconAdjustmentsHorizontal size={18} />
                        </Button>
                    </Button.Group>
                </Group>
            </Group>

            <Group
                className="no-print"
                maw={1100}
                mx="auto"
                px={18}
                pt={8}
                pb={4}
                gap="4px 14px"
                c="dimmed"
                fz="sm"
            >
                <span>
                    <Dot color="var(--pouce-rh)" />
                    Main droite
                </span>
                <span>
                    <Dot color="var(--pouce-lh)" />
                    Main gauche
                </span>
                {settings.tempo && (
                    <span>Suggestion à ♩ = {settings.tempo}</span>
                )}
                {count > 0 && (
                    <span>
                        {plural(count, 'doigté')}
                        {autoCount > 0 &&
                            `, dont ${autoCount} suggéré${autoCount > 1 ? 's' : ''} (en clair)`}
                    </span>
                )}
            </Group>

            <ScoreView
                xml={piece.data.xml}
                notes={index.notes}
                handOf={handOf}
                annotations={annotations}
                selected={selected}
                zoom={zoom}
                onSelect={select}
                onLayout={setPositions}
            />

            <FingerDock hand={hand} hint={hint} onPick={assign} />

            <SuggestSettings
                opened={settingsOpen}
                onClose={settingsModal.close}
                settings={settings}
                onChange={setSettings}
                staves={staves}
                partNames={parsed.partNames}
                scoreTempo={index.tempo}
            />
            <PieceInfo
                opened={infoOpen}
                onClose={infoModal.close}
                piece={piece.data}
                source={source}
                id={id}
                index={index}
            />
        </Box>
    );
};

export default EditorPage;
