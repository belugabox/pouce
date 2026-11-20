import { strToU8, zipSync } from 'fflate';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { analyze, quickMeta, stripXml } from '../scripts/pdmx/analyze';
import {
    attribute,
    fixMojibake,
    normalizeName,
} from '../scripts/pdmx/composers';
import { mxlToXml } from '../scripts/pdmx/musicxml';
import {
    type PdmxRow,
    cleanTitle,
    popularity,
    selectRow,
} from '../scripts/pdmx/select';

const catalogXml = (id: string) =>
    readFileSync(path.join(__dirname, '../catalog', `${id}.musicxml`), 'utf-8');

// « Dvořák » écrit en UTF-8 puis relu en Latin-1.
const MOJIBAKE = `DvoÅ${String.fromCharCode(0x99)}Ã¡k`;

describe('attribute', () => {
    it('reconnaît un compositeur du domaine public', () => {
        expect(
            attribute({ composer: 'Ludwig van Beethoven' }, 'Für Elise'),
        ).toEqual({ composer: 'Ludwig van Beethoven', how: 'composer' });
        expect(
            attribute({ composer: 'L.V. Betthoven' }, 'Bagatelle')?.composer,
        ).toBe('Ludwig van Beethoven');
        expect(attribute({ artist: 'J.S. Bach' }, 'Gigue')?.composer).toBe(
            'Johann Sebastian Bach',
        );
    });

    it('écarte les chansons récentes déclarées « domaine public »', () => {
        expect(
            attribute({ composer: 'Lewis Capaldi' }, 'Someone You Loved'),
        ).toBe(null);
        expect(attribute({ artist: 'Coldplay' }, 'Clocks')).toBe(null);
        expect(
            attribute({ composer: 'Toby Fox Arranged by Stoh' }, 'Undertale'),
        ).toBe(null);
        // Auteur inconnu : écarté, même avec un titre classique dans le nom.
        expect(
            attribute({ composer: 'Rob' }, 'Nocturne in the style of Chopin'),
        ).toBe(null);
    });

    it('ne croit pas la catégorie « Misc Traditional » ni « Anonymous »', () => {
        expect(
            attribute(
                { artist: 'Misc Traditional' },
                'Petit Papa Noël',
                'folk',
            ),
        ).toBe(null);
        expect(
            attribute(
                { composer: 'Alchemist Music', artist: 'Anonymous' },
                'Copycat (Vocaloid)',
                'classical',
            ),
        ).toBe(null);
        // Un air traditionnel connu reste reconnu par son titre.
        expect(
            attribute({ artist: 'Misc Traditional' }, 'Bella ciao', 'folk'),
        ).toEqual({ composer: 'Traditionnel', how: 'title' });
    });

    it('écarte les medleys et les genres récents', () => {
        expect(
            attribute(
                { composer: 'Arranged by Jun Sern', artist: 'Misc' },
                'Beautiful in White + Canon in D + Ode to Joy',
                'electronic',
            ),
        ).toBe(null);
        expect(attribute({}, 'Silent Night', 'pop')).toBe(null);
        expect(
            attribute(
                { composer: 'Traditional, arranged by Vince Guaraldi' },
                'O Tannenbaum',
                'jazz',
            ),
        ).toBe(null);
    });

    it('écarte les compositeurs morts après 1955', () => {
        expect(attribute({ composer: 'Jean Sibelius' }, 'Valse triste')).toBe(
            null,
        );
        expect(
            attribute({ composer: 'Ralph Vaughan Williams' }, 'Greensleeves'),
        ).toBe(null);
        // Œuvres attribuées à tort à un ancien compositeur.
        expect(
            attribute({ composer: 'Tomaso Albinoni' }, 'Adagio in G minor'),
        ).toBe(null);
        expect(attribute({ composer: 'Giulio Caccini' }, 'Ave Maria')).toBe(
            null,
        );
    });

    it('cherche l’auteur dans le titre quand il manque', () => {
        expect(attribute({}, 'Hosanna We Sing - John Bacchus Dykes')).toEqual({
            composer: 'John Bacchus Dykes',
            how: 'composer',
        });
        expect(
            attribute({ composer: 'NA' }, 'Chopin Prelude in E minor')
                ?.composer,
        ).toBe('Frédéric Chopin');
    });

    it('accepte les dates de vie, le répertoire traditionnel et les titres célèbres', () => {
        expect(
            attribute(
                { composer: 'James Hill (1811-1853) Northumbrian' },
                'The Random Jig',
            ),
        ).toEqual({ composer: 'James Hill', how: 'dates' });
        expect(
            attribute({ composer: 'Farrenc, Louise (1804-1875)' }, 'Etude'),
        ).toEqual({ composer: 'Louise Farrenc', how: 'dates' });
        expect(attribute({ composer: 'Nobody (1950-2020)' }, 'Song')).toBe(
            null,
        );
        expect(
            attribute(
                { composer: 'Original (La Rosalie) by: (1880-1930)' },
                'X',
            ),
        ).toBe(null);
        expect(attribute({ composer: 'Trad.' }, 'The Bear Dance')).toEqual({
            composer: 'Traditionnel',
            how: 'traditional',
        });
        expect(
            attribute({ composer: 'arranged by Betty Colley' }, 'Silent Night'),
        ).toEqual({ composer: 'Franz Xaver Gruber', how: 'title' });
    });

    it('répare les noms mal décodés', () => {
        expect(fixMojibake(MOJIBAKE)).toBe('Dvořák');
        expect(fixMojibake('Dvořák')).toBe('Dvořák');
        expect(normalizeName(`Anton ${MOJIBAKE}`)).toBe(' anton dvorak ');
        expect(
            attribute({ composer: `Anton ${MOJIBAKE}` }, 'Serenade')?.composer,
        ).toBe('Antonín Dvořák');
    });
});

