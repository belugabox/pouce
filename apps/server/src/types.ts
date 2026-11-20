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
}

/** Une page de résultats de recherche. */
export interface CatalogPage {
    total: number;
    items: CatalogEntry[];
    /** Nombre de résultats par niveau (avant le filtre de niveau). */
    levels: Record<Level, number>;
}

/** Motifs de signalement d'une partition du catalogue. */
export const REPORT_REASONS = {
    copyright: 'Problème de droits d’auteur',
    wrong: 'Partition fausse ou illisible',
    other: 'Autre',
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;

/** Texte sans majuscules ni accents, pour comparer une recherche. */
export const normalizeSearch = (text: string | null | undefined) =>
    (text ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
