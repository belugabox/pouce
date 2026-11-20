import { describe, expect, it } from 'vitest';

import menuetXml from '../../../server/catalog/menuet.musicxml?raw';
import { scoreXml } from '../test/scores';
import { buildExport, slug } from './exportXml';
import { importFile } from './importFile';
import { indexScore, parseXml, readFingerings, readMeta } from './musicxml';
import { matches, norm } from './search';

const wrap = (measure: string) =>
    `<score-partwise version="4.0"><part-list><score-part id="P1"/></part-list><part id="P1"><measure number="1"><attributes><divisions>2</divisions></attributes>${measure}</measure></part></score-partwise>`;

const note = (step: string, extra = '', duration = 2) =>
    `<note><pitch><step>${step}</step><octave>4</octave></pitch><duration>${duration}</duration>${extra}</note>`;

describe('indexScore', () => {
    it('donne une clé par note, rangée du grave à l’aigu dans l’accord', () => {
        const { notes } = indexScore(
            parseXml(scoreXml({ rh: ['G4+C4+E4', 'D4'], lh: ['C3'] })),
        );
        expect(notes.map((n) => [n.key, n.midi])).toEqual([
            ['0|0|1|0.0000|0', 60],
            ['0|0|1|0.0000|1', 64],
            ['0|0|1|0.0000|2', 67],
            ['0|0|1|0.2500|0', 62],
            ['0|0|2|0.0000|0', 48],
        ]);
        expect(notes[0]!.size).toBe(3);
    });

    it('ignore silences, appoggiatures et notes « cue »', () => {
        const { notes } = indexScore(
            parseXml(
                wrap(
                    note('C') +
                        '<note><rest/><duration>2</duration></note>' +
                        '<note><grace/><pitch><step>D</step><octave>4</octave></pitch></note>' +
                        note('E', '<cue/>') +
                        note('F'),
                ),
            ),
        );
        expect(notes.map((n) => n.midi)).toEqual([60, 65]);
        // Le silence et la note « cue » prennent leur temps.
        expect(notes[1]!.t).toBe(3);
    });

    it('lit le tempo du métronome et de <sound>', () => {
        const metronome = (unit: string, dot = '') =>
            indexScore(
                parseXml(
                    wrap(
                        `<direction><direction-type><metronome><beat-unit>${unit}</beat-unit>${dot}<per-minute>60</per-minute></metronome></direction-type></direction>${note('C')}`,
                    ),
                ),
            ).tempo;
        expect(metronome('quarter')).toBe(60);
        expect(metronome('half')).toBe(120);
        expect(metronome('eighth', '<beat-unit-dot/>')).toBe(45);
        expect(
            indexScore(parseXml(scoreXml({ rh: ['C4'], tempo: 132 }))).tempo,
        ).toBe(132);
        expect(indexScore(parseXml(scoreXml({ rh: ['C4'] }))).tempo).toBe(100);
    });

    it('suit les liaisons et les articulations', () => {
        const { notes } = indexScore(
            parseXml(
                wrap(
                    note(
                        'C',
                        '<notations><slur type="start" number="1"/></notations>',
                    ) +
                        note('D') +
                        note(
                            'E',
                            '<notations><slur type="stop" number="1"/></notations>',
                        ) +
                        note(
                            'F',
                            '<notations><articulations><staccato/></articulations><fermata/></notations>',
                        ),
                ),
            ),
        );
        const [c, d, e, f] = notes;
        expect(c!.slur).not.toBeNull();
        expect(d!.slur).toBe(c!.slur);
        expect(e!.slur).toBe(c!.slur);
        expect(e!.slurEnd).toBe(true);
        expect(f!.slur).toBeNull();
        expect(f!.stacc).toBe(true);
        expect(f!.fermata).toBe(true);
    });

    it('enchaîne les mesures en temps absolu', () => {
        const { notes, tempo } = indexScore(parseXml(menuetXml));
        expect(tempo).toBe(120);
        const firstOfMeasure2 = notes.find((n) => n.measure === 1)!;
        expect(firstOfMeasure2.t).toBe(3);
    });
});

