// Enhanced compare SSR cached vs live for given paths
// Usage: node compare_ssr.js / /news /topics

const DEFAULT_SUPABASE = 'https://tuledxqigzufkecztnlo.supabase.co';
const SUPABASE_FUNCTIONS_URL = process.env.SUPABASE_FUNCTIONS_URL || `${DEFAULT_SUPABASE}/functions/v1`;
const ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const PROD_BASE_URL = process.env.PROD_BASE_URL || 'https://bravennow.com';

const headers = {
  'Accept': 'text/html'
};
if (ANON_KEY) {
  headers['Authorization'] = `Bearer ${ANON_KEY}`;
  headers['apikey'] = ANON_KEY;
}

const args = process.argv.slice(2);
const paths = args.length ? args : ['/'];

function stripHtml(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractImages(html) {
  const imgs = [];
  const re = /<img[^>]+src=(?:"|')([^"'>]+)(?:"|')/gi;
  let m;
  while ((m = re.exec(html))) {
    const src = m[1];
    if (!src) continue;
    if (src.startsWith('data:')) continue;
    const abs = src.startsWith('http') ? src : (PROD_BASE_URL.replace(/\/+$/, '') + (src.startsWith('/') ? src : '/' + src));
    imgs.push(abs);
  }
  return Array.from(new Set(imgs));
}

function extractInternalLinks(html) {
  const links = [];
  const re = /href=(?:"|')([^"'#]+)(?:"|')/gi;
  let m;
  while ((m = re.exec(html))) {
    const href = m[1];
    if (!href) continue;
    if (href.startsWith('/')) links.push(href);
    else if (href.startsWith(PROD_BASE_URL)) {
      try { const p = new URL(href); links.push(p.pathname); } catch(e){}
    }
  }
  return Array.from(new Set(links));
}

function wordFreq(html) {
  const txt = stripHtml(html).toLowerCase();
  const words = txt.split(/\s+/).filter(Boolean);
  const freq = Object.create(null);
  for (const w of words) {
    const clean = w.replace(/[^a-zA-Zа-яА-Я0-9\u0400-\u04FF'-]/g, '');
    if (!clean) continue;
    freq[clean] = (freq[clean] || 0) + 1;
  }
  return { total: words.length, freq };
}

async function fetchSSR(path, useCache) {
  const u = `${SUPABASE_FUNCTIONS_URL.replace(/\/+$/, '')}/ssr-render?path=${encodeURIComponent(path)}&lang=en&cache=${useCache?'true':'false'}`;
  const res = await fetch(u, { headers });
  if (!res.ok) throw new Error(`${res.status} for ${u}`);
  return await res.text();
}

function topDiffWords(freqA, freqB, topN = 30) {
  const keys = new Set([...Object.keys(freqA), ...Object.keys(freqB)]);
  const diffs = [];
  for (const k of keys) {
    const a = freqA[k] || 0;
    const b = freqB[k] || 0;
    const diff = b - a; // cached - live
    if (diff !== 0) diffs.push({ word: k, live: a, cached: b, diff });
  }
  diffs.sort((x,y) => Math.abs(y.diff) - Math.abs(x.diff));
  return diffs.slice(0, topN);
}

const fs = await import('fs');

(async () => {
  const report = { generatedAt: new Date().toISOString(), items: [] };
  for (const p of paths) {
    try {
      console.log(`Comparing ${p} ...`);
      const live = await fetchSSR(p, false);
      const cached = await fetchSSR(p, true);

      const liveImgs = extractImages(live);
      const cachedImgs = extractImages(cached);
      const missingImgs = liveImgs.filter(x => !cachedImgs.includes(x));

      const liveLinks = extractInternalLinks(live);
      const cachedLinks = extractInternalLinks(cached);
      const missingLinks = liveLinks.filter(x => !cachedLinks.includes(x));

      const liveWords = wordFreq(live);
      const cachedWords = wordFreq(cached);
      const wordDiffs = topDiffWords(liveWords.freq, cachedWords.freq, 40);

      const item = {
        path: p,
        summary: {
          live: { images: liveImgs.length, links: liveLinks.length, words: liveWords.total },
          cached: { images: cachedImgs.length, links: cachedLinks.length, words: cachedWords.total },
        },
        missingImages: missingImgs.slice(0,200),
        missingLinks: missingLinks.slice(0,200),
        wordDiffs
      };
      report.items.push(item);

      console.log(`  Live -> img:${liveImgs.length} links:${liveLinks.length} words:${liveWords.total}`);
      console.log(`  Cached -> img:${cachedImgs.length} links:${cachedLinks.length} words:${cachedWords.total}`);
      console.log(`  Missing images: ${missingImgs.length}, Missing links: ${missingLinks.length}`);
      console.log(`  Top word diffs:`, wordDiffs.slice(0,8).map(d=>`${d.word}(${d.live}->${d.cached})`).join(', '));

    } catch (e) {
      console.error(`Error for ${p}:`, e.message || e);
    }
  }
  const outPath = `compare_report_${Date.now()}.json`;
  await fs.promises.writeFile(outPath, JSON.stringify(report, null, 2));
  console.log(`Report written to ${outPath}`);
})();
