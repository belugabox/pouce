import { zValidator } from '@hono/zod-validator';
import { eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import type { Db } from './db';
import { scores } from './db/schema';
import type { Logger } from './tools/logger';
import { type CatalogEntry, normalizeSearch } from './types';

export interface ApiDeps {
    db: Db;
    logger: Logger;
    version: string;
}

const listColumns = {
    id: scores.id,
    title: scores.title,
    composer: scores.composer,
    level: scores.level,
    tags: scores.tags,
    source: scores.source,
    license: scores.license,
};

/** API de Pouce (`/api`) : catalogue en lecture seule. */
export const createApi = ({ db, logger, version }: ApiDeps) =>
    new Hono()
        .onError((err, c) => {
            logger.error(err, `${c.req.method} ${c.req.path}`);
            return c.json({ message: 'Erreur du serveur' }, 500);
        })
        .get('/health', (c) => c.json({ status: 'ok' as const, version }))
        .get(
            '/catalog',
            zValidator('query', z.object({ q: z.string().optional() })),
            (c) => {
                const q = normalizeSearch(c.req.valid('query').q?.trim());
                const rows: CatalogEntry[] = db
                    .select(listColumns)
                    .from(scores)
                    .orderBy(sql`rowid`)
                    .all();
                // Sans accents ni majuscules : filtré ici, pas par SQLite.
                return c.json(
                    q
                        ? rows.filter((r) =>
                              normalizeSearch(
                                  `${r.title} ${r.composer} ${r.tags}`,
                              ).includes(q),
                          )
                        : rows,
                );
            },
        )
        .get('/catalog/:id', (c) => {
            const row = db
                .select({ ...listColumns, xml: scores.xml })
                .from(scores)
                .where(eq(scores.id, c.req.param('id')))
                .get();
            if (!row) {
                return c.json({ message: 'Partition introuvable' }, 404);
            }
            return c.json(row, 200);
        });

export type ApiType = ReturnType<typeof createApi>;
