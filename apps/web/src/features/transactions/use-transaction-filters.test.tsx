import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { useTransactionFilters } from './use-transaction-filters';

function filtersFor(url: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  );
  return renderHook(() => useTransactionFilters(), { wrapper }).result.current.filters;
}

describe('useTransactionFilters', () => {
  it('reads EVERY filter from the URL (regression: tagId was ignored)', () => {
    const filters = filtersFor(
      '/transactions?from=2026-09-01&to=2026-09-30&type=expense&walletId=1&categoryId=2&tagId=3&q=coffee&deleted=true&sort=amount:desc&page=2',
    );

    expect(filters).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
      type: 'expense',
      walletId: '1',
      categoryId: '2',
      tagId: '3',
      q: 'coffee',
      deleted: true,
      sort: 'amount:desc',
      page: 2,
      limit: 20,
    });
  });

  it('ignores invalid values instead of sending them to the API', () => {
    const filters = filtersFor('/transactions?type=bogus&sort=nope&page=-1');

    expect(filters).toEqual({ page: 1, limit: 20 });
  });
});
