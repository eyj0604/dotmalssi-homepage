CREATE TABLE `automation_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`input_revision` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`error_code` text,
	CONSTRAINT "automation_runs_status_check" CHECK("automation_runs"."status" in ('running', 'passed', 'blocked', 'failed'))
);
--> statement-breakpoint
CREATE INDEX `automation_runs_kind_started_idx` ON `automation_runs` (`kind`,`started_at`);--> statement-breakpoint
CREATE TABLE `feedback_rate_limits` (
	`author_ref` text NOT NULL,
	`window_start` integer NOT NULL,
	`request_count` integer DEFAULT 1 NOT NULL,
	`expires_at` integer NOT NULL,
	PRIMARY KEY(`author_ref`, `window_start`)
);
--> statement-breakpoint
CREATE INDEX `feedback_rate_limits_expires_idx` ON `feedback_rate_limits` (`expires_at`);--> statement-breakpoint
CREATE TABLE `feedback_replies` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`generated_by` text NOT NULL,
	`model_ref` text,
	`created_at` integer NOT NULL,
	`reviewed_at` integer,
	`published_at` integer,
	FOREIGN KEY (`post_id`) REFERENCES `visitor_posts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "feedback_replies_status_check" CHECK("feedback_replies"."status" in ('draft', 'approved', 'rejected', 'published')),
	CONSTRAINT "feedback_replies_generated_by_check" CHECK("feedback_replies"."generated_by" in ('assistant', 'template', 'human'))
);
--> statement-breakpoint
CREATE INDEX `feedback_replies_post_status_idx` ON `feedback_replies` (`post_id`,`status`);--> statement-breakpoint
CREATE TABLE `moderation_events` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`reply_id` text,
	`action` text NOT NULL,
	`reason_code` text,
	`actor_type` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `visitor_posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reply_id`) REFERENCES `feedback_replies`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "moderation_events_actor_check" CHECK("moderation_events"."actor_type" in ('system', 'assistant', 'moderator'))
);
--> statement-breakpoint
CREATE INDEX `moderation_events_post_created_idx` ON `moderation_events` (`post_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `reply_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`not_before` integer NOT NULL,
	`error_code` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `visitor_posts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "reply_jobs_status_check" CHECK("reply_jobs"."status" in ('queued', 'drafted', 'blocked', 'failed', 'closed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reply_jobs_post_unique` ON `reply_jobs` (`post_id`);--> statement-breakpoint
CREATE INDEX `reply_jobs_status_not_before_idx` ON `reply_jobs` (`status`,`not_before`);--> statement-breakpoint
CREATE TABLE `visitor_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`body` text NOT NULL,
	`deletion_token_hash` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`consent_version` text NOT NULL,
	`created_at` integer NOT NULL,
	`retention_until` integer NOT NULL,
	`published_at` integer,
	CONSTRAINT "visitor_posts_status_check" CHECK("visitor_posts"."status" in ('pending', 'approved', 'rejected', 'published'))
);
--> statement-breakpoint
CREATE INDEX `visitor_posts_status_created_idx` ON `visitor_posts` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `visitor_posts_retention_idx` ON `visitor_posts` (`retention_until`);