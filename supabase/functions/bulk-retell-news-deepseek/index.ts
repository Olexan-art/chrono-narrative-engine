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

    let jobNameForUpdate: string | undefined;
    let countryCodeForUpdate: string | undefined;

    try {
        const { country_code, time_range, llm_model, job_name, force_all, trigger } = await req.json();

        jobNameForUpdate = job_name;
        countryCodeForUpdate = country_code;

        if (!country_code) {
            return new Response(JSON.stringify({ error: 'country_code is required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const origin = trigger === 'cron' ? 'automatic' : 'manual';
        try {
            await supabase.from('cron_job_events').insert({
                job_name: job_name || null,
                event_type: 'run_started',
                origin,
                details: { provider: 'deepseek', country_code, time_range, llm_model, job_name, force_all }
            });
        } catch (e) {
            console.error('Failed to write cron_job_events (run_started):', e);
        }

        console.log(`[bulk-retell-news-deepseek] Starting for: ${country_code}, time_range: ${time_range || 'all'}`);

        // Get DeepSeek API key from settings or env
        const { data: settings } = await supabase
            .from('settings')
            .select('deepseek_api_key')
            .single();
        
        const deepseekApiKey = settings?.deepseek_api_key || Deno.env.get('DEEPSEEK_API_KEY');
        if (!deepseekApiKey) {
            const errorMsg = 'DEEPSEEK_API_KEY not configured in settings or environment variables';
            console.error(errorMsg);
            return new Response(JSON.stringify({ 
                error: errorMsg,
                processed: 0,
                success: 0,
                errors: 1,
                details: ['DeepSeek API key missing']
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        let countryCode = country_code;
        let queryFilter: any;

        if (country_code.toUpperCase() === 'ALL') {
            // Process all countries
            queryFilter = supabase
                .from('news_rss_items')
                .select('id, title, slug, fetched_at, content, country:news_countries(code)')
                .is('key_points', null);
        } else {
            // Process specific country
            const { data: country, error: countryError } = await supabase
                .from('news_countries')
                .select('*')
                .eq('code', country_code.toUpperCase())
                .single();

            if (countryError || !country) {
                return new Response(JSON.stringify({ 
                    error: `Country ${country_code} not found`,
                    processed: 0,
                    failed: 1
                }), {
                    status: 404,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }

            countryCode = country.code;
            queryFilter = supabase
                .from('news_rss_items')
                .select('id, title, slug, fetched_at, content, country:news_countries(code)')
                .eq('country_id', country.id)
                .is('key_points', null);
        }

        if (time_range === 'last_24h') {
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            queryFilter = queryFilter.gte('fetched_at', yesterday);
        } else if (time_range === 'last_6h') {
            const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
            queryFilter = queryFilter.gte('fetched_at', sixHoursAgo);
        } else if (time_range === 'last_1h') {
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            queryFilter = queryFilter.gte('fetched_at', oneHourAgo);
        } else if (time_range === 'last_30m') {
            const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
            queryFilter = queryFilter.gte('fetched_at', thirtyMinAgo);
        }

        const TARGET_ITEMS = 20; // DeepSeek target: keep small to stay within 150s Supabase timeout

        // Fetch 2x more items upfront to feed the odd-ID filter
        const { data: newsItems, error } = await queryFilter
            .order('fetched_at', { ascending: false })
            .limit(200);

        if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (!newsItems || newsItems.length === 0) {
            const summary = {
                processed: 0,
                success: 0,
                failed: 0,
                skipped: 0,
                message: `No news items found in ${countryCode} for retelling`,
                details: { provider: 'deepseek', time_range, country_code: countryCode }
            };

            try {
                await supabase.from('cron_job_events').insert({
                    job_name: job_name || null,
                    event_type: 'run_completed',
                    origin,
                    details: summary
                });
            } catch (e) {
                console.error('Failed to write cron_job_events (run_completed):', e);
            }

            return new Response(JSON.stringify(summary), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // For parallel processing with Z.AI: DeepSeek handles items where ID hash mod 2 === 1
        // Fallback: if no odd-ID items found, process all available items (Z.AI may be down)
        const oddItems = (newsItems || []).filter((item) => {
            const lastChar = item.id.slice(-1);
            const val = parseInt(lastChar, 16);
            return isNaN(val) ? false : val % 2 === 1;
        });
        let filteredItems = oddItems.length > 0 ? oddItems : (newsItems || []);
        const splitMode = oddItems.length > 0 ? 'odd_indexes' : 'all_fallback';

        // If still below target, top up from global queue: US first, then other countries
        if (filteredItems.length < TARGET_ITEMS) {
            const seenIds = new Set(filteredItems.map((i: any) => i.id));
            const needed = TARGET_ITEMS - filteredItems.length;

            // Build time filter string for global top-up
            let timeFilter: string | null = null;
            if (time_range === 'last_24h') timeFilter = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            else if (time_range === 'last_6h') timeFilter = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
            else if (time_range === 'last_1h') timeFilter = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            else if (time_range === 'last_30m') timeFilter = new Date(Date.now() - 30 * 60 * 1000).toISOString();

            // Fetch US items first
            let usQuery = supabase
                .from('news_rss_items')
                .select('id, title, slug, fetched_at, content, country:news_countries!inner(code)')
                .is('key_points', null)
                .eq('news_countries.code', 'US');
            if (timeFilter) usQuery = usQuery.gte('fetched_at', timeFilter);
            const { data: usItems } = await usQuery.order('fetched_at', { ascending: false }).limit(needed * 2);

            const extraItems: any[] = [];
            for (const item of (usItems || [])) {
                if (!seenIds.has(item.id)) {
                    seenIds.add(item.id);
                    extraItems.push(item);
                    if (extraItems.length >= needed) break;
                }
            }

            // If still need more, fetch from all other countries
            if (extraItems.length < needed) {
                let globalQuery = supabase
                    .from('news_rss_items')
                    .select('id, title, slug, fetched_at, content, country:news_countries(code)')
                    .is('key_points', null);
                if (timeFilter) globalQuery = globalQuery.gte('fetched_at', timeFilter);
                const { data: globalItems } = await globalQuery.order('fetched_at', { ascending: false }).limit((needed - extraItems.length) * 3);

                for (const item of (globalItems || [])) {
                    if (!seenIds.has(item.id)) {
                        seenIds.add(item.id);
                        extraItems.push(item);
                        if (extraItems.length >= needed) break;
                    }
                }
            }

            if (extraItems.length > 0) {
                console.log(`Top-up: adding ${extraItems.length} items from global queue`);
                filteredItems = [...filteredItems, ...extraItems];
            }
        }

        console.log(`Processing ${filteredItems.length} news items (${splitMode}) out of ${newsItems.length} primary total`);

        let successCount = 0;
        let errorCount = 0;
        const errors: any[] = [];
        const processedSlugs: Array<{ slug: string; country: string; title: string }> = [];
        const pendingTasks: Promise<any>[] = [];

        // Parse structured JSON response from LLM into key_points, themes, keywords
        const parseStructuredResponse = (text: string): { key_points: string[]; themes: string[]; keywords: string[] } => {
            try {
                const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ||
                    text.match(/```\s*([\s\S]*?)\s*```/) ||
                    [null, text];
                const parsed = JSON.parse((jsonMatch[1] || text).trim());
                return {
                    key_points: Array.isArray(parsed.key_points) ? parsed.key_points.slice(0, 5).map(String) : [],
                    themes: Array.isArray(parsed.themes) ? parsed.themes.slice(0, 4).map(String) : [],
                    keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 8).map(String) : [],
                };
            } catch (_) {}
            // Fallback: treat as plain text key points
            const lines = text.split('\n')
                .map((l: string) => l.replace(/^\d+[.)]\s*|^[-•*]\s*/, '').trim())
                .filter((l: string) => l.length > 5);
            return {
                key_points: lines.length >= 2 ? lines.slice(0, 5) : [text.slice(0, 500)],
                themes: [],
                keywords: [],
            };
        };

        const processItem = async (newsItem: any) => {
            try {
                const dsAbort = new AbortController();
                const dsTimer = setTimeout(() => dsAbort.abort(), 30000);
                const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
                    signal: dsAbort.signal,
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${deepseekApiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: llm_model || 'deepseek-chat',
                        messages: [
                            { role: 'system', content: 'You are a professional journalist and news editor. Always respond with valid JSON only, no markdown, no extra text.' },
                            { role: 'user', content: `Summarize this news article. Output ONLY valid JSON:\n{\n  "key_points": ["Key takeaway 1", "Key takeaway 2", "Key takeaway 3", "Key takeaway 4"],\n  "themes": ["Theme1", "Theme2"],\n  "keywords": ["keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5"]\n}\nRules: key_points = 4-5 most important takeaways (short sentences); themes = 2-4 main topics (1-2 words each); keywords = 5-8 search keywords.\n\nTitle: ${newsItem.title}\n\nContent:\n${newsItem.content || newsItem.title}` }
                        ],
                        temperature: 0.3
                    }),
                }).finally(() => clearTimeout(dsTimer));

                if (!response.ok) {
                    throw new Error(`Deepseek API Error: ${response.status}`);
                }
                
                const result = await response.json();
                const content = result.choices?.[0]?.message?.content;

                if (content) {
                    const dsParsed = parseStructuredResponse(content);
                    const { data: upd, error: updErr } = await supabase.from('news_rss_items').update({
                        key_points: dsParsed.key_points,
                        themes: dsParsed.themes.length > 0 ? dsParsed.themes : undefined,
                        keywords: dsParsed.keywords.length > 0 ? dsParsed.keywords : undefined,
                        llm_processed_at: new Date().toISOString(),
                        llm_model: llm_model || 'deepseek-chat',
                        llm_provider: 'deepseek'
                    }).eq('id', newsItem.id).select('id, llm_provider');
                    console.log('[DS-UPD]', newsItem.id, JSON.stringify({ upd, updErr }));

                    // Log to llm_usage_logs for stats tracking
                    await supabase.from('llm_usage_logs').insert({
                        operation: 'retell-news',
                        success: true,
                        metadata: {
                            llm_provider: 'deepseek',
                            news_id: newsItem.id
                        }
                    });

                    // Refresh cache for this specific news page (for search bots)
                    const itemCountryCode = (newsItem.country?.code || countryCode || 'us').toLowerCase();
                    const adminPass = Deno.env.get('ADMIN_PASSWORD');
                    const cacheUrl = `${supabaseUrl}/functions/v1/cache-pages?action=refresh-single&path=${encodeURIComponent(`/news/${itemCountryCode}/${newsItem.slug}`)}&password=${adminPass}`;
                    try {
                        await fetch(cacheUrl, { headers: { 'Authorization': `Bearer ${supabaseKey}` } });
                    } catch (e) {
                        console.warn('Cache refresh failed:', e);
                    }

                    // Queue analysis & wiki tasks — awaited collectively before returning
                    const fullContent = (newsItem.content || newsItem.title || '').slice(0, 3000);
                    pendingTasks.push(
                        fetch(`${supabaseUrl}/functions/v1/generate-news-analysis`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ newsId: newsItem.id, newsTitle: newsItem.title, newsContent: fullContent, model: llm_model || 'deepseek-chat' })
                        }).catch(e => console.warn('[deepseek] generate-news-analysis error:', e))
                    );
                    pendingTasks.push(
                        fetch(`${supabaseUrl}/functions/v1/search-wiki`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ newsId: newsItem.id, title: newsItem.title, keywords: dsParsed.keywords || [], language: 'en' })
                        }).catch(e => console.warn('[deepseek] search-wiki error:', e))
                    );

                    processedSlugs.push({ slug: newsItem.slug, country: (newsItem.country?.code || countryCode || 'us').toLowerCase(), title: newsItem.title });
                    successCount++;
                    console.log(`✓ Processed: ${newsItem.title?.substring(0, 50)}...`);
                } else {
                    throw new Error('No content returned from DeepSeek');
                }
            } catch (err) {
                errorCount++;
                const error = err instanceof Error ? err.message : String(err);
                errors.push({ item_id: newsItem.id, error });
                console.error(`✗ Failed: ${newsItem.title?.substring(0, 50)}... - ${error}`);
            }
        };

        // Process items in batches
        const batchSize = 5;
        for (let i = 0; i < filteredItems.length; i += batchSize) {
            const batch = filteredItems.slice(i, i + batchSize);
            await Promise.all(batch.map(processItem));
            if (i + batchSize < filteredItems.length) {
                await new Promise(r => setTimeout(r, 300));
            }
        }

        // Wait for all pending analysis/wiki tasks (cap at 30s to stay within function timeout)
        if (pendingTasks.length > 0) {
            await Promise.race([
                Promise.allSettled(pendingTasks),
                new Promise(r => setTimeout(r, 30000))
            ]);
        }

        const summary = {
            processed: filteredItems.length,
            success_count: successCount,
            error_count: errorCount,
            success: successCount, // backwards compatibility
            failed: errorCount, // backwards compatibility
            skipped: newsItems.length - filteredItems.length,
            total: newsItems.length,
            provider: 'deepseek',
            llm_model: llm_model || 'deepseek-chat',
            country_code: countryCode,
            message: `Processed ${filteredItems.length} items: ${successCount} success, ${errorCount} errors`,
            sample_items: processedSlugs.slice(0, 3),
            details: { 
                provider: 'deepseek', 
                time_range, 
                country_code: countryCode, 
                parallel_processing: splitMode,
                errors: errors.slice(0, 5)
            }
        };

        if (job_name) {
            await supabase.from('cron_job_configs').update({
                last_run_at: new Date().toISOString(),
                last_run_status: errorCount === 0 ? 'success' : 'warning',
                last_run_details: summary
            }).eq('job_name', job_name);
        }

        try {
            await supabase.from('cron_job_events').insert({
                job_name: job_name || null,
                event_type: 'run_finished',
                origin,
                status: errorCount === 0 ? 'success' : 'warning',
                details: summary
            });
        } catch (e) {
            console.error('Failed to write cron_job_events (run_finished):', e);
        }

        return new Response(JSON.stringify(summary), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('Function error:', errorMessage);

        try {
            const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
            const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
            const supabase = createClient(supabaseUrl, supabaseKey);

            await supabase.from('cron_job_events').insert({
                job_name: jobNameForUpdate || null,
                event_type: 'run_failed',
                origin: 'manual',
                details: { 
                    provider: 'deepseek', 
                    country_code: countryCodeForUpdate, 
                    error: errorMessage 
                }
            });
        } catch (e) {
            console.error('Failed to write cron_job_events (run_failed):', e);
        }

        return new Response(JSON.stringify({ 
            error: errorMessage,
            processed: 0,
            failed: 1 
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
