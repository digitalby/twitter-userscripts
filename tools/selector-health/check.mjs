#!/usr/bin/env node
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, 'selectors.json');
const REPORT_PATH = join(__dirname, 'report.json');
const NAV_TIMEOUT_MS = 45000;
const IDLE_TIMEOUT_MS = 15000;

const config = JSON.parse(await readFile(CONFIG_PATH, 'utf8'));

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
});
const page = await context.newPage();

const bundles = [];
page.on('response', async (response) => {
  const url = response.url();
  const contentType = response.headers()['content-type'] || '';
  if (!/\.js(\?|$)/.test(url) && !contentType.includes('javascript')) return;
  try {
    const body = await response.text();
    bundles.push({ url, size: body.length, body });
  } catch {
    // Response body no longer available; skip.
  }
});

let navError = null;
try {
  await page.goto(config.target, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
  await page.waitForLoadState('networkidle', { timeout: IDLE_TIMEOUT_MS }).catch(() => {});
} catch (err) {
  navError = err.message;
}

await browser.close();

const haystack = bundles.map((b) => b.body).join('\n');
const haystackBytes = haystack.length;

const results = config.selectors.map((sel) => {
  const min = typeof sel.minOccurrences === 'number' ? sel.minOccurrences : 1;
  let occurrences = 0;
  const matchedBundles = [];
  for (const b of bundles) {
    let from = 0;
    let bundleHits = 0;
    while (true) {
      const idx = b.body.indexOf(sel.needle, from);
      if (idx === -1) break;
      bundleHits++;
      from = idx + sel.needle.length;
    }
    if (bundleHits > 0) {
      occurrences += bundleHits;
      matchedBundles.push(b.url);
    }
  }
  return {
    id: sel.id,
    testid: sel.testid,
    needle: sel.needle,
    criticality: sel.criticality,
    scripts: sel.scripts,
    minOccurrences: min,
    occurrences,
    found: occurrences >= min,
    foundInBundles: matchedBundles,
  };
});

const missing = results.filter((r) => !r.found);
const missingCriticalOrHigh = missing.filter(
  (r) => r.criticality === 'critical' || r.criticality === 'high',
);

const report = {
  ranAt: new Date().toISOString(),
  target: config.target,
  bundlesFetched: bundles.length,
  bundleBytes: haystackBytes,
  navError,
  results,
  summary: {
    total: results.length,
    found: results.length - missing.length,
    missing: missing.length,
    missingCriticalOrHigh: missingCriticalOrHigh.length,
  },
};

await writeFile(REPORT_PATH, JSON.stringify(report, null, 2));

console.log(`Fetched ${bundles.length} JS bundles (${haystackBytes} bytes)`);
if (navError) console.log(`Navigation warning: ${navError}`);
for (const r of results) {
  const icon = r.found ? 'OK ' : 'MISS';
  console.log(
    `${icon} [${r.criticality}] ${r.id} (${r.testid}) -- needle="${r.needle}" hits=${r.occurrences}/${r.minOccurrences}`,
  );
}

if (bundles.length === 0) {
  console.error('\nNo JS bundles captured. CI cannot verify selectors.');
  process.exit(2);
}

if (missingCriticalOrHigh.length > 0) {
  console.error(
    `\n${missingCriticalOrHigh.length} critical/high selector(s) missing from x.com bundles:`,
  );
  for (const r of missingCriticalOrHigh) {
    console.error(`  - ${r.id} (${r.testid}) used by: ${r.scripts.join(', ') || '(none)'}`);
  }
  process.exit(1);
}

if (missing.length > 0) {
  console.warn(`\n${missing.length} medium selector(s) missing (non-blocking).`);
}

process.exit(0);
