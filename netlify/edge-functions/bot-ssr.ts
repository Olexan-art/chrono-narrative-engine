import type { Context } from "https://edge.netlify.com";

const SUPABASE_URL = 'https://tuledxqigzufkecztnlo.supabase.co';
const SUPABASE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const SSR_ENDPOINT = `${SUPABASE_FUNCTIONS_URL}/ssr-render`;
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.XKqWqIwfy5BoKzQNNUhs5uYC_QI0GLLKXw1pBDgkCi0';

// Mapping: URL path -> cached_pages path in DB
const SITEMAP_CACHE_PATHS: Record<string, (searchParams: URLSearchParams) => string> = {
  '/api/sitemap': () => '/api/sitemap',
  '/api/news-sitemap': (params) => {
    const country = params.get('country');
    return country ? `/news-sitemap?country=${country}` : '/news-sitemap-index';
  },
  '/api/wiki-sitemap': () => '/api/wiki-sitemap',
  '/api/topics-sitemap': () => '/api/topics-sitemap',
  '/api/llms-txt': () => '/api/llms-txt',
};

const BOT_PATTERNS = [
  // Search engines
  'googlebot', 'google-extended', 'googleother', 'google-inspectiontool',
  'bingbot', 'msnbot', 'yandex', 'duckduckbot', 'baiduspider',
  // AI crawlers
  'gptbot', 'chatgpt-user', 'anthropic-ai', 'claudebot', 'claude-web',
  'perplexitybot', 'gemini', 'google-gemini', 'cohere-ai', 'bytespider',
  'amazonbot', 'meta-externalagent', 'youbot', 'diffbot', 'ccbot',
  // Social
  'twitterbot', 'facebookexternalhit', 'linkedinbot', 'slackbot',
  'telegrambot', 'whatsapp', 'discordbot', 'applebot',
  // SEO tools
  'semrush', 'ahrefs', 'mj12bot', 'screaming frog', 'ahrefsbot', 'semrushbot',
  // Generic
  'crawler', 'spider', 'bot/'
];

const SSR_PATTERNS = [
  /^\/$/,
  /^\/news$/,
  /^\/news\/[a-zA-Z]{2}$/,
  /^\/news\/[a-zA-Z]{2}\/[a-z0-9-]+$/,
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
  /^\/wiki\/[a-zA-Z0-9-]+$/i,
  /^\/ink-abyss$/,
  /^\/topics$/,
  /^\/topics\/.+$/,
];

function isBot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return BOT_PATTERNS.some(pattern => ua.includes(pattern));
}

function shouldSSR(pathname: string): boolean {
  return SSR_PATTERNS.some(pattern => pattern.test(pathname));
}

// Fetch cached content from cached_pages table via Supabase REST API
async function fetchFromCachedPages(cachePath: string): Promise<{ html: string | null; htmlSize: number | null; expires_at?: string | null } | null> {
  try {
    const restUrl = `${SUPABASE_URL}/rest/v1/cached_pages?path=eq.${encodeURIComponent(cachePath)}&select=html,html_size_bytes,expires_at&limit=1`;
    
    const response = await fetch(restUrl, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`cached_pages fetch failed: ${response.status}`);
      return null;
    }

    const rows = await response.json();
    if (!rows || rows.length === 0) return null;

    const row = rows[0];
    // Log cached row details for debugging (length + snippet)
    try {
      const htmlSample = (row.html || '').slice(0, 200).replace(/\s+/g, ' ');
      console.log(`[bot-ssr] cached_pages row for ${cachePath}: html_length=${(row.html||'').length}, html_size_bytes=${row.html_size_bytes}, expires_at=${row.expires_at}, sample="${htmlSample.replace(/"/g, '\\"')}"`);
    } catch (e) {
      console.log('[bot-ssr] cached_pages row logging failed', String(e));
    }

    return { html: row.html || null, htmlSize: row.html_size_bytes || null, expires_at: row.expires_at || null };
  } catch (error) {
    console.error('fetchFromCachedPages error:', error);
    return null;
  }
}

