CREATE TABLE `book_copies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookId` int NOT NULL,
	`inventoryCode` varchar(64) NOT NULL,
	`barcode` varchar(64),
	`shelf` varchar(128),
	`status` enum('available','loaned','maintenance','lost') NOT NULL DEFAULT 'available',
	`condition` varchar(64) DEFAULT 'bom',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `book_copies_id` PRIMARY KEY(`id`),
	CONSTRAINT `book_copies_inventory_unique` UNIQUE(`inventoryCode`),
	CONSTRAINT `book_copies_barcode_unique` UNIQUE(`barcode`)
);
--> statement-breakpoint
CREATE TABLE `books` (
	`id` int AUTO_INCREMENT NOT NULL,
	`isbn` varchar(13) NOT NULL,
	`title` varchar(512) NOT NULL,
	`subtitle` varchar(512),
	`author` varchar(512) NOT NULL,
	`publisher` varchar(255),
	`edition` varchar(64),
	`year` varchar(4),
	`pages` int,
	`language` varchar(32),
	`category` varchar(128),
	`description` text,
	`coverUri` text,
	`catalogSource` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `books_id` PRIMARY KEY(`id`),
	CONSTRAINT `books_isbn_unique` UNIQUE(`isbn`)
);
--> statement-breakpoint
CREATE TABLE `loans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`copyId` int NOT NULL,
	`studentId` int NOT NULL,
	`borrowedAt` timestamp NOT NULL DEFAULT (now()),
	`dueAt` timestamp NOT NULL,
	`returnedAt` timestamp,
	`status` enum('active','returned','overdue') NOT NULL DEFAULT 'active',
	`notes` text,
	CONSTRAINT `loans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` int AUTO_INCREMENT NOT NULL,
	`registrationCode` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`className` varchar(64),
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `students_id` PRIMARY KEY(`id`),
	CONSTRAINT `students_registrationCode_unique` UNIQUE(`registrationCode`)
);
--> statement-breakpoint
ALTER TABLE `book_copies` ADD CONSTRAINT `book_copies_bookId_books_id_fk` FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `loans` ADD CONSTRAINT `loans_copyId_book_copies_id_fk` FOREIGN KEY (`copyId`) REFERENCES `book_copies`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `loans` ADD CONSTRAINT `loans_studentId_students_id_fk` FOREIGN KEY (`studentId`) REFERENCES `students`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `book_copies_book_idx` ON `book_copies` (`bookId`);--> statement-breakpoint
CREATE INDEX `books_title_idx` ON `books` (`title`);--> statement-breakpoint
CREATE INDEX `books_author_idx` ON `books` (`author`);--> statement-breakpoint
CREATE INDEX `loans_copy_idx` ON `loans` (`copyId`);--> statement-breakpoint
CREATE INDEX `loans_student_idx` ON `loans` (`studentId`);--> statement-breakpoint
CREATE INDEX `loans_status_idx` ON `loans` (`status`);--> statement-breakpoint
CREATE INDEX `students_name_idx` ON `students` (`name`);