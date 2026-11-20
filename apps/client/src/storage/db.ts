import { type DBSchema, type IDBPDatabase, openDB } from 'idb';

import type { CatalogEntry } from '@server/types';

import type { Level } from '@/core/difficulty';
import type { HandMap } from '@/core/fingering/hands';
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
    level?: Level | null;
    difficulty?: number | null;
}

/** Partition du catalogue déjà ouverte : gardée pour le hors-ligne. */
export interface LibraryPiece extends CatalogEntry {
    xml: string;
    openedAt: number;
}

/** Réglages de la suggestion pour une partition. */
export interface PieceSettings {
    /** Main de chaque portée (`partie|portée`). */
    hands?: HandMap;
    /** Tempo de jeu choisi (noires par minute). */
    tempo?: number;
}

interface SavedAnnotations extends Annotations {
    piece: string;
    updatedAt: number;
}

interface PouceDb extends DBSchema {
    imports: { key: string; value: ImportedPiece };
    annotations: { key: string; value: SavedAnnotations };
    library: { key: string; value: LibraryPiece };
    settings: { key: string; value: PieceSettings & { piece: string } };
}

let opening: Promise<IDBPDatabase<PouceDb>> | null = null;

const db = () =>
    (opening ??= openDB<PouceDb>('pouce', 2, {
        upgrade(database, oldVersion) {
            if (oldVersion < 1) {
                database.createObjectStore('imports', { keyPath: 'id' });
                database.createObjectStore('annotations', {
                    keyPath: 'piece',
                });
            }
            if (oldVersion < 2) {
                database.createObjectStore('library', { keyPath: 'id' });
                database.createObjectStore('settings', { keyPath: 'piece' });
            }
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

/** Supprime une partition importée, ses doigtés et ses réglages. */
export const deleteImport = async (id: string) => {
    const key = pieceKey('import', id);
    const tx = (await db()).transaction(
        ['imports', 'annotations', 'settings'],
        'readwrite',
    );
    await Promise.all([
        tx.objectStore('imports').delete(id),
        tx.objectStore('annotations').delete(key),
        tx.objectStore('settings').delete(key),
        tx.done,
    ]);
};

/** Garde une partition du catalogue qu'on vient d'ouvrir. */
export const keepLibraryPiece = async (piece: Omit<LibraryPiece, 'openedAt'>) =>
    (await db()).put('library', { ...piece, openedAt: Date.now() });

export const getLibraryPiece = async (id: string) =>
    (await db()).get('library', id);

/** Partitions du catalogue ouvertes sur cet appareil, la plus récente d'abord. */
export const listLibrary = async () =>
    (await (await db()).getAll('library')).sort(
        (a, b) => b.openedAt - a.openedAt,
    );

/** Oublie une partition du catalogue (et ses doigtés) sur cet appareil. */
export const forgetLibraryPiece = async (id: string) => {
    const key = pieceKey('catalogue', id);
    const tx = (await db()).transaction(
        ['library', 'annotations', 'settings'],
        'readwrite',
    );
    await Promise.all([
        tx.objectStore('library').delete(id),
        tx.objectStore('annotations').delete(key),
        tx.objectStore('settings').delete(key),
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

export const getSettings = async (piece: string): Promise<PieceSettings> => {
    const saved = await (await db()).get('settings', piece);
    return { hands: saved?.hands, tempo: saved?.tempo };
};

export const saveSettings = async (piece: string, value: PieceSettings) => {
    await (await db()).put('settings', { ...value, piece });
};
