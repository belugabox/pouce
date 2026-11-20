import { type DBSchema, type IDBPDatabase, openDB } from 'idb';

import type { Annotations } from '@/core/fingering/suggest';

/** Source d'une partition : catalogue partagé ou import personnel. */
export type PieceSource = 'catalogue' | 'import';

/** Identifiant d'une partition, quelle que soit sa source. */
export const pieceKey = (source: PieceSource, id: string) => `${source}/${id}`;

/** Partition importée : elle reste dans ce navigateur. */
export interface ImportedPiece {
    id: string;
    title: string;
    composer: string;
    xml: string;
    addedAt: number;
}

interface SavedAnnotations extends Annotations {
    piece: string;
    updatedAt: number;
}

interface PouceDb extends DBSchema {
    imports: { key: string; value: ImportedPiece };
    annotations: { key: string; value: SavedAnnotations };
}

let opening: Promise<IDBPDatabase<PouceDb>> | null = null;

const db = () =>
    (opening ??= openDB<PouceDb>('pouce', 1, {
        upgrade(database) {
            database.createObjectStore('imports', { keyPath: 'id' });
            database.createObjectStore('annotations', { keyPath: 'piece' });
        },
    }));

/** Ferme la base (tests). */
export const closeDb = async () => {
    if (opening) (await opening).close();
    opening = null;
};

/** Partitions importées, la plus récente d'abord. */
export const listImports = async () =>
    (await (await db()).getAll('imports')).sort(
        (a, b) => b.addedAt - a.addedAt,
    );

export const getImport = async (id: string) => (await db()).get('imports', id);

export const addImport = async (
    piece: Omit<ImportedPiece, 'id' | 'addedAt'>,
): Promise<ImportedPiece> => {
    const saved = {
        ...piece,
        id: `imp-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        addedAt: Date.now(),
    };
    await (await db()).put('imports', saved);
    return saved;
};

/** Supprime une partition importée et ses doigtés. */
export const deleteImport = async (id: string) => {
    const tx = (await db()).transaction(
        ['imports', 'annotations'],
        'readwrite',
    );
    await Promise.all([
        tx.objectStore('imports').delete(id),
        tx.objectStore('annotations').delete(pieceKey('import', id)),
        tx.done,
    ]);
};

/** Doigtés notés sur une partition (undefined : jamais ouverte). */
export const getAnnotations = async (
    piece: string,
): Promise<Annotations | undefined> => {
    const saved = await (await db()).get('annotations', piece);
    return saved && { f: saved.f, auto: saved.auto };
};

export const saveAnnotations = async (piece: string, value: Annotations) => {
    await (
        await db()
    ).put('annotations', {
        piece,
        f: value.f,
        auto: value.auto,
        updatedAt: Date.now(),
    });
};

/** Nombre de doigtés notés, par partition. */
export const countAnnotations = async () => {
    const all = await (await db()).getAll('annotations');
    return new Map(all.map((a) => [a.piece, Object.keys(a.f).length]));
};
