import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TopicStat {
  topic: string;
  count: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const ssrEndpoint = `${supabaseUrl}/functions/v1/ssr-render`;
    const startTime = Date.now();

    // Step 1: Cache /topics catalog page
    console.log('[cache-topics-cron] Pre-warming /topics catalog...');
    try {
      const catalogResponse = await fetch(`${ssrEndpoint}?path=/topics&lang=en&cache=true`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      if (catalogResponse.ok) {
        console.log(`[cache-topics-cron] Cached /topics (${catalogResponse.status})`);
      } else {
        console.error(`[cache-topics-cron] Failed to cache /topics: ${catalogResponse.status}`);
      }
    } catch (e) {
      console.error('[cache-topics-cron] Error caching /topics:', e);
    }

    // Step 2: Get top 30 topics and cache their pages
    const { data: topTopics, error: topicsError } = await supabase
      .rpc('get_trending_topics', { item_limit: 30 });

    if (topicsError) {
      console.error('[cache-topics-cron] Failed to fetch topics:', topicsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch topics', details: topicsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const topics = (topTopics || []) as TopicStat[];
    console.log(`[cache-topics-cron] Found ${topics.length} topics to cache`);

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Cache top topics in parallel batches of 5 to avoid overwhelming the system
    const BATCH_SIZE = 5;
    for (let i = 0; i < topics.length; i += BATCH_SIZE) {
      const batch = topics.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async ({ topic }) => {
        try {
          const topicSlug = encodeURIComponent(topic);
          const topicPath = `/topics/${topicSlug}`;
          
          const response = await fetch(`${ssrEndpoint}?path=${encodeURIComponent(topicPath)}&lang=en&cache=true`, {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
          });

          if (response.ok) {
            successCount++;
            console.log(`[cache-topics-cron] ✓ ${topicPath}`);
          } else {
            errorCount++;
            const errorMsg = `${topicPath}: ${response.status}`;
            errors.push(errorMsg);
            console.error(`[cache-topics-cron] ✗ ${errorMsg}`);
          }
        } catch (e) {
          errorCount++;
          const errorMsg = `${topic}: ${e instanceof Error ? e.message : String(e)}`;
          errors.push(errorMsg);
          console.error(`[cache-topics-cron] Error caching topic:`, errorMsg);
        }
      });

      await Promise.all(batchPromises);
      
      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < topics.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    const duration = Date.now() - startTime;
    const result = {
      success: true,
      cached_catalog: true,
      total_topics: topics.length,
      success_count: successCount,
      error_count: errorCount,
      duration_ms: duration,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Only first 10 errors
    };

    console.log(`[cache-topics-cron] Completed: ${successCount} success, ${errorCount} errors in ${(duration / 1000).toFixed(1)}s`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[cache-topics-cron] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal error', 
        message: error instanceof Error ? error.message : String(error) 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
