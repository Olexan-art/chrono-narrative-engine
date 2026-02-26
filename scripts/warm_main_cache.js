#!/usr/bin/env node
// Warm main site cache: call ssr-render (if available) and then GET live pages/images
// Usage: SUPABASE_FUNCTIONS_URL=https://... PROD_BASE_URL=https://bravennow.com node scripts/warm_main_cache.js

import url from 'url';

const fetch = globalThis.fetch;

const SUPABASE_FUNCTIONS_URL = process.env.SUPABASE_FUNCTIONS_URL;
const PROD_BASE_URL = process.env.PROD_BASE_URL || 'https://bravennow.com';
const MAX_LINKS = parseInt(process.env.MAX_WARM_LINKS || '40', 10);

function extractLinksAndImages(html) {
  const linkRe = /href=(?:"|')([^"'#>]+)(?:"|')/gi;
  const imgRe = /<img[^>]+src=(?:"|')([^"'>]+)(?:"|')/gi;
  const links = new Set();
  const images = new Set();
  let m;
  while ((m = linkRe.exec(html))) {
    const href = m[1];
    if (!href) continue;
    // internal only
    if (href.startsWith('/') && !href.startsWith('//')) links.add(href.split('#')[0]);
  }
  while ((m = imgRe.exec(html))) {
    const src = m[1];
    if (!src) continue;
    // ignore data: URIs
    if (src.startsWith('data:')) continue;
    // make absolute
    const imgUrl = src.startsWith('http') ? src : url.resolve(PROD_BASE_URL, src);
    images.add(imgUrl);
  }
  return { links: Array.from(links), images: Array.from(images) };
}

async function callSsrRender(path) {
  if (!SUPABASE_FUNCTIONS_URL) return null;
  const full = `${SUPABASE_FUNCTIONS_URL.replace(/\/+$/, '')}/ssr-render?path=${encodeURIComponent(path)}&lang=en&cache=true`;
  console.log(`Calling ssr-render: ${full}`);
  try {
    const r = await fetch(full, { method: 'GET', timeout: 15000 });
    if (!r.ok) {
      console.warn(`ssr-render ${path} -> ${r.status}`);
      return null;
    }
    const text = await r.text();
    return text;
  } catch (e) {
    console.warn('ssr-render failed', e.message || e);
    return null;
  }
}

async function getLive(path) {
  const full = `${PROD_BASE_URL.replace(/\/+$/, '')}${path}`;
  console.log(`GET ${full}`);
  try {
    const r = await fetch(full, { method: 'GET', timeout: 15000 });
    if (!r.ok) {
      console.warn(`GET ${path} -> ${r.status}`);
      return null;
    }
    const text = await r.text();
    return text;
  } catch (e) {
    console.warn('GET failed', e.message || e);
    return null;
  }
}

async function warm() {
  console.log('Starting warming for main site...');

  // 1. Warm root via ssr-render (preferred)
  let html = null;
  if (SUPABASE_FUNCTIONS_URL) {
    html = await callSsrRender('/');
  }

  // 2. If ssr-render not available or failed, fallback to GET live
  if (!html) {
    html = await getLive('/');
  } else {
    // After SSR render, also GET live URL so Cloudflare worker stores edge cache
    await getLive('/');
  }

  if (!html) {
    console.error('Failed to retrieve homepage HTML. Aborting.');
    process.exit(1);
  }

  // Parse links and images
  const { links, images } = extractLinksAndImages(html);
  console.log(`Found ${links.length} internal links and ${images.length} images on homepage.`);

  // Warm images
  for (const img of images.slice(0, 200)) {
    try {
      console.log(`Warming image: ${img}`);
      const r = await fetch(img, { method: 'GET' });
      console.log(`  -> ${r.status}`);
    } catch (e) {
      console.warn('  image fetch failed', e.message || e);
    }
  }

  // Warm internal links via ssr-render + GET
  let count = 0;
  for (const link of links) {
    if (count >= MAX_LINKS) break;
    // Skip common admin or API paths
    if (link.startsWith('/admin') || link.startsWith('/api') || link.startsWith('/_next')) continue;
    console.log(`Warming page: ${link}`);
    let h = null;
    if (SUPABASE_FUNCTIONS_URL) {
      h = await callSsrRender(link);
    }
    // Always GET live path to populate Cloudflare edge
    await getLive(link);
    count++;
  }

  console.log(`Warmed ${count} pages and ${Math.min(images.length,200)} images.`);
  console.log('Done.');
}

warm().catch((e) => { console.error(e); process.exit(1); });
