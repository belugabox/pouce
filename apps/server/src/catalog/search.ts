import {
    type CatalogEntry,
    type CatalogHit,
    type CatalogPage,
    GENRES,
    type Genre,
    LEVELS,
    type Level,
    type Sort,
    normalizeSearch,
} from '../types';

/**
 * Recherche dans le catalogue, en mémoire : quelques dizaines de milliers de
 * partitions, cherchées en quelques dizaines de millisecondes. Insensible aux
 * accents et aux majuscules, tolérante aux fautes de frappe, avec quelques
 * équivalences français / anglais (valse → waltz…).
 */

export interface IndexedEntry extends CatalogEntry {
    popularity: number | null;
}

/** Mots ignorés s'ils ne se trouvent pas (articles, prépositions). */
const STOP_WORDS = new Set(
    'a au aux de des du d en et l la le les pour sur un une the of in and for to by from'.split(
        ' ',
    ),
);

/** Équivalences d'un mot de la recherche (titres souvent en anglais). */
const SYNONYMS: Record<string, string[]> = {
    valse: ['waltz', 'walzer', 'vals'],
    waltz: ['valse', 'walzer'],
    sonate: ['sonata', 'sonatina', 'sonatine'],
    sonatine: ['sonatina'],
    marche: ['march', 'marsch', 'marcia'],
    menuet: ['minuet', 'minuetto', 'menuett'],
    minuet: ['menuet', 'menuett'],
    berceuse: ['lullaby', 'wiegenlied', 'cradle'],
    fugue: ['fuga', 'fuge'],
    chanson: ['song', 'lied'],
    noel: ['christmas', 'carol'],
    etude: ['study', 'etudes'],
    prelude: ['preludio', 'praeludium'],
    nocturne: ['notturno'],
    romance: ['romanze'],
    danse: ['dance', 'tanz', 'danza'],
    hongroise: ['hungarian'],
    turque: ['turkish', 'turca', 'turk'],
    printemps: ['spring'],
    hiver: ['winter'],
    ete: ['summer'],
    automne: ['autumn'],
    lune: ['moon', 'moonlight'],
    clair: ['moonlight'],
    gymnopedie: ['gymnopedies'],
    canon: ['kanon'],
    rhapsodie: ['rhapsody'],
    impromptu: ['impromptus'],
    pathetique: ['pathetic'],
    traditionnel: ['traditional', 'trad'],
    facile: ['easy', 'simple', 'simplified', 'beginner'],
    debutant: ['beginner', 'easy', 'simple'],
    easy: ['facile', 'simple', 'simplified'],
    beginner: ['debutant', 'easy'],
    intermediaire: ['intermediate'],
    avance: ['advanced'],
    difficile: ['advanced', 'hard', 'difficult'],
};

/**
 * Mots qui désignent un niveau : facultatifs, ils favorisent les partitions
 * de ce niveau (« valse facile » : les valses faciles, sinon toutes).
 */
const LEVEL_WORDS: Record<string, Level[]> = {
    facile: ['Débutant', 'Facile'],
    easy: ['Débutant', 'Facile'],
    simple: ['Débutant', 'Facile'],
    debutant: ['Débutant'],
    beginner: ['Débutant'],
    intermediaire: ['Intermédiaire'],
    intermediate: ['Intermédiaire'],
    avance: ['Avancé'],
    advanced: ['Avancé'],
    difficile: ['Avancé'],
    hard: ['Avancé'],
};

/**
 * Mots qui distinguent les versions d'un même morceau sans en changer
 * l'œuvre (« Für Elise (Easy Piano Version) » = « Für Elise »).
 */
const VERSION_WORDS = new Set(
    'easy easier very super simple simplified beginner beginners facile tres debutant intermediate intermediaire advanced avance hard difficult difficile piano solo version ver cover arrangement arr arranged for pour short full tutorial sheet music my of the a'.split(
        ' ',
    ),
);

/**
 * Clé d'un morceau : titre sans mots de version ni nom du compositeur, et
 * nom de famille du compositeur. Sans compositeur, pas de regroupement
 * (« Waltz » d'auteurs inconnus).
 */
export const workKey = (
    entry: Pick<CatalogEntry, 'id' | 'title' | 'composer'>,
) => {
    const composer = tokenize(entry.composer).filter(
        (w) => !VERSION_WORDS.has(w),
    );
    const name = new Set(composer);
    const title = tokenize(entry.title).filter(
        (w) => !VERSION_WORDS.has(w) && !name.has(w),
    );
    if (!composer.length || !title.length) return entry.id;
    return `${title.join(' ')}|${composer.at(-1)}`;
};

/** Un mot cherché, avec ses équivalences. */
interface QueryWord {
    variants: string[];
    /** Facultatif : petit mot ou niveau. */
    optional: boolean;
    levels?: Level[];
}

/** Expressions françaises traduites avant la recherche. */
const PHRASES: [RegExp, string][] = [
    [/\blettre a elise\b/g, 'fur elise'],
    [/\bclair de lune\b/g, 'clair de lune'],
    [/\bmarche turque\b/g, 'rondo alla turca'],
    [/\ble beau danube bleu\b/g, 'blue danube'],
    [/\bsonate au clair de lune\b/g, 'moonlight sonata'],
];

