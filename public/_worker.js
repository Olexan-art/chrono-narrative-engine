/**
 * Cloudflare Pages Worker — Edge Cache + SSR
 * 
 * Strategy:
 * 1. Check Cloudflare edge cache first (instant, 0ms)
 * 2. If MISS → fetch pre-rendered HTML from Supabase cached_pages via ssr-render
 * 3. Store response in Cloudflare edge cache for future requests
 * 4. Serve full HTML to ALL visitors (bots AND users)
 */

const SUPABASE_URL = 'https://tuledxqigzufkecztnlo.supabase.co/functions/v1';
const SSR_ENDPOINT = `${SUPABASE_URL}/ssr-render`;
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzczNTI0MzcsImV4cCI6MjA1MjkyODQzN30.hhPxGZ2bDNrwPtJnDXa0IILrJsJUgFNJmLFbHKbLUMM';

// Cache TTLs (seconds)
const CACHE_TTL = {
  ssr: 3600,        // 1 hour for SSR pages
  api: 3600,        // 1 hour for API responses
  sitemap: 86400,   // 24 hours for sitemaps
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
  '.json', '.xml', '.txt', '.webmanifest',
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
];

// API proxy routes → Supabase Edge Functions
const API_ROUTES = {
  '/api/sitemap':      { fn: 'sitemap',      ttl: CACHE_TTL.sitemap },
  '/api/news-sitemap': { fn: 'news-sitemap', ttl: CACHE_TTL.sitemap },
  '/api/wiki-sitemap': { fn: 'wiki-sitemap', ttl: CACHE_TTL.sitemap },
  '/api/ssr-render':   { fn: 'ssr-render',   ttl: CACHE_TTL.api },
  '/api/llms-txt':     { fn: 'llms-txt',     ttl: CACHE_TTL.sitemap },
  '/api/rss-feed':     { fn: 'rss-feed',     ttl: CACHE_TTL.api },
};

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
 * Fetch from Supabase Edge Function with auth headers
 */
async function fetchFromSupabase(url, userAgent) {
  return fetch(url, {
    headers: {
      'User-Agent': userAgent || 'Cloudflare-Worker',
      'Accept': 'text/html, application/xml, */*',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
}

/**
 * Handle API proxy routes with Cloudflare cache
 */
async function handleApiRoute(request, pathname, env) {
  const matchedRoute = Object.entries(API_ROUTES).find(([path]) => pathname.startsWith(path));
  if (!matchedRoute) return null;

  const [, { fn, ttl }] = matchedRoute;
  const url = new URL(request.url);
  const cache = caches.default;

  // Build cache key from full URL (includes query params)
  const cacheKey = new Request(request.url, { method: 'GET' });

  // Check cache first
  let cached = await cache.match(cacheKey);
  if (cached) {
    return new Response(cached.body, {
      status: cached.status,
      headers: {
        ...Object.fromEntries(cached.headers),
        'X-Cache': 'HIT',
        'X-Cache-Source': 'cloudflare-edge',
      },
    });
  }

  // Cache MISS → proxy to Supabase
  const targetUrl = new URL(`${SUPABASE_URL}/${fn}`);
  url.searchParams.forEach((v, k) => targetUrl.searchParams.set(k, v));

  const userAgent = request.headers.get('User-Agent') || '';
  const response = await fetchFromSupabase(targetUrl.toString(), userAgent);

  if (!response.ok) {
    return new Response('API Error', { status: response.status });
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

  // Store in Cloudflare cache (non-blocking)
  const cacheResponse = new Response(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': `public, max-age=${ttl}, s-maxage=${ttl}`,
    },
  });
  ctx_waitUntil_put(cache, cacheKey, cacheResponse);

  return result;
}

// Helper: non-blocking cache.put (we'll call it from the main handler with ctx)
let _ctx = null;
function ctx_waitUntil_put(cache, key, response) {
  if (_ctx && _ctx.waitUntil) {
    _ctx.waitUntil(cache.put(key, response));
  } else {
    cache.put(key, response); // fire and forget
  }
}

/**
 * Handle SSR pages with Cloudflare edge cache
 */
async function handleSSR(request, pathname, env) {
  const cache = caches.default;
  const userAgent = request.headers.get('User-Agent') || '';
  const isBotReq = isBot(userAgent);

  // Cache key: normalize to just the pathname (ignore headers/cookies)
  const cacheUrl = new URL(request.url);
  cacheUrl.search = ''; // SSR pages don't use query params
  const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });

  // 1. Check Cloudflare edge cache
  let cached = await cache.match(cacheKey);
  if (cached) {
    // Clone and add cache headers
    const headers = new Headers(cached.headers);
    headers.set('X-Cache', 'HIT');
    headers.set('X-Cache-Source', 'cloudflare-edge');
    headers.set('X-SSR-Bot', isBotReq ? 'true' : 'false');

    return new Response(cached.body, {
      status: cached.status,
      headers,
    });
  }

  // 2. Cache MISS → fetch from Supabase ssr-render
  try {
    const ssrUrl = `${SSR_ENDPOINT}?path=${encodeURIComponent(pathname)}&lang=en`;
    const ssrResponse = await fetchFromSupabase(ssrUrl, userAgent);

    if (ssrResponse.ok) {
      const html = await ssrResponse.text();

      const responseHeaders = {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': `public, max-age=${CACHE_TTL.ssr}, s-maxage=${CACHE_TTL.ssr}`,
        'X-Cache': 'MISS',
        'X-Cache-Source': 'supabase-ssr',
        'X-SSR': 'true',
        'X-SSR-Bot': isBotReq ? 'true' : 'false',
      };

      const result = new Response(html, { status: 200, headers: responseHeaders });

      // Store in Cloudflare edge cache (non-blocking)
      const cacheResponse = new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': `public, max-age=${CACHE_TTL.ssr}, s-maxage=${CACHE_TTL.ssr}`,
          'X-SSR': 'true',
        },
      });
      ctx_waitUntil_put(cache, cacheKey, cacheResponse);

      return result;
    }
  } catch (error) {
    console.error('[worker] SSR fetch failed:', error);
  }

  // 3. Fallback: serve SPA
  return null;
}

export default {
  async fetch(request, env, ctx) {
    _ctx = ctx; // store for cache.put waitUntil
    const url = new URL(request.url);
    const pathname = url.pathname;

    // 1. Static assets → serve directly
    if (isStaticAsset(pathname)) {
      return env.ASSETS.fetch(request);
    }

    // 2. API routes → proxy with cache
    const apiResponse = await handleApiRoute(request, pathname, env);
    if (apiResponse) return apiResponse;

    // 3. SSR-eligible pages → serve cached HTML
    const accept = request.headers.get('Accept') || '';
    const secFetchDest = request.headers.get('Sec-Fetch-Dest') || '';
    const isDocumentRequest = secFetchDest === 'document' || accept.includes('text/html');

    if (isDocumentRequest && shouldSSR(pathname)) {
      const ssrResponse = await handleSSR(request, pathname, env);
      if (ssrResponse) return ssrResponse;
    }

    // 4. Fallback: serve SPA (index.html)
    return env.ASSETS.fetch(request);
  },
};
