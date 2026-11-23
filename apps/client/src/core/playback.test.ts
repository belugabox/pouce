import { describe, expect, it } from 'vitest';

import { scoreXml } from '@/test/scores';

import { indexScore, parseXml } from './musicxml';
import { playNotes } from './playback';

const notes = (xml: string) => indexScore(parseXml(xml)).notes;

const round = (list: ReturnType<typeof playNotes>) =>
    list.map((n) => [n.midi, +n.start.toFixed(3), +n.dur.toFixed(3)]);

describe('playNotes', () => {
    it('suit les nuances et les accents', () => {
        const xml = scoreXml({ rh: ['C4', 'D4', 'E4'], tempo: 120 })
            .replace(
                /(<note>)/,
                '<direction><direction-type><dynamics><p/></dynamics></direction-type></direction>$1',
            )
            .replace(
                /(<note>)(?=<pitch><step>E)/,
                '<direction><direction-type><dynamics><ff/></dynamics></direction-type><sound dynamics="120"/></direction>$1',
            )
            .replace(
                /(<step>D<\/step>[\s\S]*?)(<\/note>)/,
                '$1<notations><articulations><accent/></articulations></notations>$2',
            );
        expect(
            playNotes(notes(xml)).map((n) => +n.velocity.toFixed(2)),
        ).toEqual([0.4, 0.54, 0.85]);
        const plain = scoreXml({ rh: ['C4'] });
        expect(playNotes(notes(plain))[0]!.velocity).toBe(0.64);
    });

    it('place les notes en secondes, d’après le tempo', () => {
        const xml = scoreXml({
            rh: ['C4', 'D4', 'E4'],
            lh: ['C3'],
            tempo: 120,
        });
        expect(round(playNotes(notes(xml)))).toEqual([
            [48, 0, 0.5],
            [60, 0, 0.5],
            [62, 0.5, 0.5],
            [64, 1, 0.5],
        ]);
    });

    it('part d’une note et change de vitesse', () => {
        const xml = scoreXml({ rh: ['C4', 'D4', 'E4'], tempo: 120 });
        expect(round(playNotes(notes(xml), { from: 1, factor: 2 }))).toEqual([
            [62, 0, 0.25],
            [64, 0.25, 0.25],
        ]);
    });

    it('tient les notes liées d’un seul coup', () => {
        const xml = scoreXml({ rh: ['C4', 'C4', 'D4'], tempo: 60 }).replace(
            /(<note>)(?=<pitch><step>C<\/step><octave>4<\/octave><\/pitch>)(?![\s\S]*<note><pitch><step>C)/,
            '$1<tie type="stop"/>',
        );
        expect(round(playNotes(notes(xml)))).toEqual([
            [60, 0, 2],
            [62, 2, 1],
        ]);
    });
});

describe('échantillons de piano', () => {
    it('prend la note enregistrée la plus proche et la couche de la nuance', async () => {
        const { sampleFor, layerFor } = await import('@/editor/player');
        expect([21, 22, 23, 60, 61, 62, 108, 110, 15].map(sampleFor)).toEqual([
            21, 21, 24, 60, 60, 63, 108, 108, 21,
        ]);
        expect(layerFor(0.4)).toBe('p');
        expect(layerFor(0.64)).toBe('f');
    });
});
