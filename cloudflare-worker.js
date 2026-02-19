const BOT_PATTERNS = [
  'googlebot', 'bingbot', 'yandex', 'duckduckbot', 'baiduspider',
  'gptbot', 'chatgpt-user', 'anthropic-ai', 'claudebot', 'perplexitybot',
  'twitterbot', 'facebookexternalhit', 'linkedinbot', 'slackbot',
  'telegrambot', 'whatsapp', 'discordbot', 'applebot',
  'semrush', 'ahrefs', 'mj12bot', 'screaming frog',
  'crawler', 'spider', 'bot/', 'ccbot', 'diffbot', 'bytespider',
  'cohere-ai', 'omgili', 'youbot', 'ia_archiver'
];

function isBot(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return BOT_PATTERNS.some(pattern => ua.includes(pattern));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const WORKER_VERSION = 'v2026.02.19-bot-ssr';
    const userAgent = request.headers.get('user-agent') || '';
    const isBotRequest = isBot(userAgent);

    // Proxy Supabase API requests
    if (url.pathname.startsWith('/rest/') || url.pathname.startsWith('/functions/')) {
      const supabaseUrl = 'https://tuledxqigzufkecztnlo.supabase.co';
      const targetUrl = supabaseUrl + url.pathname + url.search;

      const response = await fetch(targetUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body
      });

      // Create a new response to modify headers (headers are immutable in the original response)
      const newResponse = new Response(response.body, response);
      newResponse.headers.set('X-Worker-Version', WORKER_VERSION);

      return newResponse;
    }

    // For HTML pages and bots: bypass Cloudflare cache to ensure fresh SSR content from origin
    // This ensures that Netlify edge function (bot-ssr.ts) can properly handle the request
    const isHtmlPath = !url.pathname.includes('.') && !url.pathname.startsWith('/api/');
    
    if (isBotRequest && isHtmlPath) {
      // For bots requesting HTML pages: bypass cache and fetch directly from origin
      // This allows Netlify's bot-ssr edge function to serve proper SSR content
      const originRequest = new Request(request, {
        cf: {
          // Bypass Cloudflare cache completely for bots on HTML routes
          cacheEverything: false,
          cacheTtl: 0,
        }
      });

      const response = await fetch(originRequest);
      const newResponse = new Response(response.body, response);
      newResponse.headers.set('X-Worker-Version', WORKER_VERSION);
      newResponse.headers.set('X-Bot-Detected', 'true');
      newResponse.headers.set('X-CF-Cache-Status', 'BYPASS');
      
      // Ensure proper content type for HTML
      if (!newResponse.headers.get('Content-Type')) {
        newResponse.headers.set('Content-Type', 'text/html; charset=utf-8');
      }

      return newResponse;
    }

    // For all other requests (regular users, static assets), use normal caching
    const response = await fetch(request);
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('X-Worker-Version', WORKER_VERSION);

    return newResponse;
  }
};
