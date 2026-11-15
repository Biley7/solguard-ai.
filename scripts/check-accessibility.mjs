import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from '@playwright/test';

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

const url = argument('url', 'http://127.0.0.1:4173/');
const output = argument('out', 'perf-artifacts/accessibility.json');
const axePath = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const views = ['dashboard', 'copilot', 'scanner', 'xray', 'history', 'settings'];
const themes = ['dark', 'light'];
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

const browser = await chromium.launch();
const results = [];

for (const theme of themes) {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      colorScheme: theme,
    });
    for (const view of views) {
      const page = await context.newPage();
      await page.goto(`${url}#${view}`, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForSelector('#app-content h1', { timeout: 15_000 });
      await page.addScriptTag({ path: axePath });

      const axe = await page.evaluate(async () => window.axe.run(document, {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
        },
      }));
      const violations = axe.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        nodes: violation.nodes.map((node) => ({
          target: node.target,
          html: node.html,
          summary: node.failureSummary,
        })),
      }));

      const keyboard = [];
      for (let index = 0; index < 12; index += 1) {
        await page.keyboard.press('Tab');
        keyboard.push(await page.evaluate(() => {
          const active = document.activeElement;
          if (!active || active === document.body) return null;
          const style = getComputedStyle(active);
          let focusIndicator = style.outlineStyle !== 'none' && style.outlineWidth !== '0px';
          let focusOwner = active;
          for (let parent = active.parentElement; parent && !focusIndicator; parent = parent.parentElement) {
            const parentStyle = getComputedStyle(parent);
            const visibleRing = parent.matches(':focus-within')
              && (parentStyle.boxShadow !== 'none'
                || (parentStyle.outlineStyle !== 'none' && parentStyle.outlineWidth !== '0px'));
            if (visibleRing) {
              focusIndicator = true;
              focusOwner = parent;
            }
          }
          return {
            tag: active.tagName.toLowerCase(),
            id: active.id,
            className: typeof active.className === 'string' ? active.className : '',
            label: active.getAttribute('aria-label') ?? active.textContent?.trim().slice(0, 60) ?? '',
            outlineStyle: style.outlineStyle,
            outlineWidth: style.outlineWidth,
            outlineColor: style.outlineColor,
            boxShadow: style.boxShadow,
            focusIndicator,
            focusOwner: focusOwner === active
              ? active.tagName.toLowerCase()
              : `${focusOwner.tagName.toLowerCase()}.${String(focusOwner.className).split(' ')[0]}`,
            rect: (() => {
              const rect = active.getBoundingClientRect();
              return { width: Math.round(rect.width), height: Math.round(rect.height) };
            })(),
          };
        }));
      }

      const structure = await page.evaluate(() => {
        const headings = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')]
          .map((heading) => ({
            level: Number(heading.tagName.slice(1)),
            text: heading.textContent.trim().replace(/\s+/g, ' ').slice(0, 100),
          }));
        const unlabeledControls = [...document.querySelectorAll('button, a[href], input, select, textarea')]
          .filter((element) => {
            if (element.hidden || element.closest('[hidden]')) return false;
            const style = getComputedStyle(element);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            const text = element.textContent?.trim();
            return !text
              && !element.getAttribute('aria-label')
              && !element.getAttribute('aria-labelledby')
              && !element.getAttribute('title')
              && !element.labels?.length;
          })
          .map((element) => element.outerHTML.slice(0, 180));
        const undersized = [...document.querySelectorAll('button, a[href], input, select, textarea')]
          .filter((element) => {
            if (element.hidden || element.closest('[hidden]')) return false;
            const style = getComputedStyle(element);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            const rect = element.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return false;
            return rect.width < 24 || rect.height < 24;
          })
          .map((element) => ({
            tag: element.tagName.toLowerCase(),
            label: element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 50) ?? '',
            width: Math.round(element.getBoundingClientRect().width),
            height: Math.round(element.getBoundingClientRect().height),
          }));
        return {
          headings,
          headingSequenceValid: headings.every((heading, index) => (
            index === 0 ? heading.level === 1 : heading.level <= headings[index - 1].level + 1
          )),
          unlabeledControls,
          undersized,
          horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
          lang: document.documentElement.lang,
          landmarks: {
            main: document.querySelectorAll('main').length,
            nav: document.querySelectorAll('nav').length,
            aside: document.querySelectorAll('aside').length,
          },
        };
      });

      results.push({
        theme,
        viewport: viewport.name,
        width: viewport.width,
        view,
        axeViolations: violations,
        keyboard,
        structure,
      });
      await page.close();
    }
    await context.close();
  }
}

const violationCounts = {};
for (const result of results) {
  for (const violation of result.axeViolations) {
    violationCounts[violation.id] = (violationCounts[violation.id] ?? 0) + violation.nodes.length;
  }
}

const report = {
  measuredAt: new Date().toISOString(),
  url,
  runs: results.length,
  violationCounts,
  results,
};
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  runs: results.length,
  violationCounts,
  pagesWithViolations: results.filter((result) => result.axeViolations.length > 0)
    .map((result) => `${result.theme}/${result.viewport}/${result.view}`),
  overflow: results.filter((result) => result.structure.horizontalOverflow)
    .map((result) => `${result.theme}/${result.viewport}/${result.view}`),
  unlabeled: results.filter((result) => result.structure.unlabeledControls.length > 0)
    .map((result) => `${result.theme}/${result.viewport}/${result.view}: ${result.structure.unlabeledControls.length}`),
  undersized: results.filter((result) => result.structure.undersized.length > 0)
    .map((result) => `${result.theme}/${result.viewport}/${result.view}: ${JSON.stringify(result.structure.undersized)}`),
  invalidHeadingOrder: results.filter((result) => !result.structure.headingSequenceValid)
    .map((result) => `${result.theme}/${result.viewport}/${result.view}`),
}, null, 2));

await browser.close();
