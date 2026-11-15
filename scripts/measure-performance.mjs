import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from '@playwright/test';

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

const url = argument('url', 'http://127.0.0.1:4173/');
const apiBase = argument('api', 'http://127.0.0.1:3000');
const rpcUrl = argument('rpc', 'https://api.devnet.solana.com');
const output = argument('out', 'perf-artifacts/runtime.json');
const width = Number(argument('width', '1440'));
const height = Number(argument('height', '900'));

function percentile(values, fraction) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))];
}

function summary(samples) {
  return {
    samples: samples.length,
    minMs: samples.length ? Math.round(Math.min(...samples)) : null,
    medianMs: samples.length ? Math.round(percentile(samples, 0.5)) : null,
    p95Ms: samples.length ? Math.round(percentile(samples, 0.95)) : null,
    maxMs: samples.length ? Math.round(Math.max(...samples)) : null,
  };
}

async function timeRequests(count, request) {
  const samples = [];
  for (let index = 0; index < count; index += 1) {
    const start = performance.now();
    const response = await request();
    await response.arrayBuffer();
    samples.push(performance.now() - start);
  }
  return summary(samples);
}

const apiHealth = await timeRequests(20, () => fetch(`${apiBase}/api/health`));
const interpretation = await timeRequests(8, () => fetch(`${apiBase}/api/ai/interpret`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    prompt: 'Send 0.25 SOL to Stake11111111111111111111111111111111111111 for graphic design work.',
  }),
}));

const rpcSamples = [];
for (let index = 0; index < 5; index += 1) {
  const start = performance.now();
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: index + 1,
      method: 'getLatestBlockhash',
      params: [{ commitment: 'finalized' }],
    }),
    signal: AbortSignal.timeout(15_000),
  });
  await response.arrayBuffer();
  rpcSamples.push(performance.now() - start);
}

const browser = await chromium.launch({
  args: ['--enable-precise-memory-info'],
});
const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: 1,
  colorScheme: 'dark',
});
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send('Network.enable');
await cdp.send('Performance.enable');
await cdp.send('Runtime.enable');

const requests = new Map();
const records = [];
cdp.on('Network.responseReceived', (event) => {
  requests.set(event.requestId, {
    url: event.response.url,
    type: event.type,
    status: event.response.status,
    mimeType: event.response.mimeType,
    fromDiskCache: event.response.fromDiskCache,
    fromServiceWorker: event.response.fromServiceWorker,
    encodedDataLength: 0,
  });
});
cdp.on('Network.loadingFinished', (event) => {
  const record = requests.get(event.requestId);
  if (!record) return;
  record.encodedDataLength = event.encodedDataLength;
  records.push(record);
  requests.delete(event.requestId);
});

await page.addInitScript(() => {
  const metrics = {
    lcp: 0,
    cls: 0,
    longTasks: [],
    eventTimings: [],
  };
  window.__solguardPerf = metrics;

  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) metrics.lcp = entry.startTime;
  }).observe({ type: 'largest-contentful-paint', buffered: true });

  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!entry.hadRecentInput) metrics.cls += entry.value;
    }
  }).observe({ type: 'layout-shift', buffered: true });

  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      metrics.longTasks.push({ startTime: entry.startTime, duration: entry.duration });
    }
  }).observe({ type: 'longtask', buffered: true });

  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      metrics.eventTimings.push({ name: entry.name, duration: entry.duration });
    }
  }).observe({ type: 'event', durationThreshold: 16, buffered: true });
});

const started = performance.now();
await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
await page.waitForTimeout(1_000);
const initialResources = [...records];
const initialCdpPerformance = await cdp.send('Performance.getMetrics');
const initialCdpMetrics = Object.fromEntries(
  initialCdpPerformance.metrics.map(({ name, value }) => [name, value]),
);
const initialPageMetrics = await page.evaluate(() => ({
  lcp: window.__solguardPerf.lcp,
  cls: window.__solguardPerf.cls,
  longTasks: [...window.__solguardPerf.longTasks],
  domNodes: document.querySelectorAll('*').length,
  heap: performance.memory ? {
    usedJSHeapSize: performance.memory.usedJSHeapSize,
    totalJSHeapSize: performance.memory.totalJSHeapSize,
  } : null,
}));
const interactionStarted = performance.now();
for (const view of ['copilot', 'scanner', 'history', 'dashboard']) {
  await page.locator(`[data-view="${view}"]`).first().click();
  await page.waitForTimeout(120);
}
const interactionWallMs = performance.now() - interactionStarted;
await page.waitForTimeout(500);
const wallMs = performance.now() - started;

