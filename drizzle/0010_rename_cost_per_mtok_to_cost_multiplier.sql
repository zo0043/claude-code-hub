-- 重命名 providers 表的 cost_per_mtok 列为 cost_multiplier，并设置默认值为 1.0
ALTER TABLE "providers" RENAME COLUMN "cost_per_mtok" TO "cost_multiplier";--> statement-breakpoint

-- 更新所有 NULL 值为默认值 1.0
UPDATE "providers" SET "cost_multiplier" = '1.0' WHERE "cost_multiplier" IS NULL;--> statement-breakpoint

-- 设置列的默认值为 1.0
ALTER TABLE "providers" ALTER COLUMN "cost_multiplier" SET DEFAULT '1.0';
