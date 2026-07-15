import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const visitorPosts = sqliteTable(
  "visitor_posts",
  {
    id: text("id").primaryKey(),
    displayName: text("display_name").notNull(),
    body: text("body").notNull(),
    deletionTokenHash: text("deletion_token_hash").notNull(),
    status: text("status").notNull().default("pending"),
    consentVersion: text("consent_version").notNull(),
    createdAt: integer("created_at").notNull(),
    retentionUntil: integer("retention_until").notNull(),
    publishedAt: integer("published_at"),
  },
  (table) => [
    index("visitor_posts_status_created_idx").on(table.status, table.createdAt),
    index("visitor_posts_retention_idx").on(table.retentionUntil),
    check(
      "visitor_posts_status_check",
      sql`${table.status} in ('pending', 'approved', 'rejected', 'published')`,
    ),
  ],
);

export const feedbackRateLimits = sqliteTable(
  "feedback_rate_limits",
  {
    authorRef: text("author_ref").notNull(),
    windowStart: integer("window_start").notNull(),
    requestCount: integer("request_count").notNull().default(1),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.authorRef, table.windowStart] }),
    index("feedback_rate_limits_expires_idx").on(table.expiresAt),
  ],
);

export const feedbackReplies = sqliteTable(
  "feedback_replies",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => visitorPosts.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    status: text("status").notNull().default("draft"),
    generatedBy: text("generated_by").notNull(),
    modelRef: text("model_ref"),
    createdAt: integer("created_at").notNull(),
    reviewedAt: integer("reviewed_at"),
    publishedAt: integer("published_at"),
  },
  (table) => [
    index("feedback_replies_post_status_idx").on(table.postId, table.status),
    check(
      "feedback_replies_status_check",
      sql`${table.status} in ('draft', 'approved', 'rejected', 'published')`,
    ),
    check(
      "feedback_replies_generated_by_check",
      sql`${table.generatedBy} in ('assistant', 'template', 'human')`,
    ),
  ],
);

export const replyJobs = sqliteTable(
  "reply_jobs",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => visitorPosts.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    notBefore: integer("not_before").notNull(),
    errorCode: text("error_code"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("reply_jobs_post_unique").on(table.postId),
    index("reply_jobs_status_not_before_idx").on(table.status, table.notBefore),
    check(
      "reply_jobs_status_check",
      sql`${table.status} in ('queued', 'drafted', 'blocked', 'failed', 'closed')`,
    ),
  ],
);

export const moderationEvents = sqliteTable(
  "moderation_events",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => visitorPosts.id, { onDelete: "cascade" }),
    replyId: text("reply_id").references(() => feedbackReplies.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    reasonCode: text("reason_code"),
    actorType: text("actor_type").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("moderation_events_post_created_idx").on(table.postId, table.createdAt),
    check(
      "moderation_events_actor_check",
      sql`${table.actorType} in ('system', 'assistant', 'moderator')`,
    ),
  ],
);

export const automationRuns = sqliteTable(
  "automation_runs",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    status: text("status").notNull(),
    inputRevision: text("input_revision").notNull(),
    attempts: integer("attempts").notNull().default(0),
    startedAt: integer("started_at").notNull(),
    finishedAt: integer("finished_at"),
    errorCode: text("error_code"),
  },
  (table) => [
    index("automation_runs_kind_started_idx").on(table.kind, table.startedAt),
    check(
      "automation_runs_status_check",
      sql`${table.status} in ('running', 'passed', 'blocked', 'failed')`,
    ),
  ],
);
