import { randomUUID } from 'node:crypto';
import { API_PREFIX } from '@income-expenses/shared';
import { pinoHttp } from 'pino-http';
import { logger } from './logger.js';

// Accept a caller-supplied id (e.g. from nginx) only if it looks safe to put in logs.
const REQUEST_ID_PATTERN = /^[\w-]{1,64}$/;

export const httpLogger = pinoHttp({
  logger,

  genReqId: (req, res) => {
    const incoming = req.headers['x-request-id'];
    const id =
      typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },

  customLogLevel: (_req, res, error) => {
    if (error || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },

  // Log only what is needed to debug — never headers or bodies (tokens, passwords).
  serializers: {
    req: (req: { id: unknown; method: string; url: string }) => ({
      id: req.id,
      method: req.method,
      url: req.url,
    }),
    res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
  },

  // Uptime monitors hit /health every few minutes; do not flood the logs with them.
  autoLogging: { ignore: (req) => req.url === `${API_PREFIX}/health` },
});
