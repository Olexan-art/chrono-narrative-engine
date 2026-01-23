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
    const { entityType, entityId } = await req.json();

    if (!entityType || !entityId) {
      throw new Error('entityType and entityId are required');
    }

    if (!['part', 'chapter', 'volume'].includes(entityType)) {
      throw new Error('Invalid entityType');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Update or insert view count
    const { data: existing } = await supabase
      .from('view_counts')
      .select('id, views')
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
          views: 1
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
