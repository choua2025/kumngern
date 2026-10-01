import {
  TRANSACTION_SORTS,
  TRANSACTION_TYPES,
  type TransactionSort,
} from '@income-expenses/shared';
import { useSearchParams } from 'react-router-dom';
import type { TransactionFilters } from '../../api/transactions';

const PAGE_SIZE = 20;

/**
 * Filters live in the URL (?type=expense&page=2): the back button works, a refresh
 * keeps them, and a link can be shared. Invalid values are simply ignored.
 */
export function useTransactionFilters() {
  const [params, setParams] = useSearchParams();

  const get = (key: string) => params.get(key) ?? undefined;
  const type = get('type');
  const sort = get('sort');
  const page = Number(get('page') ?? '1');

  const filters: TransactionFilters = {
    from: get('from'),
    to: get('to'),
    type: TRANSACTION_TYPES.includes(type as never)
      ? (type as TransactionFilters['type'])
      : undefined,
    walletId: get('walletId'),
    categoryId: get('categoryId'),
    tagId: get('tagId'),
    q: get('q'),
    deleted: params.get('deleted') === 'true',
    sort: TRANSACTION_SORTS.includes(sort as TransactionSort)
      ? (sort as TransactionSort)
      : undefined,
    page: Number.isInteger(page) && page > 0 ? page : 1,
    limit: PAGE_SIZE,
  };

  /** Changing any filter goes back to page 1. */
  const update = (changes: Record<string, string | undefined>) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        if (!('page' in changes)) next.delete('page');
        return next;
      },
      { replace: true },
    );
  };

  const clear = () => setParams(new URLSearchParams(), { replace: true });

  // Drop undefined keys so the query key (and the request) stays minimal.
  const cleanFilters = Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== false),
  ) as TransactionFilters;

  return { filters: cleanFilters, update, clear };
}
