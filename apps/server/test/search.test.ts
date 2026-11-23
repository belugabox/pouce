import { describe, expect, it } from 'vitest';

import {
    CatalogIndex,
    type IndexedEntry,
    editDistance,
    wordScore,
} from '../src/catalog/search';

const entry = (
    id: string,
    title: string,
    composer: string,
    extra: Partial<IndexedEntry> = {},
): IndexedEntry => ({
    id,
    title,
    composer,
    arranger: '',
    level: 'Facile',
    difficulty: 3,
    tags: '',
    source: 'pdmx',
    license: 'CC0',
    licenseUrl: null,
    sourceUrl: null,
    duration: 60,
    measures: 16,
    genre: 'Classique',
    popularity: 1,
    ...extra,
});

const index = new CatalogIndex([
    entry('ode', 'Ode à la joie', 'Ludwig van Beethoven', {
        source: 'pouce',
        popularity: null,
        level: 'Débutant',
        difficulty: 1,
    }),
    entry('elise', 'Für Elise', 'Ludwig van Beethoven', {
        level: 'Intermédiaire',
        difficulty: 4.6,
        popularity: 9,
    }),
    entry('valse', 'Waltz in A minor', 'Frédéric Chopin', {
        popularity: 5,
        difficulty: 3.5,
    }),
    entry('nocturne', 'Nocturne Op. 9 No. 2', 'Frédéric Chopin', {
        level: 'Avancé',
        difficulty: 7,
        popularity: 8,
    }),
    entry('gymno', 'Gymnopédie No. 1', 'Erik Satie', {
        popularity: 7,
        tags: 'classical calm',
    }),
    entry('jacques', 'Frère Jacques', 'Traditionnel', {
        level: 'Débutant',
        difficulty: 1.2,
        popularity: 2,
    }),
]);

const ids = (q: string, more = {}) =>
    index.search({ q, ...more }).items.map((e) => e.id);

describe('editDistance', () => {
    it('compte les fautes, inversions comprises', () => {
        expect(editDistance('chopin', 'chopin', 2)).toBe(0);
        expect(editDistance('chpoin', 'chopin', 2)).toBe(1);
        expect(editDistance('betoven', 'beethoven', 2)).toBe(2);
        expect(editDistance('abc', 'xyz', 1)).toBe(2);
    });

    it('reconnaît un mot en cours de frappe', () => {
        expect(wordScore('beeth', 'beethoven')).toBeGreaterThan(0.8);
        expect(wordScore('beethovn', 'beethoven')).toBeGreaterThan(0.5);
        expect(wordScore('9', '90')).toBe(0);
    });
});

