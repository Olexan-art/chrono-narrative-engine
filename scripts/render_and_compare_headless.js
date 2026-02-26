#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { chromium } from 'playwright';

const argvPath = process.argv[2];
if (!argvPath) {
  console.error('Usage: node scripts/render_and_compare_headless.js /path/to/page');
  process.exit(2);
}

const pagePath = argvPath.startsWith('/') ? argvPath : `/${argvPath}`;
const PROD_BASE_URL = process.env.PROD_BASE_URL || process.env.BASE_URL || 'https://bravennow.com';
const SUPABASE_FUNCTIONS_URL = process.env.SUPABASE_FUNCTIONS_URL || process.env.SSR_FUNCTION_URL || 'https://nxkrzecbbkyaajogszjr.supabase.co/functions/v1';

const timestamp = Date.now();
const outDir = path.resolve('archive', 'generated');
await fs.mkdir(outDir, { recursive: true });

async function fetchCachedSnapshot(p) {
  if (!SUPABASE_FUNCTIONS_URL) return null;
  const url = `${SUPABASE_FUNCTIONS_URL.replace(/\/$/, '')}/ssr-render?path=${encodeURIComponent(p)}&cache=true`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    return null;
  }
}

async function fetchLiveSSR(p) {
  if (!SUPABASE_FUNCTIONS_URL) return null;
  const url = `${SUPABASE_FUNCTIONS_URL.replace(/\/$/, '')}/ssr-render?path=${encodeURIComponent(p)}&cache=false`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    return null;
  }
}

const liveUrl = `${PROD_BASE_URL.replace(/\/$/, '')}${pagePath}`;

console.log('Live URL:', liveUrl);
console.log('Fetching with Playwright (JS enabled) and (JS disabled)');

const browser = await chromium.launch({ headless: true });
let jsHtml = null;
let noJsHtml = null;
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(liveUrl, { waitUntil: 'networkidle', timeout: 60000 });
  jsHtml = await page.content();
  await context.close();

  // JS disabled
  const contextNoJs = await browser.newContext({ javaScriptEnabled: false });
  const pageNoJs = await contextNoJs.newPage();
  await pageNoJs.goto(liveUrl, { waitUntil: 'networkidle', timeout: 60000 });
  noJsHtml = await pageNoJs.content();
  await contextNoJs.close();
} catch (e) {
  console.error('Playwright render error:', e.message || e);
} finally {
  await browser.close();
}

const cachedHtml = await fetchCachedSnapshot(pagePath);
const liveSsrHtml = await fetchLiveSSR(pagePath);

// Check for sections/blocks
function checkSections(html) {
  if (!html) return {};
  
  const sections = {
    'Verified': /Verified|✓ Verified|VerifiedSection|data-section="verified"/i.test(html),
    'Cartoons': /карикатур|Cartoon|Caricature|data-section="cartoon"/i.test(html),
    'Keywords': /Keywords:|Ключові слова:|data-section="keywords"/i.test(html),
    'Key Takeaways': /Key Takeaways|Ключові висновки|KeyTakeaways|data-section="key-takeaways"/i.test(html),
    'Topics': /Topics:|Теми:|data-section="topics"/i.test(html),
    'Retelling': /пересказ|Retelling|Summary|data-section="retelling"/i.test(html),
    'Why It Matters': /Why It Matters|Чому це важливо|data-section="why-it-matters"/i.test(html),
    'Context & Background': /Context & Background|Контекст|data-section="context"/i.test(html),
    'What Happens Next': /What Happens Next|Що далі|data-section="what-next"/i.test(html),
    'FAQ': /Frequently Asked Questions|FAQ|Часті питання|data-section="faq"/i.test(html),
    'More news about': /More news about|Більше новин про|data-section="more-news"/i.test(html),
    'Entity Intersection Graph': /Entity Intersection Graph|Граф перетину|data-section="entity-graph"/i.test(html),
    'Source': /Source:|Джерело:|data-section="source"/i.test(html),
    'Mentioned Entities': /Mentioned Entities|Згадані сутності|data-section="entities"/i.test(html)
  };
  
  return sections;
}

const sectionPresence = {
  js_render: checkSections(jsHtml),
  nojs_render: checkSections(noJsHtml),
  cached_ssr: checkSections(cachedHtml),
  live_ssr: checkSections(liveSsrHtml)
};

const report = {
  path: pagePath,
  liveUrl,
  timestamp,
  results: {
    js_render: jsHtml ? `${outDir}/render_js_${timestamp}.html` : null,
    nojs_render: noJsHtml ? `${outDir}/render_nojs_${timestamp}.html` : null,
    cached_ssr: cachedHtml ? `${outDir}/cached_ssr_${timestamp}.html` : null,
    live_ssr: liveSsrHtml ? `${outDir}/live_ssr_${timestamp}.html` : null
  },
  sectionPresence
};

if (jsHtml) await fs.writeFile(path.join(outDir, `render_js_${timestamp}.html`), jsHtml, 'utf-8');
if (noJsHtml) await fs.writeFile(path.join(outDir, `render_nojs_${timestamp}.html`), noJsHtml, 'utf-8');
if (cachedHtml) await fs.writeFile(path.join(outDir, `cached_ssr_${timestamp}.html`), cachedHtml, 'utf-8');
if (liveSsrHtml) await fs.writeFile(path.join(outDir, `live_ssr_${timestamp}.html`), liveSsrHtml, 'utf-8');

await fs.writeFile(path.join(outDir, `render_report_${timestamp}.json`), JSON.stringify(report, null, 2), 'utf-8');

console.log('Saved report to', `${outDir}/render_report_${timestamp}.json`);
console.log('Files written:');
Object.values(report.results).forEach(v => v && console.log(' -', v));

console.log('\nSection presence check:');
const sectionTable = {};
Object.keys(sectionPresence.js_render || {}).forEach(section => {
  sectionTable[section] = {
    'JS Render': sectionPresence.js_render?.[section] || false,
    'No-JS Render': sectionPresence.nojs_render?.[section] || false,
    'Cached SSR': sectionPresence.cached_ssr?.[section] || false,
    'Live SSR': sectionPresence.live_ssr?.[section] || false
  };
});
console.table(sectionTable);

process.exit(0);
