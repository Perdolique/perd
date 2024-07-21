CREATE TABLE `gears` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`weight` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
