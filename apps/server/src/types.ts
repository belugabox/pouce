/** Types et petites fonctions partagés avec le client (`@server/types`). */

export type { ApiType } from './api';

/** Niveaux du catalogue, du plus facile au plus difficile. */
export const LEVELS = [
    'Débutant',
    'Facile',
    'Intermédiaire',
    'Avancé',
] as const;
export type Level = (typeof LEVELS)[number];

/** Genres du catalogue (d'après PDMX, sinon d'après le compositeur). */
export const GENRES = [
    'Classique',
    'Films et séries',
    'Jeux vidéo',
    'Pop et rock',
    'Jazz',
    'Traditionnel',
    'Religieux',
    'Autres',
] as const;
export type Genre = (typeof GENRES)[number];

/** Tris proposés par la recherche. */
export const SORTS = ['relevance', 'popular', 'easy', 'title'] as const;
export type Sort = (typeof SORTS)[number];

/** Partition du catalogue, sans son contenu. */
export interface CatalogEntry {
    id: string;
    title: string;
    composer: string;
    arranger: string;
    level: Level | null;
    /** De 0 (très facile) à 10. */
    difficulty: number | null;
    tags: string;
    source: string;
    license: string;
    licenseUrl: string | null;
    sourceUrl: string | null;
    /** En secondes. */
    duration: number | null;
    measures: number | null;
    genre: Genre | null;
}

/** Un résultat : une partition, représentant toutes les versions du morceau. */
export interface CatalogHit extends CatalogEntry {
    /** Clé du morceau (`group` de la recherche, pour lister ses versions). */
    group: string;
    /** Nombre de versions du morceau qui correspondent à la recherche. */
    versions: number;
}

/** Une page de résultats de recherche (un résultat par morceau). */
export interface CatalogPage {
    total: number;
    items: CatalogHit[];
    /** Morceaux par niveau (avant le filtre de niveau, après celui de genre). */
    levels: Record<Level, number>;
    /** Morceaux par genre (avant le filtre de genre, après celui de niveau). */
    genres: Record<Genre, number>;
}

/** Motifs de signalement d'une partition du catalogue. */
export const REPORT_REASONS = {
    wrong: 'Partition fausse ou illisible',
    other: 'Autre',
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;

/** Texte sans majuscules ni accents, pour comparer une recherche. */
export const normalizeSearch = (text: string | null | undefined) =>
    (text ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        // Lettres que la d\u00e9composition ne simplifie pas (\u00ab S\u0142awecki \u00bb, \u00ab c\u0153ur \u00bb).
        .replace(/\u0142/g, 'l')
        .replace(/\u00f8/g, 'o')
        .replace(/\u0111/g, 'd')
        .replace(/\u00e6/g, 'ae')
        .replace(/\u0153/g, 'oe')
        .replace(/\u00df/g, 'ss');
