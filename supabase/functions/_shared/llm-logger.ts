import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

interface LogParams {
    supabase: SupabaseClient;
    provider: string;
    model: string;
    operation: string;
    tokens_used?: number;
    duration_ms: number;
    success: boolean;
    error_message?: string;
    metadata?: any;
}

export async function logLlmUsage({
    supabase,
    provider,
    model,
    operation,
    tokens_used,
    duration_ms,
    success,
    error_message,
    metadata
}: LogParams) {
    try {
        // Run content insert in background to not block response
        // But since Edge Functions are ephemeral, we should await it if runtime allows, 
        // or use EdgeRuntime.waitUntil if available (Cloudflare specific, but Deno Deploy handles promises differently).
        // Safest is to await it, as insert is fast.
        const { error } = await supabase.from('llm_usage_logs').insert({
            provider,
            model,
            operation,
            tokens_used,
            duration_ms: Math.round(duration_ms),
            success,
            error_message: error_message ? error_message.substring(0, 1000) : null,
            metadata
        });

        if (error) {
            console.error('Failed to log LLM usage:', error);
        }
    } catch (err) {
        console.error('Exception logging LLM usage:', err);
    }
}
