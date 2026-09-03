CREATE TYPE "public"."repository_status" AS ENUM('In progress', 'Started', 'Stale', 'Empty', 'Completed', 'Maintained');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('running', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "activity_events" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"repository_id" bigint,
	"installation_id" bigint,
	"event_type" varchar(64) NOT NULL,
	"action" varchar(64),
	"title" text NOT NULL,
	"detail" text,
	"commit_count" integer DEFAULT 0 NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_installations" (
	"id" bigint PRIMARY KEY NOT NULL,
	"account_id" bigint,
	"account_login" varchar(255) NOT NULL,
	"account_type" varchar(32) DEFAULT 'User' NOT NULL,
	"avatar_url" text,
	"profile_url" text,
	"repository_selection" varchar(32) DEFAULT 'all' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repositories" (
	"id" bigint PRIMARY KEY NOT NULL,
	"installation_id" bigint NOT NULL,
	"name" varchar(255) NOT NULL,
	"full_name" varchar(512) NOT NULL,
	"description" text,
	"language" varchar(100),
	"visibility" varchar(20) DEFAULT 'private' NOT NULL,
	"html_url" text NOT NULL,
	"default_branch" varchar(255),
	"stars" integer DEFAULT 0 NOT NULL,
	"forks" integer DEFAULT 0 NOT NULL,
	"open_issues" integer DEFAULT 0 NOT NULL,
	"size" integer DEFAULT 0 NOT NULL,
	"topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"is_fork" boolean DEFAULT false NOT NULL,
	"detected_status" "repository_status" DEFAULT 'Started' NOT NULL,
	"manual_status" "repository_status",
	"progress" integer DEFAULT 0 NOT NULL,
	"pushed_at" timestamp with time zone,
	"github_updated_at" timestamp with time zone,
	"removed_at" timestamp with time zone,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"installation_id" bigint,
	"kind" varchar(32) NOT NULL,
	"status" "sync_status" DEFAULT 'running' NOT NULL,
	"repositories_seen" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"event" varchar(64) NOT NULL,
	"action" varchar(64),
	"status" "sync_status" DEFAULT 'running' NOT NULL,
	"error" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_installation_id_github_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."github_installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_installation_id_github_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."github_installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_installation_id_github_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."github_installations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_repository_idx" ON "activity_events" USING btree ("repository_id");--> statement-breakpoint
CREATE INDEX "activity_occurred_idx" ON "activity_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "repositories_full_name_idx" ON "repositories" USING btree ("full_name");--> statement-breakpoint
CREATE INDEX "repositories_installation_idx" ON "repositories" USING btree ("installation_id");--> statement-breakpoint
CREATE INDEX "repositories_status_idx" ON "repositories" USING btree ("detected_status");