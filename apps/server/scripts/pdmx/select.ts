import {
    type Attribution,
    type AuthorFields,
    COMPOSERS,
    attribute,
    fixMojibake,
    normalizeName,
} from './composers';

/**
 * Choix des lignes de `PDMX.csv` : piano seul, licence CC-0 ou domaine
 * public sans conflit, meilleure version de chaque morceau, œuvre du
 * domaine public (`composers.ts`).
 */

/** Colonnes de `PDMX.csv` utilisées. */
export interface PdmxRow {
    mxl: string;
    metadata: string;
    license: string;
    license_url: string;
    license_conflict: string;
    tracks: string;
    is_best_unique_arrangement: string;
    'subset:all_valid': string;
    title: string;
    song_name: string;
    artist_name: string;
    composer_name: string;
    genres: string;
    tags: string;
    n_views: string;
    n_favorites: string;
    n_ratings: string;
    rating: string;
}

export interface Candidate {
    /** Chemin du `.mxl` dans l'archive (`mxl/1/11/….mxl`). */
    path: string;
    id: string;
    title: string;
    authors: AuthorFields;
    genres: string;
    attribution: Attribution | null;
    license: 'CC0' | 'Domaine public';
    licenseUrl: string | null;
    sourceUrl: string | null;
    popularity: number;
    tags: string;
}

const LICENSES: Record<string, Candidate['license']> = {
    'cc-zero': 'CC0',
    publicdomain: 'Domaine public',
};

const isTrue = (v: string | undefined) => v === 'True';
const text = (v: string | undefined) =>
    v && v !== 'NA' ? fixMojibake(v).trim() : '';

/** Popularité : vues, favoris et notes (échelle logarithmique). */
export const popularity = (
    row: Pick<PdmxRow, 'n_views' | 'n_favorites' | 'n_ratings' | 'rating'>,
) => {
    const views = Number(row.n_views) || 0;
    const favorites = Number(row.n_favorites) || 0;
    const ratings = Number(row.n_ratings) || 0;
    const rating = Number(row.rating) || 0;
    const score =
        Math.log10(1 + views) +
        2 * Math.log10(1 + favorites) +
        (ratings ? (rating - 3) * Math.min(1, ratings / 10) : 0);
    return Math.round(score * 1000) / 1000;
};

/**
 * Titre sans le compositeur collé devant ou derrière
 * (« Debussy Claude - La plus que lente », « Hosanna - J. B. Dykes »).
 */
export const cleanTitle = (title: string, composer: string | null) => {
    const parts = title.split(/\s+[-–]\s+/);
    if (parts.length < 2 || !composer) return title.trim();
    const entry = COMPOSERS.find((x) => x.name === composer);
    const aliases = [
        ...(entry?.aliases ?? []),
        ...normalizeName(composer).trim().split(' ').slice(-1),
    ];
    const isComposer = (part: string) => {
        const n = normalizeName(part);
        return (
            aliases.some((a) => n.includes(` ${a} `)) &&
            n.split(' ').length <= 8
        );
    };
    const kept = parts.filter((p) => !isComposer(p));
    return (kept.length ? kept.join(' - ') : title).trim();
};

/** Ligne retenue (avant lecture du XML), ou null. */
export const selectRow = (row: PdmxRow): Candidate | null => {
    const license = LICENSES[row.license];
    if (!license || isTrue(row.license_conflict)) return null;
    if (row.tracks !== '0') return null;
    if (!isTrue(row.is_best_unique_arrangement)) return null;
    if (!isTrue(row['subset:all_valid'])) return null;
    const scoreId = /\/(\d+)\.json$/.exec(row.metadata)?.[1];
    if (!scoreId) return null;

    const title = text(row.title) || text(row.song_name);
    if (!title) return null;
    const authors = {
        composer: text(row.composer_name),
        artist: text(row.artist_name),
    };
    const genres = text(row.genres);
    const tags = [row.genres, row.tags]
        .map(text)
        .filter(Boolean)
        .join(' ')
        .replace(/[-_]+/g, ' ')
        .slice(0, 300);
    return {
        path: row.mxl.replace(/^\.\//, ''),
        id: `pdmx-${scoreId}`,
        title,
        authors,
        genres,
        attribution: attribute(authors, title, genres),
        license,
        licenseUrl: text(row.license_url) || null,
        sourceUrl: `https://musescore.com/score/${scoreId}`,
        popularity: popularity(row),
        tags,
    };
};