/** Mots d'un texte, sans accents ni ponctuation. */
export const tokenize = (text: string) =>
    normalizeSearch(text)
        // Toutes les écritures (titres japonais, coréens…), pas seulement le latin.
        .replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ')
        .trim()
        .split(' ')
        .filter(Boolean);

/** Distance d'édition (Damerau-Levenshtein restreinte), arrêtée à `max`. */
export const editDistance = (a: string, b: string, max: number): number => {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev2: number[] = [];
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
        const cur = [i];
        let rowMin = i;
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            let d = Math.min(
                prev[j]! + 1,
                cur[j - 1]! + 1,
                prev[j - 1]! + cost,
            );
            if (
                i > 1 &&
                j > 1 &&
                a[i - 1] === b[j - 2] &&
                a[i - 2] === b[j - 1]
            ) {
                d = Math.min(d, prev2[j - 2]! + 1);
            }
            cur.push(d);
            rowMin = Math.min(rowMin, d);
        }
        if (rowMin > max) return max + 1;
        prev2 = prev;
        prev = cur;
    }
    return prev[b.length]!;
};

/** Fautes tolérées selon la longueur du mot cherché. */
const tolerance = (word: string) =>
    /^\d+$/.test(word) ? 0 : word.length >= 7 ? 2 : word.length >= 4 ? 1 : 0;

/** Ressemblance d'un mot cherché avec un mot du texte (0 à 1). */
export const wordScore = (query: string, word: string): number => {
    if (word === query) return 1;
    if (word.startsWith(query)) {
        // Mot en cours de frappe ; les nombres doivent être complets.
        return /^\d+$/.test(query) ? 0 : query.length >= 2 ? 0.85 : 0.5;
    }
    const max = tolerance(query);
    if (!max) return 0;
    if (query.length >= 4 && word.includes(query)) return 0.6;
    const d = editDistance(query, word, max);
    if (d <= max) return 0.75 - 0.1 * d;
    // Faute dans un mot en cours de frappe : « beethov » → « beethoven ».
    if (query.length >= 6 && word.length > query.length) {
        const p = editDistance(query, word.slice(0, query.length), max);
        if (p <= max) return 0.6 - 0.1 * p;
    }
    return 0;
};

interface Field {
    /** Mots du champ, par leur numéro dans le vocabulaire de l'index. */
    words: Int32Array;
    weight: number;
}

interface Doc {
    entry: IndexedEntry;
    fields: Field[];
    /** Popularité ramenée entre 0 et 1. */
    pop: number;
    order: number;
    /** Morceau (`workKey`) : ses versions sont regroupées. */
    group: string;
}

export interface SearchParams {
    q?: string;
    level?: Level;
    genre?: Genre;
    /** Toutes les versions d'un morceau, sans regroupement. */
    group?: string;
    sort?: Sort;
    offset?: number;
    limit?: number;
}

const counts = <K extends string>(keys: readonly K[]) =>
    Object.fromEntries(keys.map((k) => [k, new Set<string>()])) as Record<
        K,
        Set<string>
    >;
const sizes = <K extends string>(sets: Record<K, Set<string>>) =>
    Object.fromEntries(
        Object.entries<Set<string>>(sets).map(([k, v]) => [k, v.size]),
    ) as Record<K, number>;

const collator = new Intl.Collator('fr', { sensitivity: 'base' });

export class CatalogIndex {
    private docs: Doc[] = [];
    /** Mots distincts du catalogue : la ressemblance se calcule une fois par mot. */
    private vocabulary: string[] = [];

    constructor(entries: IndexedEntry[] = []) {
        this.load(entries);
    }

    get size() {
        return this.docs.length;
    }

    /** Remplace tout le contenu de l'index. */
    load(entries: IndexedEntry[]) {
        const known = entries
            .map((e) => e.popularity)
            .filter((p): p is number => p !== null)
            .sort((a, b) => a - b);
        const max = Math.max(1, known.at(-1) ?? 0);
        // Catalogue intégré (sans popularité) : des morceaux très connus,
        // classés parmi le quart le plus populaire.
        const builtIn = known.length
            ? known[Math.floor((known.length - 1) * 0.75)]! / max
            : 0.5;
        const ids = new Map<string, number>();
        const field = (text: string, weight: number): Field => ({
            weight,
            words: Int32Array.from(tokenize(text), (w) => {
                let id = ids.get(w);
                if (id === undefined) {
                    id = ids.size;
                    ids.set(w, id);
                }
                return id;
            }),
        });
        this.docs = entries.map((entry, order) => ({
            entry,
            order,
            group: workKey(entry),
            pop:
                entry.popularity === null
                    ? builtIn
                    : Math.max(0, entry.popularity) / max,
            fields: [
                field(entry.title, 1),
                field(entry.composer, 0.95),
                field(entry.tags, 0.7),
                field(entry.arranger, 0.4),
            ],
        }));
        this.vocabulary = [...ids.keys()];
    }

