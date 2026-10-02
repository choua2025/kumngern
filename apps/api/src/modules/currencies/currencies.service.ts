import type { CurrencyDto } from '@income-expenses/shared';
import { detail, errors } from '../../lib/errors.js';
import { type CurrenciesRepository, currenciesRepository } from './currencies.repository.js';

export function createCurrenciesService(currencies: CurrenciesRepository) {
  return {
    async list(): Promise<CurrencyDto[]> {
      const rows = await currencies.findAll();
      return rows.map(({ code, name, symbol, decimals }) => ({ code, name, symbol, decimals }));
    },

    /** Throws a field-level VALIDATION_ERROR so forms can show it next to the input. */
    async assertExists(code: string, field = 'defaultCurrency'): Promise<void> {
      if (!(await currencies.exists(code))) {
        throw errors.validation(undefined, [detail(field, 'validation.currencyUnsupported')]);
      }
    },
  };
}

export type CurrenciesService = ReturnType<typeof createCurrenciesService>;

export const currenciesService = createCurrenciesService(currenciesRepository);
