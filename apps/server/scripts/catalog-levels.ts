/**
 * Recalcule niveau, difficulté, durée et nombre de mesures des partitions
 * du catalogue intégré (`catalog/catalog.json`), avec le même estimateur
 * que pour PDMX.
 *
 *   pnpm --filter server catalog:levels
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { estimateDifficulty } from '../../client/src/core/difficulty';
import { indexScore } from '../../client/src/core/musicxml';
import { parseXmlDocument } from './pdmx/musicxml';

const dir = path.join(__dirname, '../catalog');
const file = path.join(dir, 'catalog.json');
const entries = JSON.parse(readFileSync(file, 'utf-8')) as Record<
    string,
    unknown
>[];

for (const entry of entries) {
    const xml = readFileSync(
        path.join(dir, `${String(entry.id)}.musicxml`),
        'utf-8',
    );
    const { score, level, features } = estimateDifficulty(
        indexScore(parseXmlDocument(xml)),
    );
    Object.assign(entry, {
        level,
        difficulty: score,
        duration: Math.round(features.duration),
        measures: features.measures,
    });
    console.log(`${String(entry.id)} : ${level} (${score})`);
}
writeFileSync(file, JSON.stringify(entries, null, 4) + '\n');
