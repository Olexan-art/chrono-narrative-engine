/**
 * Cloudflare Pages Worker for Bot SSR Redirect
 * 
 * This worker detects search engine bots and AI crawlers by User-Agent,
 * and serves them pre-rendered HTML from the ssr-render Edge Function
 * instead of the SPA JavaScript bundle.
 * 
 * This ensures crawlers can index the full content of pages like:
 * - /news/us (country news listing)
 * - /news/us/some-article-slug (individual news articles)
 * - /read/2026-01-28/1 (story pages)
 * - /chapter/15 (chapter pages)
 * - etc.
 */

const SSR_ENDPOINT = 'https://bgdwxnoildvvepsoaxrf.supabase.co/functions/v1/ssr-render';

// Bot User-Agent patterns (search engines, AI crawlers, social bots)
const BOT_PATTERNS = [
  // Search Engine Bots
  'googlebot',
  'bingbot',
  'yandex',
  'duckduckbot',
  'baiduspider',
  'slurp', // Yahoo
  'sogou',
  'exabot',
  'facebot',
  'ia_archiver', // Alexa
  
  // AI/LLM Crawlers
  'gptbot',
  'chatgpt-user',
  'google-extended',
  'anthropic-ai',
  'claudebot',
  'claude-web',
  'perplexitybot',
  'cohere-ai',
  'ccbot',
  'bytespider',
  'diffbot',
  'applebot',
  
  // Social Media Bots
  'twitterbot',
  'facebookexternalhit',
  'linkedinbot',
  'slackbot',
  'telegrambot',
  'whatsapp',
  'pinterest',
  'discordbot',
  
  // SEO Tools
  'screaming frog',
  'semrush',
  'ahrefs',
  'mj12bot',
  'dotbot',
  'rogerbot',
  
  // Other Crawlers
  'crawler',
  'spider',
  'bot/',
  'http://',
  'fetcher',
];

// Paths that should NOT be SSR'd (static assets, API routes)
const EXCLUDED_PATHS = [
  '/assets/',
  '/src/',
  '/_worker.js',
  '/registerSW.js',
  '/manifest.json',
  '/favicon',
  '/robots.txt',
  '/sitemap.xml',
  '/llms.txt',
  '/llms-full.txt',
  '/.well-known/',
];

// API rewrites to Supabase Edge Functions
const API_REWRITES = {
  '/api/sitemap': `${SSR_ENDPOINT.replace('/ssr-render', '/sitemap')}`,
  '/api/news-sitemap': `${SSR_ENDPOINT.replace('/ssr-render', '/news-sitemap')}`,
  '/api/wiki-sitemap': `${SSR_ENDPOINT.replace('/ssr-render', '/wiki-sitemap')}`,
  '/api/ssr-render': SSR_ENDPOINT,
  '/api/llms-txt': `${SSR_ENDPOINT.replace('/ssr-render', '/llms-txt')}`,
};

// Check if User-Agent is a bot
function isBot(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return BOT_PATTERNS.some(pattern => ua.includes(pattern));
}

// Check if path should be excluded from SSR
function isExcludedPath(pathname) {
  return EXCLUDED_PATHS.some(excluded => pathname.startsWith(excluded));
}

// Paths that should be SSR'd for bots
function shouldSSR(pathname) {
  // SSR these path patterns:
  // - /news/xx (country news)
  // - /news/xx/slug (news articles)
  // - /read/date/num (stories)
  // - /chapter/num (chapters)
  // - /volume/year-month (volumes)
  // - /date/date (date pages)
  // - / (homepage)
  // - /chapters, /volumes, /calendar, /sitemap, /news
  
  const ssrPatterns = [
    /^\/$/,
    /^\/news$/,
    /^\/news\/[a-z]{2}$/,
    /^\/news\/[a-z]{2}\/[a-z0-9-]+$/,
    /^\/read\/\d{4}-\d{2}-\d{2}\/\d+$/,
    /^\/chapter\/\d+$/,
    /^\/volume\/\d{4}-\d{2}$/,
    /^\/date\/\d{4}-\d{2}-\d{2}$/,
    /^\/chapters$/,
    /^\/volumes$/,
    /^\/calendar$/,
    /^\/sitemap$/,
    /^\/wiki$/,
    /^\/wiki\/[a-z0-9-]+$/,
    /^\/ink-abyss$/,
  ];
  
  return ssrPatterns.some(pattern => pattern.test(pathname));
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const userAgent = request.headers.get('User-Agent') || '';
    
    // Handle API rewrites to Supabase Edge Functions
    for (const [apiPath, targetUrl] of Object.entries(API_REWRITES)) {
      if (pathname.startsWith(apiPath)) {
        try {
          // Build the target URL with query params
          const targetUrlObj = new URL(targetUrl);
          // Copy query params from original request
          url.searchParams.forEach((value, key) => {
            targetUrlObj.searchParams.set(key, value);
          });
          
          const proxyResponse = await fetch(targetUrlObj.toString(), {
            method: request.method,
            headers: {
              'User-Agent': userAgent,
              'Accept': request.headers.get('Accept') || '*/*',
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnZHd4bm9pbGR2dmVwc29heHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxOTM2MzQsImV4cCI6MjA4NDc2OTYzNH0.FaLsz1zWVZMLCWizBnKG1ARFFO3N_I1Vmri9xMVVXFk',
              'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnZHd4bm9pbGR2dmVwc29heHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxOTM2MzQsImV4cCI6MjA4NDc2OTYzNH0.FaLsz1zWVZMLCWizBnKG1ARFFO3N_I1Vmri9xMVVXFk',
            },
          });
          
          if (proxyResponse.ok) {
            const body = await proxyResponse.text();
            const contentType = proxyResponse.headers.get('Content-Type') || 'application/xml';
            
            return new Response(body, {
              status: proxyResponse.status,
              headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=3600, s-maxage=86400',
                'Access-Control-Allow-Origin': '*',
              },
            });
          }
        } catch (error) {
          console.error('API proxy failed:', error);
        }
      }
    }
    
    // Skip excluded paths (assets, etc.)
    if (isExcludedPath(pathname)) {
      return env.ASSETS.fetch(request);
    }
    
    // Check if this is a bot AND the path should be SSR'd
    if (isBot(userAgent) && shouldSSR(pathname)) {
      try {
        // Fetch pre-rendered HTML from SSR endpoint
        const ssrUrl = `${SSR_ENDPOINT}?path=${encodeURIComponent(pathname)}&lang=en`;
        
        const ssrResponse = await fetch(ssrUrl, {
          headers: {
            'User-Agent': userAgent,
            'Accept': 'text/html',
          },
        });
        
        if (ssrResponse.ok) {
          const html = await ssrResponse.text();
          
          return new Response(html, {
            status: 200,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'public, max-age=3600, s-maxage=86400',
              'X-SSR-Bot': 'true',
              'X-Bot-Detected': userAgent.substring(0, 100),
            },
          });
        }
      } catch (error) {
        console.error('SSR fetch failed:', error);
        // Fall through to serve SPA
      }
    }
    
    // Serve the normal SPA for humans or if SSR failed
    return env.ASSETS.fetch(request);
  },
};
