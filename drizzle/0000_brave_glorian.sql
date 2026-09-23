CREATE TABLE `project_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`path` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`content_hash` text DEFAULT '' NOT NULL,
	`fetched_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_project_documents_project_path` ON `project_documents` (`project_id`,`path`);--> statement-breakpoint
CREATE INDEX `idx_project_documents_project_id` ON `project_documents` (`project_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`icon` text DEFAULT '◆' NOT NULL,
	`accent` text DEFAULT '#f4b860' NOT NULL,
	`source_type` text DEFAULT 'git' NOT NULL,
	`repository_url` text NOT NULL,
	`branch` text DEFAULT 'main' NOT NULL,
	`document_paths` text DEFAULT '["handoff.md"]' NOT NULL,
	`encrypted_token` text,
	`token_iv` text,
	`last_synced_at` text,
	`last_revision` text,
	`last_author` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_projects_slug` ON `projects` (`slug`);