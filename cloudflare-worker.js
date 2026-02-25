// =====================================================================
//  BravenNow — Cloudflare Worker  (ISR + Cache API for ALL users)
//  Strategy: Cache-first → SSR on miss → cache result with TTL per path
// =====================================================================

const WORKER_VERSION = 'v2026.02.25-isr-v3';
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

// Fire-and-forget: async warm a path via ssr-render (called from waitUntil)
async function asyncWarmPath(pathname) {
  const warmUrl = `${SUPABASE_URL}/functions/v1/ssr-render?path=${encodeURIComponent(pathname)}&lang=en&cache=true`;
  try {
    await fetch(warmUrl, {
      headers: {
        'Authorization': `Bearer ${ANON_KEY}`,
        'apikey':        ANON_KEY,
        'Accept':        'text/html',
      },
    });
    console.log(`[Worker] asyncWarmPath done: ${pathname}`);
  } catch (e) {
    console.warn(`[Worker] asyncWarmPath failed: ${pathname}`, e);
  }
}

// Log a bot-visit failure directly to Supabase REST (no edge function roundtrip)
async function logBotFallback(pathname, cacheStatus, userAgent) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/bot_visits`, {
      method: 'POST',
      headers: {
        'apikey':        ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Type':  'application/json',
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify({
        bot_type:     'worker-fallback',
        bot_category: 'other',
        path:         pathname,
        user_agent:   userAgent ? userAgent.substring(0, 500) : null,
        status_code:  200,
        cache_status: cacheStatus,
      }),
    });
  } catch (_) { /* non-critical */ }
}

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

  // ── 3. IndexNow key file — serve directly from Worker ───────────────
  if (pathname === '/d82c5f1a3e7b9042c6d8f1e3a5b70924.txt') {
    return new Response('d82c5f1a3e7b9042c6d8f1e3a5b70924', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }

  // ── 3. Static assets — pass-through via Netlify origin ───────────────
  if (pathname.startsWith('/assets/') || pathname.includes('.')) {
    const netlifyOrigin = 'https://chrono-narrative-engine.netlify.app';
    return fetch(netlifyOrigin + pathname + url.search, { headers: request.headers });
  }

  // ── 4. API routes — pass-through ────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    return fetch(request);
  }

  // ── 5. Admin pages — never cache, always SPA via Netlify origin ────
  if (pathname.startsWith('/admin')) {
    const netlifyOrigin = 'https://chrono-narrative-engine.netlify.app';
    const originUrl = netlifyOrigin + pathname + url.search;
    try {
      const originReq = new Request(originUrl, {
        method:  request.method,
        headers: request.headers,
        body:    request.body,
        redirect: 'manual',
      });
      const originResp = await fetch(originReq);
      // If Netlify returns 404 (no static file), serve SPA shell from index.html
      if (originResp.status === 404 || originResp.status === 410) {
        const shell = await fetch(netlifyOrigin + '/index.html');
        const out = new Response(shell.body, shell);
        out.headers.set('X-Worker-Version', WORKER_VERSION);
        out.headers.set('X-Cache', 'ADMIN-SPA-FALLBACK');
        out.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        return out;
      }
      return originResp;
    } catch (e) {
      // On error, fall back to SPA shell too
      const shell = await fetch(netlifyOrigin + '/index.html');
      const out = new Response(shell.body, shell);
      out.headers.set('X-Worker-Version', WORKER_VERSION);
      out.headers.set('X-Cache', 'ADMIN-SPA-ERROR-FALLBACK');
      out.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      return out;
    }
  }

  // ── 6. ISR: Cache-first → SSR on miss → cache result ────
  //
  //  For the fastest response we prefer serving whatever HTML we already
  //  have stored in the `cached_pages` table, regardless of whether the
  //  requester is a bot or a real user.  That lets humans get a full server-
  //  rendered page instead of a tiny SPA shell at no additional cost.  We
  //  strip the client-side redirect script from the cached HTML, so there
  //  is no risk of a redirect loop when regular browsers are returned the
  //  cached content.
  //
  //  Bots and origin failures still fall back to live SSR as before.
  //
    // try DB fast-path first (everyone)
    try {
      const restUrl = `${SUPABASE_URL}/rest/v1/cached_pages?path=eq.${encodeURIComponent(pathname)}&select=html,html_size_bytes&limit=1`;
      const cpResp = await fetch(restUrl, {
        headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}`, 'Accept': 'application/json' }
      });
      if (cpResp.ok) {
        const rows = await cpResp.json();
        if (rows && rows[0]?.html && rows[0].html.length >= 10000) {
          event.waitUntil(asyncWarmPath(pathname));
          let cleaned = rows[0].html.replace(/<script(?:\s[^>]*)?>(?:(?!<\/script>)[\s\S])*?window\.location\.replace(?:(?!<\/script>)[\s\S])*?<\/script>/gi, '');
          // make version visible in body for debugging
          cleaned = `<!-- worker ${WORKER_VERSION} fast-path -->\n${cleaned}`;
          return new Response(cleaned, {
            status: 200,
            headers: {
              'Content-Type':     'text/html; charset=utf-8',
              'Cache-Control':    `public, max-age=${getTTL(pathname)}`,
              'X-Cache':          'CACHED-PAGES-FAST-PATH',
              'X-Cached-Length':  String(cleaned.length),
              'X-Worker-Version': WORKER_VERSION,
            },
          });
        }
      }
    } catch (_) { /* ignore db failure and continue with normal flow */ }

    // ── 6. ISR/SSR: Regular users -> try Netlify SPA origin first, then SSR on 404
    // ── Bots -> always SSR (cache=true)
    const ttl    = getTTL(pathname);
    const ssrUrl = `${SUPABASE_URL}/functions/v1/ssr-render?path=${encodeURIComponent(pathname)}&lang=en&cache=true`;

    // For regular users, prefer Netlify origin (SPA shell). If origin
    // returns 404/410 or fails, fall back to SSR. Bots continue to get
    // SSR directly.
    if (!isBotRequest) {
      const netlifyOrigin = 'https://chrono-narrative-engine.netlify.app';
      try {
        const originUrl = netlifyOrigin + url.pathname + url.search;
        const originReq = new Request(originUrl, {
          method:  request.method,
          headers: request.headers,
          body:    request.body,
          redirect: 'manual',
        });
        const originResp = await fetch(originReq);
        // If Netlify has a valid response (200..299), inspect it.
        if (originResp && originResp.ok) {
          const contentType = (originResp.headers.get('Content-Type') || '').toLowerCase();
          // For HTML responses, read the body to detect small SPA shell.
          if (contentType.includes('text/html')) {
            try {
              const originText = await originResp.text();
              // If origin served a small HTML (likely SPA shell), try DB cached_pages
              if (originText.length < 10000) {
                try {
                  const restUrl = `${SUPABASE_URL}/rest/v1/cached_pages?path=eq.${encodeURIComponent(pathname)}&select=html,html_size_bytes&limit=1`;
                  const cpResp = await fetch(restUrl, {
                    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}`, 'Accept': 'application/json' }
                  });
                  if (cpResp.ok) {
                    const rows = await cpResp.json();
                    if (rows && rows[0]?.html && rows[0].html.length >= 10000) {
                      event.waitUntil(asyncWarmPath(pathname));
                      // strip the client-side redirect script so regular browsers
                      // don't reload the same URL in an infinite loop
                      const cleaned = rows[0].html.replace(/<script(?:\s[^>]*)?>(?:(?!<\/script>)[\s\S])*?window\.location\.replace(?:(?!<\/script>)[\s\S])*?<\/script>/gi, '');
                      const out = new Response(cleaned, {
                        status: 200,
                        headers: {
                          'Content-Type':     'text/html; charset=utf-8',
                          'Cache-Control':    `public, max-age=${getTTL(pathname)}`,
                          'X-Cache':          'CACHED-PAGES-FAST-PATH',
                          'X-Cached-Length':  String(cleaned.length),
                          'X-Worker-Version': WORKER_VERSION,
                        },
                      });
                      return out;
                    }
                  }
                } catch (_) { /* ignore and fall back to origin */ }
              }
              // Not a small SPA (or no DB fallback) — return origin HTML
              const r = new Response(originText, {
                status: originResp.status,
                statusText: originResp.statusText,
                headers: originResp.headers,
              });
              r.headers.set('X-Cache',          'BYPASS-SPA');
              r.headers.set('X-Worker-Version', WORKER_VERSION);
              r.headers.set('Cache-Control',    'no-cache, no-store, must-revalidate');
              return r;
            } catch (e) {
              // If reading origin body failed, fall through to return origin response object
            }
          }
          // Non-HTML or inspection failed: return origin response as-is
          return originResp;
        }
        // If Netlify returned something other than 404/410, forward it.
        if (originResp && originResp.status && originResp.status !== 404 && originResp.status !== 410) {
          return originResp;
        }
        // otherwise fall through to SSR below
      } catch (e) {
        console.warn('[Worker] Netlify origin request failed, falling back to SSR', e);
      }
    }
    // This ensures crawlers and old user agents receive full server-rendered HTML.
    try {
      const ssrResponse = await fetch(ssrUrl, {
        headers: {
          'Authorization': `Bearer ${ANON_KEY}`,
          'apikey':        ANON_KEY,
          'User-Agent':    userAgent,
          'Accept':        'text/html',
        },
      });
      if (ssrResponse.status === 301 || ssrResponse.status === 308) {
        const location = ssrResponse.headers.get('Location');
        if (location) {
          return new Response(null, {
            status: ssrResponse.status,
            headers: {
              'Location':         location,
              'Cache-Control':    'public, max-age=86400',
              'X-Worker-Version': WORKER_VERSION,
              'X-Redirect-Type':  'SSR-UUID-SLUG',
            },
          });
        }
      }
      if (ssrResponse.ok) {
        let html = await ssrResponse.text();
        if (html.length < 10000) {
          // 1. Try cached_pages stale entry — even expired is better than SPA
          try {
            const restUrl = `${SUPABASE_URL}/rest/v1/cached_pages?path=eq.${encodeURIComponent(pathname)}&select=html&limit=1`;
            const cpResp  = await fetch(restUrl, {
              headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}`, 'Accept': 'application/json' }
            });
            if (cpResp.ok) {
              const rows = await cpResp.json();
              if (rows && rows[0]?.html && rows[0].html.length >= 10000) {
                event.waitUntil(asyncWarmPath(pathname));
                // same clean-up for stale fallback
                let cleaned = rows[0].html.replace(/<script(?:\s[^>]*)?>(?:(?!<\/script>)[\s\S])*?window\.location\.replace(?:(?!<\/script>)[\s\S])*?<\/script>/gi, '');
                cleaned = `<!-- worker ${WORKER_VERSION} stale-fallback -->\n${cleaned}`;
                return new Response(cleaned, {
                  status: 200,
                  headers: {
                    'Content-Type':     'text/html; charset=utf-8',
                    'Cache-Control':    'no-store',
                    'X-Cache':          'STALE-DB-FALLBACK',
                    'X-SSR-Size':       String(html.length),
                    'X-Worker-Version': WORKER_VERSION,
                  },
                });
              }
            }
          } catch (_) { /* ignore, try fresh render */ }
          // 2. Try a fresh force-render (cache=false)
          try {
            const freshUrl = `${SUPABASE_URL}/functions/v1/ssr-render?path=${encodeURIComponent(pathname)}&lang=en&cache=false`;
            const freshResp = await fetch(freshUrl, {
              headers: {
                'Authorization': `Bearer ${ANON_KEY}`,
                'apikey':        ANON_KEY,
                'User-Agent':    userAgent,
                'Accept':        'text/html',
              },
            });
            if (freshResp.ok) {
              const freshHtml = await freshResp.text();
              if (freshHtml.length >= 10000) {
                event.waitUntil(asyncWarmPath(pathname));
                const stripped = freshHtml.replace(/<script(?:\s[^>]*)?>(?:(?!<\/script>)[\s\S])*?window\.location\.replace(?:(?!<\/script>)[\s\S])*?<\/script>/gi, '');
                return new Response(stripped, {
                  status: 200,
                  headers: {
                    'Content-Type':     'text/html; charset=utf-8',
                    'Cache-Control':    'no-store',
                    'X-Cache':          'SSR-FORCE-RENDER',
                    'X-Worker-Version': WORKER_VERSION,
                    'X-Bot-Detected':   'true',
                  },
                });
              }
            }
          } catch (_) { /* ignore, fall through to SPA */ }
          event.waitUntil(logBotFallback(pathname, 'SSR-TOO-SMALL', userAgent));
          const fb = await fetch(request);
          const r  = new Response(fb.body, fb);
          r.headers.set('X-Cache',          'SSR-TOO-SMALL');
          r.headers.set('X-SSR-Size',        String(html.length));
          r.headers.set('X-Worker-Version',  WORKER_VERSION);
          r.headers.set('Cache-Control',     'no-cache, no-store, must-revalidate');
          return r;
        }
        html = html.replace(/<script(?:\s[^>]*)?>(?:(?!<\/script>)[\s\S])*?window\.location\.replace(?:(?!<\/script>)[\s\S])*?<\/script>/gi, '');
        // inject version comment
        html = `<!-- worker ${WORKER_VERSION} ssr -->\n${html}`;
        return new Response(html, {
          status: 200,
          headers: {
            'Content-Type':     'text/html; charset=utf-8',
            'Cache-Control':    'no-store',
            'X-Cache':          'SSR',
            'X-Cache-TTL':      String(ttl),
            'X-Worker-Version': WORKER_VERSION,
            'X-Bot-Detected':   'true',
            'X-SSR-Source':     'cloudflare-passthrough',
          },
        });
      }
    } catch (e) {
      event.waitUntil(logBotFallback(pathname, 'SSR-ERROR', userAgent));
      event.waitUntil(asyncWarmPath(pathname));
    }
    const fallback = await fetch(request);
    const fb = new Response(fallback.body, fallback);
    fb.headers.set('X-Cache',          'SSR-FALLBACK');
    fb.headers.set('X-Worker-Version', WORKER_VERSION);
    fb.headers.set('Cache-Control',    'no-cache, no-store, must-revalidate');
    return fb;

}

