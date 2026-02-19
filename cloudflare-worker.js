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

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const WORKER_VERSION = 'v2026.02.19-fix-v9-ssr-block';
  const userAgent = request.headers.get('user-agent') || '';
  const isBotRequest = isBot(userAgent);

  // 1. Proxy Supabase API requests (directly to Supabase origin)
  if (url.pathname.startsWith('/rest/') || url.pathname.startsWith('/functions/')) {
    const supabaseUrl = 'https://tuledxqigzufkecztnlo.supabase.co';
    const targetUrl = supabaseUrl + url.pathname + url.search;
    return fetch(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body
    });
  }

  // 2. SSR for bots (using same direct logic as before)
  const isHtmlPath = !url.pathname.includes('.') && !url.pathname.startsWith('/api/');
  if (isBotRequest && isHtmlPath) {
    const ssrUrl = 'https://tuledxqigzufkecztnlo.supabase.co/functions/v1/ssr-render?path=' + encodeURIComponent(url.pathname) + '&lang=en';
    const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.XKqWqIwfy5BoKzQNNUhs5uYC_QI0GLLKXw1pBDgkCi0';

    try {
      const ssrResponse = await fetch(ssrUrl, {
        headers: {
          'Authorization': 'Bearer ' + anonKey,
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
            'X-Worker-Version': WORKER_VERSION,
            'X-Bot-Detected': 'true',
            'X-SSR-Source': 'cloudflare-worker-direct',
          },
        });
      }
    } catch (e) {}
  }

  // 3. Fallback for everyone else: pass-through with SSR blocking
  // Add a header to tell origin to skip SSR for non-bots
  const modifiedRequest = new Request(request, {
    headers: new Headers(request.headers)
  });
  
  if (!isBotRequest && isHtmlPath) {
    modifiedRequest.headers.set('X-Skip-SSR', 'true');
  }
  
  const response = await fetch(modifiedRequest);
  
  // If it's a redirect or non-200, return it as is
  if (response.status >= 300 && response.status < 400) {
    return response;
  }

  // CRITICAL FIX: If origin returns SSR content for non-bots, block it
  const hasSSR = response.headers.get('X-SSR') === 'true';
  const isSSRBot = response.headers.get('X-SSR-Bot') === 'true';
  
  if (hasSSR && !isBotRequest && !isSSRBot) {
    // Origin incorrectly sent SSR to a non-bot user — fetch index.html directly
    const spaUrl = new URL(request.url);
    spaUrl.pathname = '/index.html';
    const spaResponse = await fetch(spaUrl.toString());
    
    const newHeaders = new Headers(spaResponse.headers);
    newHeaders.set('X-Worker-Version', WORKER_VERSION);
    newHeaders.set('X-SSR-Blocked', 'true');
    newHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    return new Response(spaResponse.body, {
      status: 200,
      headers: newHeaders
    });
  }

  // Tag the response for debugging
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('X-Worker-Version', WORKER_VERSION);
  
  // Force no-cache for HTML to break redirect loops in browsers
  if (response.headers.get('Content-Type')?.includes('text/html')) {
    newResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  
  return newResponse;
}
