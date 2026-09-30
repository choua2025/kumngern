import { pino, type LoggerOptions } from 'pino';
import { config } from '../config/index.js';

/**
 * Paths removed from every log line (engineering rule 9).
 * Defense in depth: the request serializer already omits headers and bodies,
 * but anything logged explicitly (e.g. `logger.info({ body })`) is still scrubbed.
 */
const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  ...[
    'password',
    'currentPassword',
    'newPassword',
    'passwordHash',
    'token',
    'accessToken',
    'refreshToken',
  ].flatMap((key) => [key, `*.${key}`, `*.*.${key}`]),
];

const options: LoggerOptions = {
  level: config.LOG_LEVEL,
  base: { service: 'api', env: config.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  formatters: {
    // "level": "info" instead of "level": 30 — easier to grep and filter.
    level: (label) => ({ level: label }),
  },
};

export const logger =
  config.NODE_ENV === 'development'
    ? pino({
        ...options,
        // Human-readable logs on a developer machine only; production stays JSON.
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss',
            ignore: 'pid,hostname,service,env',
          },
        },
      })
    : pino(options);
