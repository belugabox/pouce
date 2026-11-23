import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { pino } from 'pino';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type PackEntry, loadPack } from '../src/catalog/pack';
import { unpackXml, visibleEntries } from '../src/catalog/store';
import { openDatabase } from '../src/db';
import { scores } from '../src/db/schema';

const silent = pino({ level: 'silent' });

const entry = (id: string, extra: Partial<PackEntry> = {}): PackEntry => ({
    id,
    title: `Titre ${id}`,
    composer: 'Frédéric Chopin',
    arranger: '',
    level: 'Facile',
    difficulty: 3,
    tags: 'classical',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    sourceUrl: 'https://musescore.com/score/1',
    popularity: 4.2,
    duration: 90,
    measures: 32,
    genre: 'Classique',
    xmlGz: gzipSync(Buffer.from(`<score-partwise id="${id}"/>`)).toString(
        'base64',
    ),
    ...extra,
});

let dir: string;
let file: string;
let database: ReturnType<typeof openDatabase>;

const write = (lines: unknown[], mtime = 1_700_000_000) => {
    writeFileSync(
        file,
        gzipSync(lines.map((l) => JSON.stringify(l)).join('\n') + '\n'),
    );
    utimesSync(file, mtime, mtime);
};

beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'pouce-pack-'));
    file = path.join(dir, 'pdmx.jsonl.gz');
    database = openDatabase(':memory:');
});

afterEach(() => {
    database.close();
    rmSync(dir, { recursive: true, force: true });
});

describe('loadPack', () => {
    it('ne fait rien sans paquet', async () => {
        expect(await loadPack(database.db, file, silent)).toBeNull();
    });

    it('charge les partitions, une seule fois par version du paquet', async () => {
        write([entry('pdmx-1'), entry('pdmx-2')]);
        expect(await loadPack(database.db, file, silent)).toBe(2);
        expect(await loadPack(database.db, file, silent)).toBeNull();
        const rows = database.db.select().from(scores).all();
        expect(rows.map((r) => r.id)).toEqual(['pdmx-1', 'pdmx-2']);
        expect(rows[0]!.source).toBe('pdmx');
        expect(unpackXml(rows[0]!.content)).toBe(
            '<score-partwise id="pdmx-1"/>',
        );
    });

    it('refuse les licences non libres et les lignes invalides', async () => {
        write([
            entry('pdmx-1'),
            entry('pdmx-2', { license: 'CC BY' as 'CC0' }),
            { id: 'pdmx-3' },
            entry('autre-4'),
        ]);
        expect(await loadPack(database.db, file, silent)).toBe(1);
    });

    it('remplace le paquet précédent et garde les partitions retirées', async () => {
        write([entry('pdmx-1'), entry('pdmx-2'), entry('pdmx-3')]);
        await loadPack(database.db, file, silent);
        database.db.$client
            .prepare("UPDATE scores SET hidden = 1 WHERE id = 'pdmx-2'")
            .run();

        write([entry('pdmx-2'), entry('pdmx-4')], 1_800_000_000);
        expect(await loadPack(database.db, file, silent)).toBe(2);
        expect(visibleEntries(database.db).map((e) => e.id)).toEqual([
            'pdmx-4',
        ]);
    });
});
