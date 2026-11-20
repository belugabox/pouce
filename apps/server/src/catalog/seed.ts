import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { Db } from '../db';
import { scores } from '../db/schema';

// `apps/server/catalog`, depuis `src/catalog` (dev) comme `dist/catalog` (build).
export const CATALOG_DIR = path.join(__dirname, '../../catalog');

interface CatalogFile {
    id: string;
    title: string;
    composer: string;
    level: string | null;
    tags: string;
    source: string;
    license: string;
}

/**
 * Catalogue intégré (`catalog/catalog.json` et un `<id>.musicxml` par
 * partition), écrit dans la base à chaque démarrage : une partition
 * corrigée dans le dépôt l'est aussi en base.
 */
export const seedCatalog = (db: Db, dir = CATALOG_DIR) => {
    const entries = JSON.parse(
        readFileSync(path.join(dir, 'catalog.json'), 'utf-8'),
    ) as CatalogFile[];
    db.transaction((tx) => {
        for (const entry of entries) {
            const row = {
                ...entry,
                xml: readFileSync(
                    path.join(dir, `${entry.id}.musicxml`),
                    'utf-8',
                ),
            };
            tx.insert(scores)
                .values(row)
                .onConflictDoUpdate({ target: scores.id, set: row })
                .run();
        }
    });
    return entries.length;
};
