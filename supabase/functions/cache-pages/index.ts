import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-password',
};

const BASE_URL = 'https://echoes2.com';
const SSR_ENDPOINT = Deno.env.get('SUPABASE_URL') + '/functions/v1/ssr-render';

// Get all pages based on filter type
async function getAllPagesToCache(
  supabase: any, 
  filter?: 'all' | 'recent-24h' | 'news-7d'
): Promise<string[]> {
  const pages: string[] = [];
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Static pages (only for 'all' or 'recent-24h')
  if (filter !== 'news-7d') {
    pages.push('/', '/news', '/chapters', '/volumes', '/calendar', '/sitemap');
  }

  // Add country news pages
  const { data: countries } = await supabase
    .from('news_countries')
    .select('code')
    .eq('is_active', true);

  if (countries && filter !== 'news-7d') {
    for (const country of countries) {
      pages.push(`/news/${country.code}`);
    }
  }

  // Add news articles based on filter
  if (filter === 'news-7d') {
    // Only news from last 7 days
    const { data: newsItems } = await supabase
      .from('news_rss_items')
      .select('slug, country_id, news_countries!inner(code)')
      .eq('is_archived', false)
      .not('slug', 'is', null)
      .gte('published_at', sevenDaysAgo.toISOString())
      .order('published_at', { ascending: false });

    if (newsItems) {
      for (const item of newsItems) {
        if (item.slug && item.news_countries?.code) {
          pages.push(`/news/${item.news_countries.code}/${item.slug}`);
        }
      }
    }
  } else if (filter === 'recent-24h') {
    // Only pages updated in last 24 hours
    const { data: recentPages } = await supabase
      .from('cached_pages')
      .select('path')
      .gte('updated_at', oneDayAgo.toISOString());

    if (recentPages) {
      for (const p of recentPages) {
        if (!pages.includes(p.path)) {
          pages.push(p.path);
        }
      }
    }

    // Also add news from last 24 hours
    const { data: newsItems } = await supabase
      .from('news_rss_items')
      .select('slug, country_id, news_countries!inner(code)')
      .eq('is_archived', false)
      .not('slug', 'is', null)
      .gte('published_at', oneDayAgo.toISOString())
      .order('published_at', { ascending: false });

    if (newsItems) {
      for (const item of newsItems) {
        if (item.slug && item.news_countries?.code) {
          const path = `/news/${item.news_countries.code}/${item.slug}`;
          if (!pages.includes(path)) {
            pages.push(path);
          }
        }
      }
    }
  } else {
    // ALL news articles (not archived, with slug) - no limit!
    const { data: newsItems } = await supabase
      .from('news_rss_items')
      .select('slug, country_id, news_countries!inner(code)')
      .eq('is_archived', false)
      .not('slug', 'is', null)
      .order('published_at', { ascending: false });

    if (newsItems) {
      console.log(`Found ${newsItems.length} news articles to cache`);
      for (const item of newsItems) {
        if (item.slug && item.news_countries?.code) {
          pages.push(`/news/${item.news_countries.code}/${item.slug}`);
        }
      }
    }
  }

  // Add stories based on filter
  if (filter !== 'news-7d') {
    if (filter === 'recent-24h') {
      // Only stories from last 24 hours
      const { data: stories } = await supabase
        .from('parts')
        .select('date, number')
        .eq('status', 'published')
        .gte('published_at', oneDayAgo.toISOString())
        .order('date', { ascending: false });

      if (stories) {
        for (const story of stories) {
          const path = `/read/${story.date}/${story.number}`;
          if (!pages.includes(path)) {
            pages.push(path);
          }
        }
      }
    } else {
      // ALL published stories - no limit!
      const { data: stories } = await supabase
        .from('parts')
        .select('date, number')
        .eq('status', 'published')
        .order('date', { ascending: false });

      if (stories) {
        console.log(`Found ${stories.length} stories to cache`);
        for (const story of stories) {
          pages.push(`/read/${story.date}/${story.number}`);
        }
      }
    }
  }

  // Add all chapters (they don't change often)
  if (filter !== 'news-7d' && filter !== 'recent-24h') {
    const { data: chapters } = await supabase
      .from('chapters')
      .select('number')
      .order('number', { ascending: false });

    if (chapters) {
      console.log(`Found ${chapters.length} chapters to cache`);
      for (const chapter of chapters) {
        pages.push(`/chapter/${chapter.number}`);
      }
    }
  }

  // Add all volumes
  if (filter !== 'news-7d' && filter !== 'recent-24h') {
    const { data: volumes } = await supabase
      .from('volumes')
      .select('year, month')
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (volumes) {
      console.log(`Found ${volumes.length} volumes to cache`);
      for (const volume of volumes) {
        const monthStr = String(volume.month).padStart(2, '0');
        pages.push(`/volume/${volume.year}-${monthStr}`);
      }
    }
  }

  // Add date stories pages (unique dates)
  if (filter !== 'news-7d' && filter !== 'recent-24h') {
    const { data: dates } = await supabase
      .from('parts')
      .select('date')
      .eq('status', 'published')
      .order('date', { ascending: false });

    if (dates) {
      const uniqueDates = [...new Set(dates.map((d: { date: string }) => d.date))];
      console.log(`Found ${uniqueDates.length} unique dates to cache`);
      for (const date of uniqueDates) {
        pages.push(`/read/${date}`);
      }
    }
  }

  console.log(`Total pages to cache: ${pages.length}`);
  return pages;
}

