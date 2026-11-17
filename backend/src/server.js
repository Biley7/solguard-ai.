import { createApp } from './app.js';
import { loadRuntimeConfig } from './config/runtime.js';
import { createLogger } from './observability/logger.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '127.0.0.1';

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

const config = loadRuntimeConfig();
const logger = createLogger({
  level: config.logLevel,
  base: {
    service: 'solguard-api',
    environment: config.appEnvironment,
    version: config.appVersion,
  },
});
const app = createApp({ config, logger });

const server = app.listen(port, host, () => {
  logger.info('server.started', { host, port, network: config.solanaNetwork });
});

server.requestTimeout = 30_000;
server.headersTimeout = 35_000;

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('server.shutdown_started', { signal });

  const forceExit = setTimeout(() => {
    logger.error('server.shutdown_forced');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close((error) => {
    clearTimeout(forceExit);
    if (error) {
      logger.error('server.shutdown_failed', {}, error);
      process.exitCode = 1;
      return;
    }
    logger.info('server.stopped');
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (error) => {
  logger.error('process.unhandled_rejection', {}, error);
  process.exitCode = 1;
});
