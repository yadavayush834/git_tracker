import {
  bigint,
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const repositoryStatus = pgEnum("repository_status", [
  "In progress",
  "Started",
  "Stale",
  "Empty",
  "Completed",
  "Maintained",
]);

export const syncStatus = pgEnum("sync_status", ["running", "completed", "failed"]);

export const githubInstallations = pgTable("github_installations", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  accountId: bigint("account_id", { mode: "number" }),
  accountLogin: varchar("account_login", { length: 255 }).notNull(),
  accountType: varchar("account_type", { length: 32 }).notNull().default("User"),
  avatarUrl: text("avatar_url"),
  profileUrl: text("profile_url"),
  repositorySelection: varchar("repository_selection", { length: 32 }).notNull().default("all"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const repositories = pgTable("repositories", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  installationId: bigint("installation_id", { mode: "number" })
    .notNull()
    .references(() => githubInstallations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  fullName: varchar("full_name", { length: 512 }).notNull(),
  description: text("description"),
  language: varchar("language", { length: 100 }),
  visibility: varchar("visibility", { length: 20 }).notNull().default("private"),
  htmlUrl: text("html_url").notNull(),
  defaultBranch: varchar("default_branch", { length: 255 }),
  stars: integer("stars").notNull().default(0),
  forks: integer("forks").notNull().default(0),
  openIssues: integer("open_issues").notNull().default(0),
  size: integer("size").notNull().default(0),
  topics: jsonb("topics").$type<string[]>().notNull().default([]),
  isArchived: boolean("is_archived").notNull().default(false),
  isFork: boolean("is_fork").notNull().default(false),
  detectedStatus: repositoryStatus("detected_status").notNull().default("Started"),
  manualStatus: repositoryStatus("manual_status"),
  progress: integer("progress").notNull().default(0),
  pushedAt: timestamp("pushed_at", { withTimezone: true }),
  githubUpdatedAt: timestamp("github_updated_at", { withTimezone: true }),
  removedAt: timestamp("removed_at", { withTimezone: true }),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("repositories_full_name_idx").on(table.fullName),
  index("repositories_installation_idx").on(table.installationId),
  index("repositories_status_idx").on(table.detectedStatus),
]);

export const activityEvents = pgTable("activity_events", {
  id: varchar("id", { length: 128 }).primaryKey(),
  repositoryId: bigint("repository_id", { mode: "number" }).references(() => repositories.id, { onDelete: "cascade" }),
  installationId: bigint("installation_id", { mode: "number" }).references(() => githubInstallations.id, { onDelete: "cascade" }),
  eventType: varchar("event_type", { length: 64 }).notNull(),
  action: varchar("action", { length: 64 }),
  title: text("title").notNull(),
  detail: text("detail"),
  commitCount: integer("commit_count").notNull().default(0),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("activity_repository_idx").on(table.repositoryId),
  index("activity_occurred_idx").on(table.occurredAt),
]);

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: varchar("id", { length: 128 }).primaryKey(),
  event: varchar("event", { length: 64 }).notNull(),
  action: varchar("action", { length: 64 }),
  status: syncStatus("status").notNull().default("running"),
  error: text("error"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});

export const syncRuns = pgTable("sync_runs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  installationId: bigint("installation_id", { mode: "number" }).references(() => githubInstallations.id, { onDelete: "set null" }),
  kind: varchar("kind", { length: 32 }).notNull(),
  status: syncStatus("status").notNull().default("running"),
  repositoriesSeen: integer("repositories_seen").notNull().default(0),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});
