import {
    type CatalogEntry,
    type CatalogPage,
    LEVELS,
    type Level,
    type Sort,
    normalizeSearch,
} from '../types';

/**
 * Recherche dans le catalogue, en mémoire : quelques dizaines de milliers de
 * partitions au plus, cherchées en quelques millisecondes. Insensible aux
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
};

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
        .replace(/[^a-z0-9]+/g, ' ')
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
    words: string[];
    weight: number;
}

interface Doc {
    entry: IndexedEntry;
    fields: Field[];
    /** Popularité ramenée entre 0 et 1. */
    pop: number;
    order: number;
}

export interface SearchParams {
    q?: string;
    level?: Level;
    sort?: Sort;
    offset?: number;
    limit?: number;
}

const emptyLevels = () =>
    Object.fromEntries(LEVELS.map((l) => [l, 0])) as Record<Level, number>;

const collator = new Intl.Collator('fr', { sensitivity: 'base' });

export class CatalogIndex {
    private docs: Doc[] = [];

    constructor(entries: IndexedEntry[] = []) {
        this.load(entries);
    }

    get size() {
        return this.docs.length;
    }

    /** Remplace tout le contenu de l'index. */
    load(entries: IndexedEntry[]) {
        const max = Math.max(1, ...entries.map((e) => e.popularity ?? 0));
        this.docs = entries.map((entry, order) => ({
            entry,
            order,
            // Catalogue intégré (sans popularité) : choisi, mis en avant.
            pop:
                entry.popularity === null
                    ? 1.01
                    : Math.max(0, entry.popularity) / max,
            fields: [
                { words: tokenize(entry.title), weight: 1 },
                { words: tokenize(entry.composer), weight: 0.95 },
                { words: tokenize(entry.tags), weight: 0.7 },
                { words: tokenize(entry.arranger), weight: 0.4 },
            ],
        }));
    }

    /** Pertinence d'une partition (null : ne correspond pas). */
    private score(doc: Doc, words: string[][]): number | null {
        let total = 0;
        let missed = 0;
        let required = 0;
        for (const variants of words) {
            const stop = STOP_WORDS.has(variants[0]!);
            if (!stop) required++;
            let best = 0;
            for (const field of doc.fields) {
                for (const word of field.words) {
                    for (const [i, v] of variants.entries()) {
                        // Un synonyme compte un peu moins que le mot tapé.
                        const s = wordScore(v, word) * (i ? 0.9 : 1);
                        if (s * field.weight > best) best = s * field.weight;
                    }
                }
            }
            if (best === 0 && !stop) missed++;
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
        sort,
        offset = 0,
        limit = 30,
    }: SearchParams): CatalogPage {
        let text = normalizeSearch(q);
        for (const [re, by] of PHRASES) text = text.replace(re, by);
        const words = tokenize(text).map((w) => [w, ...(SYNONYMS[w] ?? [])]);

        let scored: { doc: Doc; score: number }[] = [];
        for (const doc of this.docs) {
            const score = words.length ? this.score(doc, words) : 0;
            if (score !== null) scored.push({ doc, score });
        }
        // Une très bonne correspondance écarte les approximations lointaines
        // (« frere » : Frère Jacques, pas Frédéric Chopin).
        const top = Math.max(0, ...scored.map((h) => h.score));
        if (top >= 0.9) scored = scored.filter((h) => h.score >= top * 0.7);

        const levels = emptyLevels();
        const hits: { doc: Doc; score: number }[] = [];
        for (const hit of scored) {
            const entryLevel = hit.doc.entry.level;
            if (entryLevel) levels[entryLevel]++;
            if (level && entryLevel !== level) continue;
            hits.push(hit);
        }

        const by = sort ?? (words.length ? 'relevance' : 'popular');
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

        return {
            total: hits.length,
            levels,
            items: hits
                .slice(offset, offset + limit)
                .map(({ doc }) => publicEntry(doc.entry)),
        };
    }
}

/** Partition telle que l'API la renvoie (sans la popularité). */
export const publicEntry = ({
    popularity: _,
    ...entry
}: IndexedEntry): CatalogEntry => entry;
