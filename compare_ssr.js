// Compare SSR cached vs live for given paths
const SUPABASE_URL = 'https://tuledxqigzufkecztnlo.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.XKqWqIwfy5BoKzQNNUhs5uYC_QI0GLLKXw1pBDgkCi0';

const headers = {
  'Authorization': `Bearer ${ANON_KEY}`,
  'apikey': ANON_KEY,
  'Accept': 'text/html'
};

const paths = ['/', '/news/US', '/wiki'];

function counts(html) {
  const img = (html.match(/<img\b/gi) || []).length;
  const int1 = (html.match(/href=\"\//gi) || []).length;
  const int2 = (html.match(/href=\"https?:\/\/bravennow\.com\//gi) || []).length;
  const internal = int1 + int2;
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
  const words = (text.trim().split(/\s+/).filter(Boolean)).length;
  return { images: img, words, internalLinks: internal };
}

async function fetchSSR(path, useCache) {
  const url = `${SUPABASE_URL}/functions/v1/ssr-render?path=${encodeURIComponent(path)}&lang=en&cache=${useCache?'true':'false'}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return await res.text();
}

(async () => {
  for (const p of paths) {
    try {
      const live = await fetchSSR(p, false);
      const cached = await fetchSSR(p, true);
      const lc = counts(live);
      const cc = counts(cached);
      console.log(`=== ${p} ===`);
      console.log(`Live   -> img:${lc.images} words:${lc.words} links:${lc.internalLinks}`);
      console.log(`Cached -> img:${cc.images} words:${cc.words} links:${cc.internalLinks}`);
    } catch (e) {
      console.error(`Error for ${p}:`, e.message);
    }
  }
})();
