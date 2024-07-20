CREATE TABLE `userEquipment` (
	`userId` text NOT NULL,
	`equipmentId` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`equipmentId`, `userId`),
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`equipmentId`) REFERENCES `equipment`(`id`) ON UPDATE cascade ON DELETE cascade
);
