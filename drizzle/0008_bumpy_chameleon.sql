DROP INDEX "idx_providers_enabled_weight";--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "priority" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "cost_per_mtok" numeric(10, 4);--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "group_tag" varchar(50);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "provider_group" varchar(50);--> statement-breakpoint
CREATE INDEX "idx_providers_enabled_priority" ON "providers" USING btree ("is_enabled","priority","weight") WHERE "providers"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_providers_group" ON "providers" USING btree ("group_tag") WHERE "providers"."deleted_at" IS NULL;