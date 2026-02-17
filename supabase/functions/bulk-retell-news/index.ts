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
        const { country_code, time_range, llm_model, llm_provider, job_name } = await req.json();

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

        console.log(`[bulk-retell-news] Starting for country: ${country_code}, time_range: ${time_range}, model: ${llm_model}`);

        // Get country ID
        const { data: country, error: countryError } = await supabase
            .from('news_countries')
            .select('id, code')
            .eq('code', country_code.toUpperCase())
            .single();

        if (countryError || !country) {
            throw new Error(`Country ${country_code} not found`);
        }

        // IMPROVED LOGIC: Check key_points to determine if news is already retold.
        // retell-news always populates key_points, themes, keywords.
        // Checking content/content_en is unreliable if fetch-rss fills them or if they overlap.
        console.log(`[bulk-retell-news] Checking 'key_points' is null to find unretold news`);

        // Build query for unretold news
        let query = supabase
            .from('news_rss_items')
            .select('id, title, slug, fetched_at')
            .eq('country_id', country.id)
            .is('key_points', null) // Primary check: if no key_points, it needs retelling
            .order('fetched_at', { ascending: false });

        // Apply time range filter
        const now = Date.now();
        if (time_range === 'last_1h') {
            const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
            query = query.gte('fetched_at', oneHourAgo);
        } else if (time_range === 'last_24h') {
            const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
            query = query.gte('fetched_at', twentyFourHoursAgo);
        }

        const { data: newsItems, error: newsError } = await query.limit(20); // Process max 20 items per run (reduced from 100 to avoid timeout)

        if (newsError) {
            throw new Error(`Failed to fetch news: ${newsError.message}`);
        }

        if (!newsItems || newsItems.length === 0) {
            console.log(`[bulk-retell-news] No unretold news found for ${country_code} in range ${time_range}`);
            const summary = {
                success: true,
                processed: 0,
                success_count: 0,
                error_count: 0,
                message: 'No news to process',
                country_code,
                time_range,
                llm_model
            };

            // Update cron job status
            if (job_name) {
                await supabase
                    .from('cron_job_configs')
                    .update({
                        last_run_at: new Date().toISOString(),
                        last_run_status: 'success',
                        last_run_details: summary
                    })
                    .eq('job_name', job_name);
            }

            return new Response(JSON.stringify(summary), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        console.log(`[bulk-retell-news] Found ${newsItems.length} news items to process`);

        // Process in batches (parallel)
        const batchSize = 3; // Concurrency limit
        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];

        for (let i = 0; i < newsItems.length; i += batchSize) {
            const batch = newsItems.slice(i, i + batchSize);
            const promises = batch.map(async (newsItem) => {
                try {
                    console.log(`[bulk-retell-news] Processing: ${newsItem.slug}`);
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

                    if (!retellResponse.ok) {
                        const errorText = await retellResponse.text();
                        throw new Error(`Failed: ${retellResponse.status} - ${errorText}`);
                    }

                    const retellResult = await retellResponse.json();
                    if (retellResult.success) {
                        return { success: true, slug: newsItem.slug };
                    } else {
                        return { success: false, slug: newsItem.slug, error: retellResult.error || 'Unknown error' };
                    }
                } catch (error) {
                    return { success: false, slug: newsItem.slug, error: error instanceof Error ? error.message : String(error) };
                }
            });

            const results = await Promise.all(promises);

            results.forEach(r => {
                if (r.success) {
                    successCount++;
                    console.log(`[bulk-retell-news] ✓ Verified: ${r.slug}`);
                } else {
                    errorCount++;
                    errors.push(`${r.slug}: ${r.error}`);
                    console.error(`[bulk-retell-news] ✗ Failed: ${r.slug}: ${r.error}`);
                }
            });
        }

        const summary = {
            success: true, // Function ran successfully even if some items failed
            processed: newsItems.length,
            success_count: successCount,
            error_count: errorCount,
            errors: errors.slice(0, 10),
            country_code,
            time_range
        };

        console.log(`[bulk-retell-news] Complete:`, summary);

        // Update cron job status
        if (job_name) {
            await supabase
                .from('cron_job_configs')
                .update({
                    last_run_at: new Date().toISOString(),
                    last_run_status: errorCount === 0 ? 'success' : 'warning',
                    last_run_details: summary
                })
                .eq('job_name', job_name);
        }

        return new Response(JSON.stringify(summary), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('[bulk-retell-news] Fatal Error:', error);

        // Attempt to update status to error, even if main logic failed
        // Re-create supabase client since variables might be available
        try {
            if (jobNameForUpdate) {
                const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
                const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
                const supabase = createClient(supabaseUrl, supabaseKey);

                await supabase
                    .from('cron_job_configs')
                    .update({
                        last_run_at: new Date().toISOString(),
                        last_run_status: 'error',
                        last_run_details: { error: error instanceof Error ? error.message : 'Unknown fatal error' }
                    })
                    .eq('job_name', jobNameForUpdate);
            }
        } catch (e) {
            console.error('Failed to update error status:', e);
        }

        return new Response(JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
