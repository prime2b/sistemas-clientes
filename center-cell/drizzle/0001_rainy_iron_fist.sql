CREATE TABLE `product_stage` (
	`run_id` text NOT NULL,
	`id` integer NOT NULL,
	`name` text NOT NULL,
	`search` text NOT NULL,
	`category` text NOT NULL,
	`data` text NOT NULL,
	`synced` integer NOT NULL,
	PRIMARY KEY(`run_id`, `id`)
);
