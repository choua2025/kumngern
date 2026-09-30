-- Hand-written migration: everything Prisma schema cannot express.
-- See docs/erd.md section 2 for the rationale of each constraint.

-- =========================================================================
-- 1. CHECK constraints
-- =========================================================================

-- users
ALTER TABLE "users"
  ADD CONSTRAINT "chk_users_email_lower" CHECK ("email" = lower("email"));

-- wallets
ALTER TABLE "wallets"
  ADD CONSTRAINT "chk_wallets_type"
    CHECK ("type" IN ('cash', 'bank', 'ewallet', 'credit_card', 'saving'));

-- categories
ALTER TABLE "categories"
  ADD CONSTRAINT "chk_categories_type" CHECK ("type" IN ('income', 'expense')),
  ADD CONSTRAINT "chk_categories_color" CHECK ("color" IS NULL OR "color" ~ '^#[0-9A-Fa-f]{6}$'),
  ADD CONSTRAINT "chk_categories_not_self_parent" CHECK ("parent_id" IS NULL OR "parent_id" <> "category_id");

-- transactions
ALTER TABLE "transactions"
  ADD CONSTRAINT "chk_tx_type" CHECK ("type" IN ('income', 'expense', 'transfer')),
  ADD CONSTRAINT "chk_tx_amount" CHECK ("amount" > 0),
  ADD CONSTRAINT "chk_tx_shape" CHECK (
    ("type" IN ('income', 'expense') AND "category_id" IS NOT NULL AND "to_wallet_id" IS NULL)
    OR
    ("type" = 'transfer' AND "to_wallet_id" IS NOT NULL AND "category_id" IS NULL AND "to_wallet_id" <> "wallet_id")
  ),
  ADD CONSTRAINT "chk_tx_to_amount" CHECK ("to_amount" IS NULL OR ("type" = 'transfer' AND "to_amount" > 0));

-- budgets
ALTER TABLE "budgets"
  ADD CONSTRAINT "chk_budgets_month_first_day" CHECK (EXTRACT(DAY FROM "month") = 1),
  ADD CONSTRAINT "chk_budgets_limit" CHECK ("limit_amount" > 0),
  ADD CONSTRAINT "chk_budgets_alert" CHECK ("alert_percent" BETWEEN 1 AND 100);

-- recurring_transactions
-- (no end_date >= next_run_date check: the cron job moves next_run_date past end_date
--  on the final run — validated in Zod instead, see design-doc X9)
ALTER TABLE "recurring_transactions"
  ADD CONSTRAINT "chk_rec_type" CHECK ("type" IN ('income', 'expense')),
  ADD CONSTRAINT "chk_rec_amount" CHECK ("amount" > 0),
  ADD CONSTRAINT "chk_rec_frequency" CHECK ("frequency" IN ('daily', 'weekly', 'monthly', 'yearly'));

-- attachments
ALTER TABLE "attachments"
  ADD CONSTRAINT "chk_att_mime"
    CHECK ("mime_type" IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  ADD CONSTRAINT "chk_att_size" CHECK ("size_bytes" > 0 AND "size_bytes" <= 5242880);

-- =========================================================================
-- 2. Partial indexes
--    Prisma created these as full indexes (same name/columns are declared in
--    schema.prisma so Prisma does not try to drop them). Recreate as partial.
-- =========================================================================

DROP INDEX "idx_tx_user_date";
CREATE INDEX "idx_tx_user_date" ON "transactions" ("user_id", "occurred_at" DESC)
  WHERE "deleted_at" IS NULL;

DROP INDEX "idx_recurring_due";
CREATE INDEX "idx_recurring_due" ON "recurring_transactions" ("next_run_date")
  WHERE "is_active";

-- =========================================================================
-- 3. Views
--    Balance is always derived from transactions — never stored (design-doc D1).
--    The view is NOT filtered by user: repositories must add WHERE user_id = $1.
-- =========================================================================

CREATE VIEW "v_wallet_balances" AS
SELECT w."wallet_id",
       w."user_id",
       w."name",
       w."currency_code",
       w."initial_balance"
       + COALESCE(SUM(CASE
           WHEN t."type" = 'income'                                        THEN  t."amount"
           WHEN t."type" = 'expense'                                       THEN -t."amount"
           WHEN t."type" = 'transfer' AND t."wallet_id"    = w."wallet_id" THEN -t."amount"
           WHEN t."type" = 'transfer' AND t."to_wallet_id" = w."wallet_id" THEN COALESCE(t."to_amount", t."amount")
         END), 0) AS "balance"
FROM "wallets" w
LEFT JOIN "transactions" t
       ON (t."wallet_id" = w."wallet_id" OR t."to_wallet_id" = w."wallet_id")
      AND t."deleted_at" IS NULL
GROUP BY w."wallet_id", w."user_id", w."name", w."currency_code", w."initial_balance";
