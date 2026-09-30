import type { AuthResponse, RegisterInput } from '@income-expenses/shared';
import type { Express } from 'express';
import type { Response } from 'supertest';
import request from 'supertest';

export const TEST_PASSWORD = 'Password123!';

let counter = 0;

/** Unique email per call so tests never collide. */
export function uniqueEmail(prefix = 'user'): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}@example.com`;
}

/** Value of the `rt` cookie from a Set-Cookie header, or undefined. */
export function getRefreshCookie(res: Response): string | undefined {
  const header = res.headers['set-cookie'] as string[] | string | undefined;
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  const match = cookies.map((cookie) => /^rt=([^;]*)/.exec(cookie)).find(Boolean);
  const value = match?.[1];
  return value ? decodeURIComponent(value) : undefined;
}

export function refreshCookieHeader(token: string): string {
  return `rt=${encodeURIComponent(token)}`;
}

export interface TestUser extends AuthResponse {
  refreshToken: string;
  email: string;
  password: string;
}

export async function registerUser(
  app: Express,
  overrides: Partial<RegisterInput> = {},
): Promise<TestUser> {
  const input: RegisterInput = {
    email: uniqueEmail(),
    password: TEST_PASSWORD,
    displayName: 'Test User',
    defaultCurrency: 'THB',
    ...overrides,
  };
  const res = await request(app).post('/api/v1/auth/register').send(input);
  if (res.status !== 201) {
    throw new Error(`registerUser failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  const body = res.body as { data: AuthResponse };
  const refreshToken = getRefreshCookie(res);
  if (!refreshToken) {
    throw new Error('registerUser: no refresh cookie');
  }
  return { ...body.data, refreshToken, email: input.email, password: input.password };
}
