import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ZAI_API_URL = 'https://api.z.ai/v1/retell'; // Приклад, замініть на актуальний endpoint

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
                details: { country_code, time_range, llm_model, job_name, force_all }
            });
        } catch (e) {
            console.error('Failed to write cron_job_events (run_started):', e);
        }

        console.log(`[bulk-retell-news-zai] CPU-Intensive mode starting for: ${country_code}, time_range: ${time_range || 'all'}`);

        const { data: country, error: countryError } = await supabase
            .from('news_countries')
            .select('id, code')
            .eq('code', country_code.toUpperCase())
            .single();

        if (countryError || !country) {
            throw new Error(`Country ${country_code} not found`);
        }

        let query = supabase
            .from('news_rss_items')
            .select('id, title, slug, fetched_at, content')
            .eq('country_id', country.id)
            .is('key_points', null);

        if (!force_all) {
            const now = Date.now();
            if (time_range === 'last_1h') {
                const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
                query = query.gte('fetched_at', oneHourAgo);
            } else if (time_range === 'last_24h') {
                const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
                query = query.gte('fetched_at', twentyFourHoursAgo);
            }
        }

        query = query.order('fetched_at', { ascending: false });

        const concurrency = 20;
        let successCount = 0;
        let errorCount = 0;
        const errors: any[] = [];
        const processedIds = new Set<number>();

        const processItem = async (newsItem: any) => {
            try {
                if (processedIds.has(newsItem.id)) return;
                processedIds.add(newsItem.id);

                // Виклик Z.AI API
                const ZAI_API_KEY = Deno.env.get('ZAI_API_KEY');
                if (!ZAI_API_KEY) throw new Error('ZAI_API_KEY not configured');
                const zaiResponse = await fetch(ZAI_API_URL, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${ZAI_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        text: newsItem.content || newsItem.title,
                        newsId: newsItem.id,
                        model: llm_model || undefined,
                    }),
                });

                if (!zaiResponse.ok) throw new Error(`Status ${zaiResponse.status}`);
                const result = await zaiResponse.json();
                if (result.success) {
                    // Оновити новину у базі (наприклад, записати key_points)
                    await supabase.from('news_rss_items').update({
                        key_points: result.key_points || result.summary || null
                    }).eq('id', newsItem.id);

                    // Примусово оновити кеш сторінки новини
                    const adminPass = Deno.env.get('ADMIN_PASSWORD');
                    const cacheUrl = `${supabaseUrl}/functions/v1/cache-pages?action=refresh-single&path=${encodeURIComponent(`/news/${country.code}/${newsItem.slug}`)}&password=${adminPass}`;
                    try {
                        await fetch(cacheUrl, { headers: { 'Authorization': `Bearer ${supabaseKey}` } });
                    } catch (_) { /* non-fatal */ }

                    // Automatically trigger Deep Analysis
                    try {
                        console.log('Triggering generate-news-analysis for newsId:', newsItem.id);
                        fetch(`${supabaseUrl}/functions/v1/generate-news-analysis`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${supabaseKey}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                newsId: newsItem.id,
                                newsTitle: newsItem.title,
                                newsContent: result.key_points || result.summary || null,
                                model: llm_model || undefined
                            })
                        }).catch(e => console.error('Error triggering generate-news-analysis asynchronously:', e));
                    } catch (analysisErr) {
                        console.error('Error triggering generate-news-analysis:', analysisErr);
                    }

                    successCount++;
                } else {
                    errorCount++;
                    errors.push({ slug: newsItem.slug, error: result.error });
                }
            } catch (error) {
                errorCount++;
                errors.push({ slug: newsItem.slug, error: error instanceof Error ? error.message : String(error) });
            }
        };

        let totalProcessed = 0;
        if (!force_all && time_range === 'last_1h') {
            const windows = [15, 15, 20];
            let cumulativeOffset = 0;

            for (const minutes of windows) {
                const windowEnd = new Date(Date.now() - cumulativeOffset * 60 * 1000);
                const windowStart = new Date(windowEnd.getTime() - minutes * 60 * 1000);

                const { data: windowItems, error: windowError } = await supabase
                    .from('news_rss_items')
                    .select('id, title, slug, fetched_at, content')
                    .eq('country_id', country.id)
                    .is('key_points', null)
                    .gte('fetched_at', windowStart.toISOString())
                    .lt('fetched_at', windowEnd.toISOString())
                    .order('fetched_at', { ascending: false })
                    .limit(100);

                if (windowError) {
                    throw new Error(`Failed to fetch news (window ${minutes}m): ${windowError.message}`);
                }

                if (!windowItems || windowItems.length === 0) {
                    cumulativeOffset += minutes;
                    continue;
                }

                console.log(`[bulk-retell-news-zai] Processing ${windowItems.length} items for ${country_code} (window ${minutes}m)`);

                const queue = [...windowItems];
                const workers = Array(Math.min(concurrency, queue.length)).fill(null).map(async () => {
                    while (queue.length > 0) {
                        const item = queue.shift();
                        if (item) await processItem(item);
                    }
                });
                await Promise.all(workers);

                totalProcessed += windowItems.length;
                cumulativeOffset += minutes;
            }
        } else {
            const { data: newsItems, error: newsError } = await query.limit(200);

            if (newsError) {
                throw new Error(`Failed to fetch news: ${newsError.message}`);
            }

            if (!newsItems || newsItems.length === 0) {
                console.log(`[bulk-retell-news-zai] Queue empty for ${country_code}`);
                const summary = { success: true, processed: 0, message: 'Queue empty' };
                if (job_name) {
                    await supabase.from('cron_job_configs').update({
                        last_run_at: new Date().toISOString(),
                        last_run_status: 'success',
                        last_run_details: summary
                    }).eq('job_name', job_name);
                }
                return new Response(JSON.stringify(summary), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            console.log(`[bulk-retell-news-zai] Processing backlog of ${newsItems.length} items with concurrency ${concurrency}`);

            const queue = [...newsItems];
            const workers = Array(Math.min(concurrency, queue.length)).fill(null).map(async () => {
                while (queue.length > 0) {
                    const item = queue.shift();
                    if (item) await processItem(item);
                }
            });

            await Promise.all(workers);

            totalProcessed = newsItems.length;
        }

        const summary = {
            success: true,
            processed: totalProcessed,
            success_count: successCount,
            error_count: errorCount,
            errors: errors.slice(0, 5),
            country_code,
            mode: force_all ? 'catch-up' : (time_range === 'last_1h' ? 'progressive' : 'normal')
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
                origin: trigger === 'cron' ? 'automatic' : 'manual',
                status: errorCount === 0 ? 'success' : 'warning',
                details: summary
            });
        } catch (e) {
            console.error('Failed to write cron_job_events (run_finished):', e);
        }

        return new Response(JSON.stringify(summary), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('[bulk-retell-news-zai] Fatal Error:', error);
        try {
            const origin = (await (async () => { try { const body = await req.json(); return body.trigger || 'manual'; } catch { return 'manual'; } })()) || 'manual';
            await createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!).from('cron_job_events').insert({ job_name: jobNameForUpdate || null, event_type: 'run_failed', origin, details: { error: error instanceof Error ? error.message : String(error) } });
        } catch (e) { console.error('Failed to write cron_job_events (run_failed):', e); }

        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
