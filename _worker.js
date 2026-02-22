/**
 * Cloudflare Pages Worker — Edge Cache + SSR
 * 
 * Strategy:
 * 1. Check Cloudflare edge cache first (instant, 0ms)
 * 2. If MISS → fetch HTML from cached_pages via REST API (fast, no regeneration)
 * 3. If cached_pages also empty → try ssr-render (generates fresh HTML)
 * 4. Store response in Cloudflare edge cache for future requests
 * 5. Fallback: serve SPA index.html
 */

const SUPABASE_URL = 'https://tuledxqigzufkecztnlo.supabase.co';
const SUPABASE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const SSR_ENDPOINT = `${SUPABASE_FUNCTIONS_URL}/ssr-render`;
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.XKqWqIwfy5BoKzQNNUhs5uYC_QI0GLLKXw1pBDgkCi0';
const WORKER_VERSION = 'v2026.02.20-fix-v10-deployed-by-agent';

// Cache TTLs (seconds)
const CACHE_TTL = {
  ssr: 1800,       // 30 min Cloudflare edge cache for SSR pages
  api: 3600,       // 1 hour for API responses
  sitemap: 86400,  // 24 hours for sitemaps
};

// Bot detection for analytics headers
const BOT_PATTERNS = [
  'googlebot', 'bingbot', 'yandex', 'duckduckbot', 'baiduspider',
  'gptbot', 'chatgpt-user', 'anthropic-ai', 'claudebot', 'perplexitybot',
  'twitterbot', 'facebookexternalhit', 'linkedinbot', 'slackbot',
  'telegrambot', 'whatsapp', 'discordbot', 'applebot',
  'semrush', 'ahrefs', 'mj12bot', 'screaming frog',
  'crawler', 'spider', 'bot/'
];

// Paths to exclude from SSR (static assets)
const EXCLUDED_EXTENSIONS = [
  '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
  '.woff', '.woff2', '.ttf', '.eot', '.map', '.webp', '.avif',
  '.json', '.txt', '.webmanifest',
];

// SSR-eligible path patterns
const SSR_PATTERNS = [
  /^\/$/,
  /^\/news$/,
  /^\/news\/[a-z]{2}$/,
  /^\/news\/[a-z]{2}\/[a-z0-9-]+$/,
  /^\/read\/\d{4}-\d{2}-\d{2}\/\d+$/,
  /^\/read\/\d{4}-\d{2}-\d{2}$/,
  /^\/date\/\d{4}-\d{2}-\d{2}$/,
  /^\/chapter\/\d+$/,
  /^\/volume\/\d{4}-\d{2}$/,
  /^\/chapters$/,
  /^\/volumes$/,
  /^\/calendar$/,
  /^\/sitemap$/,
  /^\/wiki$/,
  /^\/wiki\/[a-z0-9-]+$/,
  /^\/ink-abyss$/,
  /^\/topics$/,
  /^\/topics\/.+$/,
];



function isBot(ua) {
  if (!ua) return false;
  const lower = ua.toLowerCase();
  return BOT_PATTERNS.some(p => lower.includes(p));
}

function isStaticAsset(pathname) {
  return EXCLUDED_EXTENSIONS.some(ext => pathname.endsWith(ext))
    || pathname.startsWith('/assets/')
    || pathname.startsWith('/_worker.js');
}

function shouldSSR(pathname) {
  return SSR_PATTERNS.some(p => p.test(pathname));
}



/**
 * Fetch from Supabase Edge Function (ssr-render) for fresh generation
 */
