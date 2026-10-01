import { createApp } from './app.js';
import { config } from './config/index.js';
import { startScheduler } from './jobs/scheduler.js';
import { lifecycle } from './lib/lifecycle.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';

const app = createApp();

const server = app.listen(config.PORT, config.HOST, () => {
  logger.info({ host: config.HOST, port: config.PORT }, 'API listening');
});

const scheduler = startScheduler();

// Keep idle connections open longer than the proxy in front of us (nginx: 60 s).
// If Node closed first, nginx could reuse a socket that is being closed → random 502s.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

/**
 * Graceful shutdown (engineering rule 10):
 *   1. mark not-ready so /ready returns 503
 *   2. stop accepting new connections, let in-flight requests finish
 *   3. stop the cron and wait for a running job
 *   4. close the database pool
 *   5. exit — or force-exit if steps 2-4 hang longer than SHUTDOWN_TIMEOUT_MS
 */
async function shutdown(reason: string, exitCode = 0): Promise<void> {
  if (lifecycle.isShuttingDown) return;
  lifecycle.isShuttingDown = true;
  logger.info({ reason }, 'Shutting down');

  const forceExit = setTimeout(() => {
    logger.error(
      { timeoutMs: config.SHUTDOWN_TIMEOUT_MS },
      'Graceful shutdown timed out, forcing exit',
    );
    process.exit(1);
  }, config.SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  try {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      // Idle keep-alive sockets would otherwise keep close() waiting until they time out.
      server.closeIdleConnections();
    });
    await scheduler.stop();
    await prisma.$disconnect();
    logger.info('Shutdown complete');
  } catch (error) {
    logger.error({ err: error }, 'Error during shutdown');
    exitCode = 1;
  }

  logger.flush();
  process.exit(exitCode);
}

// Docker sends SIGTERM on `docker stop`; Ctrl+C sends SIGINT.
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection');
  void shutdown('unhandledRejection', 1);
});

process.on('uncaughtException', (error) => {
  // The process may be in an unknown state — log and exit immediately.
  logger.fatal({ err: error }, 'Uncaught exception');
  logger.flush();
  process.exit(1);
});
