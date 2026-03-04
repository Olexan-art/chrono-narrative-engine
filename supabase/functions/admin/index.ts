import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, password, data } = body;

    // Get admin password from environment variable (not hardcoded)
    const ADMIN_PASSWORD = Deno.env.get('ADMIN_PASSWORD') || '1nuendo19071';

    if (!ADMIN_PASSWORD) {
      console.error('ADMIN_PASSWORD environment variable not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify password for all admin actions
    if (password !== ADMIN_PASSWORD) {
      console.log('Admin auth failed: incorrect password');
      return new Response(
        JSON.stringify({ error: 'Невірний пароль' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log(`Admin request received`);
    console.log(`SUPABASE_URL: ${Deno.env.get('SUPABASE_URL') ? 'set' : 'NOT SET'}`);
    console.log(`SUPABASE_SERVICE_ROLE_KEY: ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ? 'set' : 'NOT SET'}`);

    console.log(`Admin action: ${action}`);

    switch (action) {
      case 'verify': {
        return new Response(
          JSON.stringify({ success: true, message: 'Авторизація успішна' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getSettings': {
        const { data: settings, error } = await supabase
          .from('settings')
          .select('*')
          .limit(1)
          .single();

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true, settings }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Safe helper: expose ONLY which LLM providers are configured (no keys returned).
      case 'getLLMAvailability': {
        const { data: settings, error } = await supabase
          .from('settings')
          .select('openai_api_key, gemini_api_key, gemini_v22_api_key, anthropic_api_key, zai_api_key, mistral_api_key, deepseek_api_key')
          .limit(1)
          .single();

        if (error) throw error;

        const availability = {
          hasOpenai: !!settings?.openai_api_key || !!Deno.env.get('OPENAI_API_KEY') || !!Deno.env.get('OPENAI_API_KEY_SECONDARY'),
          hasGemini: !!settings?.gemini_api_key || !!Deno.env.get('GEMINI_API_KEY'),
          hasGeminiV22: !!settings?.gemini_v22_api_key || !!Deno.env.get('GEMINI_V22_API_KEY'),
          hasAnthropic: !!settings?.anthropic_api_key || !!Deno.env.get('ANTHROPIC_API_KEY'),
          hasZai: !!settings?.zai_api_key || !!Deno.env.get('ZAI_API_KEY'),
          hasMistral: !!settings?.mistral_api_key || !!Deno.env.get('MISTRAL_API_KEY'),
          hasDeepseek: !!settings?.deepseek_api_key || !!Deno.env.get('DEEPSEEK_API_KEY'),
        };

        return new Response(
          JSON.stringify({ success: true, availability }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'updateSettings': {
        console.log('updateSettings called with data:', JSON.stringify(data));

        if (!data || !data.id) {
          console.error('Missing data or data.id in updateSettings');
          return new Response(
            JSON.stringify({ error: 'Missing required fields: data.id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error } = await supabase
          .from('settings')
          .update(data)
          .eq('id', data.id);

        if (error) {
          console.error('updateSettings error:', error);
          throw error;
        }
        console.log('updateSettings success');
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'updateApiKeys': {
        console.log('updateApiKeys called');

        // Fetch current settings to get ID
        const { data: currentSettings } = await supabase
          .from('settings')
          .select('id')
          .limit(1)
          .single();

        if (!currentSettings) {
          return new Response(
            JSON.stringify({ error: 'Settings not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update keys - data should contain { openai_api_key, etc }
        // Filter out empty strings to avoid overwriting with empty
        const updates: any = {};
        if (data.openai_api_key !== undefined) updates.openai_api_key = data.openai_api_key;
        if (data.gemini_api_key !== undefined) updates.gemini_api_key = data.gemini_api_key;
        if (data.gemini_v22_api_key !== undefined) updates.gemini_v22_api_key = data.gemini_v22_api_key;
        if (data.anthropic_api_key !== undefined) updates.anthropic_api_key = data.anthropic_api_key;
        if (data.zai_api_key !== undefined) updates.zai_api_key = data.zai_api_key;
        if (data.mistral_api_key !== undefined) updates.mistral_api_key = data.mistral_api_key;
        if (data.deepseek_api_key !== undefined) updates.deepseek_api_key = data.deepseek_api_key;

        const { error } = await supabase
          .from('settings')
          .update(updates)
          .eq('id', currentSettings.id);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'deleteRssFeed': {
        const { feedId } = data as { feedId: string };
        if (!feedId) {
          return new Response(JSON.stringify({ error: 'feedId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        // Get all news item ids for this feed
        const { data: items } = await supabase.from('news_rss_items').select('id').eq('feed_id', feedId);
        const itemIds = (items || []).map((i: any) => i.id);
        if (itemIds.length > 0) {
          // Delete wiki entity links
          await supabase.from('news_wiki_entities').delete().in('news_item_id', itemIds);
          // Delete outrage ink links
          await supabase.from('outrage_ink_entities').delete().in('outrage_ink_id',
            (await supabase.from('outrage_ink').select('id').in('news_item_id', itemIds)).data?.map((r: any) => r.id) || []
          );
          await supabase.from('outrage_ink').delete().in('news_item_id', itemIds);
          // Delete ollama staging
          await supabase.from('ollama_retell_staging').delete().in('news_item_id', itemIds);
        }
        // Delete the feed (cascades to news_rss_items)
        const { error: delError } = await supabase.from('news_rss_feeds').delete().eq('id', feedId);
        if (delError) throw delError;
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'upsertRssFeeds': {
        const { feeds } = data as { feeds: Array<{ name: string; url: string; category: string; country_id: string }> };
        if (!feeds?.length) {
          return new Response(JSON.stringify({ error: 'feeds array required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        let inserted = 0, updated = 0;
        for (const feed of feeds) {
          const { data: existing } = await supabase.from('news_rss_feeds').select('id').eq('url', feed.url).maybeSingle();
          if (existing) {
            await supabase.from('news_rss_feeds').update({ name: feed.name, category: feed.category }).eq('id', existing.id);
            updated++;
          } else {
            await supabase.from('news_rss_feeds').insert({ name: feed.name, url: feed.url, category: feed.category, country_id: feed.country_id });
            inserted++;
          }
        }
        return new Response(JSON.stringify({ success: true, inserted, updated }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'cleanNullDates': {
        const { data: deleted, error: delErr } = await supabase
          .from('news_rss_items')
          .delete()
          .is('published_at', null)
          .select('id');
        if (delErr) throw delErr;
        return new Response(JSON.stringify({ success: true, deleted: deleted?.length ?? 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'createHolidayEntity': {
        const { name, date } = data as { name: string; date: string };
        if (!name) return new Response(JSON.stringify({ error: 'name required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        // Check if exists
        const { data: existing } = await supabase.from('wiki_entities').select('id,slug').eq('name_en', name).maybeSingle();
        if (existing) return new Response(JSON.stringify({ success: true, existing: true, slug: existing.slug }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        // Generate slug + wiki_id
        const kebab = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const shortId = crypto.randomUUID().split('-')[0];
        const slug = `${kebab}-${shortId}`;
        const wikiId = `holiday-${kebab}-${date?.slice(0, 4) || new Date().getFullYear()}`;
        const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}`;
        const { error: insErr } = await supabase.from('wiki_entities').insert({
          wiki_id: wikiId,
          entity_type: 'organization',
          name,
          name_en: name,
          description_en: `US Federal Holiday observed annually on or around ${date || 'a fixed date'}.`,
          wiki_url: wikiUrl,
          wiki_url_en: wikiUrl,
          slug,
        });
        if (insErr) throw insErr;
        return new Response(JSON.stringify({ success: true, slug }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'testProvider': {
        const { provider, apiKey, model } = data;
        if (!provider || !apiKey) {
          return new Response(
            JSON.stringify({ error: 'Provider and API Key required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        try {
          let success = false;
          let message = '';

          if (provider === 'openai') {
            const response = await fetch('https://api.openai.com/v1/models', {
              headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            success = response.ok;
            message = success ? 'Connection successful' : `Error: ${response.status}`;
          } else if (provider === 'anthropic') {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
              },
              body: JSON.stringify({
                model: 'claude-3-haiku-20240307',
                max_tokens: 1,
                messages: [{ role: 'user', content: 'Hi' }]
              })
            });
            success = response.ok;
            message = success ? 'Connection successful' : `Error: ${response.status}`;
          } else if (provider === 'gemini' || provider === 'geminiV22') {
            const m = model || 'gemini-1.5-flash';
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}?key=${apiKey}`);
            success = response.ok;
            message = success ? 'Connection successful' : `Error: ${response.status}`;
          } else if (provider === 'zai') {
            const response = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: 'GLM-4.7-Flash',
                messages: [{ role: 'user', content: 'Hi' }]
              })
            });
            success = response.ok;
            message = success ? 'Connection successful' : `Error: ${response.status}`;
          } else if (provider === 'mistral') {
            const response = await fetch('https://api.mistral.ai/v1/models', {
              headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            success = response.ok;
            message = success ? 'Connection successful' : `Error: ${response.status}`;
          } else {
            return new Response(
              JSON.stringify({ success: true, message: 'Provider test not implemented yet' }), // Treat as skipping test
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          return new Response(
            JSON.stringify({ success, message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );

        } catch (e) {
          return new Response(
            JSON.stringify({ success: false, message: e instanceof Error ? e.message : 'Unknown error' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      case 'getCronConfigs': {
        const { data: configs, error } = await supabase
          .from('cron_job_configs')
          .select('*')
          .order('job_name');

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, configs }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // --- Ollama staging helpers (dev-only) -------------------------------------------------
      case 'ensureOllamaTable': {
        // Creates ollama_retell_staging table if not exists (one-time setup for dev)
        try {
          const { data: exists } = await supabase
            .from('information_schema.tables' as any)
            .select('table_name')
            .eq('table_schema', 'public')
            .eq('table_name', 'ollama_retell_staging')
            .maybeSingle();

          if (exists) {
            return new Response(JSON.stringify({ success: true, created: false, message: 'Table already exists' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }

          // Use pg directly for DDL
          const { default: postgres } = await import('npm:postgres');
          const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!);
          await sql`
            CREATE TABLE IF NOT EXISTS public.ollama_retell_staging (
              id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
              news_id uuid NOT NULL REFERENCES public.news_rss_items(id) ON DELETE CASCADE,
              model text NOT NULL,
              language text NOT NULL DEFAULT 'en',
              content text NOT NULL DEFAULT '',
              key_points jsonb,
              themes jsonb,
              keywords jsonb,
              created_at timestamptz DEFAULT now(),
              pushed boolean DEFAULT false,
              pushed_at timestamptz
            )
          `;
          await sql`
            CREATE UNIQUE INDEX IF NOT EXISTS ux_ollama_retell_staging_news_model
              ON public.ollama_retell_staging(news_id, model)
          `;
          await sql`ALTER TABLE public.ollama_retell_staging ENABLE ROW LEVEL SECURITY`;
          await sql`
            CREATE POLICY "ollama_staging_allow_all" ON public.ollama_retell_staging
              FOR ALL USING (true) WITH CHECK (true)
          `;
          await sql.end();
          return new Response(JSON.stringify({ success: true, created: true, message: 'Table created' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (e) {
          console.error('ensureOllamaTable error:', e);
          return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      case 'ensureDeepseekCron': {
        try {
          const { default: postgres } = await import('npm:postgres');
          const dbUrl = Deno.env.get('SUPABASE_DB_URL');
          if (!dbUrl) throw new Error('SUPABASE_DB_URL not configured');

          const sql = postgres(dbUrl);

          // 1. Schedule the cron job if it doesn't exist
          // NOTE: We use DO $$ ... $$ to make it idempotent in a more robust way if needed, 
          // but unschedule + schedule is usually fine for maintenance tasks.
          await sql`
            SELECT cron.unschedule('invoke_bulk_retell_news_deepseek_15m');
          `.catch(() => { }); // Ignore error if not scheduled

          await sql`
            SELECT cron.schedule(
              'invoke_bulk_retell_news_deepseek_15m',
              '*/15 * * * *',
              ${`
                select net.http_post(
                  url:='${Deno.env.get('SUPABASE_URL')}/functions/v1/bulk-retell-news-deepseek',
                  headers:=jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
                  ),
                  body:=jsonb_build_object(
                    'country_code', 'ALL',
                    'time_range', 'last_3h',
                    'llm_model', 'deepseek-chat',
                    'job_name', 'bulk_retell_all_deepseek',
                    'trigger', 'cron'
                  )
                );
              `}
            );
          `;

          // 2. Insert into cron_job_configs for UI visibility
          await sql`
            INSERT INTO cron_job_configs (job_name, frequency_minutes, enabled, processing_options)
            VALUES (
              'bulk_retell_all_deepseek', 
              15, 
              true, 
              ${JSON.stringify({
            country_code: 'ALL',
            time_range: 'last_3h',
            llm_model: 'deepseek-chat',
            llm_provider: 'deepseek'
          })}::jsonb
            )
            ON CONFLICT (job_name) DO UPDATE SET 
              frequency_minutes = EXCLUDED.frequency_minutes, 
              enabled = EXCLUDED.enabled,
              processing_options = COALESCE(cron_job_configs.processing_options, EXCLUDED.processing_options);
          `;

          await sql.end();

          return new Response(JSON.stringify({ success: true, message: 'DeepSeek cron job initialized and scheduled' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (e) {
          console.error('ensureDeepseekCron error:', e);
          return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      case 'ensureZaiCron': {
        try {
          const { default: postgres } = await import('npm:postgres');
          const dbUrl = Deno.env.get('SUPABASE_DB_URL');
          if (!dbUrl) throw new Error('SUPABASE_DB_URL not configured');

          const sql = postgres(dbUrl);

          // 1. Schedule the cron job if it doesn't exist (parallel with DeepSeek)
          await sql`
            SELECT cron.unschedule('invoke_bulk_retell_news_zai_15m');
          `.catch(() => { }); // Ignore error if not scheduled

          await sql`
            SELECT cron.schedule(
              'invoke_bulk_retell_news_zai_15m',
              '*/15 * * * *',
              ${`
                select net.http_post(
                  url:='${Deno.env.get('SUPABASE_URL')}/functions/v1/bulk-retell-news-zai',
                  headers:=jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
                  ),
                  body:=jsonb_build_object(
                    'country_code', 'ALL',
                    'time_range', 'last_3h',
                    'llm_model', 'GLM-4.7-Flash',
                    'job_name', 'bulk_retell_all_zai',
                    'trigger', 'cron'
                  )
                );
              `}
            );
          `;

          // 2. Insert into cron_job_configs for UI visibility
          await sql`
            INSERT INTO cron_job_configs (job_name, frequency_minutes, enabled, processing_options)
            VALUES (
              'bulk_retell_all_zai', 
              15, 
              true, 
              ${JSON.stringify({
            country_code: 'ALL',
            time_range: 'last_3h',
            llm_model: 'GLM-4.7-Flash',
            llm_provider: 'zai'
          })}::jsonb
            )
            ON CONFLICT (job_name) DO UPDATE SET 
              frequency_minutes = EXCLUDED.frequency_minutes, 
              enabled = EXCLUDED.enabled,
              processing_options = COALESCE(cron_job_configs.processing_options, EXCLUDED.processing_options);
          `;

          await sql.end();

          return new Response(JSON.stringify({ success: true, message: 'Z.AI cron job initialized and scheduled' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (e) {
          console.error('ensureZaiCron error:', e);
          return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      case 'saveOllamaStaged': {
        // data: { retells: Array<{ newsId, model, language, content, key_points?, themes?, keywords? }> }
        if (!data || !data.retells) {
          return new Response(JSON.stringify({ error: 'Missing retells data' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const rows = Array.isArray(data.retells) ? data.retells : [data.retells];
        try {
          const { error } = await supabase
            .from('ollama_retell_staging')
            .upsert(rows.map(r => ({
              news_id: r.newsId,
              model: r.model,
              language: r.language || 'en',
              content: r.content,
              key_points: r.key_points || null,
              themes: r.themes || null,
              keywords: r.keywords || null,
              pushed: false
            })), { onConflict: 'news_id,model' });

          if (error) throw error;
          return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (e) {
          console.error('saveOllamaStaged error:', e);
          return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      case 'listOllamaStaged': {
        // Optional filters: pushed (true/false), limit
        const pushedFilter = data?.pushed;
        const limit = data?.limit || 200;
        try {
          let q = supabase.from('ollama_retell_staging').select('*').order('created_at', { ascending: false }).limit(limit);
          if (pushedFilter === true) q = q.eq('pushed', true);
          if (pushedFilter === false) q = q.eq('pushed', false);

          const { data: rows, error } = await q;
          if (error) throw error;
          return new Response(JSON.stringify({ success: true, rows }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (e) {
          console.error('listOllamaStaged error:', e);
          return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      case 'pushOllamaStagedToLive': {
        // data: { ids?: string[] } - if omitted, push all unpushed
        try {
          const ids: string[] | undefined = data?.ids;
          let stagedQuery = supabase.from('ollama_retell_staging').select('*').order('created_at', { ascending: true });
          if (ids && Array.isArray(ids) && ids.length > 0) stagedQuery = stagedQuery.in('id', ids);
          else stagedQuery = stagedQuery.eq('pushed', false);

          const { data: stagedRows, error: stagedErr } = await stagedQuery;
          if (stagedErr) throw stagedErr;
          if (!stagedRows || stagedRows.length === 0) return new Response(JSON.stringify({ success: true, processed: 0, pushed: 0, skipped: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

          let processed = 0;
          let pushed = 0;
          let skipped = 0;

          for (const row of stagedRows) {
            processed++;
            const lang = (row.language || 'en').toLowerCase();
            // determine target field
            const targetField = lang === 'en' ? 'content_en' : (lang === 'hi' ? 'content_hi' : (lang === 'ta' ? 'content_ta' : (lang === 'te' ? 'content_te' : (lang === 'bn' ? 'content_bn' : 'content'))));

            // Check if the target field already has a retell (length > 100)
            const { data: existing, error: existingErr } = await supabase.from('news_rss_items').select(`${targetField}`).eq('id', row.news_id).limit(1).single();
            if (existingErr) {
              console.error('Failed to fetch news item for push:', existingErr);
              skipped++;
              continue;
            }

            const existingContent = existing ? (existing[targetField] as string | null) : null;
            if (existingContent && existingContent.length > 100) {
              // already has retell — skip
              skipped++;
              // still mark staging row as pushed=false (keep it) — or keep as-is
              continue;
            }

            // Prepare update payload for news_rss_items
            const updatePayload: any = {};
            updatePayload[targetField] = row.content;
            if (row.key_points) updatePayload.key_points = row.key_points;
            if (row.themes) updatePayload.themes = row.themes;
            if (row.keywords) updatePayload.keywords = row.keywords;

            const { error: updateErr } = await supabase.from('news_rss_items').update(updatePayload).eq('id', row.news_id);
            if (updateErr) {
              console.error('Failed to apply staged retell to news item:', updateErr);
              skipped++;
              continue;
            }

            // mark staging row as pushed
            const { error: markErr } = await supabase.from('ollama_retell_staging').update({ pushed: true, pushed_at: new Date().toISOString() }).eq('id', row.id);
            if (markErr) console.error('Failed to mark staging row as pushed:', markErr);

            pushed++;
          }

          return new Response(JSON.stringify({ success: true, processed, pushed, skipped }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (e) {
          console.error('pushOllamaStagedToLive error:', e);
          return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // --- Ollama Wiki staging helpers (dev-only) -------------------------------------------
      case 'ensureOllamaWikiTable': {
        // Creates ollama_wiki_staging table if not exists (one-time setup for dev)
        try {
          const { data: exists } = await supabase
            .from('information_schema.tables' as any)
            .select('table_name')
            .eq('table_schema', 'public')
            .eq('table_name', 'ollama_wiki_staging')
            .maybeSingle();

          if (exists) {
            return new Response(JSON.stringify({ success: true, created: false, message: 'Table already exists' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }

          // Use pg directly for DDL
          const { default: postgres } = await import('npm:postgres');
          const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!);
          await sql`
            CREATE TABLE IF NOT EXISTS public.ollama_wiki_staging (
              id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
              entity_id uuid NOT NULL REFERENCES public.wiki_entities(id) ON DELETE CASCADE,
              model text NOT NULL,
              language text NOT NULL DEFAULT 'uk',
              content text NOT NULL DEFAULT '',
              sources jsonb,
              created_at timestamptz DEFAULT now(),
              pushed boolean DEFAULT false,
              pushed_at timestamptz
            )
          `;
          await sql`
            CREATE UNIQUE INDEX IF NOT EXISTS ux_ollama_wiki_staging_entity_model_lang
              ON public.ollama_wiki_staging(entity_id, model, language)
          `;
          await sql`ALTER TABLE public.ollama_wiki_staging ENABLE ROW LEVEL SECURITY`;
          await sql`
            CREATE POLICY "ollama_wiki_staging_allow_all" ON public.ollama_wiki_staging
              FOR ALL USING (true) WITH CHECK (true)
          `;
          await sql.end();
          return new Response(JSON.stringify({ success: true, created: true, message: 'Table created' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (e) {
          console.error('ensureOllamaWikiTable error:', e);
          return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      case 'pushOllamaWikiStagedToLive': {
        // data: { ids?: string[] } - if omitted, push all unpushed
        try {
          const ids: string[] | undefined = data?.ids;
          let stagedQuery = supabase.from('ollama_wiki_staging').select('*').order('created_at', { ascending: true });
          if (ids && Array.isArray(ids) && ids.length > 0) stagedQuery = stagedQuery.in('id', ids);
          else stagedQuery = stagedQuery.eq('pushed', false);

          const { data: stagedRows, error: stagedErr } = await stagedQuery;
          if (stagedErr) throw stagedErr;
          if (!stagedRows || stagedRows.length === 0) {
            return new Response(JSON.stringify({ success: true, processed: 0, pushed: 0, skipped: 0 }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }

          let processed = 0;
          let pushed = 0;
          let skipped = 0;

          for (const row of stagedRows) {
            processed++;

            // Fetch the entity's current raw_data
            const { data: entity, error: entityErr } = await supabase
              .from('wiki_entities')
              .select('raw_data')
              .eq('id', row.entity_id)
              .single();

            if (entityErr) {
              console.error('Failed to fetch wiki entity for push:', entityErr);
              skipped++;
              continue;
            }

            // Check if entity already has info_card_content
            const existingRawData = entity?.raw_data as Record<string, any> || {};
            const existingInfoCard = existingRawData?.info_card_content || '';

            if (existingInfoCard && existingInfoCard.length > 100) {
              // already has info card — skip
              skipped++;
              continue;
            }

            // Update raw_data with info_card_content and info_card_sources
            const updatedRawData = {
              ...existingRawData,
              info_card_content: row.content,
              info_card_sources: row.sources || [],
              info_card_language: row.language,
              info_card_model: row.model,
            };

            const { error: updateErr } = await supabase
              .from('wiki_entities')
              .update({ raw_data: updatedRawData })
              .eq('id', row.entity_id);

            if (updateErr) {
              console.error('Failed to apply staged info card to wiki entity:', updateErr);
              skipped++;
              continue;
            }

            // mark staging row as pushed
            const { error: markErr } = await supabase
              .from('ollama_wiki_staging')
              .update({ pushed: true, pushed_at: new Date().toISOString() })
              .eq('id', row.id);

            if (markErr) console.error('Failed to mark staging row as pushed:', markErr);

            pushed++;
          }

          return new Response(JSON.stringify({ success: true, processed, pushed, skipped }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (e) {
          console.error('pushOllamaWikiStagedToLive error:', e);
          return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // --- Ollama Scoring staging helpers (dev-only) ----------------------------------------
      case 'ensureOllamaScoringTable': {
        // Creates ollama_scoring_staging table if not exists (one-time setup for dev)
        try {
          const { data: exists } = await supabase
            .from('information_schema.tables' as any)
            .select('table_name')
            .eq('table_schema', 'public')
            .eq('table_name', 'ollama_scoring_staging')
            .maybeSingle();

          if (exists) {
            return new Response(JSON.stringify({ success: true, created: false, message: 'Table already exists' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }

          // Use pg directly for DDL
          const { default: postgres } = await import('npm:postgres');
          const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!);
          await sql`
            CREATE TABLE IF NOT EXISTS public.ollama_scoring_staging (
              id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
              news_id uuid NOT NULL REFERENCES public.news_rss_items(id) ON DELETE CASCADE,
              model text NOT NULL,
              scoring_data jsonb,
              html_content text,
              created_at timestamptz DEFAULT now(),
              pushed boolean DEFAULT false,
              pushed_at timestamptz
            )
          `;
          await sql`
            CREATE UNIQUE INDEX IF NOT EXISTS ux_ollama_scoring_staging_news_model
              ON public.ollama_scoring_staging(news_id, model)
          `;
          await sql`ALTER TABLE public.ollama_scoring_staging ENABLE ROW LEVEL SECURITY`;
          await sql`
            CREATE POLICY "ollama_scoring_staging_allow_all" ON public.ollama_scoring_staging
              FOR ALL USING (true) WITH CHECK (true)
          `;
          await sql.end();
          return new Response(JSON.stringify({ success: true, created: true, message: 'Table created' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (e) {
          console.error('ensureOllamaScoringTable error:', e);
          return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      case 'saveOllamaScoringStaged': {
        if (!data || !data.scores) {
          return new Response(JSON.stringify({ error: 'Missing scores data' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const rows = Array.isArray(data.scores) ? data.scores : [data.scores];
        try {
          const { error } = await supabase
            .from('ollama_scoring_staging')
            .upsert(rows.map(r => ({
              news_id: r.newsId,
              model: r.model,
              scoring_data: r.scoring_data,
              html_content: r.html_content,
              pushed: false
            })), { onConflict: 'news_id,model' });

          if (error) throw error;
          return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (e) {
          console.error('saveOllamaScoringStaged error:', e);
          return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      case 'listOllamaScoringStaged': {
        const pushedFilter = data?.pushed;
        const limit = data?.limit || 200;
        try {
          let q = supabase.from('ollama_scoring_staging').select('*, news_rss_items(title, url)').order('created_at', { ascending: false }).limit(limit);
          if (pushedFilter === true) q = q.eq('pushed', true);
          if (pushedFilter === false) q = q.eq('pushed', false);

          const { data: rows, error } = await q;
          if (error) throw error;
          return new Response(JSON.stringify({ success: true, rows }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (e) {
          console.error('listOllamaScoringStaged error:', e);
          return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      case 'pushOllamaScoringStagedToLive': {
        try {
          const ids: string[] | undefined = data?.ids;
          let stagedQuery = supabase.from('ollama_scoring_staging').select('*').order('created_at', { ascending: true });
          if (ids && Array.isArray(ids) && ids.length > 0) stagedQuery = stagedQuery.in('id', ids);
          else stagedQuery = stagedQuery.eq('pushed', false);

          const { data: stagedRows, error: stagedErr } = await stagedQuery;
          if (stagedErr) throw stagedErr;
          if (!stagedRows || stagedRows.length === 0) {
            return new Response(JSON.stringify({ success: true, processed: 0, pushed: 0, skipped: 0 }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }

          let processed = 0;
          let pushed = 0;
          let skipped = 0;

          for (const row of stagedRows) {
            processed++;

            // Check if entity already has source_scoring
            const { data: existing, error: existingErr } = await supabase
              .from('news_rss_items')
              .select('source_scoring')
              .eq('id', row.news_id)
              .single();

            if (existingErr) {
              console.error('Failed to fetch news item for push:', existingErr);
              skipped++;
              continue;
            }

            // We will conditionally skip if it already has scoring
            const existingScoring = existing?.source_scoring;
            if (existingScoring && typeof existingScoring === 'object' && Object.keys(existingScoring).length > 0) {
              // skip
              skipped++;
              continue; // Don't overwrite existing scoring unless forced
            }

            const sourceScoring = {
              json: row.scoring_data,
              html: row.html_content
            };

            const { error: updateErr } = await supabase
              .from('news_rss_items')
              .update({ source_scoring: sourceScoring })
              .eq('id', row.news_id);

            if (updateErr) {
              console.error('Failed to apply staged scoring to news item:', updateErr);
              skipped++;
              continue;
            }

            // mark staging row as pushed
            const { error: markErr } = await supabase
              .from('ollama_scoring_staging')
              .update({ pushed: true, pushed_at: new Date().toISOString() })
              .eq('id', row.id);

            if (markErr) console.error('Failed to mark staging row as pushed:', markErr);

            pushed++;
          }

          return new Response(JSON.stringify({ success: true, processed, pushed, skipped }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (e) {
          console.error('pushOllamaScoringStagedToLive error:', e);
          return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // --------------------------------------------------------------------------------------

      case 'getCronEvents': {
        try {
          const limit = (data && data.limit) || 25;
          const { data: events, error } = await supabase
            .from('cron_job_events')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

          if (error) throw error;
          return new Response(JSON.stringify({ success: true, events }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (outerErr) {
          console.error('getCronEvents failed:', outerErr);
          return new Response(JSON.stringify({ success: false, error: outerErr instanceof Error ? outerErr.message : String(outerErr) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // Inspect pg_cron table (job entries)
      case 'inspectPgCron': {
        const jobName = (data && data.jobName) ? String(data.jobName) : '%bulk_retell_%';
        try {
          const sql = `SELECT jobid, jobname, schedule, next_run, nodename, active, last_run, last_status FROM cron.job WHERE jobname LIKE '${jobName.replace("'", "''")}'`;
          const { data: rows } = await supabase.rpc('exec_sql', { sql });
          return new Response(JSON.stringify({ success: true, rows }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (e) {
          console.error('inspectPgCron failed:', e);
          return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // provide aggregated retell statistics broken down by provider/model for a recent window
      case 'getRetellStats': {
        try {
          const hours = (data && typeof data.hours === 'number') ? data.hours : 5;
          const sql = `
      select job_name,
             coalesce(details->>'provider','<unknown>') as provider,
             coalesce(details->>'llm_model', details->>'model','') as model,
             sum(
               coalesce(
                 nullif(details->>'success_count','')::int,
                 nullif(details->>'processed','')::int,
                 0
               )
             ) as news_retold,
             min(created_at) as first_run,
             max(created_at) as last_run
      from cron_job_events
      where event_type='run_finished'
        and created_at >= now() - interval '${hours} hour'
        and job_name like 'retell_%'
      group by job_name, provider, model
      order by job_name
    `;
          console.log('Executing SQL:', sql);
          const { data: rows, error } = await supabase.rpc('exec_sql', { sql });
          console.log('exec_sql result - rows:', rows, 'error:', error);
          if (error) {
            const errorMsg = error.message || (typeof error === 'string' ? error : JSON.stringify(error));
            throw new Error(errorMsg);
          }
          return new Response(JSON.stringify({ success: true, rows: rows || [] }), { headers:{...corsHeaders,'Content-Type':'application/json'} });
        } catch (e) {
          console.error('getRetellStats failed:', e);
          const errorMsg = e instanceof Error ? e.message : String(e);
          return new Response(JSON.stringify({ success:false, error: errorMsg}), { status:500, headers:{...corsHeaders,'Content-Type':'application/json'} });
        }
      }

      // Directly invoke the cache-pages function (for manual cache warm from Dashboard)
      case 'triggerCacheRefresh': {
        // filter values: 'recent' (last 24h), 'news' (7d), 'wiki', 'all'
        const { filter = 'recent', offset = 0, batchSize = 20 } = data || {};
        const actionMap: Record<string, string> = {
          recent: 'refresh-recent',
          news: 'refresh-news',
          wiki: 'refresh-wiki',
          all: 'refresh-all',
        };
        const cacheAction = actionMap[filter] || 'refresh-recent';
        try {
          const adminPass = Deno.env.get('ADMIN_PASSWORD')!;
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
          const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          // Use AbortController to return early after 25s (function limit);
          // cache-pages will continue processing on its side.
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 25000);
          let resp: Response;
          let result: any;
          try {
            resp = await fetch(
              `${supabaseUrl}/functions/v1/cache-pages?action=${encodeURIComponent(cacheAction)}&password=${encodeURIComponent(adminPass)}&batchSize=${batchSize}&offset=${offset}`,
              {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${serviceKey}` },
                signal: controller.signal,
              }
            );
            result = await resp.json().catch(() => ({ status: resp.status }));
          } catch (e: any) {
            // AbortError = timed out but request was sent and is processing
            if (e.name === 'AbortError') {
              return new Response(
                JSON.stringify({ success: true, status: 202, filter, cacheAction, result: { message: 'Cache warm triggered — processing continues in background' } }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
            throw e;
          } finally {
            clearTimeout(timeout);
          }
          return new Response(
            JSON.stringify({ success: resp.ok, status: resp.status, filter, cacheAction, result }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (e) {
          return new Response(
            JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Force-run a pg_cron job by job_name (cron.run(jobid)) — admin-only utility
      case 'runPgCronNow': {
        const { jobName } = data || {};
        if (!jobName) {
          return new Response(JSON.stringify({ error: 'jobName required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        try {
          const { data: found } = await supabase.rpc('exec_sql', { sql: `SELECT jobid FROM cron.job WHERE jobname = '${String(jobName).replace("'", "''")}' LIMIT 1` });
          const jobid = Array.isArray(found) && found.length > 0 ? (found[0] && found[0].jobid) : null;
          if (!jobid) return new Response(JSON.stringify({ success: false, error: 'job not found in pg_cron' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

          await supabase.rpc('exec_sql', { sql: `SELECT cron.run(${jobid})` });

          // Log forced run
          try { await supabase.from('cron_job_events').insert({ job_name: jobName, event_type: 'run_forced', origin: 'admin', details: { jobid } }); } catch (e) { console.error('Failed to write cron_job_events (run_forced):', e); }

          return new Response(JSON.stringify({ success: true, jobid }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (e) {
          console.error('runPgCronNow failed:', e);
          return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // Force-run a pg_cron job by numeric job id — useful when jobname isn't visible via cron.job
      case 'runCronById': {
        const { jobId } = data || {};
        if (jobId === undefined || jobId === null) {
          return new Response(JSON.stringify({ error: 'jobId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        try {
          await supabase.rpc('exec_sql', { sql: `SELECT cron.run(${Number(jobId)})` });
          try { await supabase.from('cron_job_events').insert({ job_name: null, event_type: 'run_forced_by_id', origin: 'admin', details: { jobId } }); } catch (e) { console.error('Failed to write cron_job_events (run_forced_by_id):', e); }
          return new Response(JSON.stringify({ success: true, jobId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (e) {
          console.error('runCronById failed:', e);
          return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // Simulate pg_cron HTTP invoke (call the same net.http_post target directly using service role key)
      case 'testCronInvoke': {
        const { country_code, time_range, job_name } = data || {};
        try {
          const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/bulk-retell-news`;
          const resp = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceKey}`
            },
            body: JSON.stringify({ country_code, time_range, job_name, trigger: 'cron' })
          });

          let body = null;
          try { body = await resp.json(); } catch (e) { body = await resp.text().catch(() => null); }

          // Log test invoke
          try {
            await supabase.from('cron_job_events').insert({ job_name: job_name || null, event_type: 'test_invoke', origin: 'admin', details: { status: resp.status, body } });
          } catch (e) { console.error('Failed to write cron_job_events (test_invoke):', e); }

          return new Response(JSON.stringify({ success: resp.ok, status: resp.status, body }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (e) {
          console.error('testCronInvoke failed:', e);
          return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      case 'updateCronConfig': {
        const { jobName, config } = data;
        if (!jobName) {
          return new Response(
            JSON.stringify({ error: 'Job Name required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // 1. Prepare the data
        const now = new Date().toISOString();
        const updateData: any = { 
          job_name: jobName,
          updated_at: now,
          enabled: config.enabled !== undefined ? config.enabled : true,
          frequency_minutes: config.frequency_minutes || 60,
          countries: config.countries || null,
          processing_options: config.processing_options || null
        };

        // Use upsert to handle both insert and update
        console.log('Upserting cron config:', JSON.stringify(updateData));
        const { error, data: upsertedData } = await supabase
          .from('cron_job_configs')
          .upsert([updateData], { 
            onConflict: 'job_name',
            ignoreDuplicates: false 
          });

        console.log(`Upsert result:`, {
          error: error ? { message: error.message, code: error.code } : null,
          dataLength: upsertedData ? upsertedData.length : 0
        });

        if (error) {
          console.error('Upsert failed:', error.message);
          throw error;
        }


        // 2. Sync with pg_cron
        // Only if enabled/frequency changes, or if we want to ensure it's always in sync
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        // Determine schedule expression
        let schedule = '0 * * * *'; // default 1 hour
        if (config.frequency_minutes) {
          const mins = config.frequency_minutes;
          if (mins === 15) schedule = '*/15 * * * *';
          else if (mins === 30) schedule = '*/30 * * * *';
          else if (mins === 60) schedule = '0 * * * *';
          else if (mins === 180) schedule = '0 */3 * * *';
          else if (mins === 360) schedule = '0 */6 * * *';
          else if (mins === 720) schedule = '0 */12 * * *';
          else if (mins === 1440) schedule = '0 0 * * *';
          else if (mins === 10080) schedule = '0 9 * * 1'; // Weekly on Monday morning 9am
        }

        const isEnabled = config.enabled !== undefined ? config.enabled : true; // Assuming true if not passed, but we should probably fetch current if not passed. 
        // Better: Fetch the FULL updated config to be sure
        const { data: updatedConfig } = await supabase
          .from('cron_job_configs')
          .select('*')
          .eq('job_name', jobName)
          .single();

        if (updatedConfig) {
          const finalEnabled = updatedConfig.enabled;
          const finalMins = updatedConfig.frequency_minutes;

          // Recalculate schedule based on fetched data
          if (finalMins === 15) schedule = '*/15 * * * *';
          else if (finalMins === 30) schedule = '*/30 * * * *';
          else if (finalMins === 60) schedule = '0 * * * *';
          else if (finalMins === 180) schedule = '0 */3 * * *';
          else if (finalMins === 360) schedule = '0 */6 * * *';
          else if (finalMins === 720) schedule = '0 */12 * * *';
          else if (finalMins === 1440) schedule = '0 0 * * *';
          else if (finalMins === 10080) schedule = '0 9 * * 1';

          try {
            // Always try to unschedule first using direct SQL
            await supabase.rpc('exec_sql', {
              sql: `SELECT cron.unschedule('${jobName}')`
            });

            // Log unschedule event (best-effort)
            try {
              await supabase.from('cron_job_events').insert({ job_name: jobName, event_type: 'unscheduled', origin: 'admin', details: {} });
            } catch (e) { console.error('Failed to write cron_job_events (unscheduled):', e); }

            if (finalEnabled) {
              let cronCommand = '';

              if (jobName === 'news_fetching' || jobName === 'fetch-rss-feeds-hourly') {
                cronCommand = `SELECT net.http_post(url:='${supabaseUrl}/functions/v1/fetch-rss', headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${serviceKey}"}'::jsonb, body:='{"action": "fetch_all"}'::jsonb, timeout:=60000) as request_id;`;
              } else if (jobName === 'fetch-us-rss') {
                cronCommand = `SELECT net.http_post(url:='${supabaseUrl}/functions/v1/fetch-rss', headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${serviceKey}"}'::jsonb, body:='{"action": "fetch_us_rss"}'::jsonb, timeout:=60000) as request_id;`;
              } else if (jobName === 'generate-week') {
                cronCommand = `SELECT net.http_post(url:='${supabaseUrl}/functions/v1/generate-week', headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${serviceKey}"}'::jsonb, body:='{"mode": "auto"}'::jsonb, timeout:=60000) as request_id;`;
              } else if (jobName === 'news_retelling') {
                cronCommand = `SELECT net.http_post(url:='${supabaseUrl}/functions/v1/retell-news', headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${serviceKey}"}'::jsonb, body:='{"action": "process_queue"}'::jsonb, timeout:=60000) as request_id;`;
              } else if (jobName === 'news_retelling_zai') {
                cronCommand = `SELECT net.http_post(url:='${supabaseUrl}/functions/v1/bulk-retell-news-zai', headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${serviceKey}"}'::jsonb, body:='{"country_code": "us", "time_range": "last_24h", "job_name": "${jobName}", "trigger": "cron"}'::jsonb, timeout:=60000) as request_id;`;
              } else if (jobName === 'bulk_retell_all_deepseek') {
                const opts = updatedConfig.processing_options || { country_code: 'ALL', time_range: 'last_3h', llm_model: 'deepseek-chat', llm_provider: 'deepseek' };
                cronCommand = `SELECT net.http_post(url:='${supabaseUrl}/functions/v1/bulk-retell-news-deepseek', headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${serviceKey}"}'::jsonb, body:='{"country_code": "${opts.country_code}", "time_range": "${opts.time_range}", "llm_model": "${opts.llm_model}", "job_name": "${jobName}", "trigger": "cron"}'::jsonb, timeout:=60000) as request_id;`;
              } else if (jobName === 'bulk_retell_all_zai') {
                const opts = updatedConfig.processing_options || { country_code: 'ALL', time_range: 'last_3h', llm_model: 'GLM-4.7-Flash', llm_provider: 'zai' };
                cronCommand = `SELECT net.http_post(url:='${supabaseUrl}/functions/v1/bulk-retell-news-zai', headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${serviceKey}"}'::jsonb, body:='{"country_code": "${opts.country_code}", "time_range": "${opts.time_range}", "llm_model": "${opts.llm_model}", "job_name": "${jobName}", "trigger": "cron"}'::jsonb, timeout:=60000) as request_id;`;
              } else if (jobName === 'cache_refresh') {
                cronCommand = `SELECT net.http_post(url:='${supabaseUrl}/functions/v1/cache-pages', headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${serviceKey}"}'::jsonb, body:='{"action": "refresh-all"}'::jsonb, timeout:=60000) as request_id;`;
              } else if (jobName.startsWith('bulk_retell_')) {
                const opts = updatedConfig.processing_options || {};
                cronCommand = `SELECT net.http_post(url:='${supabaseUrl}/functions/v1/bulk-retell-news', headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${serviceKey}"}'::jsonb, body:='{"country_code": "${opts.country_code}", "time_range": "${opts.time_range}", "llm_model": "${opts.llm_model}", "llm_provider": "${opts.llm_provider}", "job_name": "${jobName}", "trigger": "cron"}'::jsonb, timeout:=60000) as request_id;`;
              } else if (jobName.includes('retell') && !jobName.includes('zai')) {
                // Universal retell jobs handler - covers retell_recent_usa, USA News Retell, etc.
                const countries = updatedConfig.countries || 'us';
                const timeRange = '3'; // 3 hours default
                cronCommand = `SELECT net.http_post(url:='${supabaseUrl}/functions/v1/bulk-retell-news', headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${serviceKey}"}'::jsonb, body:='{"country_code": "${countries.split(',')[0].toUpperCase()}", "time_range": "${timeRange}", "job_name": "${jobName}", "trigger": "cron"}'::jsonb, timeout:=60000) as request_id;`;
              } else if (jobName.includes('RSS') || jobName.includes('Collection')) {
                // RSS collection jobs
                cronCommand = `SELECT net.http_post(url:='${supabaseUrl}/functions/v1/fetch-rss', headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${serviceKey}"}'::jsonb, body:='{"action": "fetch_all", "job_name": "${jobName}"}'::jsonb, timeout:=60000) as request_id;`;
              } else if (jobName.includes('Translation')) {
                // Translation jobs
                cronCommand = `SELECT net.http_post(url:='${supabaseUrl}/functions/v1/translate-news', headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${serviceKey}"}'::jsonb, body:='{"action": "translate_flash", "job_name": "${jobName}"}'::jsonb, timeout:=60000) as request_id;`;
              } else if (jobName.includes('Monitor') || jobName.includes('Stats')) {
                // Monitoring jobs
                cronCommand = `SELECT net.http_post(url:='${supabaseUrl}/functions/v1/admin', headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${serviceKey}"}'::jsonb, body:='{"action": "monitorUsage", "job_name": "${jobName}", "password": "1nuendo19071"}'::jsonb, timeout:=60000) as request_id;`;
              } else if (jobName.includes('Cleanup')) {
                // Cleanup jobs
                cronCommand = `SELECT net.http_post(url:='${supabaseUrl}/functions/v1/admin', headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${serviceKey}"}'::jsonb, body:='{"action": "cleanup", "job_name": "${jobName}", "password": "1nuendo19071"}'::jsonb, timeout:=60000) as request_id;`;
              }

              if (cronCommand) {
                let scheduleResult = null;
                try {
                  scheduleResult = await supabase.rpc('exec_sql', {
                    sql: `SELECT cron.schedule('${jobName}', '${schedule}', $$${cronCommand}$$)`
                  });
                  console.log(`Scheduled ${jobName} at ${schedule}`, scheduleResult);
                } catch (scheduleErr) {
                  console.error('cron.schedule returned error:', scheduleErr);
                  try { await supabase.from('cron_job_events').insert({ job_name: jobName, event_type: 'schedule_failed', origin: 'admin', details: { error: scheduleErr instanceof Error ? scheduleErr.message : String(scheduleErr) } }); } catch (e) { console.error('Failed to write cron_job_events (schedule_failed):', e); }
                }

                try {
                  await supabase.from('cron_job_events').insert({ job_name: jobName, event_type: 'scheduled', origin: 'admin', details: { schedule, scheduleResult } });
                } catch (e) { console.error('Failed to write cron_job_events (scheduled from update):', e); }
              }
            } else {
              console.log(`Unscheduled ${jobName}`);
            }
          } catch (cronError) {
            console.error('Error syncing cron:', cronError);
            // Don't fail the request, just log
          }
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'createVolume': {
        const { data: volume, error } = await supabase
          .from('volumes')
          .insert(data)
          .select()
          .single();

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true, volume }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'updateVolume': {
        const { error } = await supabase
          .from('volumes')
          .update(data)
          .eq('id', data.id);

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'deleteRssFeed': {
        const { feedId } = data;
        if (!feedId) throw new Error('feedId is required');

        // First delete all news items from this feed
        const { error: newsError } = await supabase
          .from('news_rss_items')
          .delete()
          .eq('feed_id', feedId);

        if (newsError) throw newsError;

        // Then delete the feed itself
        const { error: feedError } = await supabase
          .from('news_rss_feeds')
          .delete()
          .eq('id', feedId);

        if (feedError) throw feedError;

        return new Response(
          JSON.stringify({ success: true, message: 'RSS feed and all related news deleted' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'createChapter': {
        const { data: chapter, error } = await supabase
          .from('chapters')
          .insert(data)
          .select()
          .single();

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true, chapter }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'updateChapter': {
        const { error } = await supabase
          .from('chapters')
          .update(data)
          .eq('id', data.id);

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'deleteChapter': {
        const { error } = await supabase
          .from('chapters')
          .delete()
          .eq('id', data.id);

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'createPart': {
        const { data: part, error } = await supabase
          .from('parts')
          .insert(data)
          .select()
          .single();

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true, part }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'updatePart': {
        const { error } = await supabase
          .from('parts')
          .update(data)
          .eq('id', data.id);

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'deletePart': {
        const { error } = await supabase
          .from('parts')
          .delete()
          .eq('id', data.id);

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'publishPart': {
        const { error } = await supabase
          .from('parts')
          .update({
            status: 'published',
            published_at: new Date().toISOString()
          })
          .eq('id', data.id);

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'schedulePart': {
        const { error } = await supabase
          .from('parts')
          .update({
            status: 'scheduled',
            scheduled_at: data.scheduled_at
          })
          .eq('id', data.id);

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'createCharacter': {
        const { data: character, error } = await supabase
          .from('characters')
          .insert(data)
          .select()
          .single();

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true, character }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'updateCharacter': {
        const { error } = await supabase
          .from('characters')
          .update(data)
          .eq('id', data.id);

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'deleteCharacter': {
        const { error } = await supabase
          .from('characters')
          .delete()
          .eq('id', data.id);

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'createRelationship': {
        const { data: relationship, error } = await supabase
          .from('character_relationships')
          .insert(data)
          .select()
          .single();

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true, relationship }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'updateRelationship': {
        const { error } = await supabase
          .from('character_relationships')
          .update(data)
          .eq('id', data.id);

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'deleteRelationship': {
        const { error } = await supabase
          .from('character_relationships')
          .delete()
          .eq('id', data.id);

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getStats': {
        const [volumes, chapters, parts, generations] = await Promise.all([
          supabase.from('volumes').select('id', { count: 'exact' }),
          supabase.from('chapters').select('id', { count: 'exact' }),
          supabase.from('parts').select('id, status', { count: 'exact' }),
          supabase.from('generations').select('id', { count: 'exact' })
        ]);

        const publishedParts = await supabase
          .from('parts')
          .select('id', { count: 'exact' })
          .eq('status', 'published');

        return new Response(
          JSON.stringify({
            success: true,
            stats: {
              volumes: volumes.count || 0,
              chapters: chapters.count || 0,
              parts: parts.count || 0,
              publishedParts: publishedParts.count || 0,
              generations: generations.count || 0
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getAutoGenStats': {
        // Helper to get stats for a specific period
        async function getStatsForPeriod(since: string) {
          const [retoldResult, dialogueResult, tweetResult, entitiesResult] = await Promise.all([
            supabase
              .from('news_rss_items')
              .select('id', { count: 'exact', head: true })
              .gte('created_at', since)
              .not('content', 'is', null)
              .gte('content', 'length.300'),
            supabase
              .from('news_rss_items')
              .select('id', { count: 'exact', head: true })
              .gte('created_at', since)
              .not('chat_dialogue', 'is', null)
              .neq('chat_dialogue', '[]'),
            supabase
              .from('news_rss_items')
              .select('id', { count: 'exact', head: true })
              .gte('created_at', since)
              .not('tweets', 'is', null)
              .neq('tweets', '[]'),
            supabase
              .from('wiki_entities')
              .select('id', { count: 'exact', head: true })
              .gte('created_at', since)
          ]);

          return {
            retold: retoldResult.count || 0,
            dialogues: dialogueResult.count || 0,
            tweets: tweetResult.count || 0,
            entities: entitiesResult.count || 0
          };
        }

        // Helper to get stats for a specific day range
        async function getStatsForDay(startDate: Date, endDate: Date) {
          const startISO = startDate.toISOString();
          const endISO = endDate.toISOString();

          const [retoldResult, dialogueResult, tweetResult, entitiesResult] = await Promise.all([
            supabase
              .from('news_rss_items')
              .select('id', { count: 'exact', head: true })
              .gte('created_at', startISO)
              .lt('created_at', endISO)
              .not('content', 'is', null)
              .gte('content', 'length.300'),
            supabase
              .from('news_rss_items')
              .select('id', { count: 'exact', head: true })
              .gte('created_at', startISO)
              .lt('created_at', endISO)
              .not('chat_dialogue', 'is', null)
              .neq('chat_dialogue', '[]'),
            supabase
              .from('news_rss_items')
              .select('id', { count: 'exact', head: true })
              .gte('created_at', startISO)
              .lt('created_at', endISO)
              .not('tweets', 'is', null)
              .neq('tweets', '[]'),
            supabase
              .from('wiki_entities')
              .select('id', { count: 'exact', head: true })
              .gte('created_at', startISO)
              .lt('created_at', endISO)
          ]);

          return {
            retold: retoldResult.count || 0,
            dialogues: dialogueResult.count || 0,
            tweets: tweetResult.count || 0,
            entities: entitiesResult.count || 0
          };
        }

        const now = new Date();
        const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        const d3 = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
        const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

        // Fetch all periods in parallel
        const [stats24h, stats3d, stats7d, stats30d] = await Promise.all([
          getStatsForPeriod(h24),
          getStatsForPeriod(d3),
          getStatsForPeriod(d7),
          getStatsForPeriod(d30)
        ]);

        // Generate daily stats for last 7 days
        const dailyPromises = [];
        const dayLabels = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

        for (let i = 6; i >= 0; i--) {
          const dayStart = new Date(now);
          dayStart.setHours(0, 0, 0, 0);
          dayStart.setDate(dayStart.getDate() - i);

          const dayEnd = new Date(dayStart);
          dayEnd.setDate(dayEnd.getDate() + 1);

          dailyPromises.push(
            getStatsForDay(dayStart, dayEnd).then(stats => ({
              date: dayStart.toISOString().split('T')[0],
              label: `${dayStart.getDate()}.${String(dayStart.getMonth() + 1).padStart(2, '0')}`,
              ...stats
            }))
          );
        }

        const daily = await Promise.all(dailyPromises);

        return new Response(
          JSON.stringify({
            success: true,
            stats: {
              h24: stats24h,
              d3: stats3d,
              d7: stats7d,
              d30: stats30d,
              daily
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'createBulkRetellCron': {
        const { country_code, time_range, llm_model, llm_provider, frequency_minutes } = data;

        if (!country_code || !time_range || !llm_model || !llm_provider || !frequency_minutes) {
          return new Response(
            JSON.stringify({ error: 'Missing required fields' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verify country exists
        const { data: country, error: countryError } = await supabase
          .from('news_countries')
          .select('id, code')
          .eq('code', country_code.toUpperCase())
          .single();

        if (countryError || !country) {
          return new Response(
            JSON.stringify({ error: `Country ${country_code} not found` }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const jobName = `bulk_retell_${country_code.toLowerCase()}`;

        // Check if job already exists
        const { data: existing } = await supabase
          .from('cron_job_configs')
          .select('id')
          .eq('job_name', jobName)
          .single();

        if (existing) {
          return new Response(
            JSON.stringify({ error: `Bulk retell cron for ${country_code} already exists` }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create cron job config
        const { error: insertError } = await supabase
          .from('cron_job_configs')
          .insert({
            job_name: jobName,
            job_type: 'bulk_retell',
            enabled: true,
            frequency_minutes,
            countries: [country_code.toLowerCase()],
            processing_options: {
              country_code: country_code.toLowerCase(),
              time_range,
              llm_model,
              llm_provider
            }
          });

        if (insertError) throw insertError;

        // Schedule in pg_cron
        const cronExpression = frequency_minutes === 15 ? '*/15 * * * *' :
          frequency_minutes === 30 ? '*/30 * * * *' :
            frequency_minutes === 60 ? '0 * * * *' :
              frequency_minutes === 180 ? '0 */3 * * *' :
                `*/${frequency_minutes} * * * *`;

        const cronCommand = `SELECT net.http_post(url:='${Deno.env.get('SUPABASE_URL')}/functions/v1/bulk-retell-news', headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}"}'::jsonb, body:='{"country_code": "${country_code.toLowerCase()}", "time_range": "${time_range}", "llm_model": "${llm_model}", "llm_provider": "${llm_provider}", "job_name": "${jobName}", "trigger": "cron"}'::jsonb, timeout:=60000) AS request_id;`;

        try {
          // Use exec_sql RPC to interface with pg_cron
          await supabase.rpc('exec_sql', {
            sql: `SELECT cron.schedule('${jobName}', '${cronExpression}', $$${cronCommand}$$)`
          });

          // Log scheduling event
          try {
            await supabase.from('cron_job_events').insert({
              job_name: jobName,
              event_type: 'scheduled',
              origin: 'admin',
              details: { cron_expression: cronExpression, processing_options: { country_code: country_code.toLowerCase(), time_range, llm_model, llm_provider } }
            });
          } catch (e) {
            console.error('Failed to write cron_job_events (scheduled):', e);
          }
        } catch (cronError) {
          console.error('Failed to schedule cron job:', cronError);
          try {
            await supabase.from('cron_job_events').insert({ job_name: jobName, event_type: 'schedule_failed', origin: 'admin', details: { error: cronError instanceof Error ? cronError.message : String(cronError) } });
          } catch (e) { console.error('Failed to write cron_job_events (schedule_failed):', e); }
        }

        return new Response(
          JSON.stringify({ success: true, jobName }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'deleteBulkRetellCron': {
        const { jobName } = data;

        if (!jobName || !jobName.startsWith('bulk_retell_')) {
          return new Response(
            JSON.stringify({ error: 'Invalid job name' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Delete from cron_job_configs
        const { error: deleteError } = await supabase
          .from('cron_job_configs')
          .delete()
          .eq('job_name', jobName);

        if (deleteError) throw deleteError;

        // Unschedule from pg_cron using exec_sql RPC
        try {
          await supabase.rpc('exec_sql', {
            sql: `SELECT cron.unschedule('${jobName}')`
          });

          try {
            await supabase.from('cron_job_events').insert({ job_name: jobName, event_type: 'deleted', origin: 'admin', details: {} });
          } catch (e) { console.error('Failed to write cron_job_events (deleted):', e); }

        } catch (cronError) {
          console.error('Failed to unschedule cron job:', cronError);
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getGlobalNewsStats': {
        const now = new Date();
        const h1 = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
        const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

        // 1. Fetch current counts (existing logic)
        const [fetchingH1, fetchingH24] = await Promise.all([
          supabase.from('news_rss_items').select('id', { count: 'exact', head: true }).gte('fetched_at', h1),
          supabase.from('news_rss_items').select('id', { count: 'exact', head: true }).gte('fetched_at', h24),
        ]);

        const [retellingH1, retellingH24] = await Promise.all([
          supabase.from('llm_usage_logs').select('id', { count: 'exact', head: true })
            .eq('operation', 'retell-news')
            .gte('created_at', h1),
          supabase.from('llm_usage_logs').select('id', { count: 'exact', head: true })
            .eq('operation', 'retell-news')
            .gte('created_at', h24),
        ]);

        // 2. Fetch history for graphs (last 24 hours, hourly buckets)
        // We Use RPC or raw SQL via supabase frontend is not possible, so we fetch all items and group by hour 
        // OR better: we can use multiple queries or a single query with grouping if we had a view.
        // Since we are in an Edge Function, we can execute a custom query via supabase.rpc if available, 
        // but let's try to fetch grouped data or just counts for each hour.

        // For simplicity and performance in Edge Function, we'll fetch daily stats via a simpler approach:
        // We'll fetch the counts for each of the last 24 hours.
        const history = [];
        for (let i = 23; i >= 0; i--) {
          const start = new Date(now.getTime() - (i + 1) * 60 * 60 * 1000).toISOString();
          const end = new Date(now.getTime() - i * 60 * 60 * 1000).toISOString();

          history.push({
            hour: new Date(now.getTime() - i * 60 * 60 * 1000).getHours(),
            timestamp: end,
            start,
            end
          });
        }

        const historyData = await Promise.all(history.map(async (slot) => {
          const [f, rs, re] = await Promise.all([
            supabase.from('news_rss_items').select('id', { count: 'exact', head: true })
              .gte('fetched_at', slot.start).lt('fetched_at', slot.end),
            supabase.from('llm_usage_logs').select('id', { count: 'exact', head: true })
              .eq('operation', 'retell-news')
              .eq('success', true)
              .gte('created_at', slot.start).lt('created_at', slot.end),
            supabase.from('llm_usage_logs').select('id', { count: 'exact', head: true })
              .eq('operation', 'retell-news')
              .eq('success', false)
              .gte('created_at', slot.start).lt('created_at', slot.end),
          ]);
          return {
            time: `${slot.hour}:00`,
            fetching: f.count || 0,
            success: rs.count || 0,
            errors: re.count || 0
          };
        }));

        return new Response(
          JSON.stringify({
            success: true,
            stats: {
              fetching: { h1: fetchingH1.count || 0, h24: fetchingH24.count || 0 },
              retelling: { h1: retellingH1.count || 0, h24: retellingH24.count || 0 },
              history: historyData
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getBulkRetellStats': {
        const { country_code } = data;

        if (!country_code) {
          return new Response(
            JSON.stringify({ error: 'country_code is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const jobName = `bulk_retell_${country_code.toLowerCase()}`;

        // Query llm_usage_logs for this cron job
        const now = new Date();
        const timeRanges = {
          h1: new Date(now.getTime() - 60 * 60 * 1000),
          h6: new Date(now.getTime() - 6 * 60 * 60 * 1000),
          h24: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          d3: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
          d7: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        };

        const getCount = async (since?: Date) => {
          let query = supabase
            .from('llm_usage_logs')
            .select('id', { count: 'exact', head: true })
            .eq('operation', 'retell-news')
            .contains('metadata', { country_code: country_code.toLowerCase() });

          if (since) {
            query = query.gte('created_at', since.toISOString());
          }

          const { count, error } = await query;
          if (error) {
            console.error(`Error fetching bulk retell stats for ${country_code}:`, error);
            throw error;
          }
          console.log(`Stats for ${country_code} since ${since?.toISOString() || 'all time'}: ${count || 0}`);

          // Debugging log for first request
          if (!since) {
            const { data: sample } = await supabase
              .from('llm_usage_logs')
              .select('metadata')
              .eq('operation', 'retell-news')
              .limit(1);
            console.log(`Sample metadata from DB:`, JSON.stringify(sample?.[0]?.metadata));
          }

          return count || 0;
        };

        const [allTime, h1, h6, h24, d3, d7] = await Promise.all([
          getCount(),
          getCount(timeRanges.h1),
          getCount(timeRanges.h6),
          getCount(timeRanges.h24),
          getCount(timeRanges.d3),
          getCount(timeRanges.d7),
        ]);

        // Build hourly buckets for last 24 hours (used by front-end charts)
        const hourlySlots = [];
        for (let i = 23; i >= 0; i--) {
          const start = new Date(now.getTime() - (i + 1) * 60 * 60 * 1000).toISOString();
          const end = new Date(now.getTime() - i * 60 * 60 * 1000).toISOString();
          hourlySlots.push({ start, end });
        }

        const hourly = await Promise.all(hourlySlots.map(async (slot) => {
          const [processedRes, successRes, failedRes] = await Promise.all([
            supabase.from('llm_usage_logs').select('id', { count: 'exact', head: true })
              .eq('operation', 'retell-news')
              .contains('metadata', { country_code: country_code.toLowerCase() })
              .gte('created_at', slot.start).lt('created_at', slot.end),
            supabase.from('llm_usage_logs').select('id', { count: 'exact', head: true })
              .eq('operation', 'retell-news')
              .contains('metadata', { country_code: country_code.toLowerCase() })
              .eq('success', true)
              .gte('created_at', slot.start).lt('created_at', slot.end),
            supabase.from('llm_usage_logs').select('id', { count: 'exact', head: true })
              .eq('operation', 'retell-news')
              .contains('metadata', { country_code: country_code.toLowerCase() })
              .eq('success', false)
              .gte('created_at', slot.start).lt('created_at', slot.end),
          ]);

          return {
            processed: processedRes.count || 0,
            success: successRes.count || 0,
            failed: failedRes.count || 0
          };
        }));

        // Average processing time (last 24h)
        let avgProcessingTime = 0;
        try {
          const { data: durations } = await supabase
            .from('llm_usage_logs')
            .select('duration_ms')
            .eq('operation', 'retell-news')
            .contains('metadata', { country_code: country_code.toLowerCase() })
            .gte('created_at', timeRanges.h24.toISOString())
            .limit(1000);

          if (durations && durations.length > 0) {
            const sum = durations.reduce((s: number, r: any) => s + (r.duration_ms || 0), 0);
            avgProcessingTime = Math.round(sum / durations.length);
          }
        } catch (e) {
          console.error('Failed to compute avg processing time:', e);
        }

        // Recent rate (items per minute over last hour)
        const recentRate = h1 / 60;

        return new Response(
          JSON.stringify({
            success: true,
            stats: {
              all_time: allTime,
              h1,
              h6,
              h24,
              d3,
              d7,
              hourly,
              avg_processing_time_ms: avgProcessingTime,
              recent_rate: Math.round((recentRate + Number.EPSILON) * 10) / 10
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getDiagnosticLogs': {
        const { data: logs, error: logsError } = await supabase
          .from('llm_usage_logs')
          .select('*')
          .eq('operation', 'retell-news')
          .order('created_at', { ascending: false })
          .limit(10);

        const { data: cronConfigs, error: cronError } = await supabase
          .from('cron_job_configs')
          .select('*')
          .order('updated_at', { ascending: false });

        // Enrich logs with news slug / path when possible
        let enrichedLogs = logs || [];
        try {
          const newsIds = (enrichedLogs || [])
            .map((l: any) => l?.metadata?.newsId)
            .filter(Boolean);

          if (newsIds.length > 0) {
            const { data: newsRows } = await supabase
              .from('news_rss_items')
              .select('id, slug, country:news_countries(code)')
              .in('id', newsIds);

            const newsMap: Record<string, any> = {};
            (newsRows || []).forEach((r: any) => {
              const countryCode = r?.country?.code || (r.country && r.country.code) || null;
              newsMap[r.id] = { slug: r.slug, country_code: countryCode };
            });

            enrichedLogs = (enrichedLogs || []).map((l: any) => {
              const nid = l?.metadata?.newsId;
              if (nid && newsMap[nid] && newsMap[nid].slug) {
                l.article_path = `/news/${(newsMap[nid].country_code || 'us').toLowerCase()}/${newsMap[nid].slug}`;
              }
              return l;
            });
          }
        } catch (e) {
          console.warn('Failed to enrich diagnostic logs with article path:', e?.message || e);
        }

        return new Response(
          JSON.stringify({
            success: true,
            logs: enrichedLogs,
            cronConfigs: cronConfigs || [],
            logsError,
            cronError
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getProcessingDashboardStats': {
        // 1. Get countries
        const { data: countries, error: countriesError } = await supabase.from('news_countries').select('id, code');
        if (countriesError) throw countriesError;

        // 2. Queue Depth (Pending news items) - Query each country for exact count
        const queueStats = await Promise.all((countries || []).map(async (c: any) => {
          const { count, error } = await supabase
            .from('news_rss_items')
            .select('*', { count: 'exact', head: true })
            .eq('country_id', c.id)
            .is('key_points', null);

          return {
            code: c.code.toLowerCase(),
            pending: count || 0
          };
        }));

        // 2. Throughput (items per hour)
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
        const { count: h1Count } = await supabase
          .from('llm_usage_logs')
          .select('*', { count: 'exact', head: true })
          .eq('operation', 'retell-news')
          .eq('success', true)
          .gte('created_at', oneHourAgo);

        // 3. Recent Failures
        const { data: failures } = await supabase
          .from('llm_usage_logs')
          .select('created_at, error_message, metadata')
          .eq('operation', 'retell-news')
          .eq('success', false)
          .order('created_at', { ascending: false })
          .limit(5);

        return new Response(
          JSON.stringify({
            success: true,
            queueStats,
            throughput: {
              h1: h1Count || 0,
            },
            recentFailures: failures || []
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getBotVisitsStats': {
        // Get bot visits for specified time range
        const now = new Date();
        const { timeRange = '24h' } = body || {};

        let pastDate: Date;
        let groupByDay = false;

        switch (timeRange) {
          case '7d':
            pastDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            groupByDay = true;
            break;
          case '30d':
            pastDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            groupByDay = true;
            break;
          case '24h':
          default:
            pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            groupByDay = false;
        }

        // Get all bot visits for detailed stats
        const { data: allBots } = await supabase
          .from('bot_visits')
          .select('bot_type, bot_category, created_at, response_time_ms, status_code')
          .gte('created_at', pastDate.toISOString())
          .order('created_at', { ascending: true })
          .limit(50000);

        // Group by hour or day
        const periodMap = new Map<string, any>();
        const responseTimesByBot: Record<string, number[]> = {
          googlebot: [],
          bingbot: [],
          ai_bots: [],
          other_bots: []
        };

        (allBots || []).forEach((v: any) => {
          let period: string;
          let timeLabel: string;

          if (groupByDay) {
            // Use Kyiv timezone for date grouping
            const d = new Date(v.created_at);
            period = d.toLocaleDateString('en-CA', { timeZone: 'Europe/Kyiv' }); // gives YYYY-MM-DD in Kyiv time
            timeLabel = new Date(period + 'T00:00:00.000Z').toLocaleDateString('uk-UA', { month: 'short', day: 'numeric', timeZone: 'UTC' });
          } else {
            // Use Kyiv timezone for hour grouping
            const d = new Date(v.created_at);
            const kyivHour = parseInt(d.toLocaleTimeString('en-US', { hour: '2-digit', hour12: false, timeZone: 'Europe/Kyiv' }));
            const kyivDate = d.toLocaleDateString('en-CA', { timeZone: 'Europe/Kyiv' }); // YYYY-MM-DD in Kyiv
            period = `${kyivDate}T${String(kyivHour).padStart(2, '0')}`; // unique key per local hour
            timeLabel = `${String(kyivHour % 24).padStart(2, '0')}:00`;
          }

          if (!periodMap.has(period)) {
            periodMap.set(period, {
              time: timeLabel,
              googlebot: 0,
              bingbot: 0,
              ai_bots: 0,
              other_bots: 0
            });
          }
          const entry = periodMap.get(period)!;
          const botType = v.bot_type.toLowerCase();

          let botCategory = 'other_bots';
          if (botType.includes('google')) {
            entry.googlebot++;
            botCategory = 'googlebot';
          } else if (botType.includes('bing')) {
            entry.bingbot++;
            botCategory = 'bingbot';
          } else if (v.bot_category === 'ai' || botType.includes('gpt') || botType.includes('claude') || botType.includes('anthropic')) {
            entry.ai_bots++;
            botCategory = 'ai_bots';
          } else {
            entry.other_bots++;
          }

          // Collect response times
          if (v.response_time_ms && v.response_time_ms > 0) {
            responseTimesByBot[botCategory].push(v.response_time_ms);
          }
        });

        const history = Array.from(periodMap.values());

        // Calculate average response times
        const avgResponseTimes = Object.entries(responseTimesByBot).map(([bot, times]) => ({
          bot: bot === 'googlebot' ? 'Google Bot' :
            bot === 'bingbot' ? 'Bing Bot' :
              bot === 'ai_bots' ? 'AI Боти' : 'Інші',
          avgTime: times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0,
          count: times.length
        })).filter(x => x.count > 0);

        // Calculate success rate
        const successfulRequests = (allBots || []).filter((b: any) => b.status_code === 200).length;
        const totalRequests = allBots?.length || 0;
        const successRate = totalRequests > 0 ? Math.round((successfulRequests / totalRequests) * 100) : 100;

        return new Response(
          JSON.stringify({
            success: true,
            stats: {
              history,
              totalRequests,
              avgResponseTimes,
              successRate,
              timeRange
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getUniqueVisitorsStats': {
        const now = new Date();
        const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const past7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Count unique visitors for news (entity_type = 'news')
        const { count: newsCount24h } = await supabase
          .from('view_visitors')
          .select('visitor_id', { count: 'exact', head: true })
          .eq('entity_type', 'news')
          .gte('first_seen', past24h.toISOString());

        const { count: newsCount7d } = await supabase
          .from('view_visitors')
          .select('visitor_id', { count: 'exact', head: true })
          .eq('entity_type', 'news')
          .gte('first_seen', past7d.toISOString());

        // Count unique visitors for wiki entities
        const { count: wikiCount24h } = await supabase
          .from('view_visitors')
          .select('visitor_id', { count: 'exact', head: true })
          .eq('entity_type', 'wiki')
          .gte('first_seen', past24h.toISOString());

        const { count: wikiCount7d } = await supabase
          .from('view_visitors')
          .select('visitor_id', { count: 'exact', head: true })
          .eq('entity_type', 'wiki')
          .gte('first_seen', past7d.toISOString());

        return new Response(
          JSON.stringify({
            success: true,
            stats: {
              news: {
                h24: newsCount24h || 0,
                d7: newsCount7d || 0
              },
              wiki: {
                h24: wikiCount24h || 0,
                d7: wikiCount7d || 0
              }
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getPageViewsHourly': {
        const now = new Date();
        const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // Try entity_views first, fallback to view_visitors
        let { data: views, error } = await supabase
          .from('entity_views')
          .select('entity_type, created_at')
          .gte('created_at', past24h.toISOString())
          .order('created_at', { ascending: true });

        // If entity_views doesn't exist or is empty, use view_visitors
        if (error || !views || views.length === 0) {
          const { data: visitorViews, error: visitorError } = await supabase
            .from('view_visitors')
            .select('entity_type, first_seen')
            .gte('first_seen', past24h.toISOString())
            .order('first_seen', { ascending: true });

          if (!visitorError && visitorViews) {
            // Map view_visitors to same format
            views = visitorViews.map((v: any) => ({
              entity_type: v.entity_type,
              created_at: v.first_seen
            }));
          }
        }

        if (error && (!views || views.length === 0)) {
          console.error('Error fetching page views:', error);
        }

        // Group by hour
        const hourlyMap = new Map<string, any>();
        (views || []).forEach((v: any) => {
          const hour = new Date(v.created_at).toISOString().substring(0, 13) + ':00:00.000Z';
          if (!hourlyMap.has(hour)) {
            hourlyMap.set(hour, {
              time: new Date(hour).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }),
              news: 0,
              wiki: 0,
              total: 0
            });
          }
          const entry = hourlyMap.get(hour)!;
          if (v.entity_type === 'news') entry.news++;
          else if (v.entity_type === 'wiki') entry.wiki++;
          entry.total++;
        });

        const history = Array.from(hourlyMap.values());

        return new Response(
          JSON.stringify({
            success: true,
            stats: {
              history,
              total24h: views?.length || 0
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getUniqueVisitorsHourly': {
        const now = new Date();
        const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // Get all visitor records from last 24h
        const { data: visitors, error } = await supabase
          .from('view_visitors')
          .select('visitor_id, entity_type, first_seen')
          .gte('first_seen', past24h.toISOString())
          .order('first_seen', { ascending: true });

        if (error) {
          console.error('Error fetching unique visitors:', error);
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }

        // Group by hour, tracking unique visitor_ids per hour
        const hourlyMap = new Map<string, Set<string>>();
        (visitors || []).forEach((v: any) => {
          const hour = new Date(v.first_seen).toISOString().substring(0, 13) + ':00:00.000Z';
          if (!hourlyMap.has(hour)) {
            hourlyMap.set(hour, new Set());
          }
          hourlyMap.get(hour)!.add(v.visitor_id);
        });

        const history = Array.from(hourlyMap.entries()).map(([hour, visitorSet]) => ({
          time: new Date(hour).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }),
          visitors: visitorSet.size
        }));

        // Sort by time
        history.sort((a, b) => a.time.localeCompare(b.time));

        return new Response(
          JSON.stringify({
            success: true,
            stats: {
              history,
              total24h: new Set(visitors?.map((v: any) => v.visitor_id)).size || 0
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getTopTrafficCountries': {
        const now = new Date();
        const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // Get bot visits by country
        const { data: botByCountry } = await supabase
          .from('bot_visits')
          .select('ip_country')
          .gte('created_at', past24h.toISOString());

        // Count by country
        const countryMap = new Map<string, number>();
        (botByCountry || []).forEach((v: any) => {
          const country = v.ip_country || 'Unknown';
          countryMap.set(country, (countryMap.get(country) || 0) + 1);
        });

        // Sort and get top 10
        const topCountries = Array.from(countryMap.entries())
          .map(([country, count]) => ({ country, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        return new Response(
          JSON.stringify({
            success: true,
            stats: {
              countries: topCountries,
              total: botByCountry?.length || 0
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getGooglebotRealtime': {
        // Googlebot activity — timeline + pages with H1/H2/word count
        // timeRange: '30m' (default), '24h', '7d'
        const now = new Date();
        const { timeRange: gbRange = '30m' } = body || {};

        let pastDate: Date;
        let bucketCount: number;
        let bucketMs: number;
        let bucketLabel: (d: Date) => string;
        let groupByDay = false;

        if (gbRange === '7d') {
          pastDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          bucketCount = 7;
          bucketMs = 24 * 60 * 60 * 1000;
          groupByDay = true;
          bucketLabel = (d: Date) => d.toLocaleDateString('uk-UA', { month: 'short', day: 'numeric', timeZone: 'Europe/Kyiv' });
        } else if (gbRange === '24h') {
          pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          bucketCount = 24;
          bucketMs = 60 * 60 * 1000;
          bucketLabel = (d: Date) => d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' });
        } else {
          // 30m default — 6 × 5 min
          pastDate = new Date(now.getTime() - 30 * 60 * 1000);
          bucketCount = 6;
          bucketMs = 5 * 60 * 1000;
          bucketLabel = (d: Date) => d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' });
        }

        const { data: googleVisits } = await supabase
          .from('bot_visits')
          .select('path, status_code, response_time_ms, cache_status, created_at, bot_type')
          .ilike('bot_type', '%google%')
          .gte('created_at', pastDate.toISOString())
          .order('created_at', { ascending: false })
          .limit(5000);

        // Build timeline buckets
        const bucketMap = new Map<string, { time: string; count: number }>();
        for (let i = 0; i < bucketCount; i++) {
          const t = new Date(pastDate.getTime() + i * bucketMs);
          bucketMap.set(String(i), { time: bucketLabel(t), count: 0 });
        }
        (googleVisits || []).forEach((v: any) => {
          const diffMs = new Date(v.created_at).getTime() - pastDate.getTime();
          const idx = Math.min(bucketCount - 1, Math.max(0, Math.floor(diffMs / bucketMs)));
          const entry = bucketMap.get(String(idx));
          if (entry) entry.count++;
        });
        const timeline = Array.from(bucketMap.values());

        // Aggregate by page
        const pathMap = new Map<string, any>();
        (googleVisits || []).forEach((v: any) => {
          if (!pathMap.has(v.path)) {
            pathMap.set(v.path, {
              path: v.path,
              status_code: v.status_code,
              response_time_ms: v.response_time_ms,
              cache_status: v.cache_status,
              created_at: v.created_at,
              count: 0,
              h1: null,
              h2: null,
              word_count: null,
            });
          }
          pathMap.get(v.path).count++;
        });

        // Enrich with H1 / H2 / word count from cached_pages
        const uniquePaths = Array.from(pathMap.keys()).slice(0, 50);
        const cachedPathsSet = new Set<string>();
        if (uniquePaths.length > 0) {
          const { data: cachedPages } = await supabase
            .from('cached_pages')
            .select('path, html, title')
            .in('path', uniquePaths);

          (cachedPages || []).forEach((page: any) => {
            const entry = pathMap.get(page.path);
            if (!entry || !page.html) return;
            cachedPathsSet.add(page.path);

            const h1m = page.html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
            if (h1m) entry.h1 = h1m[1].replace(/<[^>]+>/g, '').trim().substring(0, 100);

            const h2m = page.html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
            if (h2m) entry.h2 = h2m[1].replace(/<[^>]+>/g, '').trim().substring(0, 100);

            const text = page.html
              .replace(/<script[\s\S]*?<\/script>/gi, '')
              .replace(/<style[\s\S]*?<\/style>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            entry.word_count = text ? text.split(' ').filter((w: string) => w.length > 0).length : 0;
          });

          // Fallback for MISS paths not in cached_pages:
          // Fetch title/description directly from news_rss_items for /news/CC/slug paths.
          const missPaths = uniquePaths.filter(p => !cachedPathsSet.has(p));
          const newsSlugs: { path: string; slug: string }[] = [];
          for (const p of missPaths) {
            const m = p.match(/^\/news\/[a-zA-Z]{2}\/([a-z0-9-]+)$/i);
            if (m) newsSlugs.push({ path: p, slug: m[1] });
          }
          if (newsSlugs.length > 0) {
            const { data: newsRows } = await supabase
              .from('news_rss_items')
              .select('slug, title_en, title, description_en, description, themes_en, themes')
              .in('slug', newsSlugs.map(n => n.slug));

            const slugToNews = new Map((newsRows || []).map((r: any) => [r.slug, r]));
            for (const { path: np, slug } of newsSlugs) {
              const news = slugToNews.get(slug);
              if (!news) continue;
              const entry = pathMap.get(np);
              if (!entry) continue;
              entry.h1 = (news.title_en || news.title || '').substring(0, 100);
              const themes: string[] = news.themes_en || news.themes || [];
              entry.h2 = Array.isArray(themes) ? themes.slice(0, 3).join(' · ').substring(0, 100) : '';
              const descWords = (news.description_en || news.description || '').split(' ').filter(Boolean).length;
              entry.word_count = descWords || null;
              // Mark as DB-sourced (not from cache) so UI can differentiate
              entry.h1_source = 'db';
            }
          }
        }

        const pages = Array.from(pathMap.values())
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 100);

        return new Response(
          JSON.stringify({
            success: true,
            stats: { timeline, pages, total: googleVisits?.length || 0, uniquePages: pathMap.size, timeRange: gbRange }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getBingbotRealtime': {
        // Bingbot activity — timeline + pages with H1/H2/word count
        const now = new Date();
        const { timeRange: bbRange = '30m' } = body || {};

        let bbPastDate: Date;
        let bbBucketCount: number;
        let bbBucketMs: number;
        let bbBucketLabel: (d: Date) => string;

        if (bbRange === '7d') {
          bbPastDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          bbBucketCount = 7;
          bbBucketMs = 24 * 60 * 60 * 1000;
          bbBucketLabel = (d: Date) => d.toLocaleDateString('uk-UA', { month: 'short', day: 'numeric', timeZone: 'Europe/Kyiv' });
        } else if (bbRange === '24h') {
          bbPastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          bbBucketCount = 24;
          bbBucketMs = 60 * 60 * 1000;
          bbBucketLabel = (d: Date) => d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' });
        } else {
          bbPastDate = new Date(now.getTime() - 30 * 60 * 1000);
          bbBucketCount = 6;
          bbBucketMs = 5 * 60 * 1000;
          bbBucketLabel = (d: Date) => d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' });
        }

        const { data: bingVisits } = await supabase
          .from('bot_visits')
          .select('path, status_code, response_time_ms, cache_status, created_at, bot_type')
          .ilike('bot_type', '%bing%')
          .gte('created_at', bbPastDate.toISOString())
          .order('created_at', { ascending: false })
          .limit(5000);

        const bbBucketMap = new Map<string, { time: string; count: number }>();
        for (let i = 0; i < bbBucketCount; i++) {
          const t = new Date(bbPastDate.getTime() + i * bbBucketMs);
          bbBucketMap.set(String(i), { time: bbBucketLabel(t), count: 0 });
        }
        (bingVisits || []).forEach((v: any) => {
          const diffMs = new Date(v.created_at).getTime() - bbPastDate.getTime();
          const idx = Math.min(bbBucketCount - 1, Math.max(0, Math.floor(diffMs / bbBucketMs)));
          const entry = bbBucketMap.get(String(idx));
          if (entry) entry.count++;
        });
        const bbTimeline = Array.from(bbBucketMap.values());

        const bbPathMap = new Map<string, any>();
        (bingVisits || []).forEach((v: any) => {
          if (!bbPathMap.has(v.path)) {
            bbPathMap.set(v.path, {
              path: v.path, status_code: v.status_code, response_time_ms: v.response_time_ms,
              cache_status: v.cache_status, created_at: v.created_at, count: 0,
              h1: null, h2: null, word_count: null,
            });
          }
          bbPathMap.get(v.path).count++;
        });

        const bbUniquePaths = Array.from(bbPathMap.keys()).slice(0, 50);
        const bbCachedSet = new Set<string>();
        if (bbUniquePaths.length > 0) {
          const { data: bbCachedPages } = await supabase
            .from('cached_pages').select('path, html, title').in('path', bbUniquePaths);
          (bbCachedPages || []).forEach((page: any) => {
            const entry = bbPathMap.get(page.path);
            if (!entry || !page.html) return;
            bbCachedSet.add(page.path);
            const h1m = page.html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
            if (h1m) entry.h1 = h1m[1].replace(/<[^>]+>/g, '').trim().substring(0, 100);
            const h2m = page.html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
            if (h2m) entry.h2 = h2m[1].replace(/<[^>]+>/g, '').trim().substring(0, 100);
            const text = page.html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            entry.word_count = text ? text.split(' ').filter((w: string) => w.length > 0).length : 0;
          });
          const bbMissPaths = bbUniquePaths.filter(p => !bbCachedSet.has(p));
          const bbNewsSlugs: { path: string; slug: string }[] = [];
          for (const p of bbMissPaths) {
            const m = p.match(/^\/news\/[a-zA-Z]{2}\/([a-z0-9-]+)$/i);
            if (m) bbNewsSlugs.push({ path: p, slug: m[1] });
          }
          if (bbNewsSlugs.length > 0) {
            const { data: bbNewsRows } = await supabase
              .from('news_rss_items').select('slug, title_en, title, description_en, description, themes_en, themes')
              .in('slug', bbNewsSlugs.map(n => n.slug));
            const bbSlugMap = new Map((bbNewsRows || []).map((r: any) => [r.slug, r]));
            for (const { path: np, slug } of bbNewsSlugs) {
              const news = bbSlugMap.get(slug);
              if (!news) continue;
              const entry = bbPathMap.get(np);
              if (!entry) continue;
              entry.h1 = (news.title_en || news.title || '').substring(0, 100);
              const themes: string[] = news.themes_en || news.themes || [];
              entry.h2 = Array.isArray(themes) ? themes.slice(0, 3).join(' · ').substring(0, 100) : '';
              entry.word_count = (news.description_en || news.description || '').split(' ').filter(Boolean).length || null;
              entry.h1_source = 'db';
            }
          }
        }

        const bbPages = Array.from(bbPathMap.values())
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 100);

        return new Response(
          JSON.stringify({ success: true, stats: { timeline: bbTimeline, pages: bbPages, total: bingVisits?.length || 0, uniquePages: bbPathMap.size, timeRange: bbRange } }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getLLMbotsRealtime': {
        // LLM/AI bots activity (gptbot, claude, perplexity, etc.) — timeline + pages
        const now = new Date();
        const { timeRange: llmRange = '30m' } = body || {};

        let llmPastDate: Date;
        let llmBucketCount: number;
        let llmBucketMs: number;
        let llmBucketLabel: (d: Date) => string;

        if (llmRange === '7d') {
          llmPastDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          llmBucketCount = 7;
          llmBucketMs = 24 * 60 * 60 * 1000;
          llmBucketLabel = (d: Date) => d.toLocaleDateString('uk-UA', { month: 'short', day: 'numeric', timeZone: 'Europe/Kyiv' });
        } else if (llmRange === '24h') {
          llmPastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          llmBucketCount = 24;
          llmBucketMs = 60 * 60 * 1000;
          llmBucketLabel = (d: Date) => d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' });
        } else {
          llmPastDate = new Date(now.getTime() - 30 * 60 * 1000);
          llmBucketCount = 6;
          llmBucketMs = 5 * 60 * 1000;
          llmBucketLabel = (d: Date) => d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' });
        }

        const { data: llmVisits } = await supabase
          .from('bot_visits')
          .select('path, status_code, response_time_ms, cache_status, created_at, bot_type')
          .eq('bot_category', 'ai')
          .gte('created_at', llmPastDate.toISOString())
          .order('created_at', { ascending: false })
          .limit(5000);

        const llmBucketMap = new Map<string, { time: string; count: number }>();
        for (let i = 0; i < llmBucketCount; i++) {
          const t = new Date(llmPastDate.getTime() + i * llmBucketMs);
          llmBucketMap.set(String(i), { time: llmBucketLabel(t), count: 0 });
        }
        (llmVisits || []).forEach((v: any) => {
          const diffMs = new Date(v.created_at).getTime() - llmPastDate.getTime();
          const idx = Math.min(llmBucketCount - 1, Math.max(0, Math.floor(diffMs / llmBucketMs)));
          const entry = llmBucketMap.get(String(idx));
          if (entry) entry.count++;
        });
        const llmTimeline = Array.from(llmBucketMap.values());

        const llmPathMap = new Map<string, any>();
        (llmVisits || []).forEach((v: any) => {
          if (!llmPathMap.has(v.path)) {
            llmPathMap.set(v.path, {
              path: v.path, status_code: v.status_code, response_time_ms: v.response_time_ms,
              cache_status: v.cache_status, created_at: v.created_at, count: 0,
              bot_type: v.bot_type, h1: null, h2: null, word_count: null,
            });
          }
          llmPathMap.get(v.path).count++;
          // track all bot_types that visited this path
          const entry = llmPathMap.get(v.path);
          if (!entry.bot_types) entry.bot_types = new Set<string>();
          entry.bot_types.add(v.bot_type);
        });

        const llmUniquePaths = Array.from(llmPathMap.keys()).slice(0, 50);
        const llmCachedSet = new Set<string>();
        if (llmUniquePaths.length > 0) {
          const { data: llmCachedPages } = await supabase
            .from('cached_pages').select('path, html, title').in('path', llmUniquePaths);
          (llmCachedPages || []).forEach((page: any) => {
            const entry = llmPathMap.get(page.path);
            if (!entry || !page.html) return;
            llmCachedSet.add(page.path);
            const h1m = page.html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
            if (h1m) entry.h1 = h1m[1].replace(/<[^>]+>/g, '').trim().substring(0, 100);
            const h2m = page.html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
            if (h2m) entry.h2 = h2m[1].replace(/<[^>]+>/g, '').trim().substring(0, 100);
            const text = page.html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            entry.word_count = text ? text.split(' ').filter((w: string) => w.length > 0).length : 0;
          });
          const llmMissPaths = llmUniquePaths.filter(p => !llmCachedSet.has(p));
          const llmNewsSlugs: { path: string; slug: string }[] = [];
          for (const p of llmMissPaths) {
            const m = p.match(/^\/news\/[a-zA-Z]{2}\/([a-z0-9-]+)$/i);
            if (m) llmNewsSlugs.push({ path: p, slug: m[1] });
          }
          if (llmNewsSlugs.length > 0) {
            const { data: llmNewsRows } = await supabase
              .from('news_rss_items').select('slug, title_en, title, description_en, description, themes_en, themes')
              .in('slug', llmNewsSlugs.map(n => n.slug));
            const llmSlugMap = new Map((llmNewsRows || []).map((r: any) => [r.slug, r]));
            for (const { path: np, slug } of llmNewsSlugs) {
              const news = llmSlugMap.get(slug);
              if (!news) continue;
              const entry = llmPathMap.get(np);
              if (!entry) continue;
              entry.h1 = (news.title_en || news.title || '').substring(0, 100);
              const themes: string[] = news.themes_en || news.themes || [];
              entry.h2 = Array.isArray(themes) ? themes.slice(0, 3).join(' · ').substring(0, 100) : '';
              entry.word_count = (news.description_en || news.description || '').split(' ').filter(Boolean).length || null;
              entry.h1_source = 'db';
            }
          }
        }

        // Serialize Set → Array for JSON
        const llmPages = Array.from(llmPathMap.values())
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 100)
          .map((p: any) => ({ ...p, bot_types: p.bot_types ? Array.from(p.bot_types) : [p.bot_type] }));

        // Bot type breakdown
        const botTypeCounts = new Map<string, number>();
        (llmVisits || []).forEach((v: any) => {
          botTypeCounts.set(v.bot_type, (botTypeCounts.get(v.bot_type) || 0) + 1);
        });
        const botBreakdown = Array.from(botTypeCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([bot_type, count]) => ({ bot_type, count }));

        return new Response(
          JSON.stringify({ success: true, stats: { timeline: llmTimeline, pages: llmPages, total: llmVisits?.length || 0, uniquePages: llmPathMap.size, timeRange: llmRange, botBreakdown } }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getCachedPageContent': {
        // Fetch cached HTML for a given path — for MISS popover
        const { path: cpPath } = body || {};
        if (!cpPath) {
          return new Response(JSON.stringify({ success: false, error: 'path required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { data: cachedRow } = await supabase
          .from('cached_pages')
          .select('path, html, title, updated_at, generation_time_ms')
          .eq('path', cpPath)
          .maybeSingle();

        let plainText = '';
        let headings: { level: number; text: string }[] = [];
        if (cachedRow?.html) {
          // Extract headings
          const headingRe = /<h([1-6])[^>]*>([\s\S]*?)<\/h[1-6]>/gi;
          let hm: RegExpExecArray | null;
          while ((hm = headingRe.exec(cachedRow.html)) !== null) {
            headings.push({ level: parseInt(hm[1]), text: hm[2].replace(/<[^>]+>/g, '').trim() });
            if (headings.length >= 20) break;
          }
          // Strip to plain text
          plainText = cachedRow.html
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 8000);
        }

        // If not in cache, try to populate from DB (news_rss_items) for news paths
        let dbFallback: { title?: string; description?: string } = {};
        if (!cachedRow) {
          const newsMatch = cpPath.match(/^\/news\/[a-zA-Z]{2}\/([a-z0-9-]+)$/i);
          if (newsMatch) {
            const { data: newsItem } = await supabase
              .from('news_rss_items')
              .select('title_en, title, description_en, description')
              .eq('slug', newsMatch[1])
              .maybeSingle();
            if (newsItem) {
              dbFallback = {
                title: newsItem.title_en || newsItem.title,
                description: newsItem.description_en || newsItem.description,
              };
            }
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            content: cachedRow ? {
              path: cachedRow.path,
              title: cachedRow.title,
              updated_at: cachedRow.updated_at,
              generation_time_ms: cachedRow.generation_time_ms,
              headings,
              plainText,
              exists: true
            } : {
              path: cpPath,
              exists: false,
              // DB fallback: let UI know the page EXISTS in DB even if cache is cold
              ...(dbFallback.title ? { dbTitle: dbFallback.title, dbDescription: dbFallback.description, existsInDb: true } : {})
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'warmPage': {
        // Pre-warm cache for a specific path by calling ssr-render
        const { path: wpPath } = body || {};
        if (!wpPath) {
          return new Response(JSON.stringify({ success: false, error: 'path required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        const ssrUrl = `${supabaseUrl}/functions/v1/ssr-render?path=${encodeURIComponent(wpPath)}&lang=en&cache=true`;
        try {
          const resp = await fetch(ssrUrl, {
            headers: {
              'Authorization': `Bearer ${anonKey}`,
              'apikey': anonKey,
              'Accept': 'text/html',
            },
          });
          const html = await resp.text();
          const xCache = resp.headers.get('X-Cache') || 'MISS';
          return new Response(
            JSON.stringify({
              success: resp.ok,
              status: resp.status,
              xCache,
              htmlSize: html.length,
              path: wpPath,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (e) {
          return new Response(
            JSON.stringify({ success: false, error: String(e), path: wpPath }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      case 'getCloudflareAnalytics': {
        // Cloudflare Analytics API integration
        const CF_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
        const CF_API_TOKEN = Deno.env.get('CLOUDFLARE_API_TOKEN');
        const CF_ZONE_ID = Deno.env.get('CLOUDFLARE_ZONE_ID');

        if (!CF_ACCOUNT_ID || !CF_API_TOKEN || !CF_ZONE_ID) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Cloudflare credentials not configured',
              stats: null
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        try {
          // Get analytics for last 24 hours
          const now = new Date();
          const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

          const analyticsUrl = `https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/analytics/dashboard?since=${past24h.toISOString()}&until=${now.toISOString()}`;

          const response = await fetch(analyticsUrl, {
            headers: {
              'Authorization': `Bearer ${CF_API_TOKEN}`,
              'Content-Type': 'application/json'
            }
          });

          if (!response.ok) {
            throw new Error(`Cloudflare API error: ${response.status}`);
          }

          const cfData = await response.json();

          return new Response(
            JSON.stringify({
              success: true,
              stats: {
                requests: cfData.result?.totals?.requests?.all || 0,
                bandwidth: cfData.result?.totals?.bandwidth?.all || 0,
                threats: cfData.result?.totals?.threats?.all || 0,
                pageviews: cfData.result?.totals?.pageviews?.all || 0,
                uniques: cfData.result?.totals?.uniques?.all || 0,
                timeseries: cfData.result?.timeseries || []
              }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error('Cloudflare Analytics error:', error);
          return new Response(
            JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              stats: null
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      case 'analyzeContactSubmission': {
        const { id, topic, name, email, message } = data || {};
        if (!id || !message) {
          return new Response(
            JSON.stringify({ error: 'Missing id or message' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get LLM settings
        const { data: settings } = await supabase
          .from('settings')
          .select('zai_api_key, openai_api_key, llm_text_model')
          .limit(1)
          .single();

        const apiKey = settings?.zai_api_key || settings?.openai_api_key;
        const model = settings?.llm_text_model || 'GLM-4-Flash';

        const systemPrompt = `Ти — аналітик зворотнього зв'язку. Проаналізуй звернення користувача і надай:
1. Короткий підсумок (1-2 речення)
2. Пріоритет: низький / середній / високий
3. Рекомендована дія
4. Тон звернення (позитивний / нейтральний / негативний)
Відповідай лаконічно українською мовою.`;

        const userPrompt = `Тема: ${topic}\nІм'я: ${name || 'не вказано'}\nEmail: ${email || 'не вказано'}\nПовідомлення:\n${message}`;

        let analysis = '';
        if (apiKey) {
          const endpoint = settings?.zai_api_key
            ? 'https://api.z.ai/api/paas/v4/chat/completions'
            : 'https://api.openai.com/v1/chat/completions';
          const llmModel = settings?.zai_api_key ? (model || 'GLM-4-Flash') : (model || 'gpt-4o-mini');

          const resp = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: llmModel,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
              max_tokens: 400,
              temperature: 0.3,
            }),
          });
          const llmData = await resp.json();
          analysis = llmData?.choices?.[0]?.message?.content || 'Аналіз недоступний';
        } else {
          analysis = `Тема: ${topic}\nПріоритет: середній\nДія: Розглянути вручну (API ключ не налаштований)`;
        }

        // Save analysis to DB
        await supabase
          .from('contact_submissions')
          .update({ ai_analysis: analysis, ai_analyzed_at: new Date().toISOString() })
          .eq('id', id);

        return new Response(
          JSON.stringify({ success: true, analysis }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'clearRetellQueue': {
        try {
          // Delete all retelling data older than 3 hours
          const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
          
          // Count how many records we'll delete
          const { data: countData } = await supabase
            .from('news_rss_items')
            .select('id', { count: 'exact' })
            .not('key_points', 'is', null)
            .lt('updated_at', threeHoursAgo);

          const recordCount = countData?.length || 0;

          // Delete retelling data (key_points, themes, keywords) for items fetched before 3 hours ago
          const { error } = await supabase
            .from('news_rss_items')
            .update({
              key_points: null,
              themes: null,
              keywords: null
            })
            .not('key_points', 'is', null)
            .lt('fetched_at', threeHoursAgo);

          if (error) throw error;

          return new Response(
            JSON.stringify({
              success: true,
              message: `Видалено ${recordCount} старих переказів (раніше ніж 3 години)`,
              cleared_count: recordCount,
              cutoff_time: threeHoursAgo
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (e) {
          console.error('clearRetellQueue error:', e);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: e instanceof Error ? e.message : String(e) 
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      case 'initRetellQueue': {
        try {
          const { provider = 'both' } = data || {};
          
          // Get latest 20 news items that need retelling
          const query = supabase
            .from('news_rss_items')
            .select('id, title_en, slug, fetched_at, url')
            .is('key_points', null)
            .gte('fetched_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()) // last 6 hours
            .order('fetched_at', { ascending: false });

          if (provider === 'zai') {
            query.limit(10);
          } else if (provider === 'deepseek') {
            query.limit(10);
          } else {
            query.limit(20); // both providers - 10 each
          }

          const { data: newsItems, error } = await query;
          if (error) throw error;

          if (!newsItems || newsItems.length === 0) {
            return new Response(
              JSON.stringify({
                success: true,
                message: 'Немає новин для переказу в черзі',
                queue_items: [],
                providers: {
                  zai: { items: [] },
                  deepseek: { items: [] }
                }
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Split items between providers
          const midpoint = Math.ceil(newsItems.length / 2);
          const providers = {
            zai: {
              items: provider === 'zai' ? newsItems : newsItems.slice(0, midpoint),
              reserved_at: new Date().toISOString()
            },
            deepseek: {
              items: provider === 'deepseek' ? newsItems : newsItems.slice(midpoint),
              reserved_at: new Date().toISOString()
            }
          };

          return new Response(
            JSON.stringify({
              success: true,
              message: `Зарезервовано ${newsItems.length} новин для переказу`,
              queue_items: newsItems,
              providers,
              total_reserved: newsItems.length,
              zai_count: providers.zai.items.length,
              deepseek_count: providers.deepseek.items.length
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (e) {
          console.error('initRetellQueue error:', e);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: e instanceof Error ? e.message : String(e) 
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      case 'processRetellQueue': {
        try {
          const { 
            provider = 'both', 
            batch_size = 20,
            timeout_minutes = 10 
          } = data || {};
          
          const timeoutMs = timeout_minutes * 60 * 1000;
          const startTime = Date.now();
          const zaiUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/bulk-retell-news-zai`;
          const deepseekUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/bulk-retell-news-deepseek`;
          const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          
          const results: any = {
            zai: { processed: 0, success: 0, failed: 0, error: null },
            deepseek: { processed: 0, success: 0, failed: 0, error: null },
            total_time_ms: 0,
            timeout_reached: false
          };

          // Process zai if requested
          if (provider === 'zai' || provider === 'both') {
            try {
              const resp = await fetch(zaiUrl, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${serviceKey}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  country_code: 'ALL',
                  time_range: 'last_6h',
                  llm_model: 'GLM-4.7-Flash',
                  max_items: provider === 'both' ? 10 : batch_size,
                  job_name: 'retell_queue_zai',
                  trigger: 'queue_admin'
                })
              });
              
              const respData = await resp.json();
              results.zai = {
                processed: respData.processed || 0,
                success: respData.success || respData.processed || 0,
                failed: respData.failed || 0,
                error: resp.ok ? null : (respData.error || 'HTTP ' + resp.status)
              };
            } catch (e) {
              results.zai.error = e instanceof Error ? e.message : String(e);
            }
          }

          // Check timeout before processing deepseek
          if (Date.now() - startTime > timeoutMs) {
            results.timeout_reached = true;
            results.total_time_ms = Date.now() - startTime;
            return new Response(
              JSON.stringify({
                success: false,
                message: 'Таймаут обробки черги (10 хвилин)',
                results
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Process deepseek if requested  
          if (provider === 'deepseek' || provider === 'both') {
            try {
              const resp = await fetch(deepseekUrl, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${serviceKey}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  country_code: 'ALL',
                  time_range: 'last_6h',
                  llm_model: 'deepseek-chat',
                  max_items: provider === 'both' ? 10 : batch_size,
                  job_name: 'retell_queue_deepseek',
                  trigger: 'queue_admin'
                })
              });
              
              const respData = await resp.json();
              results.deepseek = {
                processed: respData.processed || 0,
                success: respData.success || respData.processed || 0,
                failed: respData.failed || 0,
                error: resp.ok ? null : (respData.error || 'HTTP ' + resp.status)
              };
            } catch (e) {
              results.deepseek.error = e instanceof Error ? e.message : String(e);
            }
          }

          results.total_time_ms = Date.now() - startTime;
          const totalProcessed = results.zai.processed + results.deepseek.processed;
          
          // Log queue processing event
          try {
            await supabase.from('cron_job_events').insert({
              job_name: 'retell_queue_process',
              event_type: 'queue_batch',
              origin: 'admin',
              details: {
                provider,
                batch_size,
                results,
                total_processed: totalProcessed
              }
            });
          } catch (logError) {
            console.error('Failed to log queue processing event:', logError);
          }

          return new Response(
            JSON.stringify({
              success: true,
              message: `Оброблено ${totalProcessed} новин в черзі`,
              results,
              total_processed: totalProcessed
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (e) {
          console.error('processRetellQueue error:', e);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: e instanceof Error ? e.message : String(e) 
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      case 'getRetellQueueStats': {
        try {
          const now = new Date();
          const ranges = {
            m15: new Date(now.getTime() - 15 * 60 * 1000),
            h1: new Date(now.getTime() - 60 * 60 * 1000),
            h6: new Date(now.getTime() - 6 * 60 * 60 * 1000),
            h24: new Date(now.getTime() - 24 * 60 * 60 * 1000)
          };

          // Count news pending retelling (by time range)
          const pendingStats = await Promise.all([
            supabase.from('news_rss_items')
              .select('id', { count: 'exact' })
              .is('key_points', null)
              .gte('fetched_at', ranges.m15.toISOString()),
            supabase.from('news_rss_items')
              .select('id', { count: 'exact' })
              .is('key_points', null)
              .gte('fetched_at', ranges.h1.toISOString()),
            supabase.from('news_rss_items')
              .select('id', { count: 'exact' })
              .is('key_points', null)
              .gte('fetched_at', ranges.h6.toISOString()),
            supabase.from('news_rss_items')
              .select('id', { count: 'exact' })
              .is('key_points', null)
              .gte('fetched_at', ranges.h24.toISOString())
          ]);

          // Count retells completed by provider in last 24h
          const [zaiStats, deepseekStats] = await Promise.all([
            supabase.from('llm_usage_logs')
              .select('id, metadata', { count: 'exact' })
              .eq('operation', 'retell-news')
              .eq('success', true)
              .contains('metadata', { llm_provider: 'zai' })
              .gte('created_at', ranges.h24.toISOString()),
            supabase.from('llm_usage_logs')
              .select('id, metadata', { count: 'exact' })
              .eq('operation', 'retell-news')
              .eq('success', true)
              .contains('metadata', { llm_provider: 'deepseek' })
              .gte('created_at', ranges.h24.toISOString())
          ]);

          // Get current total queue size
          const { count: currentQueueSize } = await supabase
            .from('news_rss_items')
            .select('id', { count: 'exact' })
            .is('key_points', null)
            .gte('fetched_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString());

          // Queue processing events from last 24h
          const { data: queueEvents } = await supabase
            .from('cron_job_events')
            .select('created_at, details')
            .eq('event_type', 'queue_batch')
            .gte('created_at', ranges.h24.toISOString())
            .order('created_at', { ascending: false })
            .limit(20);

          // Hourly processing chart for last 24h
          const hourlySlots = [];
          for (let i = 23; i >= 0; i--) {
            const start = new Date(now.getTime() - (i + 1) * 60 * 60 * 1000);
            const end = new Date(now.getTime() - i * 60 * 60 * 1000);
            
            const [zaiHour, deepseekHour] = await Promise.all([
              supabase.from('llm_usage_logs')
                .select('id', { count: 'exact' })
                .eq('operation', 'retell-news')
                .contains('metadata', { llm_provider: 'zai' })
                .gte('created_at', start.toISOString())
                .lt('created_at', end.toISOString()),
              supabase.from('llm_usage_logs')
                .select('id', { count: 'exact' })
                .eq('operation', 'retell-news')
                .contains('metadata', { llm_provider: 'deepseek' })
                .gte('created_at', start.toISOString())
                .lt('created_at', end.toISOString())
            ]);

            hourlySlots.push({
              time: start.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }),
              zai: zaiHour.count || 0,
              deepseek: deepseekHour.count || 0,
              total: (zaiHour.count || 0) + (deepseekHour.count || 0)
            });
          }

          return new Response(
            JSON.stringify({
              success: true,
              stats: {
                pending_queue: {
                  m15: pendingStats[0].count || 0,
                  h1: pendingStats[1].count || 0,
                  h6: pendingStats[2].count || 0,
                  h24: pendingStats[3].count || 0
                },
                current_queue_size: currentQueueSize || 0,
                completed_h24: {
                  zai: zaiStats.count || 0,
                  deepseek: deepseekStats.count || 0,
                  total: (zaiStats.count || 0) + (deepseekStats.count || 0)
                },
                recent_queue_events: queueEvents || [],
                hourly_chart: hourlySlots
              }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (e) {
          console.error('getRetellQueueStats error:', e);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: e instanceof Error ? e.message : String(e) 
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: any) {
    console.error('Admin error:', error);

    // Check if it's a Supabase error response
    if (error && typeof error === 'object' && 'message' in error) {
      return new Response(
        JSON.stringify({ error: error.message, details: error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
// Updated password: Thu Feb 12 08:52:44 EST 2026
