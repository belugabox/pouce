/** Types et petites fonctions partagés avec le client (`@server/types`). */

export type { ApiType } from './api';

/** Partition du catalogue, sans son contenu. */
export interface CatalogEntry {
    id: string;
    title: string;
    composer: string;
    level: string | null;
    tags: string;
    source: string;
    license: string;
}

/** Texte sans majuscules ni accents, pour comparer une recherche. */
export const normalizeSearch = (text: string | null | undefined) =>
    (text ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