    /**
     * Ressemblance de chaque mot du vocabulaire avec chaque variante des
     * mots cherchés (un synonyme compte un peu moins que le mot tapé).
     */
    private match(words: QueryWord[]): Float32Array[][] {
        return words.map(({ variants }) =>
            variants.map((v, i) =>
                Float32Array.from(
                    this.vocabulary,
                    (w) => wordScore(v, w) * (i ? 0.9 : 1),
                ),
            ),
        );
    }

    /** Pertinence d'une partition (null : ne correspond pas). */
    private score(
        doc: Doc,
        words: QueryWord[],
        tables: Float32Array[][],
    ): number | null {
        let total = 0;
        let missed = 0;
        let required = 0;
        for (const [k, { optional, levels }] of words.entries()) {
            if (!optional) required++;
            const level = doc.entry.level;
            let best = level && levels?.includes(level) ? 1 : 0;
            for (const table of tables[k]!) {
                for (const field of doc.fields) {
                    for (const word of field.words) {
                        const s = table[word]! * field.weight;
                        if (s > best) best = s;
                    }
                }
            }
            if (best === 0 && !optional) missed++;
            total += best;
        }
        // Une recherche longue peut avoir un mot qui ne se trouve pas.
        const allowed = required >= 3 ? 1 : 0;
        if (missed > allowed || (required > 0 && total === 0)) return null;
        return total / Math.max(1, words.length) - missed * 0.3;
    }

    search({
        q = '',
        level,
        genre,
        group,
        sort,
        offset = 0,
        limit = 30,
    }: SearchParams): CatalogPage {
        let text = normalizeSearch(q);
        for (const [re, by] of PHRASES) text = text.replace(re, by);
        const words = tokenize(text).map((w): QueryWord => ({
            variants: [w, ...(SYNONYMS[w] ?? [])],
            optional: STOP_WORDS.has(w) || w in LEVEL_WORDS,
            levels: LEVEL_WORDS[w],
        }));

        const tables = this.match(words);
        let scored: { doc: Doc; score: number }[] = [];
        for (const doc of this.docs) {
            const score = words.length ? this.score(doc, words, tables) : 0;
            if (score !== null) scored.push({ doc, score });
        }
        // Une très bonne correspondance écarte les approximations lointaines
        // (« frere » : Frère Jacques, pas Frédéric Chopin).
        const top = scored.reduce((m, h) => Math.max(m, h.score), 0);
        if (top >= 0.9) scored = scored.filter((h) => h.score >= top * 0.7);

        if (group) scored = scored.filter((h) => h.doc.group === group);

        // Facettes : morceaux par niveau (filtre de genre appliqué) et par
        // genre (filtre de niveau appliqué).
        const levels = counts(LEVELS);
        const genres = counts(GENRES);
        let hits: { doc: Doc; score: number }[] = [];
        for (const hit of scored) {
            const { entry, group: key } = hit.doc;
            const levelOk = !level || entry.level === level;
            const genreOk = !genre || (entry.genre ?? 'Autres') === genre;
            if (genreOk && entry.level) levels[entry.level].add(key);
            if (levelOk) genres[entry.genre ?? 'Autres'].add(key);
            if (levelOk && genreOk) hits.push(hit);
        }

        const by =
            sort ?? (group ? 'easy' : words.length ? 'relevance' : 'popular');
        const popular = (a: Doc, b: Doc) => b.pop - a.pop || a.order - b.order;
        hits.sort((a, b) => {
            switch (by) {
                case 'relevance':
                    return (
                        b.score +
                            0.25 * b.doc.pop -
                            (a.score + 0.25 * a.doc.pop) ||
                        popular(a.doc, b.doc)
                    );
                case 'easy':
                    return (
                        (a.doc.entry.difficulty ?? 5) -
                            (b.doc.entry.difficulty ?? 5) ||
                        popular(a.doc, b.doc)
                    );
                case 'title':
                    return collator.compare(
                        a.doc.entry.title,
                        b.doc.entry.title,
                    );
                default:
                    return popular(a.doc, b.doc);
            }
        });

        // Une ligne par morceau : la version la mieux classée, et le nombre
        // de versions (toutes listées quand on demande le morceau).
        const versions = new Map<string, number>();
        for (const { doc } of hits) {
            versions.set(doc.group, (versions.get(doc.group) ?? 0) + 1);
        }
        if (!group) {
            const seen = new Set<string>();
            hits = hits.filter(({ doc }) => {
                if (seen.has(doc.group)) return false;
                seen.add(doc.group);
                return true;
            });
        }

        return {
            total: hits.length,
            levels: sizes(levels),
            genres: sizes(genres),
            items: hits
                .slice(offset, offset + limit)
                .map(({ doc }): CatalogHit => ({
                    ...publicEntry(doc.entry),
                    group: doc.group,
                    versions: versions.get(doc.group) ?? 1,
                })),
        };
    }
}

/** Partition telle que l'API la renvoie (sans la popularité). */
export const publicEntry = ({
    popularity: _,
    ...entry
}: IndexedEntry): CatalogEntry => entry;
