CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`channel` text DEFAULT 'test' NOT NULL,
	`profile` text DEFAULT 'nao_identificado' NOT NULL,
	`status` text DEFAULT 'bot' NOT NULL,
	`assigned` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`updated` integer NOT NULL,
	`last_inbound` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `conversation_updated_idx` ON `conversations` (`updated`);--> statement-breakpoint
CREATE INDEX `conversation_phone_idx` ON `conversations` (`phone`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'saved' NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `message_conversation_idx` ON `messages` (`conversation_id`,`created`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`search` text NOT NULL,
	`category` text NOT NULL,
	`data` text NOT NULL,
	`synced` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`profile` text NOT NULL,
	`data` text NOT NULL,
	`total` integer NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `quote_created_idx` ON `quotes` (`created`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
