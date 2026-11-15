import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from '@playwright/test';

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

const url = argument('url', 'http://127.0.0.1:4173/');
const output = argument('out', 'perf-artifacts/responsive.json');
const screenshotDirectory = argument('screens', 'perf-artifacts/responsive');
const widths = [1440, 1280, 1024, 768, 390, 360];
const themes = ['dark', 'light'];
const views = ['dashboard', 'copilot'];

mkdirSync(screenshotDirectory, { recursive: true });

const browser = await chromium.launch();
const results = [];

for (const theme of themes) {
  for (const width of widths) {
    const context = await browser.newContext({
      viewport: { width, height: width <= 390 ? 844 : 900 },
      colorScheme: theme,
      reducedMotion: 'no-preference',
    });
    for (const view of views) {
      const page = await context.newPage();
      await page.goto(`${url}#${view}`, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForSelector('#app-content h1', { timeout: 15_000 });

      const measurements = await page.evaluate(() => {
        const visuallyHiddenAncestor = (element) => {
          for (let parent = element; parent; parent = parent.parentElement) {
            const style = getComputedStyle(parent);
            const clipped = style.clipPath && style.clipPath !== 'none';
            const tinyAbsolute = style.position === 'absolute'
              && parseFloat(style.width) <= 1
              && parseFloat(style.height) <= 1
              && style.overflow === 'hidden';
            if (clipped || tinyAbsolute) return true;
          }
          return false;
        };
        const visible = (element) => {
          if (element.hidden || element.closest('[hidden]')) return false;
          if (visuallyHiddenAncestor(element)) return false;
          const style = getComputedStyle(element);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        };
        const describe = (element) => ({
          tag: element.tagName.toLowerCase(),
          id: element.id,
          className: typeof element.className === 'string' ? element.className.slice(0, 120) : '',
          label: element.getAttribute('aria-label') ?? element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 80) ?? '',
          rect: (() => {
            const rect = element.getBoundingClientRect();
            return {
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              top: Math.round(rect.top),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            };
          })(),
        });
        const withinScrollContainer = (element) => {
          for (let parent = element.parentElement; parent; parent = parent.parentElement) {
            const style = getComputedStyle(parent);
            if (['auto', 'scroll'].includes(style.overflowX) && parent.scrollWidth > parent.clientWidth + 1) {
              return true;
            }
          }
          return false;
        };
        const interactive = [...document.querySelectorAll('button, a[href], input, select, textarea')]
          .filter(visible);
        const scrollRegions = [...document.querySelectorAll('*')]
          .filter(visible)
          .filter((element) => {
            const style = getComputedStyle(element);
            return ['auto', 'scroll'].includes(style.overflowX)
              && element.scrollWidth > element.clientWidth + 1;
          });
        const offscreen = [...document.querySelectorAll('body *')]
          .filter(visible)
          .filter((element) => {
            if (element.closest('#app-sidebar, .sidebar-scrim, .toast-region, [aria-hidden="true"]')) return false;
            if (withinScrollContainer(element)) return false;
            const rect = element.getBoundingClientRect();
            return rect.right > window.innerWidth + 1 || rect.left < -1;
          })
          .map(describe)
          .slice(0, 20);
        const undersized = interactive
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.width < 24 || rect.height < 24;
          })
          .map(describe);
        const clippedText = [...document.querySelectorAll('h1, h2, h3, p, span, strong, small, td, th')]
          .filter(visible)
          .filter((element) => {
            const style = getComputedStyle(element);
            if (style.textOverflow === 'ellipsis') return false;
            return element.scrollWidth > element.clientWidth + 2 && style.overflow === 'hidden';
          })
          .map(describe)
          .slice(0, 20);
        const unfocusableScrollRegions = scrollRegions
          .filter((element) => !element.hasAttribute('tabindex'))
          .map(describe);
        return {
          viewport: { width: window.innerWidth, height: window.innerHeight },
          documentWidth: document.documentElement.scrollWidth,
          horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
          bodyHeight: Math.round(document.body.getBoundingClientRect().height),
          topbar: describe(document.querySelector('.topbar')),
          main: describe(document.querySelector('#app-content')),
          sidebarOpen: document.querySelector('#app-sidebar')?.classList.contains('is-open') ?? false,
          mobileMenuVisible: visible(document.querySelector('#menu-toggle')),
          offscreen,
          undersized,
          clippedText,
          interactiveCount: interactive.length,
          scrollRegionCount: scrollRegions.length,
          unfocusableScrollRegions,
        };
      });

      const screenshotPath = `${screenshotDirectory}/${theme}-${width}-${view}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });

      const reducedPage = await context.newPage();
      await reducedPage.emulateMedia({ reducedMotion: 'reduce' });
      await reducedPage.goto(`${url}#${view}`, { waitUntil: 'networkidle', timeout: 60_000 });
      const reducedMotion = await reducedPage.evaluate(() => {
        const animated = [...document.querySelectorAll('*')]
          .filter((element) => {
            const style = getComputedStyle(element);
            return style.animationName !== 'none' && style.animationDuration !== '0s';
          })
          .map((element) => ({
            tag: element.tagName.toLowerCase(),
            className: typeof element.className === 'string' ? element.className.slice(0, 100) : '',
            animationName: getComputedStyle(element).animationName,
            animationDuration: getComputedStyle(element).animationDuration,
          }));
        return {
          runningAnimations: animated,
          activeElement: document.activeElement?.tagName.toLowerCase() ?? null,
        };
      });
      await reducedPage.close();

      results.push({
        theme,
        width,
        view,
        screenshotPath,
        measurements,
        reducedMotion,
      });
      await page.close();
    }
    await context.close();
  }
}

const issues = results.flatMap((result) => {
  const prefix = `${result.theme}/${result.width}/${result.view}`;
  return [
    ...(result.measurements.horizontalOverflow ? [`${prefix}: horizontal overflow (${result.measurements.documentWidth}px document)`] : []),
    ...result.measurements.offscreen.map((element) => `${prefix}: offscreen ${element.tag} .${element.className} at ${JSON.stringify(element.rect)}`),
    ...result.measurements.undersized.map((element) => `${prefix}: target ${element.tag} ${element.label} ${element.rect.width}x${element.rect.height}`),
    ...result.measurements.clippedText.map((element) => `${prefix}: clipped text ${element.tag} ${element.label}`),
    ...result.measurements.unfocusableScrollRegions.map((element) => `${prefix}: unfocusable scroll region ${element.tag} .${element.className}`),
    ...result.reducedMotion.runningAnimations.map((element) => `${prefix}: reduced-motion animation ${element.className} ${element.animationName} ${element.animationDuration}`),
  ];
});

const report = {
  measuredAt: new Date().toISOString(),
  url,
  widths,
  themes,
  results,
  issues,
};
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  runs: results.length,
  screenshots: screenshotDirectory,
  issues,
  overflowRuns: results.filter((result) => result.measurements.horizontalOverflow).length,
  undersizedRuns: results.filter((result) => result.measurements.undersized.length > 0).length,
  offscreenRuns: results.filter((result) => result.measurements.offscreen.length > 0).length,
  clippedRuns: results.filter((result) => result.measurements.clippedText.length > 0).length,
  reducedMotionRuns: results.filter((result) => result.reducedMotion.runningAnimations.length > 0).length,
  unfocusableScrollRegions: results.reduce((total, result) => total + result.measurements.unfocusableScrollRegions.length, 0),
}, null, 2));

await browser.close();
