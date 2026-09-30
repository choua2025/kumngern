-- Verifies v_wallet_balances against the hand-calculated example in docs/erd.md (section 3)
-- and that the CHECK constraints reject malformed transactions.
-- Everything runs inside a transaction that is rolled back — safe to run on any database
-- that has system categories seeded.
--
-- Run:  npm run db:check   (from the repo root)

\set ON_ERROR_STOP off
BEGIN;

INSERT INTO users (email, password_hash, display_name, default_currency)
VALUES ('erd-check@example.com', 'not-a-real-hash', 'ERD check', 'THB');

INSERT INTO wallets (user_id, name, type, currency_code, initial_balance)
SELECT u.user_id, v.name, v.type, v.currency_code, v.initial_balance
FROM users u
CROSS JOIN (VALUES
  ('w1', 'bank', 'THB', 1000.00),
  ('w2', 'cash', 'THB',    0.00),
  ('w3', 'cash', 'USD',    0.00)
) AS v(name, type, currency_code, initial_balance)
WHERE u.email = 'erd-check@example.com';

-- Scenario from docs/erd.md section 3
INSERT INTO transactions (user_id, type, wallet_id, to_wallet_id, category_id, amount, to_amount, occurred_at, deleted_at)
SELECT u.user_id,
       t.type,
       (SELECT wallet_id FROM wallets WHERE user_id = u.user_id AND name = t.src),
       (SELECT wallet_id FROM wallets WHERE user_id = u.user_id AND name = t.dst),
       (SELECT category_id FROM categories
         WHERE user_id IS NULL AND parent_id IS NULL AND name = t.category AND type = t.type),
       t.amount,
       t.to_amount,
       now(),
       t.deleted_at
FROM users u
CROSS JOIN (VALUES
  ('income',   'w1', NULL::text, 'เงินเดือน'::text, 5000.00::numeric, NULL::numeric, NULL::timestamptz),
  ('expense',  'w1', NULL,       'อาหาร',            200.00,          NULL,          NULL),
  ('transfer', 'w1', 'w2',       NULL,              1000.00,          NULL,          NULL),
  ('transfer', 'w1', 'w3',       NULL,              3500.00,          100.00,        NULL),
  ('expense',  'w2', NULL,       'อาหาร',              50.00,          NULL,          now())  -- soft deleted
) AS t(type, src, dst, category, amount, to_amount, deleted_at)
WHERE u.email = 'erd-check@example.com';

\echo
\echo '=== 1. Balances (expected: w1 = 1300.00, w2 = 1000.00, w3 = 100.00) ==='
SELECT b.name,
       b.currency_code,
       b.balance,
       e.expected,
       CASE WHEN b.balance = e.expected THEN 'PASS' ELSE 'FAIL' END AS result
FROM v_wallet_balances b
JOIN users u ON u.user_id = b.user_id AND u.email = 'erd-check@example.com'
JOIN (VALUES ('w1', 1300.00), ('w2', 1000.00), ('w3', 100.00)) AS e(name, expected) ON e.name = b.name
ORDER BY b.name;

\echo '=== 2. A wallet with no transactions must still appear (LEFT JOIN) ==='
INSERT INTO wallets (user_id, name, type, currency_code, initial_balance)
SELECT user_id, 'empty', 'cash', 'THB', 42.00 FROM users WHERE email = 'erd-check@example.com';
SELECT name, balance, CASE WHEN balance = 42.00 THEN 'PASS' ELSE 'FAIL' END AS result
FROM v_wallet_balances
WHERE name = 'empty' AND user_id = (SELECT user_id FROM users WHERE email = 'erd-check@example.com');

\echo '=== 3. CHECK constraints — each statement below MUST fail with the constraint shown ==='

\echo '--- expect chk_tx_shape: transfer to the same wallet'
SAVEPOINT s;
INSERT INTO transactions (user_id, type, wallet_id, to_wallet_id, amount, occurred_at)
SELECT user_id, 'transfer', wallet_id, wallet_id, 10, now()
FROM wallets WHERE name = 'w1' AND user_id = (SELECT user_id FROM users WHERE email = 'erd-check@example.com');
ROLLBACK TO SAVEPOINT s;

\echo '--- expect chk_tx_shape: expense without category'
SAVEPOINT s;
INSERT INTO transactions (user_id, type, wallet_id, amount, occurred_at)
SELECT user_id, 'expense', wallet_id, 10, now()
FROM wallets WHERE name = 'w1' AND user_id = (SELECT user_id FROM users WHERE email = 'erd-check@example.com');
ROLLBACK TO SAVEPOINT s;

\echo '--- expect chk_tx_amount: amount = 0'
SAVEPOINT s;
INSERT INTO transactions (user_id, type, wallet_id, category_id, amount, occurred_at)
SELECT w.user_id, 'expense', w.wallet_id,
       (SELECT category_id FROM categories WHERE user_id IS NULL AND name = 'อาหาร'), 0, now()
FROM wallets w WHERE w.name = 'w1' AND w.user_id = (SELECT user_id FROM users WHERE email = 'erd-check@example.com');
ROLLBACK TO SAVEPOINT s;

\echo '--- expect chk_tx_to_amount: to_amount on an expense'
SAVEPOINT s;
INSERT INTO transactions (user_id, type, wallet_id, category_id, amount, to_amount, occurred_at)
SELECT w.user_id, 'expense', w.wallet_id,
       (SELECT category_id FROM categories WHERE user_id IS NULL AND name = 'อาหาร'), 10, 5, now()
FROM wallets w WHERE w.name = 'w1' AND w.user_id = (SELECT user_id FROM users WHERE email = 'erd-check@example.com');
ROLLBACK TO SAVEPOINT s;

\echo '--- expect chk_users_email_lower'
SAVEPOINT s;
INSERT INTO users (email, password_hash, display_name, default_currency)
VALUES ('Upper@Example.com', 'x', 'x', 'THB');
ROLLBACK TO SAVEPOINT s;

\echo '--- expect chk_budgets_month_first_day'
SAVEPOINT s;
INSERT INTO budgets (user_id, category_id, month, limit_amount)
SELECT user_id, (SELECT category_id FROM categories WHERE user_id IS NULL AND name = 'อาหาร'), DATE '2026-09-15', 100
FROM users WHERE email = 'erd-check@example.com';
ROLLBACK TO SAVEPOINT s;

\echo '--- expect "cannot insert a non-DEFAULT value into column" (GENERATED ALWAYS AS IDENTITY)'
SAVEPOINT s;
INSERT INTO users (user_id, email, password_hash, display_name, default_currency)
VALUES (999999, 'identity@example.com', 'x', 'x', 'THB');
ROLLBACK TO SAVEPOINT s;

\echo '=== 4. Deleting a user cascades everything (NO ACTION FKs are checked after the cascade) ==='
DELETE FROM users WHERE email = 'erd-check@example.com';
SELECT count(*) AS leftover_wallets,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS result
FROM wallets WHERE name IN ('w1', 'w2', 'w3', 'empty');

ROLLBACK;
