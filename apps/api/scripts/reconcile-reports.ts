/**
 * Reconciles the Reports/Budgets API against INDEPENDENT hand-written SQL on the seeded
 * development database (Phase 6 Definition of Done).
 *
 * The SQL below deliberately uses different techniques from the API:
 *   - months are bucketed with to_char(occurred_at AT TIME ZONE tz) instead of UTC ranges
 *   - sub-categories are found with a subquery instead of an OR / COALESCE join
 * so a shared mistake is unlikely to hide in both.
 *
 * Run:  npm run reconcile -w @income-expenses/api   (after `npm run db:seed`)
 */
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type {
  AuthResponse,
  BudgetDto,
  ByCategoryReportDto,
  SummaryReportDto,
  UserDto,
} from '@income-expenses/shared';
import { createApp } from '../src/app.js';
import { toMoneyString } from '../src/lib/money.js';
import { addMonths, currentMonthIn, lastDayOf } from '../src/lib/month.js';
import { prisma } from '../src/lib/prisma.js';

const DEMO_USERS = ['demo1@example.com', 'demo2@example.com'];
const PASSWORD = 'Password123!';

interface Check {
  user: string;
  label: string;
  api: string;
  sql: string;
}

const checks: Check[] = [];

function check(user: string, label: string, api: unknown, sql: unknown): void {
  checks.push({ user, label, api: String(api), sql: String(sql) });
}

/** SQL numeric (string/Decimal) → "1234.50" — exact decimal, never a JS float. */
const money = (value: string | undefined): string => toMoneyString(value ?? '0');

async function main(): Promise<void> {
  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;

  async function call<T>(path: string, token?: string, body?: object): Promise<T> {
    const res = await fetch(`${base}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
      throw new Error(`${path} → ${res.status} ${await res.text()}`);
    }
    return ((await res.json()) as { data: T }).data;
  }

  try {
    for (const email of DEMO_USERS) {
      const { accessToken: token } = await call<AuthResponse>('/auth/login', undefined, {
        email,
        password: PASSWORD,
      });
      const me = await call<UserDto>('/auth/me', token);
      const month = currentMonthIn(me.timezone);
      const previous = addMonths(month, -1);
      const who = `${email} (${me.defaultCurrency})`;

      // ---- Summary: income / expense per month -------------------------------------
      const summary = await call<SummaryReportDto>(`/reports/summary?month=${month}`, token);
      const sqlMonths = await prisma.$queryRaw<
        { month: string; income: string; expense: string }[]
      >`
        SELECT to_char(t.occurred_at AT TIME ZONE u.timezone, 'YYYY-MM') AS month,
               SUM(CASE WHEN t.type = 'income'  THEN t.amount ELSE 0 END) AS income,
               SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END) AS expense
        FROM transactions t
        JOIN users u   ON u.user_id = t.user_id
        JOIN wallets w ON w.wallet_id = t.wallet_id
        WHERE u.email = ${email}
          AND t.deleted_at IS NULL
          AND w.currency_code = u.default_currency
        GROUP BY 1`;
      const sqlMonth = (m: string) => sqlMonths.find((row) => row.month === m);

      check(who, `summary ${month} income`, summary.income, money(sqlMonth(month)?.income));
      check(who, `summary ${month} expense`, summary.expense, money(sqlMonth(month)?.expense));
      check(
        who,
        `summary ${previous} income`,
        summary.previous.income,
        money(sqlMonth(previous)?.income),
      );
      check(
        who,
        `summary ${previous} expense`,
        summary.previous.expense,
        money(sqlMonth(previous)?.expense),
      );

      // ---- By category (current month, expense, children rolled into parents) ----
      const byCategory = await call<ByCategoryReportDto>(
        `/reports/by-category?from=${month}-01&to=${lastDayOf(month)}&type=expense`,
        token,
      );
      const sqlByCategory = await prisma.$queryRaw<{ category: string; total: string }[]>`
        SELECT COALESCE(parent.name, c.name) AS category, SUM(t.amount) AS total
        FROM transactions t
        JOIN users u        ON u.user_id = t.user_id
        JOIN wallets w      ON w.wallet_id = t.wallet_id
        JOIN categories c   ON c.category_id = t.category_id
        LEFT JOIN categories parent ON parent.category_id = c.parent_id
        WHERE u.email = ${email}
          AND t.type = 'expense'
          AND t.deleted_at IS NULL
          AND w.currency_code = u.default_currency
          AND to_char(t.occurred_at AT TIME ZONE u.timezone, 'YYYY-MM') = ${month}
        GROUP BY 1`;
      const categoryNames = new Set([
        ...byCategory.items.map((item) => item.category.name),
        ...sqlByCategory.map((row) => row.category),
      ]);
      for (const name of categoryNames) {
        check(
          who,
          `by-category ${name}`,
          byCategory.items.find((item) => item.category.name === name)?.total ?? '0.00',
          money(sqlByCategory.find((row) => row.category === name)?.total),
        );
      }

      // ---- Budgets: spent (parent includes children) and status -----------------
      const budgets = await call<BudgetDto[]>(`/budgets?month=${month}`, token);
      const sqlBudgets = await prisma.$queryRaw<
        { category: string; spent: string; status: string }[]
      >`
        SELECT c.name AS category, s.spent,
               CASE WHEN s.spent * 100 > b.limit_amount * 100 THEN 'over'
                    WHEN s.spent * 100 >= b.limit_amount * b.alert_percent THEN 'warning'
                    ELSE 'ok' END AS status
        FROM budgets b
        JOIN users u      ON u.user_id = b.user_id
        JOIN categories c ON c.category_id = b.category_id,
        LATERAL (
          SELECT COALESCE(SUM(t.amount), 0) AS spent
          FROM transactions t
          JOIN wallets w ON w.wallet_id = t.wallet_id
          WHERE t.user_id = b.user_id
            AND t.type = 'expense'
            AND t.deleted_at IS NULL
            AND w.currency_code = u.default_currency
            AND to_char(t.occurred_at AT TIME ZONE u.timezone, 'YYYY-MM') = to_char(b.month, 'YYYY-MM')
            AND t.category_id IN (
              SELECT category_id FROM categories
              WHERE category_id = b.category_id OR parent_id = b.category_id)
        ) s
        WHERE u.email = ${email} AND to_char(b.month, 'YYYY-MM') = ${month}`;
      for (const row of sqlBudgets) {
        const budget = budgets.find((b) => b.category.name === row.category);
        check(who, `budget ${row.category} spent`, budget?.spent, money(row.spent));
        check(who, `budget ${row.category} status`, budget?.status, row.status);
      }
      check(who, 'budget count', budgets.length, sqlBudgets.length);
    }
  } finally {
    server.close();
    await prisma.$disconnect();
  }

  const failed = checks.filter((c) => c.api !== c.sql);
  const width = Math.max(...checks.map((c) => c.label.length));
  let lastUser = '';
  for (const c of checks) {
    if (c.user !== lastUser) {
      process.stdout.write(`\n${c.user}\n`);
      lastUser = c.user;
    }
    const mark = c.api === c.sql ? '✓' : '✗';
    process.stdout.write(
      `  ${mark} ${c.label.padEnd(width)}  api=${c.api.padStart(12)}  sql=${c.sql.padStart(12)}\n`,
    );
  }
  process.stdout.write(`\n${checks.length - failed.length}/${checks.length} checks match\n`);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

await main();