async function fetchFromSSRRender(pathname, userAgent) {
  try {
    const ssrUrl = `${SSR_ENDPOINT}?path=${encodeURIComponent(pathname)}&lang=en`;
    const response = await fetch(ssrUrl, {
      headers: {
        'User-Agent': userAgent || 'Cloudflare-Worker',
        'Accept': 'text/html',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (!response.ok) return null;
    return await response.text();
  } catch (error) {
    console.error('[worker] ssr-render fetch failed:', error);
    return null;
  }
}

/**
 * Handle API proxy routes with Cloudflare cache
 */
async function handleApiRoute(request, pathname, env) {
  // Normalize pathname to remove trailing slashes for matching
  const cleanPath = pathname.replace(/\/$/, '');
  let fn = null;
  let ttl = CACHE_TTL.api;

  if (cleanPath === '/sitemap.xml' || cleanPath.includes('/api/sitemap')) {
    fn = 'sitemap';
    ttl = CACHE_TTL.sitemap;
  } else if (cleanPath.includes('/api/news-sitemap')) {
    fn = 'news-sitemap';
    ttl = CACHE_TTL.sitemap;
  } else if (cleanPath === '/api/wiki-sitemap') {
    fn = 'wiki-sitemap';
    ttl = CACHE_TTL.sitemap;
  } else if (cleanPath === '/api/topics-sitemap') {
    fn = 'topics-sitemap';
    ttl = CACHE_TTL.sitemap;
  } else if (cleanPath === '/api/ssr-render') {
    fn = 'ssr-render';
    ttl = CACHE_TTL.api;
  } else if (cleanPath === '/api/llms-txt') {
    fn = 'llms-txt';
    ttl = CACHE_TTL.sitemap;
  } else if (cleanPath === '/api/rss-feed') {
    fn = 'rss-feed';
    ttl = CACHE_TTL.api;
  }

  // If no explicit match, return null to let other handlers try
  if (!fn) return null;

  const cache = caches.default;
  const cacheKey = new Request(request.url, { method: 'GET' });

  // 1. Check Cloudflare edge cache first
  let cached = await cache.match(cacheKey);
  if (cached) {
    const headers = new Headers(cached.headers);
    headers.set('X-Cache', 'HIT');
    headers.set('X-Cache-Source', 'cloudflare-edge');
    return new Response(cached.body, { status: cached.status, headers });
  }

  const url = new URL(request.url);

  // Construct target URL for Supabase Function
  const targetUrl = new URL(`${SUPABASE_FUNCTIONS_URL}/${fn}`);

  // Copy all search params (query string) from original request
  url.searchParams.forEach((value, key) => {
    targetUrl.searchParams.append(key, value);
  });

  const userAgent = request.headers.get('User-Agent') || '';

  try {
    const response = await fetch(targetUrl.toString(), {
      method: request.method,
      headers: {
        'User-Agent': userAgent || 'Cloudflare-Worker',
        'Accept': 'text/html, application/xml, application/json, */*',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (!response.ok) {
      return new Response(`API Error: ${response.status} ${response.statusText}`, { status: response.status });
    }

    const body = await response.text();
    const contentType = response.headers.get('Content-Type') || 'application/xml';

    const result = new Response(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': `public, max-age=${ttl}, s-maxage=${ttl}`,
        'Access-Control-Allow-Origin': '*',
        'X-Cache': 'MISS',
        'X-Cache-Source': 'supabase-edge',
      },
    });

    const cache = caches.default;
    const cacheKey = new Request(request.url, { method: 'GET' });

    const cacheResponse = new Response(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': `public, max-age=${ttl}, s-maxage=${ttl}`,
      },
    });

    ctx_waitUntil_put(cache, cacheKey, cacheResponse);

    return result;
  } catch (error) {
    console.error(`[worker] API fetch failed for ${pathname}:`, error);
    return new Response('Internal Worker Error', { status: 500 });
  }
}

let _ctx = null;
function ctx_waitUntil_put(cache, key, response) {
  if (_ctx && _ctx.waitUntil) {
    _ctx.waitUntil(cache.put(key, response));
  } else {
    cache.put(key, response);
  }
}

/**
 * Handle SSR pages — 2-tier strategy:
 * 1. Cloudflare edge cache (instant)
 * 2. ssr-render Edge Function (generates fresh HTML)
 */
async function handleSSR(request, pathname, env) {
  const cache = caches.default;
  const userAgent = request.headers.get('User-Agent') || '';
  const isBotReq = isBot(userAgent);

  const cacheUrl = new URL(request.url);
  cacheUrl.search = '';
  const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });

  // 1. Check Cloudflare edge cache
  let cached = await cache.match(cacheKey);
  if (cached) {
    const headers = new Headers(cached.headers);
    headers.set('X-Cache', 'HIT');
    headers.set('X-Cache-Source', 'cloudflare-edge');
    headers.set('X-SSR-Bot', isBotReq ? 'true' : 'false');
    return new Response(cached.body, { status: cached.status, headers });
  }

  // 2. Cache MISS → fetch from ssr-render
  const html = await fetchFromSSRRender(pathname, userAgent);

  if (!html) return null; // Fall through to SPA

  const ttl = CACHE_TTL.ssr;
  const responseHeaders = {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': `public, max-age=${ttl}, s-maxage=${ttl}`,
    'X-Cache': 'MISS',
    'X-Cache-Source': 'ssr-render',
    'X-SSR': 'true',
    'X-SSR-Bot': isBotReq ? 'true' : 'false',
    'X-Worker-Version': WORKER_VERSION,
  };

  const result = new Response(html, { status: 200, headers: responseHeaders });

  // Store in Cloudflare edge cache
  const cacheResponse = new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': `public, max-age=${ttl}, s-maxage=${ttl}`,
      'X-SSR': 'true',
    },
  });
  ctx_waitUntil_put(cache, cacheKey, cacheResponse);

  return result;
}

export default {
  async fetch(request, env, ctx) {
    _ctx = ctx;
    const url = new URL(request.url);
    const pathname = url.pathname;
    const userAgent = request.headers.get('User-Agent') || '';
    
    // 1. Force HTTPS redirect
    if (url.protocol === 'http:') {
      const httpsUrl = `https://${url.hostname}${url.pathname}${url.search}`;
      return Response.redirect(httpsUrl, 301);
    }

    // 2. Redirect /sitemap.xml → /api/sitemap
    if (pathname === '/sitemap.xml') {
      return Response.redirect(`${url.origin}/api/sitemap`, 301);
    }
    
    // Check if upstream worker asked to skip SSR
    const skipSSR = request.headers.get('X-Skip-SSR') === 'true';

    // 1. Static assets → serve directly
    if (isStaticAsset(pathname)) {
      return env.ASSETS.fetch(request);
    }

    // 2. API routes → proxy with cache
    const apiResponse = await handleApiRoute(request, pathname, env);
    if (apiResponse) return apiResponse;

    // 3. SSR-eligible pages → serve cached HTML (only for bots and if not skipped)
    const accept = request.headers.get('Accept') || '';
    const secFetchDest = request.headers.get('Sec-Fetch-Dest') || '';
    const isDocumentRequest = secFetchDest === 'document' || accept.includes('text/html');

    if (!skipSSR && isDocumentRequest && isBot(userAgent) && shouldSSR(pathname)) {
      const ssrResponse = await handleSSR(request, pathname, env);
      if (ssrResponse) return ssrResponse;
    }

    // 4. Fallback: serve SPA (index.html)
    const spaResponse = await env.ASSETS.fetch(request);
    const spaHeaders = new Headers(spaResponse.headers);
    spaHeaders.set('X-Debug-Path', pathname);
    spaHeaders.set('X-Worker-Version', WORKER_VERSION);
    return new Response(spaResponse.body, { status: spaResponse.status, headers: spaHeaders });
  },
};
