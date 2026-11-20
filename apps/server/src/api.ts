import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { type Context, Hono } from 'hono';
import { compress } from 'hono/compress';
import { z } from 'zod';

import { CatalogIndex } from './catalog/search';
import { entryColumns, unpackXml, visibleEntries } from './catalog/store';
import type { Db } from './db';
import { reports, scores } from './db/schema';
import type { Logger } from './tools/logger';
import {
    type CatalogEntry,
    LEVELS,
    type Level,
    REPORT_REASONS,
    type ReportReason,
    SORTS,
} from './types';

export interface ApiDeps {
    db: Db;
    logger: Logger;
    version: string;
    /** Adresse du client, pour limiter les signalements (absente en test). */
    clientIp?: (c: Context) => string | undefined;
}

/** Signalements par adresse : au plus `MAX` par période. */
const REPORT_WINDOW = 60 * 60 * 1000;
const REPORT_MAX = 10;

const searchQuery = z.object({
    q: z.string().max(200).optional(),
    level: z.enum(LEVELS).optional(),
    sort: z.enum(SORTS).optional(),
    offset: z.coerce.number().int().min(0).max(100_000).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
});

const reportBody = z.object({
    reason: z.enum(
        Object.keys(REPORT_REASONS) as [ReportReason, ...ReportReason[]],
    ),
    message: z.string().trim().max(1000).optional(),
});

/** API de Pouce (`/api`) : catalogue en lecture seule et signalements. */
export const createApi = ({ db, logger, version, clientIp }: ApiDeps) => {
    const index = new CatalogIndex(visibleEntries(db));
    const recent = new Map<string, number[]>();

    return new Hono()
        .use(compress())
        .onError((err, c) => {
            logger.error(err, `${c.req.method} ${c.req.path}`);
            return c.json({ message: 'Erreur du serveur' }, 500);
        })
        .get('/health', (c) =>
            c.json({ status: 'ok' as const, version, scores: index.size }),
        )
        .get('/catalog', zValidator('query', searchQuery), (c) =>
            c.json(index.search(c.req.valid('query'))),
        )
        .get('/catalog/:id', (c) => {
            const row = db
                .select({
                    ...entryColumns,
                    content: scores.content,
                    hidden: scores.hidden,
                })
                .from(scores)
                .where(eq(scores.id, c.req.param('id')))
                .get();
            if (!row) {
                return c.json({ message: 'Partition introuvable' }, 404);
            }
            if (row.hidden) {
                return c.json(
                    { message: 'Partition retirée du catalogue' },
                    410,
                );
            }
            const { content, hidden: _, popularity: __, ...entry } = row;
            return c.json(
                {
                    ...(entry as CatalogEntry),
                    level: entry.level as Level | null,
                    xml: unpackXml(content),
                },
                200,
            );
        })
        .post('/catalog/:id/report', zValidator('json', reportBody), (c) => {
            const scoreId = c.req.param('id');
            const exists = db
                .select({ id: scores.id })
                .from(scores)
                .where(eq(scores.id, scoreId))
                .get();
            if (!exists) {
                return c.json({ message: 'Partition introuvable' }, 404);
            }
            const ip = clientIp?.(c) ?? 'inconnue';
            const now = Date.now();
            const times = (recent.get(ip) ?? []).filter(
                (t) => now - t < REPORT_WINDOW,
            );
            if (times.length >= REPORT_MAX) {
                return c.json(
                    {
                        message:
                            'Trop de signalements envoyés : réessaie plus tard.',
                    },
                    429,
                );
            }
            recent.set(ip, [...times, now]);
            const { reason, message = '' } = c.req.valid('json');
            db.insert(reports)
                .values({
                    scoreId,
                    reason,
                    message,
                    createdAt: new Date(now),
                })
                .run();
            logger.warn(`Signalement ${reason} : ${scoreId}`);
            return c.json({ ok: true as const }, 201);
        });
};

export type ApiType = ReturnType<typeof createApi>;
