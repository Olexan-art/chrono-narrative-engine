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

    // For HTML pages and bots: fetch SSR directly from Supabase
    const isHtmlPath = !url.pathname.includes('.') && !url.pathname.startsWith('/api/');
    
    if (isBotRequest && isHtmlPath) {
      // Call Supabase SSR endpoint directly for bots
      const ssrUrl = `https://tuledxqigzufkecztnlo.supabase.co/functions/v1/ssr-render?path=${encodeURIComponent(url.pathname)}&lang=en`;
      const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.XKqWqIwfy5BoKzQNNUhs5uYC_QI0GLLKXw1pBDgkCi0';

      try {
        const ssrResponse = await fetch(ssrUrl, {
          headers: {
            'Authorization': `Bearer ${anonKey}`,
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
              'X-Worker-Version': WORKER_VERSION,
              'X-Bot-Detected': 'true',
              'X-SSR-Source': 'cloudflare-worker-direct',
            },
          });
        }
        // If SSR fails, fall through to serve SPA
      } catch (error) {
        console.error('SSR fetch failed:', error);
        // Fall through to serve SPA
      }
    }

    // For all other requests (regular users, static assets), use normal caching
    const response = await fetch(request);
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('X-Worker-Version', WORKER_VERSION);

    return newResponse;
  }
};
