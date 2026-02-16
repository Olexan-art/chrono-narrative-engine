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
        const url = new URL(req.url);
        const timeRange = url.searchParams.get('timeRange') || '24h';

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Calculate time threshold
        const now = new Date();
        let hoursAgo = 24;
        switch (timeRange) {
            case '1h': hoursAgo = 1; break;
            case '24h': hoursAgo = 24; break;
            case '3d': hoursAgo = 72; break;
            case '7d': hoursAgo = 168; break;
        }
        const threshold = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);

        // Get aggregated statistics per provider
        const { data: logs, error } = await supabase
            .from('llm_usage_logs')
            .select('*')
            .gte('created_at', threshold.toISOString());

        if (error) throw error;

        // Aggregate by provider
        const stats: Record<string, any> = {};

        for (const log of logs || []) {
            if (!stats[log.provider]) {
                stats[log.provider] = {
                    provider: log.provider,
                    totalCalls: 0,
                    successfulCalls: 0,
                    failedCalls: 0,
                    totalDuration: 0,
                    totalTokens: 0,
                    operations: {} as Record<string, number>,
                    models: {} as Record<string, number>,
                    errors: [] as string[],
                };
            }

            const s = stats[log.provider];
            s.totalCalls++;
            if (log.success) s.successfulCalls++;
            else {
                s.failedCalls++;
                if (log.error_message && s.errors.length < 5) {
                    s.errors.push(log.error_message);
                }
            }

            if (log.duration_ms) s.totalDuration += log.duration_ms;
            if (log.tokens_used) s.totalTokens += log.tokens_used;

            s.operations[log.operation] = (s.operations[log.operation] || 0) + 1;
            s.models[log.model] = (s.models[log.model] || 0) + 1;
        }

        // Calculate averages and format
        const formattedStats = Object.values(stats).map(s => ({
            ...s,
            avgDuration: s.totalCalls > 0 ? Math.round(s.totalDuration / s.totalCalls) : 0,
            successRate: s.totalCalls > 0 ? Math.round((s.successfulCalls / s.totalCalls) * 100) : 0,
            avgTokens: s.totalCalls > 0 ? Math.round(s.totalTokens / s.totalCalls) : 0,
        }));

        return new Response(JSON.stringify({
            success: true,
            timeRange,
            stats: formattedStats,
            totalCalls: logs?.length || 0,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error in llm-stats:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
