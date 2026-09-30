import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { AxiosError } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, authHttp, getAccessToken, setAccessToken, setSessionExpiredHandler } from './client';
import { ApiError } from './errors';

function respond(config: InternalAxiosRequestConfig, status: number, data: unknown): AxiosResponse {
  const response = { data, status, statusText: '', headers: {}, config } as AxiosResponse;
  if (status >= 400) {
    throw new AxiosError('failed', String(status), config, null, response);
  }
  return response;
}

const originalApiAdapter = api.defaults.adapter;
const originalAuthAdapter = authHttp.defaults.adapter;

describe('api client', () => {
  let refreshCalls: number;
  let refreshSucceeds: boolean;
  const sessionExpired = vi.fn();

  beforeEach(() => {
    refreshCalls = 0;
    refreshSucceeds = true;
    sessionExpired.mockReset();
    setSessionExpiredHandler(sessionExpired);
    setAccessToken('expired-token');

    // Fake server: /wallets needs "fresh-token"; /auth/refresh issues it (slowly).
    const apiAdapter: AxiosAdapter = (config) => {
      const auth = config.headers.get('Authorization');
      return Promise.resolve(
        auth === 'Bearer fresh-token'
          ? respond(config, 200, { data: 'ok' })
          : respond(config, 401, { error: { code: 'UNAUTHORIZED', message: 'expired' } }),
      );
    };
    const authAdapter: AxiosAdapter = async (config) => {
      refreshCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return refreshSucceeds
        ? respond(config, 200, { data: { accessToken: 'fresh-token' } })
        : respond(config, 401, { error: { code: 'UNAUTHORIZED', message: 'session gone' } });
    };
    api.defaults.adapter = apiAdapter;
    authHttp.defaults.adapter = authAdapter;
  });

  afterEach(() => {
    api.defaults.adapter = originalApiAdapter;
    authHttp.defaults.adapter = originalAuthAdapter;
    setAccessToken(null);
  });

  it('sends ONE refresh for many simultaneous 401s, then retries each request', async () => {
    const results = await Promise.all([
      api.get('/wallets'),
      api.get('/wallets'),
      api.get('/wallets'),
    ]);

    expect(refreshCalls).toBe(1);
    expect(results.map((r) => r.data as unknown)).toEqual([
      { data: 'ok' },
      { data: 'ok' },
      { data: 'ok' },
    ]);
    expect(getAccessToken()).toBe('fresh-token');
  });

  it('gives up and signals session expiry when the refresh fails', async () => {
    refreshSucceeds = false;

    await expect(api.get('/wallets')).rejects.toBeInstanceOf(ApiError);
    expect(sessionExpired).toHaveBeenCalledOnce();
    expect(getAccessToken()).toBeNull();
  });

  it('turns API error bodies into ApiError with code and message', async () => {
    api.defaults.adapter = (config) =>
      Promise.resolve(
        respond(config, 409, {
          error: { code: 'CONFLICT', message: 'มีกระเป๋าชื่อนี้อยู่แล้ว', requestId: 'r1' },
        }),
      );

    await expect(api.post('/wallets', {})).rejects.toMatchObject({
      code: 'CONFLICT',
      status: 409,
      message: 'มีกระเป๋าชื่อนี้อยู่แล้ว',
      requestId: 'r1',
    });
  });
});
