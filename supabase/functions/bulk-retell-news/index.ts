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
        const { country_code, time_range, llm_model, job_name, force_all } = await req.json();

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

        console.log(`[bulk-retell-news] CPU-Intensive mode starting for: ${country_code}, time_range: ${time_range || 'all'}`);

        // Get country ID
        const { data: country, error: countryError } = await supabase
            .from('news_countries')
            .select('id, code')
            .eq('code', country_code.toUpperCase())
            .single();

        if (countryError || !country) {
            throw new Error(`Country ${country_code} not found`);
        }

        // Build query for unretold news
        // We look for oldest news first to ensure we close the gap
        let query = supabase
            .from('news_rss_items')
            .select('id, title, slug, fetched_at')
            .eq('country_id', country.id)
            .is('key_points', null);

        // Apply time range filter only if not force_all
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

        // Sort by oldest first to catch up
        query = query.order('fetched_at', { ascending: true });

        const { data: newsItems, error: newsError } = await query.limit(50);

        if (newsError) {
            throw new Error(`Failed to fetch news: ${newsError.message}`);
        }

        if (!newsItems || newsItems.length === 0) {
            console.log(`[bulk-retell-news] Queue empty for ${country_code}`);
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

        console.log(`[bulk-retell-news] Processing backlog of ${newsItems.length} items with concurrency 5`);

        // Parallel processing with controlled concurrency
        const concurrency = 5;
        let successCount = 0;
        let errorCount = 0;
        const errors: any[] = [];

        const processItem = async (newsItem: any) => {
            try {
                const retellResponse = await fetch(`${supabaseUrl}/functions/v1/retell-news`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        newsId: newsItem.id,
                        model: llm_model || undefined,
                    }),
                });

                if (!retellResponse.ok) throw new Error(`Status ${retellResponse.status}`);
                const result = await retellResponse.json();
                if (result.success) {
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

        // Simple worker pool
        const queue = [...newsItems];
        const workers = Array(Math.min(concurrency, queue.length)).fill(null).map(async () => {
            while (queue.length > 0) {
                const item = queue.shift();
                if (item) await processItem(item);
            }
        });

        await Promise.all(workers);

        const summary = {
            success: true,
            processed: newsItems.length,
            success_count: successCount,
            error_count: errorCount,
            errors: errors.slice(0, 5),
            country_code,
            mode: force_all ? 'catch-up' : 'normal'
        };

        if (job_name) {
            await supabase.from('cron_job_configs').update({
                last_run_at: new Date().toISOString(),
                last_run_status: errorCount === 0 ? 'success' : 'warning',
                last_run_details: summary
            }).eq('job_name', job_name);
        }

        return new Response(JSON.stringify(summary), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('[bulk-retell-news] Fatal Error:', error);
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
