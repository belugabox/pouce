import { describe, expect, it } from 'vitest';

import menuetXml from '../../../../server/catalog/menuet.musicxml?raw';
import odeXml from '../../../../server/catalog/ode.musicxml?raw';
import { scoreXml } from '../../test/scores';
import { type ScoreNote, indexScore, parseXml } from '../musicxml';
import {
    type Annotations,
    assignFinger,
    clearSuggestions,
    suggestAll,
} from './suggest';

const EMPTY: Annotations = { f: {}, auto: {} };

const suggest = (xml: string, current = EMPTY) => {
    const { notes } = indexScore(parseXml(xml));
    return { notes, ...suggestAll(notes, current) };
};

/** Doigts d'une portée, dans l'ordre des notes (mesures données). */
const fingersOf = (
    notes: ScoreNote[],
    f: Record<string, number>,
    staff: number,
    measures?: number[],
) =>
    notes
        .filter(
            (n) =>
                n.staff === staff &&
                (!measures || measures.includes(n.measure)),
        )
        .sort((a, b) => a.measure - b.measure || a.onset - b.onset)
        .map((n) => f[n.key]);

const SCALE_RH = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
const SCALE_LH = ['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4'];

describe('suggestAll', () => {
    it('doigte la gamme de do montante comme les méthodes', () => {
        const { notes, annotations } = suggest(
            scoreXml({ rh: SCALE_RH, lh: SCALE_LH }),
        );
        expect(fingersOf(notes, annotations.f, 1)).toEqual([
            1, 2, 3, 1, 2, 3, 4, 5,
        ]);
        expect(fingersOf(notes, annotations.f, 2)).toEqual([
            5, 4, 3, 2, 1, 3, 2, 1,
        ]);
    });

    it('donne le doigté classique du Menuet en sol', () => {
        const { notes, annotations } = suggest(menuetXml);
        // Mesure 1 et la première note de la mesure 2.
        expect(fingersOf(notes, annotations.f, 1, [0, 1]).slice(0, 6)).toEqual([
            5, 1, 2, 3, 4, 5,
        ]);
        // Mesure 7 : fa♯ sol la si sol.
        expect(fingersOf(notes, annotations.f, 1, [6])).toEqual([
            2, 1, 2, 3, 1,
        ]);
    });

    it('reste en position de do dans l’Ode à la joie', () => {
        const { notes, annotations } = suggest(odeXml);
        const position: Record<number, number> = {
            60: 1,
            62: 2,
            64: 3,
            65: 4,
            67: 5,
        };
        for (const n of notes.filter((n) => n.staff === 1)) {
            expect(annotations.f[n.key]).toBe(position[n.midi]);
        }
    });

    it('marque chaque doigté ajouté comme suggéré', () => {
        const { notes, annotations, added } = suggest(
            scoreXml({ rh: SCALE_RH }),
        );
        expect(added).toBe(notes.length);
        expect(Object.keys(annotations.auto)).toHaveLength(notes.length);
    });

    it('respecte les doigtés saisis et s’adapte autour', () => {
        const xml = scoreXml({ rh: SCALE_RH });
        const { notes } = indexScore(parseXml(xml));
        // Pouce imposé sur le sol : passage du pouce plus tard.
        const g = notes.find((n) => n.midi === 67)!;
        const current = assignFinger(EMPTY, g.key, 1);
        const { annotations, added } = suggestAll(notes, current);
        expect(annotations.f[g.key]).toBe(1);
        expect(annotations.auto[g.key]).toBeUndefined();
        expect(added).toBe(notes.length - 1);
        expect(fingersOf(notes, annotations.f, 1)).toEqual([
            1, 2, 3, 4, 1, 2, 3, 4,
        ]);
    });

    it('recalcule les suggestions précédentes à chaque relance', () => {
        const xml = scoreXml({ rh: SCALE_RH });
        const { notes } = indexScore(parseXml(xml));
        const first = suggestAll(notes, EMPTY).annotations;
        const fixed = assignFinger(first, notes[4]!.key, 1);
        const second = suggestAll(notes, fixed).annotations;
        expect(second.f[notes[4]!.key]).toBe(1);
        expect(second.auto[notes[4]!.key]).toBeUndefined();
        expect(Object.keys(second.auto)).toHaveLength(notes.length - 1);
    });

    it('doigte les accords dans l’ordre des hauteurs', () => {
        const { notes, annotations } = suggest(
            scoreXml({ rh: ['C4+E4+G4'], lh: ['C3+E3+G3'] }),
        );
        expect(fingersOf(notes, annotations.f, 1)).toEqual([1, 3, 5]);
        expect(fingersOf(notes, annotations.f, 2)).toEqual([5, 3, 1]);
    });
});

describe('clearSuggestions', () => {
    it('retire seulement les doigtés suggérés', () => {
        const result = clearSuggestions({
            f: { a: 1, b: 2, c: 3 },
            auto: { b: 1 },
        });
        expect(result).toEqual({ f: { a: 1, c: 3 }, auto: {} });
    });
});

describe('assignFinger', () => {
    it('confirme une suggestion, ou efface avec 0', () => {
        const current: Annotations = { f: { a: 2, b: 3 }, auto: { a: 1 } };
        expect(assignFinger(current, 'a', 2)).toEqual({
            f: { a: 2, b: 3 },
            auto: {},
        });
        expect(assignFinger(current, 'b', 0)).toEqual({
            f: { a: 2 },
            auto: { a: 1 },
        });
    });
});
