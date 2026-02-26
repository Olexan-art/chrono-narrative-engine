// Compare SSR live vs cached for a single path and diff <head>
const fetch = global.fetch || require('node-fetch');
const SUPABASE_URL = 'https://tuledxqigzufkecztnlo.supabase.co';
// Service role for reliability (ssr-render has verify_jwt=false, but SRK ensures no rate limits)
const SRK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg0NTI4OCwiZXhwIjoyMDg2NDIxMjg4fQ.wHlFsEnF5zVGhIaJBBShxrOY7TFmxBjafPzqNrBXOU4';
const headers = { Authorization: `Bearer ${SRK}`, apikey: SRK, Accept: 'text/html' };

const path = process.argv[2] || '/news/US/biggest-initiative-to-address-mental-health-in-film-television-in-a-generation-unveiled-at-uk-charit';

function extractHead(html){
  const m1 = html.indexOf('<head');
  const m2 = html.indexOf('</head>');
  if (m1 >= 0 && m2 > m1) return html.slice(m1, m2+7);
  return html.slice(0, 4000);
}

function summarizeHead(head){
  const title = (head.match(/<title>([\s\S]*?)<\/title>/i)||[])[1] || '';
  const metas = (head.match(/<meta[^>]+>/gi)||[]).length;
  const links = (head.match(/<link[^>]+>/gi)||[]).length;
  const scripts = (head.match(/<script[^>]*>/gi)||[]).length;
  return { title: title.trim(), metas, links, scripts, size: head.length };
}

async function fetchSSR(path, useCache){
  const url = `${SUPABASE_URL}/functions/v1/ssr-render?path=${encodeURIComponent(path)}&lang=en&cache=${useCache?'true':'false'}`;
  const res = await fetch(url, { headers });
  const txt = await res.text();
  return { ok: res.ok, status: res.status, text: txt };
}

(async()=>{
  const fs = require('fs');
  console.log('Path:', path);
  const live = await fetchSSR(path, false);
  const cached = await fetchSSR(path, true);
  fs.writeFileSync('live_target.html', live.text, 'utf8');
  fs.writeFileSync('cached_target.html', cached.text, 'utf8');
  const h1 = extractHead(live.text);
  const h2 = extractHead(cached.text);
  fs.writeFileSync('live_head.html', h1, 'utf8');
  fs.writeFileSync('cached_head.html', h2, 'utf8');
  const s1 = summarizeHead(h1);
  const s2 = summarizeHead(h2);
  console.log('Live head summary:', s1);
  console.log('Cached head summary:', s2);
  // quick diff hints
  const missing = [];
  if (s1.title !== s2.title) missing.push('title');
  if (s1.metas !== s2.metas) missing.push('meta-count');
  if (s1.links !== s2.links) missing.push('link-count');
  if (s1.scripts !== s2.scripts) missing.push('script-count');
  console.log('Head diffs:', missing);
  // Print first 20 lines of each head
  const firstLines = (s)=>s.split(/\r?\n/).slice(0,20).join('\n');
  console.log('--- LIVE <head> (first 20 lines) ---');
  console.log(firstLines(h1));
  console.log('--- CACHED <head> (first 20 lines) ---');
  console.log(firstLines(h2));
})();
