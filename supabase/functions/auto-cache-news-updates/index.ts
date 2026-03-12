import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { refreshNewsCache } from '../_shared/news-cache-utils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NewsUpdateRequest {
  old_record?: any;
  record: any;
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { old_record, record, type, table }: NewsUpdateRequest = await req.json();
    
    if (table !== 'news_rss_items' || type !== 'UPDATE') {
      return new Response('Not applicable', { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const newsId = record.id;
    console.log(`News update detected for ID: ${newsId}`);

    // Check if analysis-related fields were updated
    const analysisFieldsUpdated = checkAnalysisFieldsUpdated(old_record, record);
    
    if (analysisFieldsUpdated.length > 0) {
      console.log(`Analysis fields updated: ${analysisFieldsUpdated.join(', ')}`);
      
      // Refresh cache automatically
      await refreshNewsCache({
        newsId,
        reason: `fields_updated:${analysisFieldsUpdated.join(',')}`
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          cache_refreshed: true,
          updated_fields: analysisFieldsUpdated,
          message: `Cache refreshed for news ID ${newsId}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        cache_refreshed: false,
        message: 'No analysis fields updated, cache refresh not needed' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in auto-cache-news-updates:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

/**
 * Check which analysis-related fields were updated
 */
function checkAnalysisFieldsUpdated(oldRecord: any, newRecord: any): string[] {
  const fieldsToCheck = [
    'news_analysis',
    'key_points',
    'themes', 
    'keywords',
    'entities'
  ];

  const updatedFields: string[] = [];

  for (const field of fieldsToCheck) {
    const oldValue = JSON.stringify(oldRecord?.[field] || null);
    const newValue = JSON.stringify(newRecord?.[field] || null);
    
    if (oldValue !== newValue) {
      updatedFields.push(field);
      
      // Log specific changes for debugging
      if (field === 'news_analysis') {
        const oldAnalysis = oldRecord?.[field] || {};
        const newAnalysis = newRecord?.[field] || {};
        
        const analyticalBlocks = [
          'key_takeaways',
          'why_it_matters', 
          'context_background',
          'what_happens_next',
          'faq',
          'mentioned_entities',
          'source'
        ];

        const changedBlocks = analyticalBlocks.filter(block => 
          JSON.stringify(oldAnalysis[block]) !== JSON.stringify(newAnalysis[block])
        );

        if (changedBlocks.length > 0) {
          console.log(`News analysis blocks updated: ${changedBlocks.join(', ')}`);
        }
      }
    }
  }

  return updatedFields;
}