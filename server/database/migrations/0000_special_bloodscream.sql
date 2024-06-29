CREATE TABLE `users` (
	`id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
