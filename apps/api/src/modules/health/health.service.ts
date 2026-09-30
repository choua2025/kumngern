import { AppError } from '../../lib/errors.js';
import { lifecycle } from '../../lib/lifecycle.js';
import { healthRepository } from './health.repository.js';

const DB_PING_TIMEOUT_MS = 2_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export const healthService = {
  /** Liveness: the process is running and the event loop responds. No I/O on purpose. */
  liveness() {
    return { status: 'ok' as const, uptime: process.uptime() };
  },

  /** Readiness: this instance can serve traffic right now. */
  async readiness(): Promise<void> {
    if (lifecycle.isShuttingDown) {
      throw new AppError('INTERNAL_ERROR', 'Server is shutting down', { status: 503 });
    }
    try {
      await withTimeout(healthRepository.ping(), DB_PING_TIMEOUT_MS);
    } catch (error) {
      throw new AppError('INTERNAL_ERROR', 'Database unavailable', { status: 503, cause: error });
    }
  },
};
