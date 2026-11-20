import { describe, expect, it } from 'vitest';

import { scoreXml } from '../../test/scores';
import { type ScoreNote, indexScore, parseXml } from '../musicxml';
import { defaultHands, handResolver, listStaves } from './hands';
import { type Annotations, suggestAll } from './suggest';

const EMPTY: Annotations = { f: {}, auto: {} };

/** Notes factices : une par portée donnée (`partie|portée`). */
const notesOn = (...staves: string[]) =>
    staves.map((s, i) => {
        const [part, staff] = s.split('|').map(Number) as [number, number];
        return { part, staff, key: `k${i}` } as ScoreNote;
    });

describe('mains par portée', () => {
    it('piano : portée du haut à droite, celle du bas à gauche', () => {
        const staves = listStaves(notesOn('0|1', '0|2', '0|1'));
        expect(staves.map((s) => [s.key, s.notes])).toEqual([
            ['0|1', 2],
            ['0|2', 1],
        ]);
        expect(defaultHands(staves)).toEqual({ '0|1': 1, '0|2': 2 });
    });

    it('chant et piano : le chant est ignoré', () => {
        const staves = listStaves(notesOn('0|1', '1|1', '1|2'));
        expect(defaultHands(staves)).toEqual({ '0|1': 0, '1|1': 1, '1|2': 2 });
    });

    it('parties d’une portée : la première à droite, la deuxième à gauche', () => {
        const staves = listStaves(notesOn('0|1', '1|1', '2|1'));
        expect(defaultHands(staves)).toEqual({ '0|1': 1, '1|1': 2, '2|1': 0 });
    });

    it('le choix enregistré l’emporte', () => {
        const notes = notesOn('0|1', '0|2');
        const handOf = handResolver(notes, { '0|1': 2, '0|2': 0 });
        expect(handOf({ part: 0, staff: 1 })).toBe(2);
        expect(handOf({ part: 0, staff: 2 })).toBe(0);
    });

    it('la suggestion suit les mains choisies', () => {
        const { notes } = indexScore(
            parseXml(scoreXml({ rh: ['C4', 'D4', 'E4'], lh: ['C3', 'D3'] })),
        );
        // Portée du bas ignorée : seules les notes du haut sont doigtées.
        const { annotations } = suggestAll(notes, EMPTY, {
            hands: { '0|2': 0 },
        });
        const fingered = notes.filter((n) => annotations.f[n.key]);
        expect(fingered.map((n) => n.staff)).toEqual([1, 1, 1]);
        // Portée du haut jouée de la main gauche : en montant, les numéros
        // descendent (5-4-3, 3-2-1…).
        const left = suggestAll(notes, EMPTY, {
            hands: { '0|1': 2, '0|2': 0 },
        }).annotations;
        const lf = notes
            .filter((n) => n.staff === 1)
            .map((n) => left.f[n.key]!);
        expect(lf[0]! > lf[1]! && lf[1]! > lf[2]!).toBe(true);
    });
});

describe('tempo de la suggestion', () => {
    it('garde le doigté quand le tempo ne change rien, et l’accepte sinon', () => {
        const xml = scoreXml({
            rh: ['C4', 'G4', 'C4', 'G4', 'C4', 'G4'],
            tempo: 200,
        });
        const { notes, tempo } = indexScore(parseXml(xml));
        const fast = suggestAll(notes, EMPTY).annotations.f;
        const same = suggestAll(notes, EMPTY, {
            tempo: 200,
            scoreTempo: tempo,
        }).annotations.f;
        expect(same).toEqual(fast);
        const slow = suggestAll(notes, EMPTY, {
            tempo: 40,
            scoreTempo: tempo,
        });
        expect(slow.added).toBe(6);
    });
});
