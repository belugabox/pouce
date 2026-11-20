import { describe, expect, it } from 'vitest';

import { indexScore, parseXml } from '@/core/musicxml';
import { scoreXml } from '@/test/scores';

import { buildOrder, otherHand, step } from './navigation';

const { notes, byKey } = indexScore(
    parseXml(scoreXml({ rh: ['C4+E4', 'G4'], lh: ['C3', 'G3+C4'] })),
);
const midiOf = (key: string | null) => (key ? byKey.get(key)!.midi : null);

describe('navigation au clavier', () => {
    const order = buildOrder(notes, () => true);

    it('saisit les accords de l’aigu au grave à droite, l’inverse à gauche', () => {
        expect(order[1].map(midiOf)).toEqual([64, 60, 67]);
        expect(order[2].map(midiOf)).toEqual([48, 55, 60]);
    });

    it('passe à la note suivante ou précédente de la même main', () => {
        const e4 = byKey.get(order[1][0]!)!;
        expect(midiOf(step(order, e4, 1))).toBe(60);
        expect(step(order, e4, -1)).toBeNull();
    });

    it('ignore les notes non dessinées', () => {
        const hidden = order[1][1]!;
        expect(buildOrder(notes, (k) => k !== hidden)[1].map(midiOf)).toEqual([
            64, 67,
        ]);
    });

    it('rejoint la note la plus proche de l’autre main', () => {
        const x = (key: string) => byKey.get(key)!.onset * 100;
        const measure = (key: string) => byKey.get(key)!.measure;
        const g4 = byKey.get(order[1][2]!)!;
        expect(midiOf(otherHand(order, g4, x, measure))).toBe(55);
    });
});
