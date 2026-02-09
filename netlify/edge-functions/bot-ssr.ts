import type { Context } from "https://edge.netlify.com";

const SSR_ENDPOINT = 'https://bgdwxnoildvvepsoaxrf.supabase.co/functions/v1/ssr-render';

const BOT_PATTERNS = [
  'googlebot', 'bingbot', 'yandex', 'duckduckbot', 'baiduspider',
  'gptbot', 'chatgpt-user', 'anthropic-ai', 'claudebot', 'perplexitybot',
  'twitterbot', 'facebookexternalhit', 'linkedinbot', 'slackbot',
  'telegrambot', 'whatsapp', 'discordbot', 'applebot',
  'semrush', 'ahrefs', 'mj12bot', 'screaming frog',
  'crawler', 'spider', 'bot/'
];

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

function isBot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return BOT_PATTERNS.some(pattern => ua.includes(pattern));
}

function shouldSSR(pathname: string): boolean {
  return SSR_PATTERNS.some(pattern => pattern.test(pathname));
}

export default async function handler(request: Request, context: Context) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const userAgent = request.headers.get('user-agent') || '';

  // Skip static assets
  if (pathname.startsWith('/assets/') || pathname.includes('.')) {
    return context.next();
  }

  // Check if bot and SSR-able path
  if (isBot(userAgent) && shouldSSR(pathname)) {
    try {
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
            'Cache-Control': 'public, max-age=3600',
            'X-SSR-Bot': 'true',
          },
        });
      }
    } catch (error) {
      console.error('SSR fetch failed:', error);
    }
  }

  return context.next();
}
