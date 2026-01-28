import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-admin-password, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

type BotType = 'googlebot' | 'bingbot' | 'gptbot' | 'claudebot';

const BOT_USER_AGENTS: Record<BotType, string> = {
  googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  bingbot: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  gptbot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.0; +https://openai.com/gptbot)',
  claudebot: 'Mozilla/5.0 (compatible; ClaudeBot/1.0; +mailto:support@anthropic.com)',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizePath(path: string): string {
  const trimmed = (path || '').trim();
  if (!trimmed) return '/';
  if (!trimmed.startsWith('/')) return `/${trimmed}`;
  return trimmed;
}

function parseMetaRobots(html: string): string | null {
  const m = html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']+)["'][^>]*>/i);
  return m?.[1] ?? null;
}

function parseCanonical(html: string): string | null {
  const m = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["'][^>]*>/i);
  return m?.[1] ?? null;
}

function truncateHtml(html: string, maxChars: number): { html: string; isTruncated: boolean } {
  if (html.length <= maxChars) return { html, isTruncated: false };
  return { html: html.slice(0, maxChars), isTruncated: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const adminPassword = Deno.env.get('ADMIN_PASSWORD');
  const body = await req.json().catch(() => ({}));
  const password = body?.password || req.headers.get('x-admin-password');

  if (!adminPassword || password !== adminPassword) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const botType = (body?.botType || 'googlebot') as BotType;
  const lang = (body?.lang || 'en') as string;
  const path = normalizePath(String(body?.path || '/'));

  const ua = BOT_USER_AGENTS[botType] || BOT_USER_AGENTS.googlebot;
  const ssrUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/ssr-render?path=${encodeURIComponent(
    path,
  )}&lang=${encodeURIComponent(lang)}`;

  const start = Date.now();

  try {
    // Note: createClient is intentionally unused here; kept to match existing function patterns
    // and to make it easy to extend with DB reads later if needed.
    createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const resp = await fetch(ssrUrl, {
      headers: {
        'User-Agent': ua,
        Accept: 'text/html',
      },
    });

    const responseTimeMs = Date.now() - start;
    const fullHtml = await resp.text();

    // Safety: some pages (e.g. /sitemap) can be large; the admin UI only needs a preview.
    const { html, isTruncated } = truncateHtml(fullHtml, 250_000);

    const xCache = resp.headers.get('x-cache');
    const xRobotsTag = resp.headers.get('x-robots-tag');
    const canonical = parseCanonical(fullHtml);
    const robotsMeta = parseMetaRobots(fullHtml);
    const linksCount = (fullHtml.match(/<a\s+[^>]*href=/gi) || []).length;

    return json({
      ok: resp.ok,
      status: resp.status,
      statusText: resp.statusText,
      xCache,
      xRobotsTag,
      responseTimeMs,
      contentLength: fullHtml.length,
      hasCanonical: Boolean(canonical),
      canonical,
      hasRobotsMeta: Boolean(robotsMeta),
      robotsMeta,
      linksCount,
      isTruncated,
      html,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
});
