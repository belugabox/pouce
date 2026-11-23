import { handResolver } from '@/core/fingering/hands';
import type { HandOf } from '@/core/fingering/suggest';
import type { ScoreNote } from '@/core/musicxml';

/** Clés des notes de chaque main (1 : droite, 2 : gauche), dans l'ordre de saisie. */
export type NoteOrder = Record<1 | 2, string[]>;

/**
 * Ordre de saisie : mesure, attaque, puis dans un accord de l'aigu vers le
 * grave à la main droite, du grave vers l'aigu à la main gauche. Seules les
 * notes dessinées (`shown`) et jouées (portée non ignorée) comptent.
 */
export const buildOrder = (
    notes: ScoreNote[],
    shown: (key: string) => boolean,
    handOf: HandOf = handResolver(notes),
): NoteOrder => {
    const order: NoteOrder = { 1: [], 2: [] };
    for (const hand of [1, 2] as const) {
        order[hand] = notes
            .filter((n) => handOf(n) === hand && shown(n.key))
            .sort(
                (a, b) =>
                    a.part - b.part ||
                    a.measure - b.measure ||
                    a.onset - b.onset ||
                    (hand === 1 ? b.midi - a.midi : a.midi - b.midi),
            )
            .map((n) => n.key);
    }
    return order;
};

/** Main d'une note d'après l'ordre de saisie (null : portée ignorée). */
export const handIn = (order: NoteOrder, key: string): 1 | 2 | null =>
    order[1].includes(key) ? 1 : order[2].includes(key) ? 2 : null;

/** Note suivante (ou précédente) de la même main ; null au bout. */
export const step = (
    order: NoteOrder,
    note: ScoreNote,
    delta: 1 | -1,
): string | null => {
    const hand = handIn(order, note.key);
    if (!hand) return null;
    const list = order[hand];
    const i = list.indexOf(note.key);
    return list[i + delta] ?? null;
};

/** Note la plus proche dans l'autre main (même mesure de préférence). */
export const otherHand = (
    order: NoteOrder,
    note: ScoreNote,
    x: (key: string) => number,
    measureOf: (key: string) => number,
): string | null => {
    const hand = handIn(order, note.key);
    if (!hand) return null;
    const other = order[hand === 1 ? 2 : 1];
    let best: string | null = null;
    let bestScore = Infinity;
    for (const key of other) {
        const score =
            Math.abs(x(key) - x(note.key)) +
            Math.abs(measureOf(key) - note.measure) * 100;
        if (score < bestScore) {
            bestScore = score;
            best = key;
        }
    }
    return best;
};