describe('export', () => {
    it('écrit les doigtés que readFingerings relit', () => {
        const xml = scoreXml({ rh: ['C4', 'D4+F4'], lh: ['C3'] });
        const keys = indexScore(parseXml(xml)).notes.map((n) => n.key);
        const fingerings = { [keys[0]!]: 1, [keys[2]!]: 4, [keys[3]!]: 5 };
        const { text, count } = buildExport(xml, fingerings);
        expect(count).toBe(3);
        expect(readFingerings(indexScore(parseXml(text)))).toEqual(fingerings);
    });

    it('remplace les doigtés d’origine', () => {
        const xml = scoreXml({ rh: ['C4', 'D4'] });
        const keys = indexScore(parseXml(xml)).notes.map((n) => n.key);
        const first = buildExport(xml, { [keys[0]!]: 1, [keys[1]!]: 2 }).text;
        const second = buildExport(first, { [keys[1]!]: 3 }).text;
        expect(readFingerings(indexScore(parseXml(second)))).toEqual({
            [keys[1]!]: 3,
        });
        expect(second.match(/<notations>/g)).toHaveLength(1);
    });

    it('fait un nom de fichier sans accents', () => {
        expect(slug('Ah ! vous dirai-je, maman')).toBe(
            'ah-vous-dirai-je-maman',
        );
        expect(slug('!!!')).toBe('partition');
    });
});

describe('importFile', () => {
    const file = (text: string) => new Blob([text]);

    it('lit un fichier .musicxml', async () => {
        const result = await importFile(
            file(scoreXml({ rh: ['C4'], title: 'Ma pièce' })),
            'x.musicxml',
        );
        expect(result.title).toBe('Ma pièce');
        expect(result.composer).toBe('Anonyme');
    });

    it('prend le nom du fichier sans titre', async () => {
        const xml = scoreXml({ rh: ['C4'] }).replace(/<work>.*<\/work>/, '');
        const result = await importFile(file(xml), 'Sonate.xml');
        expect(result.title).toBe('Sonate');
    });

    it('lit une archive .mxl', async () => {
        const { default: JSZip } = await import('jszip');
        const zip = new JSZip();
        zip.file(
            'META-INF/container.xml',
            '<container><rootfiles><rootfile full-path="score/piece.xml"/></rootfiles></container>',
        );
        zip.file('score/piece.xml', scoreXml({ rh: ['C4'], title: 'Zippée' }));
        const blob = await zip.generateAsync({ type: 'blob' });
        expect((await importFile(blob, 'piece.mxl')).title).toBe('Zippée');
    });

    it('refuse le format « timewise » avec un message clair', async () => {
        await expect(
            importFile(file('<score-timewise/>'), 'a.xml'),
        ).rejects.toThrow('timewise');
    });

    it('refuse un fichier illisible', async () => {
        await expect(importFile(file('pas du xml'), 'a.xml')).rejects.toThrow(
            'n’est pas une partition',
        );
    });
});

describe('readMeta', () => {
    it('lit titre et compositeur', () => {
        expect(readMeta(parseXml(menuetXml))).toEqual({
            title: 'Menuet en sol majeur',
            composer: 'Christian Petzold',
        });
    });
});

describe('recherche', () => {
    it('ignore accents et majuscules', () => {
        expect(norm('Frère JACQUES')).toBe('frere jacques');
        expect(matches({ title: 'Frère Jacques' }, 'frere')).toBe(true);
        expect(matches({ title: 'X', tags: 'twinkle star' }, 'Star')).toBe(
            true,
        );
        expect(matches({ title: 'X', composer: 'Bach' }, 'mozart')).toBe(false);
        expect(matches({ title: 'X' }, '  ')).toBe(true);
    });
});
