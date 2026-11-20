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
    it('met le catalogue intégré en tête, puis le plus populaire', () => {
        expect(ids('')).toEqual([
            'ode',
            'elise',
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
