// Cloudflare Worker для кешування та SEO оптимізації
// Розгорніть цей код на workers.cloudflare.com

const CACHE_DURATION = {
  html: 3600,        // 1 година для HTML сторінок
  api: 1800,         // 30 хвилин для API
  static: 86400,     // 1 день для статичних ресурсів
  sitemap: 3600,     // 1 година для sitemaps
};

const BOT_USER_AGENTS = [
  'googlebot', 'bingbot', 'yandex', 'duckduckbot', 'baiduspider',
  'gptbot', 'chatgpt', 'claudebot', 'perplexitybot',
  'twitterbot', 'facebookexternalhit', 'linkedinbot',
  'crawler', 'spider', 'bot'
];

function isBot(userAgent) {
  const ua = (userAgent || '').toLowerCase();
  return BOT_USER_AGENTS.some(bot => ua.includes(bot));
}

function getCacheDuration(url) {
  const pathname = new URL(url).pathname;
  
  if (pathname.includes('sitemap') || pathname.includes('robots.txt')) {
    return CACHE_DURATION.sitemap;
  }
  if (pathname.startsWith('/api/')) {
    return CACHE_DURATION.api;
  }
  if (pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|ico)$/)) {
    return CACHE_DURATION.static;
  }
  return CACHE_DURATION.html;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const userAgent = request.headers.get('user-agent') || '';
    const isBotRequest = isBot(userAgent);
    
    // Створити кеш ключ
    const cacheKey = new Request(url.toString(), request);
    const cache = caches.default;
    
    // Спробувати отримати з кешу
    let response = await cache.match(cacheKey);
    
    if (response) {
      // Додати заголовок про кеш
      response = new Response(response.body, response);
      response.headers.set('X-Cache-Status', 'HIT');
      response.headers.set('X-Bot-Request', isBotRequest ? 'true' : 'false');
      return response;
    }
    
    // Якщо немає в кеші, отримати з origin
    response = await fetch(request);
    
    // Клонувати відповідь для кешування
    const responseToCache = response.clone();
    
    // Визначити тривалість кешування
    const cacheDuration = getCacheDuration(url.toString());
    
    // Налаштувати заголовки кешування
    const headers = new Headers(responseToCache.headers);
    headers.set('Cache-Control', `public, max-age=${cacheDuration}, s-maxage=${cacheDuration * 2}`);
    headers.set('X-Cache-Status', 'MISS');
    headers.set('X-Bot-Request', isBotRequest ? 'true' : 'false');
    headers.set('X-Cache-Duration', cacheDuration.toString());
    
    // Додати заголовки для SEO
    if (isBotRequest) {
      headers.set('X-Robots-Tag', 'index, follow');
    }
    
    const cachedResponse = new Response(responseToCache.body, {
      status: responseToCache.status,
      statusText: responseToCache.statusText,
      headers: headers
    });
    
    // Зберегти в кеші асинхронно
    ctx.waitUntil(cache.put(cacheKey, cachedResponse.clone()));
    
    return cachedResponse;
  }
};
