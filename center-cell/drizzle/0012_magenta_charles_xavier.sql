CREATE TABLE `conversation_reads` (
	`user_id` text NOT NULL,
	`conversation_id` text NOT NULL,
	`last_read_seq` integer DEFAULT 0 NOT NULL,
	`forced_unread` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `conversation_id`)
);
--> statement-breakpoint
ALTER TABLE `conversations` ADD `assigned_user_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `conversations` ADD `claimed_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `shared_inbox_owner_idx` ON `conversations` (`assigned_user_id`,`status`);--> statement-breakpoint
ALTER TABLE `messages` ADD `author_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `author_name` text DEFAULT '' NOT NULL;