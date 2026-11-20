/**
 * Administration du catalogue, en ligne de commande :
 *
 *   node dist/tools/admin.js signalements      liste les signalements
 *   node dist/tools/admin.js retirer <id>       retire une partition
 *   node dist/tools/admin.js remettre <id>      la remet dans le catalogue
 *
 * Dans Docker : `docker exec <conteneur> node apps/server/dist/tools/admin.js …`.
 * Le serveur relit le catalogue au démarrage : le redémarrer ensuite.
 */
import 'dotenv/config';
import { desc, eq, sql } from 'drizzle-orm';

import { loadConfig } from '../config';
import { openDatabase } from '../db';
import { reports, scores } from '../db/schema';

const [command, id] = process.argv.slice(2);
const { db, close } = openDatabase(loadConfig().DB_FILE);

const setHidden = (hidden: boolean) => {
    if (!id) throw new Error('Identifiant de partition manquant.');
    const done = db
        .update(scores)
        .set({ hidden })
        .where(eq(scores.id, id))
        .run();
    if (!done.changes) throw new Error(`Partition inconnue : ${id}`);
    console.log(
        `${id} ${hidden ? 'retirée du' : 'remise dans le'} catalogue. Redémarre le serveur pour l’appliquer.`,
    );
};

try {
    switch (command) {
        case 'signalements': {
            const rows = db
                .select({
                    scoreId: reports.scoreId,
                    title: scores.title,
                    hidden: scores.hidden,
                    count: sql<number>`count(*)`,
                    reasons: sql<string>`group_concat(${reports.reason} || coalesce(' : ' || nullif(${reports.message}, ''), ''), ' / ')`,
                    last: sql<number>`max(${reports.createdAt})`,
                })
                .from(reports)
                .leftJoin(scores, eq(scores.id, reports.scoreId))
                .groupBy(reports.scoreId)
                .orderBy(desc(sql`max(${reports.createdAt})`))
                .all();
            if (!rows.length) console.log('Aucun signalement.');
            for (const r of rows) {
                console.log(
                    `${r.scoreId}${r.hidden ? ' (retirée)' : ''} — ${r.title ?? '?'} — ${r.count} signalement(s), dernier le ${new Date(r.last).toLocaleString('fr-FR')}\n    ${r.reasons}`,
                );
            }
            break;
        }
        case 'retirer':
            setHidden(true);
            break;
        case 'remettre':
            setHidden(false);
            break;
        default:
            console.log(
                'Commandes : signalements | retirer <id> | remettre <id>',
            );
    }
} catch (err) {
    console.error((err as Error).message);
    process.exitCode = 1;
} finally {
    close();
}
