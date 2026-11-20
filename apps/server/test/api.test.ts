import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pino } from 'pino';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApi } from '../src/api';
import { seedCatalog } from '../src/catalog/seed';
import { openDatabase } from '../src/db';
import { reports } from '../src/db/schema';
import type { CatalogEntry, CatalogPage } from '../src/types';

const silent = pino({ level: 'silent' });

let database: ReturnType<typeof openDatabase>;
let api: ReturnType<typeof createApi>;

const start = () => {
    api = createApi({
        db: database.db,
        logger: silent,
        version: '1.2.3',
        clientIp: (c) => c.req.header('x-test-ip'),
    });
};

beforeEach(() => {
    database = openDatabase(':memory:');
    seedCatalog(database.db);
    start();
});

afterEach(() => database.close());

const list = async (query = '') => {
    const res = await api.request(`/catalog${query}`);
    expect(res.status).toBe(200);
    return (await res.json()) as CatalogPage;
};

const report = (id: string, body: unknown, ip = '1.2.3.4') =>
    api.request(`/catalog/${id}/report`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-test-ip': ip },
        body: JSON.stringify(body),
    });

describe('API', () => {
    it('répond sur /health', async () => {
        const res = await api.request('/health');
        expect(await res.json()).toEqual({
            status: 'ok',
            version: '1.2.3',
            scores: 6,
        });
    });

    it('liste le catalogue intégré dans son ordre, sans le XML', async () => {
        const page = await list();
        expect(page.total).toBe(6);
        expect(page.items.map((r) => r.id)).toEqual([
            'ode',
            'lune',
            'jacques',
            'twinkle',
            'menuet',
            'prelude',
        ]);
        expect(page.items[0]).not.toHaveProperty('xml');
        expect(page.items[0]).not.toHaveProperty('content');
        expect(page.items[0]!.license).toBe('Domaine public');
    });

    it('cherche sans accents ni majuscules, aussi dans les mots-clés', async () => {
        const ids = async (q: string) =>
            (await list(`?q=${encodeURIComponent(q)}`)).items.map((r) => r.id);
        expect(await ids('FRERE')).toEqual(['jacques']);
        expect(await ids('twinkle')).toEqual(['twinkle']);
        // Compositeur avant mot-clé.
        expect(await ids('bach')).toEqual(['prelude', 'menuet']);
        expect(await ids('zzz')).toEqual([]);
    });

    it('filtre par niveau et pagine', async () => {
        const page = await list('?level=D%C3%A9butant&limit=2');
        expect(page.total).toBe(4);
        expect(page.items).toHaveLength(2);
        expect(page.levels.Débutant).toBe(4);
        const res = await api.request('/catalog?level=Expert');
        expect(res.status).toBe(400);
    });

    it('renvoie une partition avec son XML', async () => {
        const res = await api.request('/catalog/menuet');
        expect(res.status).toBe(200);
        const body = (await res.json()) as CatalogEntry & { xml: string };
        expect(body.title).toBe('Menuet en sol majeur');
        expect(body.xml).toContain('<score-partwise');
        expect(body).not.toHaveProperty('content');
    });

    it('répond 404 pour une partition inconnue', async () => {
        const res = await api.request('/catalog/inconnue');
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ message: 'Partition introuvable' });
    });

    it('enregistre un signalement, puis limite les envois', async () => {
        const res = await report('menuet', {
            reason: 'copyright',
            message: 'Arrangement protégé',
        });
        expect(res.status).toBe(201);
        const rows = database.db.select().from(reports).all();
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            scoreId: 'menuet',
            reason: 'copyright',
            message: 'Arrangement protégé',
        });
        for (let i = 0; i < 9; i++) {
            expect((await report('menuet', { reason: 'wrong' })).status).toBe(
                201,
            );
        }
        expect((await report('menuet', { reason: 'wrong' })).status).toBe(429);
        // Une autre adresse n'est pas bloquée.
        expect(
            (await report('menuet', { reason: 'wrong' }, '5.6.7.8')).status,
        ).toBe(201);
    });

    it('refuse un signalement invalide', async () => {
        expect((await report('menuet', { reason: 'spam' })).status).toBe(400);
        expect((await report('inconnue', { reason: 'other' })).status).toBe(
            404,
        );
    });

    it('cache une partition retirée du catalogue', async () => {
        database.db.$client
            .prepare("UPDATE scores SET hidden = 1 WHERE id = 'menuet'")
            .run();
        start();
        expect((await list()).items.map((r) => r.id)).not.toContain('menuet');
        expect((await api.request('/catalog/menuet')).status).toBe(410);
    });
});

describe('seedCatalog', () => {
    let dir: string;
    beforeEach(() => {
        dir = mkdtempSync(path.join(tmpdir(), 'pouce-'));
    });
    afterEach(() => rmSync(dir, { recursive: true, force: true }));

    it('met à jour une partition déjà en base', async () => {
        writeFileSync(
            path.join(dir, 'catalog.json'),
            JSON.stringify([
                {
                    id: 'ode',
                    title: 'Nouveau titre',
                    composer: 'B',
                    level: null,
                    tags: '',
                    source: 'pouce',
                    license: 'Domaine public',
                },
            ]),
        );
        writeFileSync(path.join(dir, 'ode.musicxml'), '<score-partwise/>');
        seedCatalog(database.db, dir);
        start();
        const page = await list();
        expect(page.items.find((r) => r.id === 'ode')!.title).toBe(
            'Nouveau titre',
        );
        expect(page.total).toBe(6);
    });
});
