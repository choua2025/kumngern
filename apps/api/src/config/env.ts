import path from 'node:path';
import { z } from 'zod';

/** Compose turns an unset ${VAR:-} into "" — treat it as "not set" for optional values. */
const optionalText = () =>
  z.preprocess((value) => (value === '' ? undefined : value), z.string().min(1).optional());

function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Every environment variable the API reads, validated once at startup.
 * Adding a variable? Add it here AND to .env.example.
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().min(1).default('0.0.0.0'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),

    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/, error: 'must be a postgresql:// URL' }),

    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

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
    LOGIN_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(5),

    // --- Auth ---
    /** HMAC key for access tokens. Generate with: node -e "console.log(crypto.randomBytes(48).toString('base64url'))" */
    JWT_ACCESS_SECRET: z.string().min(32, 'must be at least 32 characters'),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(15 * 60),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
    /** bcrypt work factor. 12 in production (~250 ms/hash); tests use 4 to stay fast. */
    BCRYPT_COST: z.coerce.number().int().min(4).max(15).default(12),

    // --- Forgot password (OTP by email) ---
    /** HMAC key for the stored reset codes. Separate from JWT_ACCESS_SECRET (rotate independently). */
    PASSWORD_RESET_SECRET: z.string().min(32, 'must be at least 32 characters'),
    /** SMTP relay (Brevo in production). Unset = no email: forgot-password answers 503. */
    SMTP_HOST: optionalText(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(587),
    /** "true" = TLS from the first byte (port 465). "false" = STARTTLS upgrade (port 587). */
    SMTP_SECURE: z
      .enum(['true', 'false'], { error: 'must be "true" or "false"' })
      .default('false')
      .transform((value) => value === 'true'),
    SMTP_USER: optionalText(),
    SMTP_PASS: optionalText(),
    /** Sender, e.g. "Income & Expenses <noreply@chdev.site>". Required when SMTP_HOST is set. */
    MAIL_FROM: optionalText(),

    /** Attachment storage root, resolved from the working directory. Docker: /app/uploads (a volume). */
    UPLOAD_DIR: z
      .string()
      .min(1)
      .default('uploads')
      .transform((value) => path.resolve(value)),

    // --- Scheduled jobs ---
    /** "false" turns the in-process cron off (e.g. a second API replica, or debugging). */
    CRON_ENABLED: z
      .enum(['true', 'false'], { error: 'must be "true" or "false"' })
      .default('true')
      .transform((value) => value === 'true'),
    /** Timezone of the cron schedule (00:05 daily). "Today" per recurring uses users.timezone. */
    CRON_TZ: z
      .string()
      .default('Asia/Bangkok')
      .refine(isValidTimezone, 'must be an IANA timezone, e.g. Asia/Bangkok'),

    /** Grace period for in-flight requests on SIGTERM before the process is killed. */
    SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  })
  .superRefine((env, ctx) => {
    // Half-configured email is worse than none: fail at startup, not at the first reset.
    if (env.SMTP_HOST && !env.MAIL_FROM) {
      ctx.addIssue({
        code: 'custom',
        path: ['MAIL_FROM'],
        message: 'required when SMTP_HOST is set',
      });
    }
    if (Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASS)) {
      ctx.addIssue({
        code: 'custom',
        path: ['SMTP_PASS'],
        message: 'set SMTP_USER and SMTP_PASS together',
      });
    }
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
