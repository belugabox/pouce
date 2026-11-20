import { estimateDifficulty } from '../../../client/src/core/difficulty';
import { indexScore, kids } from '../../../client/src/core/musicxml';
import { parseXmlDocument } from './musicxml';

/**
 * Lecture d'une partition PDMX : piano à deux portées seulement, paroles
 * retirées (leurs auteurs peuvent être protégés, et le moteur n'en a pas
 * besoin), difficulté estimée par le moteur du client.
 */

export interface Analysis {
    xml: string;
    /** Titre et compositeur écrits dans le MusicXML. */
    workTitle: string;
    creator: string;
    arranger: string;
    difficulty: number;
    level: ReturnType<typeof estimateDifficulty>['level'];
    duration: number;
    measures: number;
    notes: number;
}

export type Rejection =
    'illisible' | 'pas-piano' | 'trop-court' | 'trop-long' | 'timewise';

/** Au moins 4 mesures, au plus 1 500 (les très longues partitions sont lourdes). */
const MIN_NOTES = 24;
const MAX_MEASURES = 1500;

/** Sans paroles (`<lyric>`), ni droits d'auteur écrits (`<rights>`). */
export const stripXml = (xml: string) =>
    xml
        .replace(/<lyric\b[^>]*\/>/g, '')
        .replace(/<lyric\b[\s\S]*?<\/lyric>/g, '')
        .replace(/<rights\b[\s\S]*?<\/rights>/g, '');

/** Compositeur et titre écrits dans le XML, sans DOM (lecture rapide). */
export const quickMeta = (xml: string) => {
    const head = xml.slice(0, 20_000);
    const pick = (re: RegExp) =>
        (re.exec(head)?.[1] ?? '')
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&apos;/g, '’')
            .replace(/&quot;/g, '"')
            .trim();
    return {
        creator: pick(
            /<creator\b[^>]*type="composer"[^>]*>([\s\S]*?)<\/creator>/,
        ),
        workTitle:
            pick(/<work-title>([\s\S]*?)<\/work-title>/) ||
            pick(/<movement-title>([\s\S]*?)<\/movement-title>/),
        arranger: pick(
            /<creator\b[^>]*type="arranger"[^>]*>([\s\S]*?)<\/creator>/,
        ),
    };
};

export const analyze = (raw: string): Analysis | Rejection => {
    if (/<score-timewise\b/.test(raw.slice(0, 5000))) return 'timewise';
    const xml = stripXml(raw);
    let doc: Document;
    try {
        doc = parseXmlDocument(xml);
    } catch {
        return 'illisible';
    }
    if (doc.documentElement?.localName !== 'score-partwise') return 'illisible';
    const parts = kids(doc.documentElement, 'part');
    if (parts.length !== 1) return 'pas-piano';
    const staves = new Set(
        Array.from(parts[0]!.querySelectorAll('attributes > staves')).map((s) =>
            s.textContent?.trim(),
        ),
    );
    if (staves.size !== 1 || !staves.has('2')) return 'pas-piano';

    const index = indexScore(doc);
    if (index.notes.length < MIN_NOTES) return 'trop-court';
    // Les deux mains jouent (sinon : mélodie sur une portée, l'autre vide).
    const lh = index.notes.filter((n) => n.staff === 2).length;
    if (lh < index.notes.length * 0.1) return 'pas-piano';
    const { score, level, features } = estimateDifficulty(index);
    if (features.measures > MAX_MEASURES) return 'trop-long';
    const meta = quickMeta(xml);
    return {
        xml,
        ...meta,
        difficulty: score,
        level,
        duration: Math.round(features.duration),
        measures: features.measures,
        notes: index.notes.length,
    };
};