const pageMetrics = await page.evaluate(() => {
  const navigation = performance.getEntriesByType('navigation')[0]?.toJSON() ?? {};
  const paints = Object.fromEntries(
    performance.getEntriesByType('paint').map((entry) => [entry.name, entry.startTime]),
  );
  const resources = performance.getEntriesByType('resource').map((entry) => ({
    name: entry.name,
    initiatorType: entry.initiatorType,
    duration: entry.duration,
    transferSize: entry.transferSize,
    encodedBodySize: entry.encodedBodySize,
    decodedBodySize: entry.decodedBodySize,
  }));
  const perf = window.__solguardPerf;
  return {
    navigation,
    paints,
    resources,
    lcp: perf.lcp,
    cls: perf.cls,
    longTasks: perf.longTasks,
    eventTimings: perf.eventTimings,
    domNodes: document.querySelectorAll('*').length,
    domDepth: (() => {
      let deepest = 0;
      for (const element of document.querySelectorAll('*')) {
        let depth = 0;
        for (let node = element; node; node = node.parentElement) depth += 1;
        deepest = Math.max(deepest, depth);
      }
      return deepest;
    })(),
    stylesheets: [...document.styleSheets].map((sheet) => sheet.href ?? 'inline'),
    heap: performance.memory ? {
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
    } : null,
  };
});

await cdp.send('HeapProfiler.enable').catch(() => {});
await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
const cdpPerformance = await cdp.send('Performance.getMetrics');
const cdpMetrics = Object.fromEntries(
  cdpPerformance.metrics.map(({ name, value }) => [name, value]),
);

const duplicateRequests = Object.entries(
  records.reduce((counts, record) => {
    const key = `${record.url}`;
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {}),
)
  .filter(([, count]) => count > 1)
  .map(([requestUrl, count]) => ({ url: requestUrl, count }));

const byType = records.reduce((totals, record) => {
  const key = record.type || 'Other';
  totals[key] = (totals[key] ?? 0) + record.encodedDataLength;
  return totals;
}, {});

const eventDurations = pageMetrics.eventTimings.map(({ duration }) => duration);

const result = {
  measuredAt: new Date().toISOString(),
  url,
  viewport: { width, height },
  build: {
    jsBytes: readdirSync('dist/assets', { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
      .map((entry) => ({ file: entry.name, bytes: readFileSync(`dist/assets/${entry.name}`).length })),
    cssBytes: readdirSync('dist/assets', { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.css'))
      .map((entry) => ({ file: entry.name, bytes: readFileSync(`dist/assets/${entry.name}`).length })),
  },
  initialLoad: {
    wallMs: Math.round(wallMs),
    domContentLoadedMs: Math.round(pageMetrics.navigation.domContentLoadedEventEnd ?? 0),
    loadMs: Math.round(pageMetrics.navigation.loadEventEnd ?? 0),
    firstPaintMs: Math.round(pageMetrics.paints['first-paint'] ?? 0),
    firstContentfulPaintMs: Math.round(pageMetrics.paints['first-contentful-paint'] ?? 0),
    largestContentfulPaintMs: Math.round(initialPageMetrics.lcp),
    cumulativeLayoutShift: Number(initialPageMetrics.cls.toFixed(4)),
    interactionToNextPaintProxyMs: eventDurations.length ? Math.round(percentile(eventDurations, 0.98)) : null,
    interactionWallMs: Math.round(interactionWallMs),
  },
  rendering: {
    domNodes: initialPageMetrics.domNodes,
    domDepth: pageMetrics.domDepth,
    longTaskCount: initialPageMetrics.longTasks.length,
    longTaskTotalMs: Math.round(initialPageMetrics.longTasks.reduce((total, task) => total + task.duration, 0)),
    layoutCount: cdpMetrics.LayoutCount ?? null,
    recalcStyleCount: cdpMetrics.RecalcStyleCount ?? null,
    scriptDurationMs: Math.round((cdpMetrics.ScriptDuration ?? 0) * 1000),
    taskDurationMs: Math.round((cdpMetrics.TaskDuration ?? 0) * 1000),
  },
  memory: {
    initialUsedJSHeapBytes: Math.round(initialCdpMetrics.JSHeapUsedSize ?? initialPageMetrics.heap?.usedJSHeapSize ?? 0),
    initialTotalJSHeapBytes: Math.round(initialCdpMetrics.JSHeapTotalSize ?? initialPageMetrics.heap?.totalJSHeapSize ?? 0),
    usedJSHeapBytes: Math.round((cdpMetrics.JSHeapUsedSize ?? pageMetrics.heap?.usedJSHeapSize ?? 0)),
    totalJSHeapBytes: Math.round(cdpMetrics.JSHeapTotalSize ?? pageMetrics.heap?.totalJSHeapSize ?? 0),
  },
  network: {
    initialRequestCount: initialResources.length,
    initialTransferredBytes: initialResources.reduce((total, record) => total + record.encodedDataLength, 0),
    initialByType: initialResources.reduce((totals, record) => {
      const key = record.type || 'Other';
      totals[key] = (totals[key] ?? 0) + record.encodedDataLength;
      return totals;
    }, {}),
    requestCount: records.length,
    transferredBytes: records.reduce((total, record) => total + record.encodedDataLength, 0),
    byType,
    duplicateRequests,
    resources: records
      .filter((record) => record.encodedDataLength > 0)
      .map((record) => ({
        url: record.url,
        type: record.type,
        status: record.status,
        bytes: record.encodedDataLength,
        fromDiskCache: record.fromDiskCache,
      })),
  },
  latency: {
    apiHealth,
    interpretation,
    devnetRpc: summary(rpcSamples),
  },
};

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));

await browser.close();
