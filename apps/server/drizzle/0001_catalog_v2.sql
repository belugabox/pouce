CREATE TABLE `meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`score_id` text NOT NULL,
	`reason` text NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reports_score_idx` ON `reports` (`score_id`);--> statement-breakpoint
-- Le catalogue est réécrit au démarrage : on repart d'une table vide.
DELETE FROM `scores`;--> statement-breakpoint
ALTER TABLE `scores` ADD `arranger` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `scores` ADD `difficulty` real;--> statement-breakpoint
ALTER TABLE `scores` ADD `license_url` text;--> statement-breakpoint
ALTER TABLE `scores` ADD `source_url` text;--> statement-breakpoint
ALTER TABLE `scores` ADD `duration` real;--> statement-breakpoint
ALTER TABLE `scores` ADD `measures` integer;--> statement-breakpoint
ALTER TABLE `scores` ADD `content` blob DEFAULT x'' NOT NULL;--> statement-breakpoint
ALTER TABLE `scores` ADD `hidden` integer DEFAULT false NOT NULL;