// Proxy to Supabase Edge Function as fallback
async function proxyToEdgeFunction(targetUrl: string, userAgent: string): Promise<Response | null> {
  try {
    const proxyResponse = await fetch(targetUrl, {
      headers: {
        'User-Agent': userAgent,
        'Accept': '*/*',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (proxyResponse.ok) {
      const body = await proxyResponse.text();
      const contentType = proxyResponse.headers.get('Content-Type') || 'application/xml';
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600, s-maxage=86400',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
    console.error(`Proxy returned ${proxyResponse.status} for ${targetUrl}`);
  } catch (error) {
    console.error(`Proxy failed for ${targetUrl}:`, error);
  }
  return null;
}

export default async function handler(request: Request, context: Context) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const userAgent = request.headers.get('user-agent') || '';

  // Skip /api/* routes entirely — handled by Netlify [[redirects]] proxy
  if (pathname.startsWith('/api/')) {
    return context.next();
  }

  // Skip static assets
  if (pathname.startsWith('/assets/') || pathname.includes('.')) {
    return context.next();
  }

  // HOMEPAGE FIX: Force full SSR for homepage regardless of user type
  if (pathname === '/') {
    try {
      console.log(`[bot-ssr] HOMEPAGE: Forcing SSR for ${userAgent.substring(0,50)}...`);
      const ssrUrl = `${SSR_ENDPOINT}?path=${encodeURIComponent(pathname)}&lang=en&cache=true`;
      const ssrResponse = await fetch(ssrUrl, {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });

      if (ssrResponse.ok) {
        const html = await ssrResponse.text();
        console.log(`[bot-ssr] HOMEPAGE: SSR success, length=${html.length}`);
        return new Response(html, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
            'X-SSR-Source': 'homepage-forced-ssr',
            'X-Worker-Version': 'v2026.02.25-homepage-fix',
          },
        });
      } else {
        console.error(`[bot-ssr] HOMEPAGE: SSR failed with ${ssrResponse.status}`);
      }
    } catch (error) {
      console.error(`[bot-ssr] HOMEPAGE: SSR error:`, error);
    }
    
    // Fallback for homepage: try cache
    const cachedHtml = await fetchFromCachedPages(pathname);
    if (cachedHtml?.html) {
      console.log(`[bot-ssr] HOMEPAGE: Serving cached version`);
      return new Response(cachedHtml.html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
          'X-SSR-Source': 'homepage-cached-fallback',
          'X-Worker-Version': 'v2026.02.25-homepage-fix',
        },
      });
    }
    
    console.warn(`[bot-ssr] HOMEPAGE: No cache available, falling through to SPA`);
  }

  // Serve SSR for ALL users on SSR-able paths (not just bots).
  // This ensures correct canonical URLs and content for users with JS disabled.
  // The SSR page contains a JS redirect that sends real users to the SPA,
  // so users with JS enabled will seamlessly transition to the React app.
  const ssrEnabled = shouldSSR(pathname);
  const isBotRequest = isBot(userAgent);
  
  // TEMPORARY FIX: Force all users to get SSR on homepage
  const forceSSRForUsers = pathname === '/';
  
  if (ssrEnabled) {
    
    // For bots OR homepage users: always try SSR (cache + live)
    // For regular users on other pages: only serve from cache (fast path, no latency penalty)
    if (isBotRequest || forceSSRForUsers) {
      console.log(`[bot-ssr] Bot detected: ${userAgent}`);
      try {
        const ssrUrl = `${SSR_ENDPOINT}?path=${encodeURIComponent(pathname)}&lang=en&cache=true`;
        console.log(`[bot-ssr] Calling SSR endpoint: ${ssrUrl}`);

        const ssrResponse = await fetch(ssrUrl, {
          headers: {
            'User-Agent': userAgent,
            'Accept': 'text/html',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
        });

        console.log(`[bot-ssr] SSR response status: ${ssrResponse.status} for ${pathname}`);

        // Forward 301/308 redirects (e.g. wiki UUID → slug)
        if (ssrResponse.status === 301 || ssrResponse.status === 308) {
          const location = ssrResponse.headers.get('Location');
          if (location) {
            console.log(`[bot-ssr] Forwarding ${ssrResponse.status} redirect → ${location}`);
            return new Response(null, {
              status: ssrResponse.status,
              headers: {
                'Location': location,
                'Cache-Control': 'public, max-age=86400',
                'X-SSR-Bot': 'true',
              },
            });
          }
        }

        if (ssrResponse.ok) {
          const html = await ssrResponse.text();
          console.log(`[bot-ssr] SSR HTML length: ${html.length} chars`);
          return new Response(html, {
            status: 200,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'public, max-age=3600',
              'X-SSR-Bot': 'true',
              'X-SSR-Source': 'supabase-edge-function',
            },
          });
        } else {
          const errorText = await ssrResponse.text();
          console.error(`[bot-ssr] SSR failed with status ${ssrResponse.status}: ${errorText}`);
        }
      } catch (error) {
        console.error('SSR fetch failed for bot:', error);
      }

      // Fallback: try cached_pages table directly
      console.log(`[bot-ssr] Trying cached_pages fallback for ${pathname}`);
      const cachedHtml = await fetchFromCachedPages(pathname);
      if (cachedHtml) {
        console.log(`[bot-ssr] Serving stale cache for ${pathname}`);
        return new Response(cachedHtml, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=300',
            'X-SSR-Bot': 'true',
            'X-SSR-Source': 'cached-pages-fallback',
          },
        });
      }
      console.warn(`[bot-ssr] No cache available for ${pathname}, serving SPA shell`);
    }
    // Regular users (non-homepage): try the cached_pages fast-path first (serve pre-rendered HTML if available)
    if (!isBotRequest && !forceSSRForUsers) {
      try {
        const cachedHtmlForUser = await fetchFromCachedPages(pathname);
        if (cachedHtmlForUser) {
            const cachedHtml = cachedHtmlForUser.html || '';
            const cachedLength = cachedHtml.length;
            console.log(`[bot-ssr] Serving cached page to regular user for ${pathname} (cached_length=${cachedLength}, db_html_size=${cachedHtmlForUser.htmlSize})`);

            // If DB reports a larger html_size_bytes than the returned html length, attempt live SSR to avoid serving truncated cache
            if (cachedHtmlForUser.htmlSize && cachedLength < cachedHtmlForUser.htmlSize) {
              console.warn(`[bot-ssr] Detected truncated cached HTML for ${pathname} (got ${cachedLength}B, expected ${cachedHtmlForUser.htmlSize}B). Falling back to live SSR.`);
              try {
                const ssrUrl = `${SSR_ENDPOINT}?path=${encodeURIComponent(pathname)}&lang=en&cache=true`;
                const ssrResponse = await fetch(ssrUrl, {
                  headers: {
                    'User-Agent': userAgent,
                    'Accept': 'text/html',
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                  },
                });
                if (ssrResponse.ok) {
                  const html = await ssrResponse.text();
                  return new Response(html, {
                    status: 200,
                    headers: {
                      'Content-Type': 'text/html; charset=utf-8',
                      'Cache-Control': 'public, max-age=3600',
                      'X-SSR-Source': 'supabase-edge-function-fallback',
                      'X-Worker-Version': 'v2026.02.23-isr-v1',
                    },
                  });
                } else {
                  console.error(`[bot-ssr] SSR fallback failed with status ${ssrResponse.status} for ${pathname}`);
                }
              } catch (e) {
                console.error('[bot-ssr] SSR fallback fetch failed', e);
              }
            }

            return new Response(cachedHtml, {
              status: 200,
              headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'public, max-age=300',
                'X-SSR-Source': 'cached-pages-fast-path',
                'X-Worker-Version': 'v2026.02.23-isr-v1',
                'X-Cached-Length': String(cachedLength),
              },
            });
          }
      } catch (e) {
        console.error(`[bot-ssr] cached_pages fast-path error for user ${pathname}:`, e);
      }
      // If no cached page, fallthrough to SPA by calling next()
    }
  }

  return context.next();
}
