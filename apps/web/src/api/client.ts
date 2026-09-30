import { API_PREFIX, type AccessTokenResponse } from '@income-expenses/shared';
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { toApiError } from './errors';

// ---------------------------------------------------------------------------
// Access token: in MEMORY only (design-doc D4). A page reload loses it; the app
// then gets a new one from the httpOnly refresh cookie ("silent login").
// ---------------------------------------------------------------------------

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

let onSessionExpired: () => void = () => undefined;

/** The auth provider registers what to do when refreshing fails (→ back to /login). */
export function setSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler;
}

/** Used for /auth/* calls: no interceptors, so a failing refresh cannot loop. */
export const authHttp = axios.create({ baseURL: API_PREFIX, withCredentials: true });

/** Used for everything else. */
export const api = axios.create({ baseURL: API_PREFIX, withCredentials: true });

// ---------------------------------------------------------------------------
// Single-flight refresh: however many requests hit 401 at the same time (or React
// StrictMode mounting twice), only ONE /auth/refresh is sent. Two refreshes with the
// same cookie would look like token theft to the API and log the user out everywhere.
// ---------------------------------------------------------------------------

let refreshInFlight: Promise<string> | null = null;

export function refreshAccessToken(): Promise<string> {
  refreshInFlight ??= authHttp
    .post<{ data: AccessTokenResponse }>('/auth/refresh')
    .then((response) => {
      setAccessToken(response.data.data.accessToken);
      return response.data.data.accessToken;
    })
    .catch((error: unknown) => {
      setAccessToken(null);
      throw toApiError(error);
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }
  return config;
});

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const original = error.config as RetriableConfig | undefined;

  // Expired access token → refresh once, then replay the original request once.
  if (error.response?.status === 401 && original && !original._retried) {
    original._retried = true;
    try {
      await refreshAccessToken();
    } catch (refreshError) {
      onSessionExpired();
      throw toApiError(refreshError);
    }
    return api(original);
  }

  throw toApiError(error);
});
