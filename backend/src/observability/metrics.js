const MAX_DURATION_SAMPLES = 1_000;

function statusClass(status) {
  if (status >= 500) return '5xx';
  if (status >= 400) return '4xx';
  if (status >= 300) return '3xx';
  return '2xx';
}

function percentile(sorted, ratio) {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1);
  return sorted[Math.max(0, index)];
}

export class MetricsRegistry {
  constructor(now = () => Date.now()) {
    this.now = now;
    this.startedAt = now();
    this.reset();
  }

  reset() {
    this.requestTotal = 0;
    this.byStatus = {};
    this.byRoute = {};
    this.durations = [];
    this.durationTotalMs = 0;
    this.events = {};
    this.ai = { requests: 0, ready: 0, clarification: 0, unsupported: 0 };
    this.geminiFailures = 0;
    this.rateLimited = 0;
    this.clientEvents = 0;
    this.telemetryRejected = 0;
  }

  recordRequest({ route = 'unmatched', status = 500, durationMs = 0 }) {
    this.requestTotal += 1;
    const statusKey = statusClass(status);
    this.byStatus[statusKey] = (this.byStatus[statusKey] ?? 0) + 1;
    const routeKey = typeof route === 'string' && route ? route : 'unmatched';
    this.byRoute[routeKey] = (this.byRoute[routeKey] ?? 0) + 1;
    this.durations.push(durationMs);
    if (this.durations.length > MAX_DURATION_SAMPLES) this.durations.shift();
    this.durationTotalMs += durationMs;
  }

  recordAiResult(result) {
    this.ai.requests += 1;
    if (result?.status === 'ready') this.ai.ready += 1;
    else if (result?.status === 'clarification') this.ai.clarification += 1;
    else if (result?.status === 'unsupported') this.ai.unsupported += 1;

    if (result?.source === 'fallback') {
      const reason = result.fallbackReason === 'not_configured' ? 'not_configured' : 'provider_failure';
      this.events[`gemini_${reason}`] = (this.events[`gemini_${reason}`] ?? 0) + 1;
      if (reason !== 'not_configured') this.geminiFailures += 1;
    } else if (result?.source === 'gemini') {
      this.events.gemini_success = (this.events.gemini_success ?? 0) + 1;
    }
  }

  recordRateLimited() {
    this.rateLimited += 1;
    this.events.rate_limited = (this.events.rate_limited ?? 0) + 1;
  }

  recordClientEvent(event) {
    this.clientEvents += 1;
    this.events[`client_${event}`] = (this.events[`client_${event}`] ?? 0) + 1;
  }

  recordTelemetryRejected() {
    this.telemetryRejected += 1;
    this.events.telemetry_rejected = (this.events.telemetry_rejected ?? 0) + 1;
  }

  recordError() {
    this.events.unhandled_api_error = (this.events.unhandled_api_error ?? 0) + 1;
  }

  snapshot() {
    const sorted = [...this.durations].sort((a, b) => a - b);
    return {
      startedAt: new Date(this.startedAt).toISOString(),
      uptimeSeconds: Math.max(0, Math.floor((this.now() - this.startedAt) / 1000)),
      requests: {
        total: this.requestTotal,
        byStatus: { ...this.byStatus },
        byRoute: { ...this.byRoute },
      },
      latencyMs: {
        samples: sorted.length,
        average: sorted.length
          ? Number((this.durationTotalMs / this.requestTotal).toFixed(2))
          : 0,
        p50: percentile(sorted, 0.5),
        p95: percentile(sorted, 0.95),
        max: sorted.at(-1) ?? 0,
      },
      ai: { ...this.ai },
      failures: {
        gemini: this.geminiFailures,
        rateLimited: this.rateLimited,
        unhandledApiErrors: this.events.unhandled_api_error ?? 0,
      },
      clientTelemetry: {
        accepted: this.clientEvents,
        rejected: this.telemetryRejected,
        events: Object.fromEntries(
          Object.entries(this.events)
            .filter(([key]) => key.startsWith('client_'))
            .map(([key, value]) => [key.slice('client_'.length), value]),
        ),
      },
      events: { ...this.events },
    };
  }
}

export const metrics = new MetricsRegistry();
