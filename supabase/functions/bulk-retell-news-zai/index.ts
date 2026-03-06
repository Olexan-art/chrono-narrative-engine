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
                details: { provider: 'zai', country_code, time_range, llm_model, job_name, force_all }
            });
        } catch (e) {
            console.error('Failed to write cron_job_events (run_started):', e);
        }

        console.log(`[bulk-retell-news-zai] Starting for: ${country_code}, time_range: ${time_range || 'all'}`);

        // Get Z.AI API key from settings or env
        const { data: settings } = await supabase
            .from('settings')
            .select('zai_api_key, deepseek_api_key')
            .single();
        
        const zaiApiKey = settings?.zai_api_key || Deno.env.get('ZAI_API_KEY');
        const deepseekApiKey = settings?.deepseek_api_key || Deno.env.get('DEEPSEEK_API_KEY');
        if (!zaiApiKey) {
            const errorMsg = 'ZAI_API_KEY not configured in settings or environment variables';
            console.error(errorMsg);
            try {
                await supabase.from('cron_job_events').insert({
                    job_name: job_name || null,
                    event_type: 'run_failed',
                    origin: trigger === 'cron' ? 'automatic' : 'manual',
                    status: 'error',
                    details: { provider: 'zai', country_code, error: errorMsg }
                });
            } catch (_) {}
            return new Response(JSON.stringify({ 
                error: errorMsg,
                processed: 0,
                success: 0,
                errors: 1,
                details: ['Z.AI API key missing']
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
                .select('id, code')
                .eq('code', country_code.toUpperCase())
                .single();

            if (countryError || !country) {
                throw new Error(`Country ${country_code} not found`);
            }

            queryFilter = supabase
                .from('news_rss_items')
                .select('id, title, slug, fetched_at, content, country:news_countries(code)')
                .eq('country_id', country.id)
                .is('key_points', null);
        }

        // Apply time range filters
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

        let query = queryFilter;

        // --- ПАРАЛЕЛЬНА ОБРОБКА: Z.AI бере тільки парні ID ---

        if (!force_all && time_range && time_range !== 'all') {
            const now = Date.now();
            if (time_range === 'last_1h') {
                const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
                query = query.gte('fetched_at', oneHourAgo);
            } else if (time_range === 'last_3h') {
                const threeHoursAgo = new Date(now - 3 * 60 * 60 * 1000).toISOString();
                query = query.gte('fetched_at', threeHoursAgo);
            } else if (time_range === 'last_24h') {
                const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
                query = query.gte('fetched_at', twentyFourHoursAgo);
            }
        }

        query = query.order('fetched_at', { ascending: false });

        const TARGET_ITEMS = 10; // ZAI target: keep small to avoid Supabase 150s function timeout

        const { data: newsItems, error: newsError } = await query.limit(200);

        if (newsError) {
            throw new Error(`Failed to fetch news: ${newsError.message}`);
        }

        // Filter for Z.AI parallel processing: items where ID hash mod 2 === 0
        const evenItems = (newsItems || []).filter((i: any) => {
            const lastChar = i.id.slice(-1);
            const val = parseInt(lastChar, 16);
            return isNaN(val) ? true : val % 2 === 0;
        });

        // Fallback: if no even-ID items found, process all available items (DeepSeek may have taken them all)
        let queue: any[] = evenItems.length > 0 ? evenItems : (newsItems || []);
        const splitMode = evenItems.length > 0 ? 'even_indexes' : 'all_fallback';

        // If still below target, top up from global queue: US first, then other countries
        if (queue.length < TARGET_ITEMS) {
            const seenIds = new Set(queue.map((i: any) => i.id));
            const needed = TARGET_ITEMS - queue.length;

            let timeFilter: string | null = null;
            if (time_range === 'last_24h') timeFilter = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            else if (time_range === 'last_6h') timeFilter = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
            else if (time_range === 'last_1h') timeFilter = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            else if (time_range === 'last_30m') timeFilter = new Date(Date.now() - 30 * 60 * 1000).toISOString();

            // US first
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

            // Then global
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
                console.log(`[zai] Top-up: adding ${extraItems.length} items from global queue`);
                queue = [...queue, ...extraItems];
            }
        }

        // Cap queue at TARGET_ITEMS to stay within ZAI rate limits
        if (queue.length > TARGET_ITEMS) {
            queue = queue.slice(0, TARGET_ITEMS);
        }

        console.log(`[zai] Processing ${queue.length} items (${splitMode}) out of ${(newsItems || []).length} primary total`);

        if (queue.length === 0) {
            console.log(`[bulk-retell-news-zai] Queue empty for ${country_code}`);
            const summary = { success: true, processed: 0, taken: 0, success_count: 0, error_count: 0, provider: 'zai', llm_model: llm_model || 'GLM-4.7-Flash', country_code, message: 'Queue empty (or all handled by DeepSeek)' };
            if (job_name) {
                await supabase.from('cron_job_configs').update({
                    last_run_at: new Date().toISOString(),
                    last_run_status: 'success',
                    last_run_details: summary
                }).eq('job_name', job_name);
            }
            try {
                await supabase.from('cron_job_events').insert({
                    job_name: job_name || null,
                    event_type: 'run_finished',
                    origin: trigger === 'cron' ? 'automatic' : 'manual',
                    status: 'success',
                    details: summary
                });
            } catch (e) {
                console.error('Failed to write cron_job_events (run_finished empty):', e);
            }
            return new Response(JSON.stringify(summary), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Z.AI rate limits aggressively; lower parallelism keeps throughput stable.
                const concurrency = 1;
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

        const processWithDeepseek = async (newsItem: any) => {
            if (!deepseekApiKey) {
                throw new Error('DeepSeek fallback key is not configured');
            }

            const dsAbort = new AbortController();
            const dsTimer = setTimeout(() => dsAbort.abort(), 25000);
            const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
                signal: dsAbort.signal,
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${deepseekApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: [
                        { role: 'system', content: 'You are a professional journalist and news editor. Always respond with valid JSON only, no markdown, no extra text.' },
                        { role: 'user', content: `Summarize this news article. Output ONLY valid JSON:\n{\n  "key_points": ["Key takeaway 1", "Key takeaway 2", "Key takeaway 3", "Key takeaway 4"],\n  "themes": ["Theme1", "Theme2"],\n  "keywords": ["keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5"]\n}\nRules: key_points = 4-5 most important takeaways (short sentences); themes = 2-4 main topics (1-2 words each); keywords = 5-8 search keywords.\n\nTitle: ${newsItem.title}\n\nContent:\n${newsItem.content || newsItem.title}` }
                    ],
                    temperature: 0.3
                }),
            }).finally(() => clearTimeout(dsTimer));

            if (!response.ok) {
                throw new Error(`DeepSeek API Error: ${response.status}`);
            }

            const result = await response.json();
            const content = result.choices?.[0]?.message?.content;
            if (!content) {
                throw new Error('Empty response from DeepSeek');
            }

            const fbParsed = parseStructuredResponse(content);
            const { data: fbUpd, error: fbErr } = await supabase.from('news_rss_items').update({
                key_points: fbParsed.key_points,
                themes: fbParsed.themes.length > 0 ? fbParsed.themes : undefined,
                keywords: fbParsed.keywords.length > 0 ? fbParsed.keywords : undefined,
                llm_provider: 'deepseek-fallback',
                llm_model: 'deepseek-chat',
                llm_processed_at: new Date().toISOString(),
            }).eq('id', newsItem.id).select('id, llm_provider');
            console.log('[DS-FALLBACK-UPD]', newsItem.id, JSON.stringify({ fbUpd, fbErr }));

            // Log to llm_usage_logs for stats tracking
            await supabase.from('llm_usage_logs').insert({
                operation: 'retell-news',
                success: true,
                metadata: {
                    llm_provider: 'deepseek',
                    news_id: newsItem.id
                }
            });
        };

        const processItem = async (newsItem: any) => {
            try {
                const systemPrompt = `You are a professional journalist and news editor. Always respond with valid JSON only, no markdown, no extra text.`;

                const userPrompt = `Summarize this news article. Output ONLY valid JSON:\n{\n  "key_points": ["Key takeaway 1", "Key takeaway 2", "Key takeaway 3", "Key takeaway 4"],\n  "themes": ["Theme1", "Theme2"],\n  "keywords": ["keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5"]\n}\nRules: key_points = 4-5 most important takeaways (short sentences); themes = 2-4 main topics (1-2 words each); keywords = 5-8 search keywords.\n\nTitle: ${newsItem.title}\n\nContent:\n${newsItem.content || newsItem.title}`;

                const zaiAbort = new AbortController();
                const zaiTimer = setTimeout(() => zaiAbort.abort(), 10000);
                const response = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
                        signal: zaiAbort.signal,
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${zaiApiKey}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            model: llm_model || 'GLM-4.7-Flash',
                            messages: [
                                { role: 'system', content: systemPrompt },
                                { role: 'user', content: userPrompt }
                            ],
                            temperature: 0.3
                        }),
                    }).finally(() => clearTimeout(zaiTimer));

                if (!response.ok) {
                    if (response.status === 429 && deepseekApiKey) {
                        // Fallback for THIS item only — don't block ZAI for remaining items
                        console.warn(`[zai] 429 rate limit on item ${newsItem.id}, falling back to DeepSeek for this item only`);
                        await processWithDeepseek(newsItem);
                        processedSlugs.push({ slug: newsItem.slug, country: (newsItem.country?.code || countryCode || 'us').toLowerCase(), title: newsItem.title });
                        successCount++;

                        // Refresh cache after deepseek-fallback key_points save
                        const itemCountryCodeFb = (newsItem.country?.code || countryCode || 'us').toLowerCase();
                        const adminPassFb = Deno.env.get('ADMIN_PASSWORD');
                        const cacheUrlFb = `${supabaseUrl}/functions/v1/cache-pages?action=refresh-single&path=${encodeURIComponent(`/news/${itemCountryCodeFb}/${newsItem.slug}`)}&password=${adminPassFb}`;
                        try {
                            await fetch(cacheUrlFb, { headers: { 'Authorization': `Bearer ${supabaseKey}` } });
                        } catch (_) { }

                        // Still trigger analysis & wiki for deepseek-fallback items
                        const itemCountryCodeFb = (newsItem.country?.code || countryCode || 'us').toLowerCase();
                        const fullContentFb = (newsItem.content || newsItem.title || '').slice(0, 3000);
                        pendingTasks.push(
                            fetch(`${supabaseUrl}/functions/v1/generate-news-analysis`, {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                                // ZAI is 429-limited here, use DeepSeek for analysis
                                body: JSON.stringify({ newsId: newsItem.id, newsTitle: newsItem.title, newsContent: fullContentFb, model: 'deepseek-chat' })
                            }).catch(e => console.warn('[zai-fb] generate-news-analysis error:', e))
                        );
                        pendingTasks.push(
                            fetch(`${supabaseUrl}/functions/v1/search-wiki`, {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ newsId: newsItem.id, title: newsItem.title, keywords: [], language: 'en' })
                            }).catch(e => console.warn('[zai-fb] search-wiki error:', e))
                        );
                        return;
                    }
                    throw new Error(`Z.AI API Error: ${response.status}`);
                }
                const result = await response.json();
                const content = result.choices?.[0]?.message?.content;

                if (content) {
                    const zaiParsed = parseStructuredResponse(content);
                    const { data: upd, error: updErr } = await supabase.from('news_rss_items').update({
                        key_points: zaiParsed.key_points,
                        themes: zaiParsed.themes.length > 0 ? zaiParsed.themes : undefined,
                        keywords: zaiParsed.keywords.length > 0 ? zaiParsed.keywords : undefined,
                        llm_provider: 'zai',
                        llm_model: llm_model || 'GLM-4.7-Flash',
                        llm_processed_at: new Date().toISOString()
                    }).eq('id', newsItem.id).select('id, llm_provider');
                    console.log('[ZAI-UPD]', newsItem.id, JSON.stringify({ upd, updErr }));

                    // Log to llm_usage_logs for stats tracking
                    await supabase.from('llm_usage_logs').insert({
                        operation: 'retell-news',
                        success: true,
                        metadata: {
                            llm_provider: 'zai',
                            news_id: newsItem.id
                        }
                    });

                    // Refresh cache - get country code from news item
                    const itemCountryCode = newsItem.country?.code || countryCode?.toLowerCase() || 'us';
                    const adminPass = Deno.env.get('ADMIN_PASSWORD');
                    const cacheUrl = `${supabaseUrl}/functions/v1/cache-pages?action=refresh-single&path=${encodeURIComponent(`/news/${itemCountryCode.toLowerCase()}/${newsItem.slug}`)}&password=${adminPass}`;
                    try {
                        await fetch(cacheUrl, { headers: { 'Authorization': `Bearer ${supabaseKey}` } });
                    } catch (_) { }

                    // Queue analysis & wiki tasks — awaited collectively before returning
                    const fullContent = (newsItem.content || newsItem.title || '').slice(0, 3000);
                    pendingTasks.push(
                        fetch(`${supabaseUrl}/functions/v1/generate-news-analysis`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ newsId: newsItem.id, newsTitle: newsItem.title, newsContent: fullContent, model: llm_model || 'GLM-4.7-Flash' })
                        }).catch(e => console.warn('[zai] generate-news-analysis error:', e))
                    );
                    pendingTasks.push(
                        fetch(`${supabaseUrl}/functions/v1/search-wiki`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ newsId: newsItem.id, title: newsItem.title, keywords: zaiParsed.keywords || [], language: 'en' })
                        }).catch(e => console.warn('[zai] search-wiki error:', e))
                    );

                    processedSlugs.push({ slug: newsItem.slug, country: itemCountryCode.toLowerCase(), title: newsItem.title });
                    successCount++;
                } else {
                    throw new Error('Empty response from Z.AI');
                }
            } catch (error) {
                errorCount++;
                errors.push({ id: newsItem.id, error: error instanceof Error ? error.message : String(error) });
                console.error(`[bulk-retell-news-zai] Error processing ${newsItem.id}:`, error);
            }
        };

        const workers = Array(Math.min(concurrency, queue.length)).fill(null).map(async () => {
            while (queue.length > 0) {
                const item = queue.shift();
                if (item) await processItem(item);
            }
        });

        await Promise.all(workers);

        // Wait for all pending analysis/wiki tasks (cap at 30s to stay within function timeout)
        if (pendingTasks.length > 0) {
            await Promise.race([
                Promise.allSettled(pendingTasks),
                new Promise(r => setTimeout(r, 30000))
            ]);
        }

        const finalSummary = {
            success: true,
            processed: (newsItems || []).length,
            success_count: successCount,
            error_count: errorCount,
            failed: errorCount,
            total: (newsItems || []).length,
            errors: errors.slice(0, 5),
            country_code,
            provider: 'zai',
            llm_model: llm_model || 'zai-default',
            sample_items: processedSlugs.slice(0, 3)
        };

        if (job_name) {
            await supabase.from('cron_job_configs').update({
                last_run_at: new Date().toISOString(),
                last_run_status: errorCount === 0 ? 'success' : 'warning',
                last_run_details: finalSummary
            }).eq('job_name', job_name);
        }

        try {
            await supabase.from('cron_job_events').insert({
                job_name: job_name || null,
                event_type: 'run_finished',
                origin: trigger === 'cron' ? 'automatic' : 'manual',
                status: errorCount === 0 ? 'success' : 'warning',
                details: finalSummary
            });
        } catch (e) {
            console.error('Failed to write cron_job_events (run_finished):', e);
        }

        return new Response(JSON.stringify(finalSummary), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[bulk-retell-news-zai] Fatal Error:', errorMessage);
        try {
            const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
            const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
            const supabase = createClient(supabaseUrl, supabaseKey);
            await supabase.from('cron_job_events').insert({
                job_name: jobNameForUpdate || null,
                event_type: 'run_failed',
                origin: 'cron',
                details: { provider: 'zai', country_code: countryCodeForUpdate, error: errorMessage }
            });
        } catch (_) {}
        return new Response(JSON.stringify({ error: errorMessage }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