async function generateAndCachePage(
  supabase: any,
  path: string,
  serviceKey: string
): Promise<{ success: boolean; error?: string; timeMs?: number }> {
  const startTime = Date.now();

  try {
    // Call ssr-render to generate HTML
    const ssrUrl = `${SSR_ENDPOINT}?path=${encodeURIComponent(path)}&lang=en`;
    
    const response = await fetch(ssrUrl, {
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Accept': 'text/html',
      },
    });

    if (!response.ok) {
      return { success: false, error: `SSR returned ${response.status}` };
    }

    const html = await response.text();
    const timeMs = Date.now() - startTime;

    // Extract title and description from HTML
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    const descMatch = html.match(/<meta name="description" content="([^"]+)"/);
    const canonicalMatch = html.match(/<link rel="canonical" href="([^"]+)"/);

    const title = titleMatch ? titleMatch[1] : null;
    const description = descMatch ? descMatch[1] : null;
    const canonical = canonicalMatch ? canonicalMatch[1] : `${BASE_URL}${path}`;

    // Upsert to cached_pages
    const { error } = await supabase
      .from('cached_pages')
      .upsert({
        path,
        html,
        title,
        description,
        canonical_url: canonical,
        generation_time_ms: timeMs,
        html_size_bytes: new TextEncoder().encode(html).length,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'path',
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, timeMs };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMessage };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'refresh-all';
  const specificPath = url.searchParams.get('path');
  const password = url.searchParams.get('password') || req.headers.get('x-admin-password');

  // Verify admin password
  const adminPassword = Deno.env.get('ADMIN_PASSWORD');
  if (password !== adminPassword) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    if (action === 'refresh-single' && specificPath) {
      // Refresh a single page
      const result = await generateAndCachePage(supabase, specificPath, serviceKey);
      
      return new Response(JSON.stringify({
        action: 'refresh-single',
        path: specificPath,
        ...result,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'refresh-all' || action === 'refresh-recent' || action === 'refresh-news') {
      // Determine filter type
      let filter: 'all' | 'recent-24h' | 'news-7d' = 'all';
      if (action === 'refresh-recent') filter = 'recent-24h';
      if (action === 'refresh-news') filter = 'news-7d';

      // Refresh pages based on filter
      const pages = await getAllPagesToCache(supabase, filter);
      const results: { path: string; success: boolean; timeMs?: number; error?: string }[] = [];

      console.log(`Starting cache refresh (${filter}) for ${pages.length} pages...`);

      for (const path of pages) {
        const result = await generateAndCachePage(supabase, path, serviceKey);
        results.push({ path, ...result });
        console.log(`Cached ${path}: ${result.success ? 'OK' : result.error}`);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      return new Response(JSON.stringify({
        action,
        filter,
        total: pages.length,
        successful,
        failed,
        results,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'clear-expired') {
      // Clear expired cache entries
      const { data, error } = await supabase
        .from('cached_pages')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select('path');

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        action: 'clear-expired',
        deleted: data?.length || 0,
        paths: data?.map(d => d.path) || [],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'stats') {
      // Get cache statistics
      const { data: pages, error } = await supabase
        .from('cached_pages')
        .select('path, title, updated_at, expires_at, generation_time_ms, html_size_bytes')
        .order('updated_at', { ascending: false });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const totalSize = pages?.reduce((sum, p) => sum + (p.html_size_bytes || 0), 0) || 0;
      const avgTime = pages?.length 
        ? pages.reduce((sum, p) => sum + (p.generation_time_ms || 0), 0) / pages.length 
        : 0;

      return new Response(JSON.stringify({
        action: 'stats',
        totalPages: pages?.length || 0,
        totalSizeBytes: totalSize,
        totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
        avgGenerationTimeMs: Math.round(avgTime),
        pages: pages?.map(p => ({
          path: p.path,
          title: p.title,
          updatedAt: p.updated_at,
          expiresAt: p.expires_at,
          sizeKB: ((p.html_size_bytes || 0) / 1024).toFixed(1),
        })),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      error: 'Invalid action',
      validActions: ['refresh-all', 'refresh-single', 'refresh-recent', 'refresh-news', 'clear-expired', 'stats'],
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Cache pages error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
