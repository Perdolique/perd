CREATE TABLE `gears` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`weight` integer,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
