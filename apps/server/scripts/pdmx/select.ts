import {
    type Attribution,
    type AuthorFields,
    COMPOSERS,
    attribute,
    fixMojibake,
    looksBroken,
    normalizeName,
} from './composers';

/**
 * Choix des lignes de `PDMX.csv` : piano seul, meilleure version de chaque
 * morceau. Pas de filtre sur les droits (projet personnel) : la licence
 * déclarée est gardée telle quelle, et `composers.ts` ne sert qu'à
 * reconnaître le compositeur.
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

const PIANO_NOTE =
    /\s*[([]+\s*(?:for\s+)?(?:solo\s+)?piano(?:\s+(?:solo|version|cover|arrangement|arr\.?))?\s*[)\]]+/gi;
const PIANO_END =
    /[\s\-–:|.,]*\b(?:(?:easy|facile)\s+)?piano\s+(?:solo|cover|version|arrangement|arr\.?|facile)\s*$/i;

/**
 * Titre sans les mentions « piano » qui n'apprennent rien dans une
 * bibliothèque de piano : « Over The Rainbow ((Piano)) », « Toad's Factory -
 * Piano Cover ». « Sonata for Piano » reste tel quel.
 */
export const tidyTitle = (title: string) => {
    const tidy = title
        .replace(PIANO_NOTE, '')
        .replace(PIANO_END, '')
        .replace(/\s+/g, ' ')
        .trim();
    return tidy || title.trim();
};

/**
 * Titre sans le compositeur collé devant ou derrière
 * (« Debussy Claude - La plus que lente », « Hosanna - J. B. Dykes »).
 */
export const cleanTitle = (raw: string, composer: string | null) => {
    const title = tidyTitle(raw);
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

/** Ce qui suit le nom de l'auteur dans un champ « compositeur » libre. */
const CREDITS =
    /\s*(?:[\n\r(/|]|\b(?:arranged|arr\.?|arrangement|transcribed|transcriber|transc\.?|performed|lyrics|words|orchestrated|piano (?:cover|arr))(?![a-z]))/i;
/** Ce qui le précède. */
const PREFIX =
    /^(?:composer|composed by|music(?: by)?|artist|by|orig\.|org\.?|original(?: composer)?)\s*[:-]?\s*/i;

/**
 * Nom de l'auteur, quand le compositeur n'est pas reconnu : le premier
 * champ qui en donne un, sans mention d'arrangement ni de transcription
 * (« Koji KondoArranged by… » → « Koji Kondo »).
 */
export const authorName = (...fields: (string | undefined)[]) => {
    for (const field of fields) {
        if (!field || looksBroken(field)) continue;
        const name = field
            // Mention collée au nom : « Koji KondoArranged », « Obataarr. ».
            .replace(
                /([a-z])(?=(?:Arranged|Arr\b|Arr[.:]|arr\.|Transcribed|transc\.|Performed))/g,
                '$1\n',
            )
            .split(CREDITS)[0]!
            .replace(PREFIX, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (name.length >= 2) return name.slice(0, 80);
    }
    return '';
};

/** Ligne retenue (avant lecture du XML), ou null. */
export const selectRow = (row: PdmxRow): Candidate | null => {
    const license = LICENSES[row.license];
    if (!license) return null;
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