// ════════════════════════════════════════════════════════════════════
//  POST /api/cache-purge?secret=...&path=/some/path
//  POST /api/cache-purge?secret=...&path=all
// ════════════════════════════════════════════════════════════════════
async function handleCachePurge(request, url) {
  // Accept secret from: query param, header, or POST body JSON
  let body = null;
  if (request.method === 'POST') {
    try { body = await request.clone().json(); } catch { /* not JSON */ }
  }
  const secret = url.searchParams.get('secret')
    || request.headers.get('X-Purge-Secret')
    || body?.secret;

  if (secret !== PURGE_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  const pathParam = url.searchParams.get('path') || body?.path || '/';

  // Purge via SSR function (has service_role key → can DELETE from cached_pages)
  const ssrPurgeUrl = `${SUPABASE_URL}/functions/v1/ssr-render?purge=true&purge_secret=${encodeURIComponent(PURGE_SECRET)}&path=${encodeURIComponent(pathParam)}`;
  try {
    const resp = await fetch(ssrPurgeUrl, {
      headers: { 'Authorization': `Bearer ${ANON_KEY}`, 'apikey': ANON_KEY }
    });
    const result = await resp.json();
    return new Response(JSON.stringify({ ok: result.ok, path: pathParam, ...result }), {
      status: resp.ok ? 200 : resp.status,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

// ════════════════════════════════════════════════════════════════════
//  GET /api/cache-status?path=/some/path
//  Checks Supabase cached_pages table — the real ISR cache layer.
//  CF Cache API is NOT used (responses are no-store) so checking it
//  always returns false. The single source of truth is cached_pages.
// ════════════════════════════════════════════════════════════════════
async function handleCacheStatus(url) {
  const pathParam = url.searchParams.get('path') || '/';

  try {
    const restUrl = `${SUPABASE_URL}/rest/v1/cached_pages?path=eq.${encodeURIComponent(pathParam)}&select=path,expires_at,html&limit=1`;
    const resp = await fetch(restUrl, {
      headers: {
        'apikey':        ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
        'Accept':        'application/json',
      },
    });

    if (!resp.ok) {
      return new Response(JSON.stringify({ cached: false, path: pathParam, error: `Supabase ${resp.status}` }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const rows = await resp.json();
    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ cached: false, path: pathParam, source: 'supabase-cached_pages' }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const row       = rows[0];
    const expiresAt = new Date(row.expires_at);
    const now       = new Date();
    const isExpired = expiresAt <= now;
    const ttlLeft   = Math.max(0, Math.round((expiresAt.getTime() - now.getTime()) / 1000));
    const htmlSize  = row.html ? row.html.length : 0;

    return new Response(JSON.stringify({
      cached:     true,
      stale:      isExpired,
      path:       pathParam,
      expiresAt:  row.expires_at,
      ttlLeft:    isExpired ? 0 : ttlLeft,
      htmlSize,
      source:     'supabase-cached_pages',
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (e) {
    return new Response(JSON.stringify({ cached: false, path: pathParam, error: String(e) }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
