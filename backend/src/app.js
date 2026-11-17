import { randomUUID } from 'node:crypto';
import express from 'express';
import { loadRuntimeConfig } from './config/runtime.js';
import { createCorsMiddleware } from './middleware/cors.js';
import { createLogger } from './observability/logger.js';
import { metrics as defaultMetrics } from './observability/metrics.js';
import { createAiRouter } from './routes/ai.js';
import { createAnalyticsRouter } from './routes/analytics.js';
import { createFeedbackRouter } from './routes/feedback.js';
import { createMetricsRouter } from './routes/metrics.js';
import { createTelemetryRouter } from './routes/telemetry.js';

function routeLabel(request) {
  if (!request.route?.path) return 'unmatched';
  return `${request.baseUrl ?? ''}${request.route.path}` || 'unmatched';
}

export function createApp({
  interpretIntent,
  config = loadRuntimeConfig(),
  logger,
  metricsStore = defaultMetrics,
} = {}) {
  const app = express();
  const log = logger ?? createLogger({
    level: config.logLevel,
    base: {
      service: 'solguard-api',
      environment: config.appEnvironment,
      version: config.appVersion,
    },
  });

  app.locals.config = config;
  app.locals.logger = log;
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxyHops);

  app.use((request, response, next) => {
    const requestId = randomUUID();
    response.locals.requestId = requestId;
    response.locals.environment = config.appEnvironment;
    response.locals.appVersion = config.appVersion;
    response.setHeader('X-Request-Id', requestId);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    response.setHeader('Cache-Control', 'no-store');
    if (config.https) {
      response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    const startedAt = process.hrtime.bigint();
    response.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const route = routeLabel(request);
      metricsStore.recordRequest({
        route,
        status: response.statusCode,
        durationMs,
      });
      log.info('api.request', {
        requestId,
        method: request.method,
        route,
        status: response.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
      });
    });
    next();
  });

  app.use(createCorsMiddleware(config));
  app.use(express.json({ limit: '8kb', strict: true }));

  app.get('/api/health', (_request, response) => {
    response.json({
      status: 'ok',
      environment: config.appEnvironment,
      version: config.appVersion,
      network: config.solanaNetwork,
      mainnetEnabled: config.mainnetEnabled,
      betaProgramEnabled: config.featureBetaProgram,
      uptimeSeconds: Math.floor(process.uptime()),
    });
  });

  app.use('/api/metrics', createMetricsRouter({
    token: config.metricsToken,
    metricsStore,
  }));

  app.use('/api/telemetry', createTelemetryRouter({
    enabled: config.featureClientTelemetry,
    metricsStore,
  }));

  app.use('/api/analytics', createAnalyticsRouter({
    enabled: config.featureBetaProgram,
    webhookUrl: config.analyticsWebhookUrl,
    webhookToken: config.analyticsWebhookToken,
    metricsStore,
    logger: log,
  }));

  app.use('/api/feedback', createFeedbackRouter({
    enabled: config.featureBetaProgram,
    webhookUrl: config.feedbackWebhookUrl,
    webhookToken: config.feedbackWebhookToken,
    metricsStore,
    logger: log,
  }));

  app.use('/api/ai', createAiRouter({
    interpret: interpretIntent,
    enabled: config.featureAiInterpretation,
    metricsStore,
  }));

  app.use((_request, response) => {
    response.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'The requested API route was not found.',
        requestId: response.locals.requestId,
      },
    });
  });

  app.use((error, _request, response, next) => {
    if (response.headersSent) {
      next(error);
      return;
    }

    if (error.type === 'entity.too.large') {
      response.status(413).json({
        error: {
          code: 'REQUEST_TOO_LARGE',
          message: 'The request body exceeds the allowed size.',
          requestId: response.locals.requestId,
        },
      });
      return;
    }

    if (error.type === 'entity.parse.failed') {
      response.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'The request body must contain valid JSON.',
          requestId: response.locals.requestId,
        },
      });
      return;
    }

    metricsStore.recordError();
    log.error('api.unhandled_error', {
      requestId: response.locals.requestId,
      route: routeLabel(_request),
      status: 500,
    }, error);
    response.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'The request could not be completed.',
        requestId: response.locals.requestId,
      },
    });
  });

  return app;
}
