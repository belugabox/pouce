/**
 * Fabrique le paquet de partitions PDMX pour le catalogue de Pouce.
 *
 *   pnpm --filter server pdmx [--csv PDMX.csv] [--mxl mxl.tar.gz]
 *        [--out data/pdmx.jsonl.gz] [--limit N]
 *
 * Sans `--csv` ni `--mxl`, les fichiers sont lus en flux depuis Zenodo
 * (~2,1 Go, rien n'est gardé sur le disque). Le paquet est chargé par le
 * serveur au démarrage s'il se trouve dans `DATA_PATH` (`pdmx.jsonl.gz`).
 * Un rapport (`.tsv`) liste à côté chaque partition retenue.
 *
 * PDMX : Long, Novack, Berg-Kirkpatrick, McAuley, « PDMX: A Large-Scale
 * Public Domain MusicXML Dataset for Symbolic Music Processing », 2024,
 * https://zenodo.org/records/15571083 (CC BY 4.0).
 */
import { parse } from 'csv-parse';
import { createReadStream, createWriteStream, mkdirSync } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { parseArgs } from 'node:util';
import { createGunzip, createGzip, gzipSync } from 'node:zlib';
import { extract } from 'tar-stream';

import type { PackEntry } from '../../src/catalog/pack';
import { type Analysis, analyze, quickMeta } from './analyze';
import { attribute, normalizeName } from './composers';
import { mxlToXml } from './musicxml';
import { type Candidate, type PdmxRow, cleanTitle, selectRow } from './select';

const ZENODO = 'https://zenodo.org/api/records/15571083/files';

const { values: args } = parseArgs({
    options: {
        csv: { type: 'string', default: `${ZENODO}/PDMX.csv/content` },
        mxl: { type: 'string', default: `${ZENODO}/mxl.tar.gz/content` },
        out: { type: 'string', default: 'data/pdmx.jsonl.gz' },
        limit: { type: 'string' },
    },
});

const open = async (source: string): Promise<Readable> => {
    if (!/^https?:/.test(source)) return createReadStream(source);
    const res = await fetch(source);
    if (!res.ok || !res.body) throw new Error(`${source} : ${res.status}`);
    return Readable.fromWeb(
        res.body as import('node:stream/web').ReadableStream,
    );
};

const log = (...parts: unknown[]) =>
    console.log(new Date().toISOString().slice(11, 19), ...parts);

const readCandidates = async () => {
    const candidates = new Map<string, Candidate>();
    let rows = 0;
    const parser = (await open(args.csv)).pipe(
        parse({ columns: true, relax_quotes: true }),
    );
    for await (const row of parser as AsyncIterable<PdmxRow>) {
        rows++;
        const c = selectRow(row);
        if (c) candidates.set(c.path, c);
    }
    log(
        `${rows} lignes, ${candidates.size} candidates (piano seul, CC-0 ou domaine public)`,
    );
    return candidates;
};

interface Kept {
    candidate: Candidate;
    analysis: Analysis;
    composer: string;
    how: string;
    title: string;
}

const main = async () => {
    const limit = args.limit ? Number(args.limit) : Infinity;
    const candidates = await readCandidates();
    const stats = new Map<string, number>();
    const count = (k: string): void => {
        stats.set(k, (stats.get(k) ?? 0) + 1);
    };
    const kept = new Map<string, Kept>();

    const tar = extract();
    const done = new Promise<void>((resolve, reject) => {
        tar.on('finish', resolve);
        tar.on('error', reject);
    });
    tar.on('entry', (header, stream, next) => {
        const candidate = candidates.get(header.name.replace(/^\.\//, ''));
        if (!candidate || kept.size >= limit) {
            stream.resume();
            stream.on('end', next);
            return;
        }
        const chunks: Buffer[] = [];
        stream.on('data', (c: unknown) => chunks.push(c as Buffer));
        stream.on('end', () => {
            try {
                handle(candidate, Buffer.concat(chunks));
            } catch (err) {
                count('erreur');
                log('erreur', candidate.id, (err as Error).message);
            }
            next();
        });
    });

    const handle = (candidate: Candidate, data: Buffer): void => {
        const raw = mxlToXml(data);
        if (!raw) return count('illisible');
        // Œuvre reconnue d'après le CSV, sinon d'après le compositeur du XML.
        let attribution = candidate.attribution;
        if (!attribution) {
            const meta = quickMeta(raw);
            attribution = attribute(
                { ...candidate.authors, creator: meta.creator },
                meta.workTitle && !candidate.title.includes(meta.workTitle)
                    ? `${candidate.title} - ${meta.workTitle}`
                    : candidate.title,
                candidate.genres,
            );
        }
        if (!attribution) return count('auteur-non-reconnu');
        const result = analyze(raw);
        if (typeof result === 'string') return count(result);
        count(`retenue:${attribution.how}`);
        const title = cleanTitle(
            candidate.title.includes(String.fromCharCode(0xfffd))
                ? result.workTitle || candidate.title
                : candidate.title,
            attribution.composer,
        );
        // Doublons (même titre, même auteur) : la plus populaire.
        const key = `${normalizeName(title)}|${attribution.composer}`;
        const prev = kept.get(key);
        if (prev && prev.candidate.popularity >= candidate.popularity)
            return count('doublon');
        if (prev) count('doublon');
        kept.set(key, {
            candidate,
            analysis: result,
            composer: attribution.composer,
            how: attribution.how,
            title,
        });
        if (kept.size % 500 === 0) log(`${kept.size} partitions retenues`);
    };

    (await open(args.mxl)).pipe(createGunzip()).pipe(tar);
    await done;

    const out = path.resolve(args.out);
    mkdirSync(path.dirname(out), { recursive: true });
    const gz = createGzip({ level: 9 });
    const file = createWriteStream(out);
    gz.pipe(file);
    const report = createWriteStream(
        out.replace(/\.jsonl\.gz$/, '') + '-report.tsv',
    );
    report.write(
        'id\tniveau\tdifficulté\treconnu\tcompositeur\ttitre\tpopularité\n',
    );
    const sorted = [...kept.values()].sort(
        (a, b) => b.candidate.popularity - a.candidate.popularity,
    );
    for (const { candidate: c, analysis: a, composer, how, title } of sorted) {
        const entry: PackEntry = {
            id: c.id,
            title,
            composer,
            arranger: a.arranger,
            level: a.level,
            difficulty: a.difficulty,
            tags: c.tags,
            license: c.license,
            licenseUrl: c.licenseUrl,
            sourceUrl: c.sourceUrl,
            popularity: c.popularity,
            duration: a.duration,
            measures: a.measures,
            xmlGz: gzipSync(Buffer.from(a.xml, 'utf-8'), { level: 9 }).toString(
                'base64',
            ),
        };
        gz.write(JSON.stringify(entry) + '\n');
        report.write(
            [
                c.id,
                a.level,
                a.difficulty,
                how,
                composer,
                title.replace(/\t/g, ' '),
                c.popularity,
            ].join('\t') + '\n',
        );
    }
    gz.end();
    report.end();
    await Promise.all([finished(file), finished(report)]);

    log(`${kept.size} partitions écrites dans ${out}`);
    for (const [k, v] of [...stats].sort()) log(`  ${k} : ${v}`);
};

main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
});
