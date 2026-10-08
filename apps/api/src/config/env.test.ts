import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.js';

const validEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  PASSWORD_RESET_SECRET: 'y'.repeat(32),
};

describe('parseEnv', () => {
  it('applies defaults when only required variables are set', () => {
    const env = parseEnv(validEnv);

    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      LOG_LEVEL: 'info',
      CORS_ORIGINS: [],
      TRUST_PROXY: 0,
      RATE_LIMIT_PER_MINUTE: 300,
    });
  });

  it('coerces numbers and splits CORS_ORIGINS', () => {
    const env = parseEnv({
      ...validEnv,
      PORT: '8080',
      TRUST_PROXY: '2',
      CORS_ORIGINS: 'http://localhost:5173, https://app.example.com',
    });

    expect(env.PORT).toBe(8080);
    expect(env.TRUST_PROXY).toBe(2);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:5173', 'https://app.example.com']);
  });

  it('parses the cron settings and rejects an unknown timezone', () => {
    expect(parseEnv(validEnv)).toMatchObject({ CRON_ENABLED: true, CRON_TZ: 'Asia/Bangkok' });
    expect(parseEnv({ ...validEnv, CRON_ENABLED: 'false' }).CRON_ENABLED).toBe(false);
    expect(() => parseEnv({ ...validEnv, CRON_ENABLED: 'yes' })).toThrow(/CRON_ENABLED/);
    expect(() => parseEnv({ ...validEnv, CRON_TZ: 'Mars/Olympus' })).toThrow(/CRON_TZ/);
  });

  it('treats email as optional, but refuses a half-configured SMTP', () => {
    expect(parseEnv(validEnv).SMTP_HOST).toBeUndefined();
    // docker compose passes an unset ${SMTP_HOST:-} as an empty string
    expect(
      parseEnv({ ...validEnv, SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '' }).SMTP_HOST,
    ).toBeUndefined();
    expect(
      parseEnv({ ...validEnv, SMTP_HOST: 'smtp-relay.brevo.com', MAIL_FROM: 'App <a@b.co>' }),
    ).toMatchObject({ SMTP_PORT: 587, SMTP_SECURE: false });
    expect(() => parseEnv({ ...validEnv, SMTP_HOST: 'smtp-relay.brevo.com' })).toThrow(/MAIL_FROM/);
    expect(() =>
      parseEnv({ ...validEnv, SMTP_HOST: 'h', MAIL_FROM: 'a@b.co', SMTP_USER: 'u' }),
    ).toThrow(/SMTP_PASS/);
    expect(() => parseEnv({ ...validEnv, PASSWORD_RESET_SECRET: 'short' })).toThrow(
      /PASSWORD_RESET_SECRET/,
    );
  });

  it('fails fast and names the missing variable', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it('rejects a non-postgres DATABASE_URL', () => {
    expect(() => parseEnv({ ...validEnv, DATABASE_URL: 'mysql://localhost/db' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('rejects a JWT secret that is too short to be safe', () => {
    expect(() => parseEnv({ ...validEnv, JWT_ACCESS_SECRET: 'secret' })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });

  it('never echoes the (possibly secret) value in the error message', () => {
    const secret = 'super-secret-password-123';
    let message = '';
    try {
      parseEnv({ DATABASE_URL: secret });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toMatch(/DATABASE_URL/);
    expect(message).not.toContain(secret);
  });

  it('returns a frozen object so config cannot be mutated at runtime', () => {
    const env = parseEnv(validEnv);

    expect(Object.isFrozen(env)).toBe(true);
  });
});
