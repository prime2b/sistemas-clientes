CREATE TABLE `catalog_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`day` integer NOT NULL,
	`kind` text NOT NULL,
	`item` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `catalog_activity_day_idx` ON `catalog_activity` (`day`,`kind`);--> statement-breakpoint
ALTER TABLE `product_stage` ADD `type` text DEFAULT 'outros' NOT NULL;--> statement-breakpoint
ALTER TABLE `product_stage` ADD `brand` text DEFAULT 'Outras' NOT NULL;--> statement-breakpoint
ALTER TABLE `product_stage` ADD `models` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `product_stage` ADD `variant` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `product_stage` ADD `display_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `product_stage` ADD `enriched` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `type` text DEFAULT 'outros' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `brand` text DEFAULT 'Outras' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `models` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `variant` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `display_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `enriched` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `product_type_idx` ON `products` (`type`);--> statement-breakpoint
CREATE INDEX `product_brand_idx` ON `products` (`brand`);