describe('select', () => {
    const row = (extra: Partial<PdmxRow> = {}): PdmxRow => ({
        mxl: './mxl/1/11/Qm.mxl',
        metadata: './metadata/5/5740212.json',
        license: 'cc-zero',
        license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
        license_conflict: 'False',
        tracks: '0',
        is_best_unique_arrangement: 'True',
        'subset:all_valid': 'True',
        title: 'Debussy Claude - La plus que lente',
        song_name: 'La plus que lente',
        artist_name: 'Claude Debussy',
        composer_name: 'NA',
        genres: 'classical',
        tags: 'debussy-valse',
        n_views: '999',
        n_favorites: '9',
        n_ratings: '0',
        rating: '0',
        ...extra,
    });

    it('garde le piano seul sous licence libre', () => {
        const c = selectRow(row());
        expect(c).toMatchObject({
            path: 'mxl/1/11/Qm.mxl',
            id: 'pdmx-5740212',
            license: 'CC0',
            sourceUrl: 'https://musescore.com/score/5740212',
            tags: 'classical debussy valse',
            genres: 'classical',
            attribution: { composer: 'Claude Debussy', how: 'composer' },
        });
        expect(selectRow(row({ tracks: '0-0' }))).toBe(null);
        expect(selectRow(row({ license_conflict: 'True' }))).toBe(null);
        expect(selectRow(row({ license: 'cc-by' }))).toBe(null);
        expect(selectRow(row({ is_best_unique_arrangement: 'False' }))).toBe(
            null,
        );
    });

    it('classe par popularité', () => {
        const p = (views: string, favorites: string) =>
            popularity({
                n_views: views,
                n_favorites: favorites,
                n_ratings: '0',
                rating: '0',
            });
        expect(p('0', '0')).toBe(0);
        expect(p('99', '0')).toBe(2);
        expect(p('99', '9')).toBe(4);
    });

    it('retire le compositeur du titre', () => {
        expect(
            cleanTitle('Debussy Claude - La plus que lente', 'Claude Debussy'),
        ).toBe('La plus que lente');
        expect(
            cleanTitle(
                'Hosanna We Sing - John Bacchus Dykes',
                'John Bacchus Dykes',
            ),
        ).toBe('Hosanna We Sing');
        expect(cleanTitle('Prelude - Allegro', 'Frédéric Chopin')).toBe(
            'Prelude - Allegro',
        );
    });
});

describe('analyze', () => {
    it('lit une partition de piano à deux portées et estime sa difficulté', () => {
        const result = analyze(catalogXml('menuet'));
        expect(typeof result).toBe('object');
        if (typeof result === 'string') return;
        expect(result.notes).toBe(49);
        expect(result.measures).toBe(8);
        expect(result.level).toBe('Facile');
        expect(result.difficulty).toBeGreaterThan(2);
    });

    it('refuse une partie sur une seule portée', () => {
        const xml = catalogXml('menuet')
            .replace(/<staves>2<\/staves>/g, '')
            .replace(/<staff>2<\/staff>/g, '<staff>1</staff>');
        expect(analyze(xml)).toBe('pas-piano');
        expect(analyze('<score-timewise/>')).toBe('timewise');
        expect(analyze('pas du xml')).toBe('illisible');
    });

    it('retire les paroles et les mentions de droits', () => {
        const xml =
            '<note><lyric number="1"><text>la</text></lyric></note><rights>© 2020</rights>';
        expect(stripXml(xml)).toBe('<note></note>');
    });

    it('lit le compositeur et le titre sans DOM', () => {
        expect(
            quickMeta(
                '<work><work-title>Valse</work-title></work><creator type="composer">F. Chopin</creator>',
            ),
        ).toEqual({ creator: 'F. Chopin', workTitle: 'Valse', arranger: '' });
    });

    it('décompresse un fichier .mxl', () => {
        const zip = zipSync({
            'META-INF/container.xml': strToU8(
                '<container><rootfiles><rootfile full-path="score.xml"/></rootfiles></container>',
            ),
            'score.xml': strToU8('<score-partwise/>'),
        });
        expect(mxlToXml(zip)).toBe('<score-partwise/>');
        expect(mxlToXml(strToU8('pas un zip'))).toBe(null);
    });
});