describe('CatalogIndex', () => {
    it('classe le catalogue intégré parmi les plus populaires', () => {
        expect(ids('')).toEqual([
            'elise',
            'ode',
            'nocturne',
            'gymno',
            'valse',
            'jacques',
        ]);
    });

    it('cherche sans accents, ni majuscules', () => {
        expect(ids('FRERE')).toEqual(['jacques']);
        expect(ids('gymnopedie')).toEqual(['gymno']);
    });

    it('tolère les fautes de frappe', () => {
        expect(ids('chpoin')).toEqual(['nocturne', 'valse']);
        expect(ids('betoven')).toContain('elise');
    });

    it('traduit quelques mots et expressions', () => {
        expect(ids('valse chopin')).toEqual(['valse']);
        expect(ids('lettre à élise')).toEqual(['elise']);
    });

    it('exige tous les mots, sauf les petits mots', () => {
        expect(ids('nocturne satie')).toEqual([]);
        expect(ids('la gymnopédie de satie')).toEqual(['gymno']);
    });

    it('comprend les mots de niveau, sans les exiger', () => {
        expect(ids('beethoven facile')).toEqual(['ode']);
        expect(ids('chopin facile')).toEqual(['valse']);
        expect(ids('satie facile')).toEqual(['gymno']);
        expect(ids('nocturne difficile')).toEqual(['nocturne']);
        expect(ids('facile', { limit: 3 })).toEqual(['ode', 'gymno', 'valse']);
    });

    it('cherche dans toutes les écritures', () => {
        const other = new CatalogIndex([
            entry('kpop', 'Story That Won’t End (어디에도)', 'Stray Kids'),
            entry('anime', 'ブルーバード', 'Ikimonogakari'),
            entry('coeur', 'Mon cœur s’ouvre à ta voix', 'Camille Saint-Saëns'),
        ]);
        const find = (q: string) => other.search({ q }).items.map((e) => e.id);
        expect(find('어디에도')).toEqual(['kpop']);
        expect(find('ブルーバード')).toEqual(['anime']);
        expect(find('coeur')).toEqual(['coeur']);
        expect(find('saens')).toEqual(['coeur']);
    });

    it('regroupe les versions d’un même morceau', () => {
        const versions = new CatalogIndex([
            entry('e1', 'Für Elise', 'Ludwig van Beethoven', {
                popularity: 9,
                difficulty: 4.6,
            }),
            entry('e2', 'Fur Elise (Easy Piano Version)', 'L. v. Beethoven', {
                popularity: 3,
                difficulty: 1.5,
                level: 'Débutant',
            }),
            entry('e3', 'Für Elise - Beethoven', 'Beethoven', {
                popularity: 5,
                difficulty: 3,
            }),
            entry('w1', 'Waltz', '', { popularity: 2 }),
            entry('w2', 'Waltz', '', { popularity: 1 }),
            entry('s1', 'Sonata for Piano', 'Haydn', { popularity: 4 }),
        ]);
        const page = versions.search({ q: 'elise' });
        expect(page.total).toBe(1);
        expect(page.items.map((e) => [e.id, e.versions])).toEqual([['e1', 3]]);
        const group = page.items[0]!.group;
        expect(versions.search({ group }).items.map((e) => e.id)).toEqual([
            'e2',
            'e3',
            'e1',
        ]);
        // Sans compositeur, pas de regroupement ; « piano » seul reste.
        expect(versions.search({ q: 'waltz' }).total).toBe(2);
        expect(versions.search({ q: 'sonata' }).items[0]!.versions).toBe(1);
        // Le niveau filtre les versions : la plus facile représente le morceau.
        expect(
            versions
                .search({ q: 'elise', level: 'Débutant' })
                .items.map((e) => [e.id, e.versions]),
        ).toEqual([['e2', 1]]);
    });

    it('filtre par genre et compte les morceaux par genre', () => {
        const mixed = new CatalogIndex([
            entry('a', 'Prelude', 'Bach'),
            entry('b', 'Zelda Theme', 'Koji Kondo', { genre: 'Jeux vidéo' }),
            entry('c', 'Song of Storms', 'Koji Kondo', {
                genre: 'Jeux vidéo',
                level: 'Avancé',
            }),
            entry('d', 'Untitled', 'X', { genre: null }),
        ]);
        const page = mixed.search({ genre: 'Jeux vidéo' });
        expect(page.items.map((e) => e.id).sort()).toEqual(['b', 'c']);
        expect(page.genres).toMatchObject({
            Classique: 1,
            'Jeux vidéo': 2,
            Autres: 1,
        });
        expect(page.levels).toMatchObject({ Facile: 1, Avancé: 1 });
        expect(mixed.search({ genre: 'Autres' }).items[0]!.id).toBe('d');
        expect(mixed.search({ level: 'Avancé' }).genres['Jeux vidéo']).toBe(1);
    });

    it('cherche aussi dans les mots-clés', () => {
        expect(ids('calm')).toEqual(['gymno']);
    });

    it('filtre par niveau et compte les résultats par niveau', () => {
        const page = index.search({ q: 'beethoven', level: 'Intermédiaire' });
        expect(page.items.map((e) => e.id)).toEqual(['elise']);
        expect(page.total).toBe(1);
        expect(page.levels).toEqual({
            Débutant: 1,
            Facile: 0,
            Intermédiaire: 1,
            Avancé: 0,
        });
    });

    it('trie par difficulté ou par titre, et pagine', () => {
        expect(ids('', { sort: 'easy', limit: 3 })).toEqual([
            'ode',
            'jacques',
            'gymno',
        ]);
        expect(ids('', { sort: 'title' })).toEqual([
            'jacques',
            'elise',
            'gymno',
            'nocturne',
            'ode',
            'valse',
        ]);
        expect(ids('', { sort: 'title', offset: 4 })).toEqual(['ode', 'valse']);
    });

    it('ne renvoie pas la popularité', () => {
        expect(index.search({ q: 'satie' }).items[0]).not.toHaveProperty(
            'popularity',
        );
    });
});
