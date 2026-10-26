ALTER TABLE `conversations` ADD `customer_status` text DEFAULT 'unchecked' NOT NULL;--> statement-breakpoint
ALTER TABLE `conversations` ADD `customer_id` integer;--> statement-breakpoint
ALTER TABLE `conversations` ADD `customer_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `conversations` ADD `customer_checked_at` integer DEFAULT 0 NOT NULL;