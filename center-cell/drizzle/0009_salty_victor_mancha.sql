ALTER TABLE `quotes` ADD `deleted_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `quotes` ADD `superseded_by` text DEFAULT '' NOT NULL;