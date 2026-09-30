import { z } from 'zod';

/**
 * Every environment variable the API reads, validated once at startup.
 * Adding a variable? Add it here AND to .env.example.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),

  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/, error: 'must be a postgresql:// URL' }),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  /** Comma-separated list of allowed browser origins. Empty = same-origin only (production). */
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    )
    .pipe(z.array(z.url())),

  /** Number of reverse proxies in front of the API (host nginx + web nginx = 2 in production). */
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),

  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(300),

  /** Grace period for in-flight requests on SIGTERM before the process is killed. */
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Pure function (no side effects) so it can be unit-tested with any input.
 * The error message lists variable names and reasons only — never the values,
 * because they may be secrets.
 */
export function parseEnv(source: Record<string, string | undefined>): Readonly<Env> {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${problems}`);
  }
  return Object.freeze(result.data);
}
