ALTER TABLE "message_request"
  ALTER COLUMN "cost_usd" TYPE numeric(21, 15),
  ALTER COLUMN "cost_usd" SET DEFAULT 0;
