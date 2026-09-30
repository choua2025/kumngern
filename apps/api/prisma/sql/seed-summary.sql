-- Read-only overview of the seeded demo data.
-- Run:  npm run db:summary   (from the repo root)

\echo '=== Wallet balances (from v_wallet_balances) ==='
SELECT u.email, b.name AS wallet, b.currency_code, b.balance
FROM v_wallet_balances b
JOIN users u USING (user_id)
ORDER BY u.email, b.wallet_id;

\echo '=== Independent balance check: ledger (UNION ALL) vs view — expect 0 rows ==='
WITH ledger AS (
  SELECT wallet_id, CASE WHEN type = 'income' THEN amount ELSE -amount END AS delta
  FROM transactions WHERE deleted_at IS NULL
  UNION ALL
  SELECT to_wallet_id, COALESCE(to_amount, amount)
  FROM transactions WHERE deleted_at IS NULL AND type = 'transfer'
)
SELECT w.wallet_id, w.name, v.balance AS view_balance,
       w.initial_balance + COALESCE(SUM(l.delta), 0) AS ledger_balance
FROM wallets w
JOIN v_wallet_balances v USING (wallet_id)
LEFT JOIN ledger l USING (wallet_id)
GROUP BY w.wallet_id, w.name, w.initial_balance, v.balance
HAVING v.balance <> w.initial_balance + COALESCE(SUM(l.delta), 0);

\echo '=== Transactions per month (user timezone) ==='
SELECT u.email,
       to_char(date_trunc('month', t.occurred_at AT TIME ZONE u.timezone), 'YYYY-MM') AS month,
       count(*) AS transactions
FROM transactions t
JOIN users u USING (user_id)
WHERE t.deleted_at IS NULL
GROUP BY 1, 2
ORDER BY 1, 2;

\echo '=== Budgets this month (default currency, parent includes children, user timezone) ==='
SELECT u.email,
       c.name AS category,
       b.limit_amount,
       s.spent,
       round(s.spent / b.limit_amount * 100, 1) AS used_percent,
       CASE
         WHEN s.spent / b.limit_amount * 100 > 100 THEN 'over'
         WHEN s.spent / b.limit_amount * 100 >= b.alert_percent THEN 'warning'
         ELSE 'ok'
       END AS status
FROM budgets b
JOIN users u USING (user_id)
JOIN categories c ON c.category_id = b.category_id
CROSS JOIN LATERAL (
  SELECT COALESCE(SUM(t.amount), 0) AS spent
  FROM transactions t
  JOIN wallets w ON w.wallet_id = t.wallet_id
  JOIN categories tc ON tc.category_id = t.category_id
  WHERE t.user_id = b.user_id
    AND t.type = 'expense'
    AND t.deleted_at IS NULL
    AND w.currency_code = u.default_currency
    AND (tc.category_id = b.category_id OR tc.parent_id = b.category_id)
    -- month boundaries in the user's timezone, compared against the raw column (sargable)
    AND t.occurred_at >= (b.month::timestamp AT TIME ZONE u.timezone)
    AND t.occurred_at <  ((b.month + INTERVAL '1 month')::timestamp AT TIME ZONE u.timezone)
) s
ORDER BY u.email, c.name;
