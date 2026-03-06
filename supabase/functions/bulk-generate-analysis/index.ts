import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    let body: any = {};
    try { body = await req.json(); } catch (_) {}

    const limit = body.limit || 20;
    const hoursBack = body.hours_back || 24;
    const model = body.model || 'deepseek-chat'; // default: DeepSeek (more reliable for batch)
    const cacheOnly = body.cache_only === true; // only refresh cache, skip analysis generation
    const hoursAgo = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

    console.log(`[bulk-generate-analysis] Starting: limit=${limit}, hours_back=${hoursBack}, model=${model}, cache_only=${cacheOnly}`);

    // cache_only mode: refresh cache for items that already have analysis
    if (cacheOnly) {
      const { data: items, error: fetchErr } = await supabase
        .from('news_rss_items')
        .select('id, slug, country:news_countries(code)')
        .gte('llm_processed_at', hoursAgo)
        .not('llm_processed_at', 'is', null)
        .not('news_analysis', 'is', null)
        .order('llm_processed_at', { ascending: false })
        .limit(limit);

      if (fetchErr) throw fetchErr;

      const adminPass = Deno.env.get('ADMIN_PASSWORD');
      const tasks = (items || [])
        .filter(item => item.slug && (item.country as any)?.code)
        .map(item => {
          const cc = (item.country as any).code.toLowerCase();
          const cacheUrl = `${supabaseUrl}/functions/v1/cache-pages?action=refresh-single&path=${encodeURIComponent(`/news/${cc}/${item.slug}`)}&password=${adminPass}`;
          return fetch(cacheUrl, { headers: { 'Authorization': `Bearer ${supabaseKey}` } })
            .then(r => ({ id: item.id, ok: r.ok }))
            .catch(e => ({ id: item.id, ok: false, err: String(e) }));
        });

      const cacheResults = await Promise.race([
        Promise.all(tasks),
        new Promise<any[]>(r => setTimeout(() => r([]), 55000)),
      ]);
      const ok = (cacheResults as any[]).filter(r => r.ok).length;
      console.log(`[bulk-generate-analysis] cache_only: refreshed ${ok}/${(items||[]).length} pages`);
      return new Response(JSON.stringify({ success: true, cache_refreshed: ok, total: (items||[]).length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Find items that need analysis (retelled but missing news_analysis)
    const { data: items, error: fetchErr } = await supabase
      .from('news_rss_items')
      .select('id, title, content, slug, llm_provider, llm_model, llm_processed_at, country:news_countries(code)')
      .gte('llm_processed_at', hoursAgo)
      .not('llm_processed_at', 'is', null)
      .is('news_analysis', null)
      .order('llm_processed_at', { ascending: true }) // oldest first
      .limit(limit);

    if (fetchErr) throw fetchErr;

    console.log(`[bulk-generate-analysis] Found ${items?.length ?? 0} items needing analysis`);

    const results = { processed: 0, success: 0, failed: 0, skipped: 0, errors: [] as string[] };

    const tasks: Promise<void>[] = [];

    for (const item of (items || [])) {
      const newsContent = (item.content || item.title || '').slice(0, 3000);
      if (!newsContent) {
        results.skipped++;
        console.warn(`[bulk-generate-analysis] Skipping ${item.id} — no content or title`);
        continue;
      }

      results.processed++;

      // Choose model based on llm_provider or override
      let itemModel = model;
      if (model === 'auto') {
        itemModel = item.llm_provider === 'zai' ? (item.llm_model || 'GLM-4.7-Flash') : (item.llm_model || 'deepseek-chat');
      }

      const task = (async () => {
        try {
          console.log(`[bulk-generate-analysis] Processing ${item.id} (${item.llm_provider}) with ${itemModel}`);
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 45000); // 45s per item timeout
          const resp = await fetch(`${supabaseUrl}/functions/v1/generate-news-analysis`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              newsId: item.id,
              newsTitle: item.title,
              newsContent,
              model: itemModel,
              skipVerification: true,
            }),
            signal: controller.signal,
          });
          clearTimeout(timer);

          if (resp.ok) {
            results.success++;
            console.log(`[bulk-generate-analysis] ✓ ${item.id}`);
            // Refresh cache so Cloudflare/SSR serves updated HTML with analysis
            if (item.slug && (item.country as any)?.code) {
              const cc = (item.country as any).code.toLowerCase();
              const adminPass = Deno.env.get('ADMIN_PASSWORD');
              const cacheUrl = `${supabaseUrl}/functions/v1/cache-pages?action=refresh-single&path=${encodeURIComponent(`/news/${cc}/${item.slug}`)}&password=${adminPass}`;
              fetch(cacheUrl, { headers: { 'Authorization': `Bearer ${supabaseKey}` } })
                .catch(e => console.warn(`[bulk-generate-analysis] cache refresh warn: ${e}`));
            }
          } else {
            const errText = await resp.text();
            results.failed++;
            results.errors.push(`${item.id}: HTTP ${resp.status} — ${errText.slice(0, 100)}`);
            console.error(`[bulk-generate-analysis] ✗ ${item.id}: HTTP ${resp.status} — ${errText.slice(0, 100)}`);
          }
        } catch (e) {
          results.failed++;
          results.errors.push(`${item.id}: ${e instanceof Error ? e.message : String(e)}`);
          console.error(`[bulk-generate-analysis] ✗ ${item.id}: ${e}`);
        }
      })();

      tasks.push(task);
    }

    // Run all items in parallel, cap total wait at 55s (within 60s function timeout)
    await Promise.race([
      Promise.allSettled(tasks),
      new Promise(r => setTimeout(r, 55000)),
    ]);

    console.log(`[bulk-generate-analysis] Done: ${JSON.stringify(results)}`);

    return new Response(JSON.stringify({
      success: true,
      ...results,
      total_found: items?.length ?? 0,
      model,
      hours_back: hoursBack,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[bulk-generate-analysis] Fatal error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
