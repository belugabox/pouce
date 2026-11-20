import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pino } from 'pino';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApi } from '../src/api';
import { seedCatalog } from '../src/catalog/seed';
import { openDatabase } from '../src/db';
import type { CatalogEntry } from '../src/types';

const silent = pino({ level: 'silent' });

let database: ReturnType<typeof openDatabase>;
let api: ReturnType<typeof createApi>;

beforeEach(() => {
    database = openDatabase(':memory:');
    seedCatalog(database.db);
    api = createApi({ db: database.db, logger: silent, version: '1.2.3' });
});

afterEach(() => database.close());

const list = async (query = '') => {
    const res = await api.request(`/catalog${query}`);
    expect(res.status).toBe(200);
    return (await res.json()) as CatalogEntry[];
};

describe('API', () => {
    it('répond sur /health', async () => {
        const res = await api.request('/health');
        expect(await res.json()).toEqual({ status: 'ok', version: '1.2.3' });
    });

    it('liste le catalogue intégré dans son ordre, sans le XML', async () => {
        const rows = await list();
        expect(rows.map((r) => r.id)).toEqual([
            'ode',
            'lune',
            'jacques',
            'twinkle',
            'menuet',
            'prelude',
        ]);
        expect(rows[0]).not.toHaveProperty('xml');
        expect(rows[0]!.license).toBe('Domaine public');
    });

    it('cherche sans accents ni majuscules, aussi dans les mots-clés', async () => {
        expect((await list('?q=FRERE')).map((r) => r.id)).toEqual(['jacques']);
        expect((await list('?q=twinkle')).map((r) => r.id)).toEqual([
            'twinkle',
        ]);
        expect((await list('?q=bach')).map((r) => r.id)).toEqual([
            'menuet',
            'prelude',
        ]);
        expect(await list('?q=zzz')).toEqual([]);
    });

    it('renvoie une partition avec son XML', async () => {
        const res = await api.request('/catalog/menuet');
        expect(res.status).toBe(200);
        const body = (await res.json()) as CatalogEntry & { xml: string };
        expect(body.title).toBe('Menuet en sol majeur');
        expect(body.xml).toContain('<score-partwise');
    });

    it('répond 404 pour une partition inconnue', async () => {
        const res = await api.request('/catalog/inconnue');
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ message: 'Partition introuvable' });
    });
});

describe('seedCatalog', () => {
    let dir: string;
    beforeEach(() => {
        dir = mkdtempSync(path.join(tmpdir(), 'pouce-'));
    });
    afterEach(() => rmSync(dir, { recursive: true, force: true }));

    it('met à jour une partition déjà en base', async () => {
        const write = (title: string) => {
            writeFileSync(
                path.join(dir, 'catalog.json'),
                JSON.stringify([
                    {
                        id: 'ode',
                        title,
                        composer: 'B',
                        level: null,
                        tags: '',
                        source: 'pouce',
                        license: 'Domaine public',
                    },
                ]),
            );
            writeFileSync(path.join(dir, 'ode.musicxml'), '<score-partwise/>');
        };
        write('Nouveau titre');
        seedCatalog(database.db, dir);
        const rows = await list();
        expect(rows.find((r) => r.id === 'ode')!.title).toBe('Nouveau titre');
        expect(rows).toHaveLength(6);
    });
});
