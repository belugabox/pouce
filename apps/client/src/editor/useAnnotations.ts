import { useCallback, useEffect, useRef, useState } from 'react';

import type { Annotations } from '@/core/fingering/suggest';
import { type ScoreIndex, readFingerings } from '@/core/musicxml';
import { getAnnotations, saveAnnotations } from '@/storage/db';

/**
 * Doigtés d'une partition, gardés dans ce navigateur à chaque changement.
 * À la première ouverture : ceux écrits dans le fichier.
 */
export const useAnnotations = (piece: string, index: ScoreIndex | null) => {
    const [annotations, setAnnotations] = useState<Annotations | null>(null);
    const current = useRef<Annotations | null>(null);

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
            });
        return () => {
            active = false;
        };
    }, [piece, index]);

    const update = useCallback(
        (change: (value: Annotations) => Annotations) => {
            if (!current.current) return;
            const next = change(current.current);
            current.current = next;
            setAnnotations(next);
            saveAnnotations(piece, next).catch((err: unknown) =>
                console.error(err),
            );
        },
        [piece],
    );

    return { annotations, update };
};
