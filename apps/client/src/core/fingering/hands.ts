import type { ScoreNote } from '../musicxml';
import type { Hand } from './costs';

/**
 * Main qui joue chaque portée. Par défaut :
 * - une partie à plusieurs portées (le piano) : la portée du haut à droite,
 *   les autres à gauche ; les autres parties (chant, violon…) sont ignorées ;
 * - sinon (parties d'une seule portée) : la première à droite, la deuxième
 *   à gauche, les suivantes ignorées.
 * La personne peut changer ce choix, partition par partition.
 */

/** 1 : main droite, 2 : main gauche, 0 : portée ignorée. */
export type HandChoice = Hand | 0;

/** Choix par portée, clé `partie|portée`. */
export type HandMap = Record<string, HandChoice>;

export const staffKey = (n: Pick<ScoreNote, 'part' | 'staff'>) =>
    `${n.part}|${n.staff}`;

export interface StaffInfo {
    key: string;
    part: number;
    staff: number;
    /** Nombre de notes jouées sur la portée. */
    notes: number;
}

/** Portées qui ont des notes, dans l'ordre de la partition. */
export const listStaves = (notes: ScoreNote[]): StaffInfo[] => {
    const byKey = new Map<string, StaffInfo>();
    for (const n of notes) {
        const key = staffKey(n);
        const info = byKey.get(key);
        if (info) info.notes++;
        else byKey.set(key, { key, part: n.part, staff: n.staff, notes: 1 });
    }
    return [...byKey.values()].sort(
        (a, b) => a.part - b.part || a.staff - b.staff,
    );
};

/** Choix par défaut, d'après la forme de la partition. */
export const defaultHands = (staves: StaffInfo[]): HandMap => {
    const map: HandMap = {};
    const parts = new Map<number, StaffInfo[]>();
    for (const s of staves) {
        if (!parts.has(s.part)) parts.set(s.part, []);
        parts.get(s.part)!.push(s);
    }
    const piano = [...parts.values()].find((p) => p.length >= 2);
    staves.forEach((s, i) => {
        if (piano) {
            map[s.key] = s.part !== piano[0]!.part ? 0 : s === piano[0] ? 1 : 2;
        } else {
            map[s.key] = i === 0 ? 1 : i === 1 ? 2 : 0;
        }
    });
    return map;
};

/**
 * Main de chaque note : choix enregistré pour sa portée, sinon le choix par
 * défaut.
 */
export const handResolver = (
    notes: ScoreNote[],
    saved?: HandMap,
): ((n: Pick<ScoreNote, 'part' | 'staff'>) => HandChoice) => {
    const map = { ...defaultHands(listStaves(notes)), ...saved };
    return (n) => map[staffKey(n)] ?? 0;
};
