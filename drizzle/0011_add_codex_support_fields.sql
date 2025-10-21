-- 添加 Codex 支持字段到 providers 表
ALTER TABLE "providers" ADD COLUMN "provider_type" varchar(20) DEFAULT 'claude' NOT NULL;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "model_redirects" jsonb;--> statement-breakpoint

-- 添加 API 类型字段到 message_request 表
ALTER TABLE "message_request" ADD COLUMN "api_type" varchar(20);
