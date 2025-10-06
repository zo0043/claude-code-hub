CREATE TABLE "system_settings" (
  "id" serial PRIMARY KEY,
  "site_title" varchar(128) NOT NULL DEFAULT 'Claude Code Hub',
  "allow_global_usage_view" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

INSERT INTO "system_settings" ("site_title", "allow_global_usage_view")
VALUES ('Claude Code Hub', true)
ON CONFLICT DO NOTHING;
