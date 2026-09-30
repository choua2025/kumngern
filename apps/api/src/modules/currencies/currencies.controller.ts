import { asyncHandler } from '../../lib/async-handler.js';
import { currenciesService } from './currencies.service.js';

export const currenciesController = {
  list: asyncHandler(async (_req, res) => {
    const currencies = await currenciesService.list();
    // Reference data that rarely changes — let the browser cache it briefly.
    res.set('Cache-Control', 'public, max-age=3600').json({ data: currencies });
  }),
};
