import { eq, sql } from 'drizzle-orm';
import { gunzipSync, gzipSync } from 'node:zlib';

import type { Db } from '../db';
import { meta, scores } from '../db/schema';
import type { Genre, Level } from '../types';
import type { IndexedEntry } from './search';

/** MusicXML compressé pour la base. */
export const packXml = (xml: string) => gzipSync(Buffer.from(xml, 'utf-8'));

export const unpackXml = (content: Buffer) =>
    gunzipSync(content).toString('utf-8');

/** Colonnes de la liste (tout sauf le contenu). */
export const entryColumns = {
    id: scores.id,
    title: scores.title,
    composer: scores.composer,
    arranger: scores.arranger,
    level: scores.level,
    difficulty: scores.difficulty,
    tags: scores.tags,
    source: scores.source,
    license: scores.license,
    licenseUrl: scores.licenseUrl,
    sourceUrl: scores.sourceUrl,
    duration: scores.duration,
    measures: scores.measures,
    genre: scores.genre,
    popularity: scores.popularity,
};

/** Partitions visibles, dans l'ordre d'insertion, pour l'index de recherche. */
export const visibleEntries = (db: Db): IndexedEntry[] =>
    db
        .select(entryColumns)
        .from(scores)
        .where(eq(scores.hidden, false))
        .orderBy(sql`rowid`)
        .all()
        .map((row) => ({
            ...row,
            level: row.level as Level | null,
            genre: row.genre as Genre | null,
        }));

export const getMeta = (db: Db, key: string) =>
    db.select().from(meta).where(eq(meta.key, key)).get()?.value ?? null;

export const setMeta = (db: Db, key: string, value: string) =>
    db
        .insert(meta)
        .values({ key, value })
        .onConflictDoUpdate({ target: meta.key, set: { value } })
        .run();
