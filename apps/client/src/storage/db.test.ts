import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    addImport,
    closeDb,
    countAnnotations,
    deleteImport,
    getAnnotations,
    getImport,
    listImports,
    pieceKey,
    saveAnnotations,
} from './db';

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
});
