ALTER TABLE "providers" RENAME COLUMN "cost_per_mtok" TO "cost_multiplier";--> statement-breakpoint
ALTER TABLE "message_request" ADD COLUMN "api_type" varchar(20);--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "provider_type" varchar(20) DEFAULT 'claude' NOT NULL;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "model_redirects" jsonb;