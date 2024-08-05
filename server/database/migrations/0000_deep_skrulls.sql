CREATE TABLE `checklistItems` (
	`id` text PRIMARY KEY NOT NULL,
	`checklistId` text NOT NULL,
	`equipmentId` text NOT NULL,
	`isChecked` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`checklistId`) REFERENCES `checklists`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`equipmentId`) REFERENCES `equipment`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `checklists` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`name` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `equipment` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text COLLATE NOCASE NOT NULL,
	`weight` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `userEquipment` (
	`userId` text NOT NULL,
	`equipmentId` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`equipmentId`, `userId`),
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`equipmentId`) REFERENCES `equipment`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`isAdmin` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `checklistItems_checklistId_equipmentId_unique` ON `checklistItems` (`checklistId`,`equipmentId`);--> statement-breakpoint
CREATE INDEX `createdAtIndex` ON `checklists` (`createdAt`);