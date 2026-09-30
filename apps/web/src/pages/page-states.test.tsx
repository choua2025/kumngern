import type { AxiosAdapter, AxiosResponse } from 'axios';
import { AxiosError } from 'axios';
import { screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { api } from '../api/client';
import { BudgetsPage } from '../features/budgets/BudgetsPage';
import { CategoriesPage } from '../features/categories/CategoriesPage';
import { ReportsPage } from '../features/reports/ReportsPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { WalletsPage } from '../features/wallets/WalletsPage';
import { renderPage } from '../test/render-page';

/**
 * Phase 8 Definition of Done: every page has a loading, an empty and an error state.
 * The axios adapter is swapped to make the API hang, answer with no data, or fail.
 */

type Mode = 'loading' | 'empty' | 'error';

const zeroMonth = (month: string) => ({ month, income: '0.00', expense: '0.00', net: '0.00' });

/** What an account with no data at all gets back from each endpoint. */
function emptyBody(url: string): unknown {
  if (url.startsWith('/currencies'))
    return [{ code: 'THB', name: 'Thai Baht', symbol: '฿', decimals: 2 }];
  if (url.startsWith('/reports/summary')) {
    return {
      currencyCode: 'THB',
      ...zeroMonth('2026-09'),
      previous: zeroMonth('2026-08'),
      changePercent: { income: null, expense: null, net: null },
    };
  }
  if (url.startsWith('/reports/daily')) {
    return { currencyCode: 'THB', items: [{ date: '2026-09-01', expense: '0.00' }] };
  }
  if (url.startsWith('/reports/trend'))
    return { currencyCode: 'THB', items: [zeroMonth('2026-09')] };
  if (url.startsWith('/reports/by-category'))
    return { currencyCode: 'THB', total: '0.00', items: [] };
  return []; // wallets, categories, budgets
}

function useMode(mode: Mode): void {
  const adapter: AxiosAdapter = (config) => {
    const url = config.url ?? '';
    if (mode === 'loading') return new Promise(() => undefined); // never resolves
    if (mode === 'error') {
      const response = {
        status: 500,
        statusText: '',
        headers: {},
        config,
        data: { error: { code: 'INTERNAL_ERROR', message: 'ระบบขัดข้อง', requestId: 'req-1' } },
      } as AxiosResponse;
      return Promise.reject(new AxiosError('failed', '500', config, null, response));
    }
    return Promise.resolve({
      status: 200,
      statusText: '',
      headers: {},
      config,
      data: { data: emptyBody(url) },
    } as AxiosResponse);
  };
  api.defaults.adapter = adapter;
}

const originalAdapter = api.defaults.adapter;
afterEach(() => {
  api.defaults.adapter = originalAdapter;
});

const pages: { name: string; element: ReactElement; emptyText: RegExp | null }[] = [
  { name: 'Wallets', element: <WalletsPage />, emptyText: /ยังไม่มีกระเป๋าเงิน/ },
  { name: 'Categories', element: <CategoriesPage />, emptyText: /ยังไม่มีหมวด/ },
  { name: 'Budgets', element: <BudgetsPage />, emptyText: /ยังไม่ได้ตั้งงบ/ },
  { name: 'Reports', element: <ReportsPage />, emptyText: /ไม่มีรายจ่ายในเดือนนี้/ },
  // Settings is a form: it has loading and error states, "empty" does not apply.
  { name: 'Settings', element: <SettingsPage />, emptyText: null },
];

describe.each(pages)('$name page', ({ element, emptyText }) => {
  it('shows a loading state while the API is pending', () => {
    useMode('loading');
    renderPage(element);

    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
  });

  it('shows an error state with the API message and a retry button', async () => {
    useMode('error');
    renderPage(element);

    const alerts = await screen.findAllByRole('alert');
    const alert = alerts.find((node) => node.textContent?.includes('ระบบขัดข้อง'));
    expect(alert).toBeDefined();
    expect(within(alert as HTMLElement).getByText(/req-1/)).toBeInTheDocument();
    expect(
      within(alert as HTMLElement).getByRole('button', { name: 'ลองใหม่' }),
    ).toBeInTheDocument();
  });

  it.runIf(emptyText !== null)('shows an empty state when there is no data', async () => {
    useMode('empty');
    renderPage(element);

    expect(await screen.findByText(emptyText as RegExp)).toBeInTheDocument();
  });
});
