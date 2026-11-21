import {
    blob,
    index,
    integer,
    real,
    sqliteTable,
    text,
} from 'drizzle-orm/sqlite-core';

/**
 * Partitions du catalogue partagé (catalogue intégré et paquet PDMX).
 * Les partitions importées par chacun restent dans son navigateur.
 */
export const scores = sqliteTable('scores', {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    /** Compositeur de l'œuvre (nom usuel, « Traditionnel »…). */
    composer: text('composer').notNull().default(''),
    /** Arrangement ou transcription (personne qui l'a publié). */
    arranger: text('arranger').notNull().default(''),
    /** Débutant, Facile, Intermédiaire ou Avancé. */
    level: text('level'),
    /** Difficulté estimée, de 0 (très facile) à 10. */
    difficulty: real('difficulty'),
    /** Mots-clés pour la recherche, séparés par des espaces. */
    tags: text('tags').notNull().default(''),
    /** Provenance : `pouce` (catalogue intégré) ou `pdmx`. */
    source: text('source').notNull(),
    license: text('license').notNull(),
    licenseUrl: text('license_url'),
    /** Page d'origine de la partition (MuseScore pour PDMX). */
    sourceUrl: text('source_url'),
    /** Popularité d'origine, pour le tri (vues, favoris, notes). */
    popularity: real('popularity'),
    /** Durée estimée, en secondes. */
    duration: real('duration'),
    measures: integer('measures'),
    /** Genre (`GENRES`), null si inconnu. */
    genre: text('genre'),
    /** MusicXML compressé (gzip). */
    content: blob('content', { mode: 'buffer' }).notNull(),
    /** Retirée du catalogue (signalement vérifié). */
    hidden: integer('hidden', { mode: 'boolean' }).notNull().default(false),
});

/** Signalements envoyés depuis l'appli (droits, partition fausse…). */
export const reports = sqliteTable(
    'reports',
    {
        id: integer('id').primaryKey({ autoIncrement: true }),
        scoreId: text('score_id').notNull(),
        reason: text('reason').notNull(),
        message: text('message').notNull().default(''),
        createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    },
    (t) => [index('reports_score_idx').on(t.scoreId)],
);

/** Petites valeurs du serveur (signature du paquet PDMX chargé…). */
export const meta = sqliteTable('meta', {
    key: text('key').primaryKey(),
    value: text('value').notNull(),
});
