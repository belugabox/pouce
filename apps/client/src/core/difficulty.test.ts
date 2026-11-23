import { describe, expect, it } from 'vitest';

import jacquesXml from '../../../server/catalog/jacques.musicxml?raw';
import luneXml from '../../../server/catalog/lune.musicxml?raw';
import menuetXml from '../../../server/catalog/menuet.musicxml?raw';
import odeXml from '../../../server/catalog/ode.musicxml?raw';
import preludeXml from '../../../server/catalog/prelude.musicxml?raw';
import twinkleXml from '../../../server/catalog/twinkle.musicxml?raw';
import { scoreXml } from '../test/scores';
import { estimateDifficulty, levelOf } from './difficulty';
import { indexScore, parseXml } from './musicxml';

const estimate = (xml: string) => estimateDifficulty(indexScore(parseXml(xml)));

describe('estimateDifficulty', () => {
    it('classe les comptines en Débutant', () => {
        for (const xml of [odeXml, luneXml, jacquesXml, twinkleXml]) {
            expect(estimate(xml).level).toBe('Débutant');
        }
    });

    it('met le Menuet en sol en Facile, au-dessus des comptines', () => {
        const menuet = estimate(menuetXml);
        expect(menuet.level).toBe('Facile');
        expect(menuet.score).toBeGreaterThan(estimate(odeXml).score);
        expect(estimate(preludeXml).score).toBeGreaterThan(menuet.score);
    });

    it('compte plus difficile un passage rapide, en accords et écarté', () => {
        const slow = estimate(
            scoreXml({ rh: ['C4', 'D4', 'E4', 'F4'], tempo: 60 }),
        );
        const hard = estimate(
            scoreXml({
                rh: [
                    'C4+E4+G4+C5',
                    'D4+F#4+A4+D5',
                    'Eb4+G4+Bb4+Eb5',
                    'C5+E5+G5+C6',
                ],
                lh: ['C2+C3', 'G2+G3', 'C2+C3', 'G1+G2'],
                tempo: 240,
            }),
        );
        expect(slow.level).toBe('Débutant');
        expect(hard.score).toBeGreaterThan(slow.score + 2);
        expect(hard.features.chords).toBeGreaterThan(0.4);
    });

    it('estime la durée au tempo écrit', () => {
        const d = estimate(
            scoreXml({ rh: ['C4', 'D4', 'E4', 'F4'], tempo: 120 }),
        );
        // 4 noires à 120 : 2 secondes.
        expect(d.features.duration).toBeCloseTo(2, 5);
        expect(d.features.measures).toBe(1);
    });

    it('découpe les niveaux', () => {
        expect(levelOf(0)).toBe('Débutant');
        expect(levelOf(3)).toBe('Facile');
        expect(levelOf(5)).toBe('Intermédiaire');
        expect(levelOf(8)).toBe('Avancé');
    });
});
