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
    const hoursAgo = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

    console.log(`[bulk-generate-analysis] Starting: limit=${limit}, hours_back=${hoursBack}, model=${model}`);

    // Find items that need analysis (retelled but missing news_analysis)
    const { data: items, error: fetchErr } = await supabase
      .from('news_rss_items')
      .select('id, title, content, llm_provider, llm_model, llm_processed_at')
      .gte('llm_processed_at', hoursAgo)
      .not('llm_processed_at', 'is', null)
      .is('news_analysis', null)
      .order('llm_processed_at', { ascending: true }) // oldest first
      .limit(limit);

    if (fetchErr) throw fetchErr;

    console.log(`[bulk-generate-analysis] Found ${items?.length ?? 0} items needing analysis`);

    const results = { processed: 0, success: 0, failed: 0, skipped: 0, errors: [] as string[] };

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
        itemModel = item.llm_provider === 'zai' ? 'GLM-4.7-Flash' : 'deepseek-chat';
      }

      try {
        console.log(`[bulk-generate-analysis] Processing ${item.id} (${item.llm_provider}) with ${itemModel}`);
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
            skipVerification: true, // skip 2nd LLM call to keep each item fast (~15s)
          }),
        });

        if (resp.ok) {
          results.success++;
          console.log(`[bulk-generate-analysis] ✓ ${item.id}`);
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
    }

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
