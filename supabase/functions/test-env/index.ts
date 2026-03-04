import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        
        console.log('Environment check:');
        console.log('SUPABASE_URL:', supabaseUrl ? 'SET' : 'NOT SET');
        console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? `SET (${supabaseServiceKey.length} chars)` : 'NOT SET');
        
        if (!supabaseUrl || !supabaseServiceKey) {
            return new Response(JSON.stringify({
                error: 'Missing environment variables',
                supabase_url: !!supabaseUrl,
                service_role_key: !!supabaseServiceKey
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Try to create a client and write to cron_job_events
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.49.1');
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        console.log('Attempting test insert to cron_job_events...');
        
        const insertResult = await supabase.from('cron_job_events').insert({
            job_name: 'test_env_check',
            event_type: 'run_started',
            origin: 'test',
            details: { test: true, timestamp: new Date().toISOString() }
        });

        console.log('Insert result error:', insertResult.error);
        console.log('Insert result data:', insertResult.data);

        if (insertResult.error) {
            return new Response(JSON.stringify({
                error: 'Failed to insert test log',
                details: insertResult.error,
                environment_ok: true
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({
            success: true,
            message: 'Environment variables are properly set and database insert works',
            environment: {
                supabase_url: !!supabaseUrl,
                service_role_key: !!supabaseServiceKey
            }
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Test error:', error);
        return new Response(JSON.stringify({
            error: 'Test failed',
            message: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});