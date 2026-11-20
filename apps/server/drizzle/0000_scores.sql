CREATE TABLE `scores` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`composer` text DEFAULT '' NOT NULL,
	`level` text,
	`tags` text DEFAULT '' NOT NULL,
	`source` text NOT NULL,
	`license` text NOT NULL,
	`popularity` real,
	`xml` text NOT NULL
);
