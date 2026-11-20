import { Box, Text } from '@mantine/core';
import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { useEffect, useRef, useState } from 'react';

import type { Annotations } from '@/core/fingering/suggest';
import type { ScoreNote } from '@/core/musicxml';

import { type Positions, collectPositions, createOsmd } from './osmd';
import { drawOverlay, hitTest, screenY } from './overlay';

/** Largeur de la fenêtre, mise à jour 250 ms après un redimensionnement. */
const useWindowWidth = () => {
    const [width, setWidth] = useState(() => window.innerWidth);
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        const onResize = () => {
            clearTimeout(timer);
            timer = setTimeout(() => setWidth(window.innerWidth), 250);
        };
        window.addEventListener('resize', onResize);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', onResize);
        };
    }, []);
    return width;
};

type Status = 'loading' | 'ready' | 'error';

/**
 * Partition dessinée par OSMD, avec le calque des doigtés. Toucher une note
 * la sélectionne ; la note sélectionnée reste visible au-dessus du clavier.
 */
export const ScoreView = ({
    xml,
    notes,
    annotations,
    selected,
    zoom,
    onSelect,
    onLayout,
}: {
    xml: string;
    notes: ScoreNote[];
    annotations: Annotations;
    selected: string | null;
    zoom: number;
    onSelect: (key: string | null) => void;
    onLayout: (positions: Positions) => void;
}) => {
    const container = useRef<HTMLDivElement>(null);
    const osmd = useRef<OpenSheetMusicDisplay | null>(null);
    const [status, setStatus] = useState<Status>('loading');
    const [positions, setPositions] = useState<Positions>(new Map());
    const width = useWindowWidth();

    // Chargement de la partition.
    useEffect(() => {
        let current = true;
        setStatus('loading');
        osmd.current ??= createOsmd(container.current!);
        osmd.current
            .load(xml)
            .then(() => current && setStatus('ready'))
            .catch((err: unknown) => {
                console.error(err);
                if (current) setStatus('error');
            });
        return () => {
            current = false;
        };
    }, [xml]);

    // Mise en page : au chargement, au zoom, quand la largeur change.
    useEffect(() => {
        if (status !== 'ready' || !osmd.current) return;
        try {
            osmd.current.Zoom = zoom;
            osmd.current.render();
            const found = collectPositions(osmd.current);
            setPositions(found);
            onLayout(found);
        } catch (err) {
            console.error(err);
            setStatus('error');
        }
        // `onLayout` change à chaque rendu de la page : sans effet ici.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, zoom, width]);

    // Calque des doigtés et de la sélection.
    useEffect(() => {
        const svg = container.current?.querySelector('svg');
        if (!svg || status !== 'ready') return;
        drawOverlay(svg, { notes, positions, annotations, selected, zoom });
    }, [notes, positions, annotations, selected, zoom, status]);

    // Note sélectionnée cachée (sous le clavier, hors de l'écran) : défiler.
    useEffect(() => {
        const svg = container.current?.querySelector('svg');
        const p = selected ? positions.get(selected) : undefined;
        if (!svg || !p) return;
        const y = screenY(svg, p.y);
        const dockTop =
            document.getElementById('dock')?.getBoundingClientRect().top ??
            window.innerHeight;
        if (y !== null && (y > dockTop - 40 || y < 90)) {
            window.scrollBy({
                top: y - window.innerHeight / 2.6,
                behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
                    ? 'auto'
                    : 'smooth',
            });
        }
    }, [selected, positions]);

    return (
        <Box
            bg="var(--pouce-paper)"
            maw={1100}
            mx="auto"
            mt={8}
            pt={8}
            pb={30}
            px={4}
            style={{ borderRadius: 6, position: 'relative' }}
        >
            {status === 'loading' && (
                <Text ta="center" c="#5b6678" py={60}>
                    Mise en page de la partition…
                </Text>
            )}
            {status === 'error' && (
                <Text ta="center" c="#5b6678" py={60} px={10}>
                    Impossible d’afficher cette partition. Le fichier est
                    peut-être incomplet.
                </Text>
            )}
            <div
                id="score"
                ref={container}
                hidden={status === 'error'}
                onClick={(e) => {
                    const svg = container.current?.querySelector('svg');
                    if (svg) {
                        onSelect(hitTest(svg, positions, e.clientX, e.clientY));
                    }
                }}
            />
        </Box>
    );
};
