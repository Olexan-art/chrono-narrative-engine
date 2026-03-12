// Utility function to refresh news cache when analysis blocks are updated
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface CacheRefreshOptions {
  newsId: string;
  reason?: string;
}

/**
 * Refreshes cache for a news article when analysis blocks are updated
 */
export async function refreshNewsCache(options: CacheRefreshOptions): Promise<void> {
  const { newsId, reason = 'analysis_update' } = options;
  
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get news item info
    const { data: newsItem, error } = await supabase
      .from('news_rss_items')
      .select('slug, country:news_countries(code)')
      .eq('id', newsId)
      .single();

    if (error) {
      console.error('Error fetching news item for cache refresh:', error);
      return;
    }

    if (!newsItem?.slug || !(newsItem.country as any)?.code) {
      console.warn('News item missing slug or country code, skipping cache refresh');
      return;
    }

    const countryCode = (newsItem.country as any).code.toLowerCase();
    const newsPath = `/news/${countryCode}/${newsItem.slug}`;
    
    // Refresh cache
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const adminPass = Deno.env.get('ADMIN_PASSWORD') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const cacheUrl = `${supabaseUrl}/functions/v1/cache-pages?action=refresh-single&path=${encodeURIComponent(newsPath)}&password=${adminPass}`;
    
    const response = await fetch(cacheUrl, {
      headers: { 'Authorization': `Bearer ${serviceKey}` }
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Cache refreshed for ${newsPath} (reason: ${reason}):`, result.success ? 'OK' : result.error);
    } else {
      console.error(`❌ Failed to refresh cache for ${newsPath}: HTTP ${response.status}`);
    }

  } catch (error) {
    console.error('Error refreshing news cache:', error);
  }
}

/**
 * Check if news analysis blocks were updated and refresh cache if needed
 */
export function hasAnalysisblocksChanged(oldData: any, newData: any): boolean {
  const analysisFields = [
    'news_analysis',
    'key_points', 
    'themes',
    'keywords'
  ];

  for (const field of analysisFields) {
    const oldValue = JSON.stringify(oldData?.[field] || null);
    const newValue = JSON.stringify(newData?.[field] || null);
    
    if (oldValue !== newValue) {
      console.log(`Analysis field changed: ${field}`);
      return true;
    }
  }

  return false;
}