import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const password = url.searchParams.get('password');
    const adminPassword = Deno.env.get('ADMIN_PASSWORD');

    if (!password || password !== adminPassword) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const countryFilter = url.searchParams.get('country'); // e.g. "US", "UA"
    const PAGE_SIZE = 500;
    let allRows: any[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('news_rss_items')
        .select('id, title, title_en, slug, published_at, country_id, url, image_url, content, content_en, content_hi, content_ta, content_te, content_bn, description, description_en, key_points, key_points_en, themes, themes_en, keywords')
        .or('content.not.is.null,content_en.not.is.null')
        .order('published_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (countryFilter) {
        query = query.eq('country_id', countryFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Query error:', error.message);
        break;
      }

      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        // Filter: only items with substantial retelling
        const filtered = data.filter((item: any) => {
          const hasContent = item.content && item.content.length > 300;
          const hasContentEn = item.content_en && item.content_en.length > 300;
          return hasContent || hasContentEn;
        });
        allRows = allRows.concat(filtered);
        offset += PAGE_SIZE;
        hasMore = data.length === PAGE_SIZE;
      }
    }

    const exportData = {
      exported_at: new Date().toISOString(),
      total_news: allRows.length,
      filter: countryFilter || 'all',
      news: allRows,
    };

    const json = JSON.stringify(exportData, null, 2);

    return new Response(json, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="retold_news_backup_${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error) {
    console.error('Backup error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
