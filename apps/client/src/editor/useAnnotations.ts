import { useCallback, useEffect, useRef, useState } from 'react';

import type { Annotations } from '@/core/fingering/suggest';
import { type ScoreIndex, readFingerings } from '@/core/musicxml';
import {
    type PieceSettings,
    getAnnotations,
    getSettings,
    saveAnnotations,
    saveSettings,
} from '@/storage/db';

/** Étapes gardées pour « Annuler ». */
const HISTORY = 100;

/**
 * Doigtés d'une partition, gardés dans ce navigateur à chaque changement,
 * avec l'historique pour annuler et rétablir. À la première ouverture :
 * ceux écrits dans le fichier.
 */
export const useAnnotations = (piece: string, index: ScoreIndex | null) => {
    const [annotations, setAnnotations] = useState<Annotations | null>(null);
    const current = useRef<Annotations | null>(null);
    const [past, setPast] = useState<Annotations[]>([]);
    const [future, setFuture] = useState<Annotations[]>([]);

    useEffect(() => {
        if (!index) return;
        let active = true;
        getAnnotations(piece)
            .catch(() => undefined)
            .then((saved) => {
                if (!active) return;
                const value = saved ?? { f: readFingerings(index), auto: {} };
                current.current = value;
                setAnnotations(value);
                setPast([]);
                setFuture([]);
            });
        return () => {
            active = false;
        };
    }, [piece, index]);

    const commit = useCallback(
        (next: Annotations) => {
            current.current = next;
            setAnnotations(next);
            saveAnnotations(piece, next).catch((err: unknown) =>
                console.error(err),
            );
        },
        [piece],
    );

    const update = useCallback(
        (change: (value: Annotations) => Annotations) => {
            const before = current.current;
            if (!before) return;
            const next = change(before);
            if (next === before) return;
            setPast((p) => [...p.slice(-(HISTORY - 1)), before]);
            setFuture([]);
            commit(next);
        },
        [commit],
    );

    const undo = useCallback(() => {
        const before = current.current;
        const previous = past[past.length - 1];
        if (!before || !previous) return false;
        setPast(past.slice(0, -1));
        setFuture((f) => [before, ...f]);
        commit(previous);
        return true;
    }, [past, commit]);

    const redo = useCallback(() => {
        const before = current.current;
        const next = future[0];
        if (!before || !next) return false;
        setFuture(future.slice(1));
        setPast((p) => [...p, before]);
        commit(next);
        return true;
    }, [future, commit]);

    return {
        annotations,
        update,
        undo,
        redo,
        canUndo: past.length > 0,
        canRedo: future.length > 0,
    };
};

/** Réglages de la suggestion (mains, tempo), gardés par partition. */
export const usePieceSettings = (piece: string) => {
    const [settings, setSettings] = useState<PieceSettings>({});
    useEffect(() => {
        let active = true;
        getSettings(piece)
            .catch(() => ({}))
            .then((value) => active && setSettings(value));
        return () => {
            active = false;
        };
    }, [piece]);
    const change = useCallback(
        (value: PieceSettings) => {
            setSettings(value);
            saveSettings(piece, value).catch((err: unknown) =>
                console.error(err),
            );
        },
        [piece],
    );
    return [settings, change] as const;
};
