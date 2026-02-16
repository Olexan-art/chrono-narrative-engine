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
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // GET - Retrieve current configuration
        if (req.method === 'GET') {
            const { data, error } = await supabase
                .from('cron_job_configs')
                .select('*')
                .order('job_name');

            if (error) throw error;

            return new Response(JSON.stringify({ success: true, configs: data }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // POST - Update configuration
        if (req.method === 'POST') {
            const body = await req.json();
            const { jobName, action, config } = body;

            if (!jobName) {
                return new Response(JSON.stringify({ success: false, error: 'jobName required' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }

            // Handle pause/resume actions
            if (action === 'pause') {
                const { error } = await supabase
                    .from('cron_job_configs')
                    .update({ enabled: false, updated_at: new Date().toISOString() })
                    .eq('job_name', jobName);

                if (error) throw error;

                return new Response(JSON.stringify({ success: true, message: 'Job paused' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }

            if (action === 'resume') {
                const { error } = await supabase
                    .from('cron_job_configs')
                    .update({ enabled: true, updated_at: new Date().toISOString() })
                    .eq('job_name', jobName);

                if (error) throw error;

                return new Response(JSON.stringify({ success: true, message: 'Job resumed' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }

            // Handle config update
            if (config) {
                const updateData: any = { updated_at: new Date().toISOString() };

                if (config.frequency_minutes !== undefined) updateData.frequency_minutes = config.frequency_minutes;
                if (config.countries !== undefined) updateData.countries = config.countries;
                if (config.processing_options !== undefined) updateData.processing_options = config.processing_options;

                const { error } = await supabase
                    .from('cron_job_configs')
                    .update(updateData)
                    .eq('job_name', jobName);

                if (error) throw error;

                return new Response(JSON.stringify({ success: true, message: 'Config updated' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }

            return new Response(JSON.stringify({ success: false, error: 'Invalid action or config' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error in cron-control:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
