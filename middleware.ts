import { NextRequest, NextResponse } from 'next/server';

const SSR_ENDPOINT = 'https://bgdwxnoildvvepsoaxrf.supabase.co/functions/v1/ssr-render';

// Bot User-Agent patterns
const BOT_PATTERNS = [
  'googlebot', 'bingbot', 'yandex', 'duckduckbot', 'baiduspider',
  'gptbot', 'chatgpt-user', 'anthropic-ai', 'claudebot', 'perplexitybot',
  'twitterbot', 'facebookexternalhit', 'linkedinbot', 'slackbot',
  'telegrambot', 'whatsapp', 'discordbot', 'applebot',
  'semrush', 'ahrefs', 'mj12bot', 'screaming frog',
  'crawler', 'spider', 'bot/'
];

// Paths to SSR
const SSR_PATTERNS = [
  /^\/$/,
  /^\/news$/,
  /^\/news\/[a-z]{2}$/,
  /^\/news\/[a-z]{2}\/[a-z0-9-]+$/,
  /^\/read\/\d{4}-\d{2}-\d{2}\/\d+$/,
  /^\/chapter\/\d+$/,
  /^\/volume\/\d{4}-\d{2}$/,
  /^\/chapters$/,
  /^\/volumes$/,
  /^\/calendar$/,
];

function isBot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return BOT_PATTERNS.some(pattern => ua.includes(pattern));
}

function shouldSSR(pathname: string): boolean {
  return SSR_PATTERNS.some(pattern => pattern.test(pathname));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const userAgent = request.headers.get('user-agent') || '';

  // Skip static assets
  if (pathname.startsWith('/assets/') || pathname.startsWith('/_next/')) {
    return NextResponse.next();
  }

  // Check if bot and SSR-able path
  if (isBot(userAgent) && shouldSSR(pathname)) {
    const ssrUrl = `${SSR_ENDPOINT}?path=${encodeURIComponent(pathname)}&lang=en`;
    
    return NextResponse.rewrite(new URL(ssrUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
