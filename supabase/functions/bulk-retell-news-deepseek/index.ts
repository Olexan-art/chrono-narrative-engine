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

        // --- ПАРАЛЕЛЬНА ОБРОБКА: Deepseek бере тільки непарні ID ---
        // Використовуємо .filter() з сирим SQL-подібним виразом або post-filtering
        // Для спрощення у Edge Function робимо post-filtering на fetched data

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

        const { data: newsItems, error: newsError } = await query.limit(200);

        if (newsError) {
            throw new Error(`Failed to fetch news: ${newsError.message}`);
        }

        const queue = (newsItems || []).filter((i: any) => i.id % 2 !== 0); // Only process odd IDs

        if (queue.length === 0) {
            console.log(`[bulk-retell-news-deepseek] Queue empty for ${country_code}`);
            const summary = { success: true, processed: 0, message: 'Queue empty (or all even IDs handled by ZAI)' };
            if (job_name) {
                await supabase.from('cron_job_configs').update({
                    last_run_at: new Date().toISOString(),
                    last_run_status: 'success',
                    last_run_details: summary
                }).eq('job_name', job_name);
            }
            return new Response(JSON.stringify(summary), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const concurrency = 10;
        let successCount = 0;
        let errorCount = 0;
        const errors: any[] = [];

        const processItem = async (newsItem: any) => {
            try {
                const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY');
                if (!deepseekKey) throw new Error('DEEPSEEK_API_KEY not configured');

                const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${deepseekKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: llm_model || 'deepseek-chat',
                        messages: [
                            { role: 'system', content: 'You are a professional journalist. Summarize news into key points.' },
                            { role: 'user', content: `Title: ${newsItem.title}\nContent: ${newsItem.content}\n\nProvide 3-5 key points.` }
                        ],
                        temperature: 0.3
                    }),
                });

                if (!response.ok) throw new Error(`Deepseek API Error: ${response.status}`);
                const result = await response.json();
                const content = result.choices?.[0]?.message?.content;

                if (content) {
                    await supabase.from('news_rss_items').update({
                        key_points: content
                    }).eq('id', newsItem.id);

                    // Refresh cache
                    const adminPass = Deno.env.get('ADMIN_PASSWORD');
                    const cacheUrl = `${supabaseUrl}/functions/v1/cache-pages?action=refresh-single&path=${encodeURIComponent(`/news/${country.code}/${newsItem.slug}`)}&password=${adminPass}`;
                    try {
                        await fetch(cacheUrl, { headers: { 'Authorization': `Bearer ${supabaseKey}` } });
                    } catch (_) { }

                    successCount++;
                } else {
                    throw new Error('Empty response from Deepseek');
                }
            } catch (error) {
                errorCount++;
                errors.push({ id: newsItem.id, error: error instanceof Error ? error.message : String(error) });
            }
        };

        console.log(`[bulk-retell-news-deepseek] Processing ${queue.length} items with concurrency ${concurrency}`);

        const workers = Array(Math.min(concurrency, queue.length)).fill(null).map(async () => {
            while (queue.length > 0) {
                const item = queue.shift();
                if (item) await processItem(item);
            }
        });

        await Promise.all(workers);

        const finalSummary = {
            success: true,
            processed: queue.length,
            success_count: successCount,
            error_count: errorCount,
            errors: errors.slice(0, 5),
            country_code,
            provider: 'deepseek'
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
        console.error('[bulk-retell-news-deepseek] Fatal Error:', error);
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
