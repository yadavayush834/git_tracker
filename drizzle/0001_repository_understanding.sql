ALTER TABLE "repositories" ADD COLUMN "understanding" jsonb;--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN "analysis_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN "analyzed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "repositories_analysis_idx" ON "repositories" USING btree ("analyzed_at");
