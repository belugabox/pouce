import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    LIBRARY_MAX,
    addImport,
    closeDb,
    countAnnotations,
    deleteImport,
    getAnnotations,
    getImport,
    getLibraryPiece,
    getSettings,
    isFavorite,
    keepLibraryPiece,
    listFavorites,
    listImports,
    listLibrary,
    pieceKey,
    saveAnnotations,
    saveSettings,
    setFavorite,
} from './db';

const libraryPiece = (id: string) => ({
    id,
    title: `Titre ${id}`,
    composer: 'Chopin',
    arranger: '',
    level: 'Facile' as const,
    difficulty: 3,
    tags: '',
    source: 'pdmx',
    license: 'CC0',
    licenseUrl: null,
    sourceUrl: null,
    duration: 60,
    measures: 16,
    genre: null,
    xml: `<score id="${id}"/>`,
});

beforeEach(() => {
    // Base vide pour chaque test.
    globalThis.indexedDB = new IDBFactory();
});
afterEach(closeDb);

describe('stockage local', () => {
    it('garde les partitions importées, la plus récente d’abord', async () => {
        const a = await addImport({ title: 'A', composer: '', xml: '<a/>' });
        await new Promise((r) => setTimeout(r, 5));
        const b = await addImport({ title: 'B', composer: 'X', xml: '<b/>' });
        expect(a.id).not.toBe(b.id);
        expect((await listImports()).map((p) => p.title)).toEqual(['B', 'A']);
        expect((await getImport(a.id))?.xml).toBe('<a/>');
    });

    it('garde les doigtés par partition et les compte', async () => {
        const piece = pieceKey('catalogue', 'ode');
        expect(await getAnnotations(piece)).toBeUndefined();
        await saveAnnotations(piece, { f: { k1: 1, k2: 3 }, auto: { k2: 1 } });
        expect(await getAnnotations(piece)).toEqual({
            f: { k1: 1, k2: 3 },
            auto: { k2: 1 },
        });
        expect((await countAnnotations()).get(piece)).toBe(2);
    });

    it('supprime une partition importée avec ses doigtés', async () => {
        const p = await addImport({ title: 'A', composer: '', xml: '<a/>' });
        await saveAnnotations(pieceKey('import', p.id), {
            f: { k: 1 },
            auto: {},
        });
        await deleteImport(p.id);
        expect(await listImports()).toEqual([]);
        expect(await getAnnotations(pieceKey('import', p.id))).toBeUndefined();
    });

    it('garde les partitions du catalogue ouvertes, pour le hors-ligne', async () => {
        await keepLibraryPiece(libraryPiece('a'));
        await new Promise((r) => setTimeout(r, 5));
        await keepLibraryPiece(libraryPiece('b'));
        expect((await listLibrary()).map((p) => p.id)).toEqual(['b', 'a']);
        expect((await getLibraryPiece('a'))?.xml).toBe('<score id="a"/>');
    });

    it('oublie les copies les plus anciennes, sauf celles des favoris', async () => {
        await keepLibraryPiece(libraryPiece('fav'));
        await setFavorite(
            { ...libraryPiece('fav'), source: 'catalogue' },
            true,
        );
        await saveAnnotations(pieceKey('catalogue', 'old'), {
            f: { k: 2 },
            auto: {},
        });
        await keepLibraryPiece(libraryPiece('old'));
        for (let i = 0; i < LIBRARY_MAX; i++) {
            await new Promise((r) => setTimeout(r, 1));
            await keepLibraryPiece(libraryPiece(`p${i}`));
        }
        const ids = (await listLibrary()).map((p) => p.id);
        expect(ids).toHaveLength(LIBRARY_MAX + 1);
        expect(ids).toContain('fav');
        expect(ids).not.toContain('old');
        // Les doigtés restent.
        expect(await getAnnotations(pieceKey('catalogue', 'old'))).toEqual({
            f: { k: 2 },
            auto: {},
        });
    });

    it('met en favori et retire, avec de quoi afficher la partition', async () => {
        const key = pieceKey('catalogue', 'a');
        expect(await isFavorite(key)).toBe(false);
        await setFavorite(
            { ...libraryPiece('a'), source: 'catalogue', label: 'x' } as never,
            true,
        );
        expect(await isFavorite(key)).toBe(true);
        const [saved] = await listFavorites();
        expect(saved).toMatchObject({
            piece: key,
            source: 'catalogue',
            id: 'a',
            title: 'Titre a',
            composer: 'Chopin',
            level: 'Facile',
            duration: 60,
        });
        // Seulement les champs utiles (ni XML, ni champs de la liste).
        expect(saved).not.toHaveProperty('xml');
        expect(saved).not.toHaveProperty('label');
        await setFavorite({ ...libraryPiece('a'), source: 'catalogue' }, false);
        expect(await listFavorites()).toEqual([]);
    });

    it('supprime le favori d’un import supprimé', async () => {
        const p = await addImport({ title: 'A', composer: '', xml: '<a/>' });
        await setFavorite({ ...p, source: 'import' }, true);
        await deleteImport(p.id);
        expect(await listFavorites()).toEqual([]);
    });

    it('garde les réglages de la suggestion par partition', async () => {
        const piece = pieceKey('import', 'x');
        expect(await getSettings(piece)).toEqual({
            hands: undefined,
            tempo: undefined,
        });
        await saveSettings(piece, { tempo: 72, hands: { '0|2': 0 } });
        expect(await getSettings(piece)).toEqual({
            tempo: 72,
            hands: { '0|2': 0 },
        });
    });
});
