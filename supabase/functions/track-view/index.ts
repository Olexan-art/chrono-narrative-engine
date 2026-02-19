import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { entityType, entityId } = body;
    // Prefer header 'x-visitor-id' for uniqueness tracking, fallback to body.visitor_id
    const visitorId = req.headers.get('x-visitor-id') || body?.visitor_id || null;

    if (!entityType || !entityId) {
      throw new Error('entityType and entityId are required');
    }

    if (!['part', 'chapter', 'volume', 'news', 'wiki'].includes(entityType)) {
      throw new Error('Invalid entityType');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Update or insert view count (include unique_visitors)
    const { data: existing } = await supabase
      .from('view_counts')
      .select('id, views, unique_visitors')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('view_counts')
        .update({ views: existing.views + 1 })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('view_counts')
        .insert({
          entity_type: entityType,
          entity_id: entityId,
          views: 1,
          unique_visitors: 0
        });
    }

    // Update or insert daily view
    const today = new Date().toISOString().split('T')[0];
    const { data: dailyExisting } = await supabase
      .from('daily_views')
      .select('id, views')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('view_date', today)
      .maybeSingle();

    if (dailyExisting) {
      await supabase
        .from('daily_views')
        .update({ views: dailyExisting.views + 1 })
        .eq('id', dailyExisting.id);
    } else {
      await supabase
        .from('daily_views')
        .insert({
          entity_type: entityType,
          entity_id: entityId,
          view_date: today,
          views: 1
        });
    }

    // Handle unique visitor tracking when visitorId is provided
    if (visitorId) {
      try {
        const { data: existingVisitor } = await supabase
          .from('view_visitors')
          .select('id')
          .eq('entity_type', entityType)
          .eq('entity_id', entityId)
          .eq('visitor_id', visitorId)
          .maybeSingle();

        if (!existingVisitor) {
          // Insert visitor record and increment unique_visitors
          await supabase
            .from('view_visitors')
            .insert({ entity_type: entityType, entity_id: entityId, visitor_id: visitorId });

          // Update unique_visitors counter (best-effort)
          await supabase
            .from('view_counts')
            .update({ unique_visitors: (existing?.unique_visitors || 0) + 1 })
            .eq('entity_type', entityType)
            .eq('entity_id', entityId);
        }
      } catch (err) {
        console.error('Unique visitor tracking failed:', err);
      }

    console.log(`Tracked view: ${entityType} ${entityId}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
