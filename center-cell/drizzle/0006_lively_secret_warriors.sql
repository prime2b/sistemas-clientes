CREATE TABLE `app_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created` integer NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `app_session_user_idx` ON `app_sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `app_users` (
	`id` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`slot` integer,
	`username` text NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`avatar` text DEFAULT '' NOT NULL,
	`password_hash` text NOT NULL,
	`salt` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`must_change_password` integer DEFAULT 1 NOT NULL,
	`created` integer NOT NULL,
	`updated` integer NOT NULL,
	`last_login` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_users_slot_unique` ON `app_users` (`slot`);--> statement-breakpoint
CREATE UNIQUE INDEX `app_users_username_unique` ON `app_users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `app_users_email_unique` ON `app_users` (`email`);--> statement-breakpoint
CREATE TABLE `login_throttle` (
	`key` text PRIMARY KEY NOT NULL,
	`failures` integer NOT NULL,
	`window_start` integer NOT NULL,
	`lock_until` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
-- Admin bootstrap is configured privately through the deployment environment.
