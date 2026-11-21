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

/**
 * Partition mise en favori : de quoi l'afficher sur l'accueil (la partition
 * elle-même est dans `imports` ou, pour le hors-ligne, dans `library`).
 */
export interface FavoritePiece {
    /** `pieceKey` de la partition. */
    piece: string;
    source: PieceSource;
    id: string;
    title: string;
    composer: string;
    arranger?: string;
    level?: Level | null;
    duration?: number | null;
    addedAt: number;
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
    favorites: { key: string; value: FavoritePiece };
}

let opening: Promise<IDBPDatabase<PouceDb>> | null = null;

const db = () =>
    (opening ??= openDB<PouceDb>('pouce', 3, {
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
            if (oldVersion < 3) {
                database.createObjectStore('favorites', { keyPath: 'piece' });
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

/** Supprime une partition importée, ses doigtés, ses réglages et son favori. */
export const deleteImport = async (id: string) => {
    const key = pieceKey('import', id);
    const tx = (await db()).transaction(
        ['imports', 'annotations', 'settings', 'favorites'],
        'readwrite',
    );
    await Promise.all([
        tx.objectStore('imports').delete(id),
        tx.objectStore('annotations').delete(key),
        tx.objectStore('settings').delete(key),
        tx.objectStore('favorites').delete(key),
        tx.done,
    ]);
};

/** Copies gardées pour le hors-ligne, en plus de celles des favoris. */
export const LIBRARY_MAX = 50;

/**
 * Garde une partition du catalogue qu'on vient d'ouvrir (hors-ligne). Au-delà
 * de `LIBRARY_MAX`, les copies les plus anciennes sont oubliées, sauf celles
 * des favoris ; les doigtés, eux, restent.
 */
export const keepLibraryPiece = async (
    piece: Omit<LibraryPiece, 'openedAt'>,
) => {
    const database = await db();
    await database.put('library', { ...piece, openedAt: Date.now() });
    const favorites = new Set(await database.getAllKeys('favorites'));
    const old = (await listLibrary())
        .filter((p) => !favorites.has(pieceKey('catalogue', p.id)))
        .slice(LIBRARY_MAX);
    if (!old.length) return;
    const tx = database.transaction('library', 'readwrite');
    await Promise.all([...old.map((p) => tx.store.delete(p.id)), tx.done]);
};

export const getLibraryPiece = async (id: string) =>
    (await db()).get('library', id);

/** Partitions du catalogue ouvertes sur cet appareil, la plus récente d'abord. */
export const listLibrary = async () =>
    (await (await db()).getAll('library')).sort(
        (a, b) => b.openedAt - a.openedAt,
    );

/** Favoris, le plus récent d'abord. */
export const listFavorites = async () =>
    (await (await db()).getAll('favorites')).sort(
        (a, b) => b.addedAt - a.addedAt,
    );

export const isFavorite = async (piece: string) =>
    !!(await (await db()).getKey('favorites', piece));

/** Met une partition en favori, ou l'en retire. */
export const setFavorite = async (
    piece: Omit<FavoritePiece, 'piece' | 'addedAt'>,
    on: boolean,
) => {
    const key = pieceKey(piece.source, piece.id);
    if (on) {
        // Champs choisis : l'objet reçu peut en porter d'autres (ligne de liste).
        const { source, id, title, composer, arranger, level, duration } =
            piece;
        await (
            await db()
        ).put('favorites', {
            piece: key,
            source,
            id,
            title,
            composer,
            arranger,
            level,
            duration,
            addedAt: Date.now(),
        });
    } else {
        await (await db()).delete('favorites', key);
    }
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
