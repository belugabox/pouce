import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import 'dotenv/config';
import { Hono } from 'hono';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createApi } from './api';
import { seedCatalog } from './catalog/seed';
import { loadConfig } from './config';
import { openDatabase } from './db';
import { createLogger } from './tools/logger';

// Depuis `src` (dev) comme depuis `dist` (build).
const SERVER_ROOT = path.join(__dirname, '..');
const CLIENT_DIST = path.join(SERVER_ROOT, '../client/dist');

const config = loadConfig();
const logger = createLogger(config.LOG_LEVEL);
const { version } = JSON.parse(
    readFileSync(path.join(SERVER_ROOT, 'package.json'), 'utf-8'),
) as { version: string };

process.on('unhandledRejection', (err) => {
    logger.error(err, 'unhandledRejection');
});

const database = openDatabase(config.DB_FILE);
logger.info(`Base de données : ${config.DB_FILE}`);
logger.info(`Catalogue : ${seedCatalog(database.db)} partitions`);

const app = new Hono()
    .route('/api', createApi({ db: database.db, logger, version }))
    // Client compilé ; toute autre adresse renvoie l'appli (routage côté client).
    // Fichiers de Vite (empreinte dans le nom) : gardés un an. Les autres
    // (index.html, sw.js, manifeste, icônes) : revérifiés à chaque fois, pour
    // qu'une nouvelle version arrive tout de suite.
    .use('/*', async (c, next) => {
        await next();
        if (c.res.ok && !c.req.path.startsWith('/api/')) {
            c.res.headers.set(
                'Cache-Control',
                c.req.path.startsWith('/assets/')
                    ? 'public, max-age=31536000, immutable'
                    : 'no-cache',
            );
        }
    })
    .use('/*', serveStatic({ root: path.relative(process.cwd(), CLIENT_DIST) }))
    .get('*', (c) =>
        c.html(readFileSync(path.join(CLIENT_DIST, 'index.html'), 'utf-8')),
    );

serve({ fetch: app.fetch, port: config.PORT }, (info) =>
    logger.info(`Pouce ${version} démarré sur http://localhost:${info.port}`),
);
