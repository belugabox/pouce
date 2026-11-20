import { real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Partitions du catalogue partagé : domaine public ou CC-0 uniquement.
 * Les partitions importées par chacun restent dans son navigateur.
 */
export const scores = sqliteTable('scores', {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    composer: text('composer').notNull().default(''),
    /** Débutant, Facile, Intermédiaire… */
    level: text('level'),
    /** Mots-clés pour la recherche, séparés par des espaces. */
    tags: text('tags').notNull().default(''),
    /** Provenance : `pouce` (catalogue intégré), plus tard `pdmx`… */
    source: text('source').notNull(),
    license: text('license').notNull(),
    /** Popularité d'origine (PDMX), pour le tri. */
    popularity: real('popularity'),
    xml: text('xml').notNull(),
});
