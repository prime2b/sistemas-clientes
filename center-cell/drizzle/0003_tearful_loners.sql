CREATE TABLE `attendant_accounts` (
	`slot` integer PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`user_id` text,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attendant_accounts_email_unique` ON `attendant_accounts` (`email`);