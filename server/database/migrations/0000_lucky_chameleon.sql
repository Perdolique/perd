CREATE TABLE `user_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`session` text NOT NULL,
	`userId` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
