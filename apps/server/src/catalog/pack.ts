import { and, eq, inArray } from 'drizzle-orm';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { createGunzip } from 'node:zlib';
import { z } from 'zod';

import type { Db } from '../db';
import { scores } from '../db/schema';
import type { Logger } from '../tools/logger';
import { GENRES, LEVELS } from '../types';
import { getMeta, setMeta } from './store';

/**
 * Paquet de partitions PDMX (`pdmx.jsonl.gz`, fabriqué par
 * `scripts/pdmx/build.ts`) : une partition JSON par ligne, XML compressé en
 * base64. Chargé au démarrage quand le fichier a changé.
 */

/** Licences déclarées dans PDMX pour le piano (non vérifiées). */
export const ALLOWED_LICENSES = ['CC0', 'Domaine public'] as const;

export const packEntrySchema = z.object({
    id: z.string().regex(/^pdmx-[\w-]+$/),
    title: z.string().min(1),
    composer: z.string(),
    arranger: z.string(),
    level: z.enum(LEVELS).nullable(),
    difficulty: z.number().nullable(),
    tags: z.string(),
    license: z.enum(ALLOWED_LICENSES),
    licenseUrl: z.string().url().nullable(),
    sourceUrl: z.string().url().nullable(),
    popularity: z.number().nullable(),
    duration: z.number().nullable(),
    measures: z.number().int().nullable(),
    // Genre inconnu (paquet d'une version précédente) : sans genre.
    genre: z.enum(GENRES).nullable().default(null).catch(null),
    /** MusicXML compressé (gzip), en base64. */
    xmlGz: z.string().min(1),
});
export type PackEntry = z.infer<typeof packEntrySchema>;

const META_KEY = 'pdmx-pack';
const BATCH = 500;

const signature = (file: string) => {
    const { size, mtimeMs } = statSync(file);
    return `${size}-${Math.round(mtimeMs)}`;
};

/**
 * Charge le paquet s'il a changé depuis le dernier chargement. Les
 * partitions retirées du catalogue (signalements) le restent.
 * Renvoie le nombre de partitions chargées (null : rien à faire).
 */
export const loadPack = async (
    db: Db,
    file: string,
    logger: Logger,
): Promise<number | null> => {
    if (!existsSync(file)) return null;
    const sig = signature(file);
    if (getMeta(db, META_KEY) === sig) return null;

    logger.info(`Chargement du paquet PDMX : ${file}`);
    const hidden = db
        .select({ id: scores.id })
        .from(scores)
        .where(and(eq(scores.source, 'pdmx'), eq(scores.hidden, true)))
        .all()
        .map((r) => r.id);
    db.delete(scores).where(eq(scores.source, 'pdmx')).run();

    let count = 0;
    let rejected = 0;
    let batch: (typeof scores.$inferInsert)[] = [];
    const flush = () => {
        const rows = batch;
        batch = [];
        db.transaction((tx) => {
            for (const row of rows) {
                tx.insert(scores)
                    .values(row)
                    .onConflictDoNothing({ target: scores.id })
                    .run();
            }
        });
    };

    const lines = createInterface({
        input: createReadStream(file).pipe(createGunzip()),
        crlfDelay: Infinity,
    });
    for await (const line of lines) {
        if (!line.trim()) continue;
        const parsed = packEntrySchema.safeParse(JSON.parse(line));
        if (!parsed.success) {
            rejected++;
            continue;
        }
        const { xmlGz, ...entry } = parsed.data;
        batch.push({
            ...entry,
            source: 'pdmx',
            content: Buffer.from(xmlGz, 'base64'),
        });
        count++;
        if (batch.length >= BATCH) flush();
    }
    flush();

    if (hidden.length) {
        db.update(scores)
            .set({ hidden: true })
            .where(inArray(scores.id, hidden))
            .run();
    }
    setMeta(db, META_KEY, sig);
    if (rejected) logger.warn(`Paquet PDMX : ${rejected} lignes refusées`);
    return count;
};
