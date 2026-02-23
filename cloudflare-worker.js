// =====================================================================
//  BravenNow — Cloudflare Worker  (ISR + Cache API for ALL users)
//  Strategy: Cache-first → SSR on miss → cache result with TTL per path
// =====================================================================

const WORKER_VERSION = 'v2026.02.23-isr-v1';
const SUPABASE_URL   = 'https://tuledxqigzufkecztnlo.supabase.co';
const ANON_KEY       = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.XKqWqIwfy5BoKzQNNUhs5uYC_QI0GLLKXw1pBDgkCi0';

// Secret for /api/cache-purge endpoint — also stored in CacheSettingsPanel.tsx
const PURGE_SECRET = 'bnn-cache-purge-key-2026';

// ── TTL rules (seconds). First matching rule wins. ──────────────────
const TTL_RULES = [
  { label: 'Головна',   pattern: /^\/$|^\/home$/,          ttl: 6  * 3600 },
  { label: 'Новини',    pattern: /^\/news(\/|$)/,           ttl: 1  * 3600 },
  { label: 'Статті',    pattern: /^\/read\//,               ttl: 1  * 3600 },
  { label: 'Дати',      pattern: /^\/date\//,               ttl: 2  * 3600 },
  { label: 'Wiki',      pattern: /^\/wiki(\/|$)/,           ttl: 24 * 3600 },
  { label: 'Теми',      pattern: /^\/topics(\/|$)/,         ttl: 6  * 3600 },
  { label: 'Глава',     pattern: /^\/chapter(s)?(\/|$)/,    ttl: 12 * 3600 },
  { label: 'Том',       pattern: /^\/volume(s)?(\/|$)/,     ttl: 12 * 3600 },
  { label: 'Календар',  pattern: /^\/calendar(\/|$)/,       ttl: 6  * 3600 },
  { label: 'Sitemap',   pattern: /^\/sitemap/,              ttl: 12 * 3600 },
];
const DEFAULT_TTL = 3600; // 1h for unknown HTML paths

function getTTL(pathname) {
  const rule = TTL_RULES.find(r => r.pattern.test(pathname));
  return rule ? rule.ttl : DEFAULT_TTL;
}

// ── Bot detection ────────────────────────────────────────────────────
const BOT_PATTERNS = [
  'googlebot', 'google-extended', 'googleother', 'google-inspectiontool',
  'bingbot', 'msnbot', 'yandex', 'duckduckbot', 'baiduspider',
  'gptbot', 'chatgpt-user', 'anthropic-ai', 'claudebot', 'claude-web',
  'perplexitybot', 'gemini', 'google-gemini', 'cohere-ai', 'bytespider',
  'amazonbot', 'meta-externalagent', 'youbot', 'diffbot', 'ccbot', 'omgili',
  'twitterbot', 'facebookexternalhit', 'linkedinbot', 'slackbot',
  'telegrambot', 'whatsapp', 'discordbot', 'applebot',
  'semrush', 'ahrefs', 'mj12bot', 'screaming frog', 'ahrefsbot', 'semrushbot',
  'crawler', 'spider', 'bot/'
];

function isBot(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return BOT_PATTERNS.some(p => ua.includes(p));
}

// Cache key: always strip query string for HTML pages
function htmlCacheKey(url) {
  return new URL(url.origin + url.pathname);
}

// ════════════════════════════════════════════════════════════════════
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request, event));
});

