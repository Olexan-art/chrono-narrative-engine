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
        }

        // Get items processing (focus on odd IDs for parallel processing with Z.AI)
        const { data: newsItems, error } = await queryFilter
            .order('fetched_at', { ascending: false })
            .limit(100);

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
        const filteredItems = newsItems.filter((item) => parseInt(item.id.slice(-1), 16) % 2 === 1);
        console.log(`Processing ${filteredItems.length} news items (ID-based odd split) out of ${newsItems.length} total`);

        let successCount = 0;
        let errorCount = 0;
        const errors: any[] = [];

        const processItem = async (newsItem: any) => {
            try {
                const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${deepseekApiKey}`,
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

                if (!response.ok) {
                    throw new Error(`Deepseek API Error: ${response.status}`);
                }
                
                const result = await response.json();
                const content = result.choices?.[0]?.message?.content;

                if (content) {
                    await supabase.from('news_rss_items').update({
                        key_points: content,
                        llm_processed_at: new Date().toISOString(),
                        llm_model: llm_model || 'deepseek-chat',
                        llm_provider: 'deepseek'
                    }).eq('id', newsItem.id);

                    // Clear cache if exists
                    const cacheUrl = `${supabaseUrl}/functions/v1/cache-clear`;
                    try {
                        await fetch(cacheUrl, { headers: { 'Authorization': `Bearer ${supabaseKey}` } });
                    } catch (e) {
                        console.warn('Cache clear failed:', e);
                    }

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
        }

        const summary = {
            processed: filteredItems.length,
            success_count: successCount,
            error_count: errorCount,
            success: successCount, // backwards compatibility
            failed: errorCount, // backwards compatibility
            skipped: newsItems.length - filteredItems.length,
            total: newsItems.length,
            message: `Processed ${filteredItems.length} items: ${successCount} success, ${errorCount} errors`,
            details: { 
                provider: 'deepseek', 
                time_range, 
                country_code: countryCode, 
                parallel_processing: 'odd_indexes',
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
