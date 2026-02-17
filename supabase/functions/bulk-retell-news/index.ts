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

    try {
        const { country_code, time_range, llm_model, llm_provider, job_name } = await req.json();

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

        // Determine which field to check for "retold" status based on country
        // UA uses 'content' (native), others use 'content_en' (translated/retold)
        const targetContentField = country.code === 'UA' ? 'content' : 'content_en';
        console.log(`[bulk-retell-news] Checking field '${targetContentField}' for completion`);

        // Build query for unretold news
        let query = supabase
            .from('news_rss_items')
            .select('id, title, slug')
            .eq('country_id', country.id)
            .is(targetContentField, null) // Not yet retold
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

        const { data: newsItems, error: newsError } = await query.limit(100); // Process max 100 items per run

        if (newsError) {
            throw new Error(`Failed to fetch news: ${newsError.message}`);
        }

        if (!newsItems || newsItems.length === 0) {
            console.log(`[bulk-retell-news] No unretold news found for ${country_code}`);
            const summary = {
                success: true,
                processed: 0,
                success_count: 0,
                error_count: 0,
                message: 'No news to process',
                country_code,
                time_range,
                llm_model,
                llm_provider
            };

            // Update cron job status if job_name is provided
            if (job_name) {
                await supabase
                    .from('cron_job_configs')
                    .update({
                        last_run_at: new Date().toISOString(),
                        last_run_status: 'success', // No errors, so success
                        last_run_details: summary
                    })
                    .eq('job_name', job_name);
            }

            return new Response(JSON.stringify(summary), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        console.log(`[bulk-retell-news] Found ${newsItems.length} news items to process`);

        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];

        // Process each news item
        for (const newsItem of newsItems) {
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
                    throw new Error(`Retell failed: ${retellResponse.status} - ${errorText}`);
                }

                const retellResult = await retellResponse.json();

                if (retellResult.success) {
                    successCount++;
                    console.log(`[bulk-retell-news] ✓ ${newsItem.slug}`);
                } else {
                    errorCount++;
                    errors.push(`${newsItem.slug}: ${retellResult.error || 'Unknown error'}`);
                    console.error(`[bulk-retell-news] ✗ ${newsItem.slug}: ${retellResult.error}`);
                }

            } catch (error) {
                errorCount++;
                const errorMsg = error instanceof Error ? error.message : String(error);
                errors.push(`${newsItem.slug}: ${errorMsg}`);
                console.error(`[bulk-retell-news] ✗ ${newsItem.slug}:`, error);
            }
        }

        const summary = {
            success: true,
            processed: newsItems.length,
            success_count: successCount,
            error_count: errorCount,
            errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
            country_code,
            time_range,
            llm_model,
            llm_provider
        };

        console.log(`[bulk-retell-news] Complete:`, summary);

        // Update cron job status if job_name is provided
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
        console.error('[bulk-retell-news] Error:', error);
        return new Response(JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