async function handleRequest(request, event) {
  const url       = new URL(request.url);
  const pathname  = url.pathname;
  const userAgent = request.headers.get('user-agent') || '';
  const isBotRequest = isBot(userAgent);

  // ── 1. Cache management endpoints ──────────────────────────────────
  if (pathname === '/api/cache-purge') {
    return handleCachePurge(request, url);
  }
  if (pathname === '/api/cache-status') {
    return handleCacheStatus(url);
  }

  // ── 2. Proxy Supabase API requests directly ─────────────────────────
  if (pathname.startsWith('/rest/') || pathname.startsWith('/functions/')) {
    const targetUrl = SUPABASE_URL + pathname + url.search;
    return fetch(targetUrl, {
      method:  request.method,
      headers: request.headers,
      body:    request.body
    });
  }

  // ── 3. Static assets — pass-through, no ISR ─────────────────────────
  if (pathname.startsWith('/assets/') || pathname.includes('.')) {
    return fetch(request);
  }

  // ── 4. API routes — pass-through ────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    return fetch(request);
  }

  // ── 5. Admin pages — never cache, always SPA ───────────────────────
  if (pathname.startsWith('/admin')) {
    return fetch(request);
  }

  // ── 6. ISR: Cache-first → SSR on miss → cache result (BOTS ONLY) ────
  //
  //  Regular users always get the SPA shell from Netlify — React hydrates
  //  instantly and they never see a blank page.
  //  Bots/crawlers get a full SSR HTML cached on CF edge (ISR pattern).
  //  SSR HTML contains a JS-redirect for real users, so serving it to
  //  regular browsers causes a redirect loop — hence the bot-only guard.
  //
  if (!isBotRequest) {
    // Pass regular users through to Netlify SPA, no caching
    const spaResp = await fetch(request);
    const r = new Response(spaResp.body, spaResp);
    r.headers.set('X-Cache',          'BYPASS-SPA');
    r.headers.set('X-Worker-Version', WORKER_VERSION);
    r.headers.set('Cache-Control',    'no-cache, no-store, must-revalidate');
    return r;
  }

  const cache    = caches.default;
  const cacheKey = new Request(htmlCacheKey(url).toString(), { method: 'GET' });

  // 6a. Check Cloudflare edge cache
  const cached = await cache.match(cacheKey);
  if (cached) {
    const hit = new Response(cached.body, cached);
    hit.headers.set('X-Cache',          'HIT');
    hit.headers.set('X-Worker-Version', WORKER_VERSION);
    return hit;
  }

  // 6b. Cache MISS → generate via SSR
  const ttl    = getTTL(pathname);
  const ssrUrl = `${SUPABASE_URL}/functions/v1/ssr-render?path=${encodeURIComponent(pathname)}&lang=en&cache=true`;

  try {
    const ssrResponse = await fetch(ssrUrl, {
      headers: {
        'Authorization': `Bearer ${ANON_KEY}`,
        'apikey':        ANON_KEY,
        'User-Agent':    userAgent,
        'Accept':        'text/html',
      },
    });

    if (ssrResponse.ok) {
      let html = await ssrResponse.text();

      // Strip the JS-redirect <script> block that SSR injects for real browsers.
      // The script checks navigator.userAgent but Google Rich Results Test and other
      // headless tools use a regular Chrome UA — not matching the bot pattern inside
      // the script — so the redirect fires, breaking structured-data tests.
      // Safe to remove: bots/crawlers don't need client-side navigation.
      html = html.replace(/<script[^>]*>[\s\S]*?window\.location\.replace[\s\S]*?<\/script>/gi, '');

      const response = new Response(html, {
        status: 200,
        headers: {
          'Content-Type':     'text/html; charset=utf-8',
          'Cache-Control':    `public, max-age=${ttl}, s-maxage=${ttl}`,
          'X-Cache':          'MISS',
          'X-Cache-TTL':      String(ttl),
          'X-TTL-Seconds':    String(ttl),
          'X-Worker-Version': WORKER_VERSION,
          'X-Bot-Detected':   'true',
          'X-SSR-Source':     'cloudflare-isr',
        },
      });

      // Store in CF edge cache (non-blocking)
      event.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    }
  } catch (e) {
    // SSR unavailable — fall through to Netlify origin
  }

  // 6c. SSR failed → fallback to Netlify SPA shell
  const fallback = await fetch(request);
  const fb = new Response(fallback.body, fallback);
  fb.headers.set('X-Cache',          'MISS-FALLBACK');
  fb.headers.set('X-Worker-Version', WORKER_VERSION);
  fb.headers.set('Cache-Control',    'no-cache, no-store, must-revalidate');
  return fb;
}

// ════════════════════════════════════════════════════════════════════
//  POST /api/cache-purge?secret=...&path=/some/path
//  POST /api/cache-purge?secret=...&path=all
// ════════════════════════════════════════════════════════════════════
async function handleCachePurge(request, url) {
  const secret = url.searchParams.get('secret') || request.headers.get('X-Purge-Secret');
  if (secret !== PURGE_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  const cache     = caches.default;
  const origin    = url.origin;
  const pathParam = url.searchParams.get('path') || '/';

  if (pathParam === 'all') {
    const knownPaths = [
      '/', '/news', '/wiki', '/topics', '/calendar',
      '/chapters', '/volumes', '/sitemap',
    ];
    const results = await Promise.all(
      knownPaths.map(async p => {
        const key     = new Request(origin + p, { method: 'GET' });
        const deleted = await cache.delete(key);
        return { path: p, deleted };
      })
    );
    return new Response(JSON.stringify({ ok: true, purged: results }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  const key     = new Request(origin + pathParam, { method: 'GET' });
  const deleted = await cache.delete(key);
  return new Response(JSON.stringify({ ok: true, path: pathParam, deleted }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

// ════════════════════════════════════════════════════════════════════
//  GET /api/cache-status?path=/some/path
// ════════════════════════════════════════════════════════════════════
async function handleCacheStatus(url) {
  const cache     = caches.default;
  const origin    = url.origin;
  const pathParam = url.searchParams.get('path') || '/';
  const key       = new Request(origin + pathParam, { method: 'GET' });
  const cached    = await cache.match(key);

  if (cached) {
    return new Response(JSON.stringify({
      cached:       true,
      path:         pathParam,
      ttl:          cached.headers.get('X-Cache-TTL')    || '?',
      cacheControl: cached.headers.get('Cache-Control')  || '',
      ssrSource:    cached.headers.get('X-SSR-Source')   || '',
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  return new Response(JSON.stringify({ cached: false, path: pathParam }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
