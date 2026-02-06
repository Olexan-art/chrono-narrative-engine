import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// IMPORTANT: use the configured backend secret - no fallback for security
const ADMIN_PASSWORD = Deno.env.get('ADMIN_PASSWORD');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify ADMIN_PASSWORD is configured
    if (!ADMIN_PASSWORD) {
      console.error('ADMIN_PASSWORD environment variable not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { action, password, data } = await req.json();

    // Get settings
    const { data: settings } = await supabase
      .from('settings')
      .select('news_archive_days, news_auto_archive_enabled')
      .limit(1)
      .single();

    const archiveDays = settings?.news_archive_days || 14;
    const autoArchiveEnabled = settings?.news_auto_archive_enabled ?? true;

    switch (action) {
      case 'get_stats': {
        // Get archive statistics
        const { count: totalNews } = await supabase
          .from('news_rss_items')
          .select('*', { count: 'exact', head: true });

        const { count: archivedNews } = await supabase
          .from('news_rss_items')
          .select('*', { count: 'exact', head: true })
          .eq('is_archived', true);

        const { count: activeNews } = await supabase
          .from('news_rss_items')
          .select('*', { count: 'exact', head: true })
          .eq('is_archived', false);

        // Count items eligible for archiving (older than archiveDays)
        const archiveDate = new Date();
        archiveDate.setDate(archiveDate.getDate() - archiveDays);
        
        const { count: eligibleForArchive } = await supabase
          .from('news_rss_items')
          .select('*', { count: 'exact', head: true })
          .eq('is_archived', false)
          .lt('fetched_at', archiveDate.toISOString());

        return new Response(
          JSON.stringify({
            success: true,
            stats: {
              totalNews: totalNews || 0,
              archivedNews: archivedNews || 0,
              activeNews: activeNews || 0,
              eligibleForArchive: eligibleForArchive || 0,
              archiveDays,
              autoArchiveEnabled
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'run_archive': {
        // Verify password
        if (password !== ADMIN_PASSWORD) {
          return new Response(
            JSON.stringify({ error: 'Невірний пароль' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const archiveDate = new Date();
        archiveDate.setDate(archiveDate.getDate() - archiveDays);

        // Archive old items
        const { data: archivedItems, error } = await supabase
          .from('news_rss_items')
          .update({ 
            is_archived: true, 
            archived_at: new Date().toISOString() 
          })
          .eq('is_archived', false)
          .lt('fetched_at', archiveDate.toISOString())
          .select('id');

        if (error) throw error;

        return new Response(
          JSON.stringify({
            success: true,
            archivedCount: archivedItems?.length || 0
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'unarchive': {
        // Verify password
        if (password !== ADMIN_PASSWORD) {
          return new Response(
            JSON.stringify({ error: 'Невірний пароль' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { newsIds } = data || {};
        if (!newsIds || !Array.isArray(newsIds)) {
          return new Response(
            JSON.stringify({ error: 'newsIds is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error } = await supabase
          .from('news_rss_items')
          .update({ 
            is_archived: false, 
            archived_at: null 
          })
          .in('id', newsIds);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'archive_items': {
        // Verify password
        if (password !== ADMIN_PASSWORD) {
          return new Response(
            JSON.stringify({ error: 'Невірний пароль' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { newsIds } = data || {};
        if (!newsIds || !Array.isArray(newsIds)) {
          return new Response(
            JSON.stringify({ error: 'newsIds is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error } = await supabase
          .from('news_rss_items')
          .update({ 
            is_archived: true, 
            archived_at: new Date().toISOString() 
          })
          .in('id', newsIds);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_settings': {
        // Verify password
        if (password !== ADMIN_PASSWORD) {
          return new Response(
            JSON.stringify({ error: 'Невірний пароль' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { archiveDays: newArchiveDays, autoArchiveEnabled: newAutoArchive } = data || {};

        const updateData: Record<string, unknown> = {};
        if (typeof newArchiveDays === 'number') {
          updateData.news_archive_days = newArchiveDays;
        }
        if (typeof newAutoArchive === 'boolean') {
          updateData.news_auto_archive_enabled = newAutoArchive;
        }

        const { error } = await supabase
          .from('settings')
          .update(updateData)
          .not('id', 'is', null);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_archived': {
        // Get archived news with pagination
        const { page = 0, limit = 20, countryId } = data || {};
        
        let query = supabase
          .from('news_rss_items')
          .select(`
            id,
            title,
            slug,
            image_url,
            category,
            fetched_at,
            archived_at,
            country_id,
            news_countries!inner(code, name, flag)
          `)
          .eq('is_archived', true)
          .order('archived_at', { ascending: false })
          .range(page * limit, (page + 1) * limit - 1);

        if (countryId) {
          query = query.eq('country_id', countryId);
        }

        const { data: archivedNews, error } = await query;
        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, news: archivedNews }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Archive error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
