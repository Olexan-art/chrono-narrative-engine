const fetch = global.fetch || require('node-fetch');
const BASE = 'https://tuledxqigzufkecztnlo.supabase.co/functions/v1/cache-pages';
const SRK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg0NTI4OCwiZXhwIjoyMDg2NDIxMjg4fQ.wHlFsEnF5zVGhIaJBBShxrOY7TFmxBjafPzqNrBXOU4';

async function run(pathsCsv) {
  const u = new URL(BASE);
  u.searchParams.set('action','parity-check');
  u.searchParams.set('autoFix','true');
  if (pathsCsv) u.searchParams.set('paths', pathsCsv);
  const res = await fetch(u.toString(), { headers: { 'Authorization': `Bearer ${SRK}`, 'Content-Type': 'application/json' }});
  const txt = await res.text();
  console.log(txt.slice(0, 4000));
}

(async () => {
  await run(undefined); // default
  await run('/,/news,/news/US,/news/UA,/news/PL,/wiki,/topics,/chapters,/calendar');
})();
