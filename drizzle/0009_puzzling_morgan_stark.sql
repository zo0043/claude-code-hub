ALTER TABLE "message_request" ADD COLUMN "provider_chain" jsonb;--> statement-breakpoint
ALTER TABLE "message_request" ADD COLUMN "status_code" integer;--> statement-breakpoint
ALTER TABLE "message_request" ADD COLUMN "input_tokens" integer;--> statement-breakpoint
ALTER TABLE "message_request" ADD COLUMN "output_tokens" integer;--> statement-breakpoint
ALTER TABLE "message_request" ADD COLUMN "cache_creation_input_tokens" integer;--> statement-breakpoint
ALTER TABLE "message_request" ADD COLUMN "cache_read_input_tokens" integer;--> statement-breakpoint
ALTER TABLE "message_request" ADD COLUMN "error_message" text;