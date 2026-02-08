import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-password, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BASE_URL = 'https://echoes2.com';
const SSR_ENDPOINT = Deno.env.get('SUPABASE_URL') + '/functions/v1/ssr-render';

// Helper to fetch all rows with pagination (bypasses 1000 row limit)
async function fetchAllRows<T>(
  supabase: any,
  tableName: string,
  selectQuery: string,
  filters: { column: string; op: string; value: any }[] = [],
  orderBy?: { column: string; ascending: boolean }
): Promise<T[]> {
  const PAGE_SIZE = 1000;
  let allRows: T[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase.from(tableName).select(selectQuery);
    
    for (const filter of filters) {
      if (filter.op === 'eq') query = query.eq(filter.column, filter.value);
      else if (filter.op === 'neq') query = query.neq(filter.column, filter.value);
      else if (filter.op === 'gte') query = query.gte(filter.column, filter.value);
      else if (filter.op === 'is.null') query = query.is(filter.column, null);
      else if (filter.op === 'not.is.null') query = query.not(filter.column, 'is', null);
    }
    
    if (orderBy) {
      query = query.order(orderBy.column, { ascending: orderBy.ascending });
    }
    
    query = query.range(offset, offset + PAGE_SIZE - 1);
    
    const { data, error } = await query;
    
    if (error) {
      console.error(`Error fetching ${tableName}:`, error);
      break;
    }
    
    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allRows = allRows.concat(data);
      offset += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    }
  }
  
  console.log(`Fetched ${allRows.length} rows from ${tableName}`);
  return allRows;
}

// Fetch all news items with country codes using pagination
async function fetchAllNewsWithCountry(supabase: any): Promise<{ slug: string; countryCode: string }[]> {
  const PAGE_SIZE = 1000;
  const results: { slug: string; countryCode: string }[] = [];
  
  // First get country mapping
  const { data: countries } = await supabase
    .from('news_countries')
    .select('id, code')
    .eq('is_active', true);
  
  const countryMap = new Map<string, string>();
  for (const c of countries || []) {
    countryMap.set(c.id, c.code);
  }
  
  // Fetch all news with pagination
  let offset = 0;
  let hasMore = true;
  
  while (hasMore) {
    const { data, error } = await supabase
      .from('news_rss_items')
      .select('slug, country_id')
      .eq('is_archived', false)
      .not('slug', 'is', null)
      .order('published_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    
    if (error || !data || data.length === 0) {
      hasMore = false;
    } else {
      for (const item of data) {
        const countryCode = countryMap.get(item.country_id);
        if (countryCode && item.slug) {
          results.push({ slug: item.slug, countryCode });
        }
      }
      offset += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    }
  }
  
  return results;
}

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
    pages.push('/', '/news', '/chapters', '/volumes', '/calendar', '/sitemap', '/wiki');
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
    const { data: newsItems7d } = await supabase
      .from('news_rss_items')
      .select('slug, country_id, news_countries!inner(code)')
      .eq('is_archived', false)
      .not('slug', 'is', null)
      .gte('published_at', sevenDaysAgo.toISOString())
      .order('published_at', { ascending: false });

    if (newsItems7d) {
      for (const item of newsItems7d) {
        if (item.slug && item.news_countries?.code) {
          pages.push(`/news/${item.news_countries.code}/${item.slug}`);
        }
      }
    }
  } else if (filter === 'recent-24h') {
    // IMPORTANT:
    // Do NOT derive "recent" from cached_pages.updated_at.
    // After a full refresh it would include almost everything and make this action time out.

    // Add news from last 24 hours
    const { data: newsItems24h } = await supabase
      .from('news_rss_items')
      .select('slug, country_id, news_countries!inner(code)')
      .eq('is_archived', false)
      .not('slug', 'is', null)
      .gte('published_at', oneDayAgo.toISOString())
      .order('published_at', { ascending: false });

    if (newsItems24h) {
      for (const item of newsItems24h) {
        if (item.slug && item.news_countries?.code) {
          const path = `/news/${item.news_countries.code}/${item.slug}`;
          if (!pages.includes(path)) {
            pages.push(path);
          }
        }
      }
    }

    // Add stories published in last 24 hours (including date index routes)
    const { data: stories } = await supabase
      .from('parts')
      .select('date, number')
      .eq('status', 'published')
      .gte('published_at', oneDayAgo.toISOString())
      .order('date', { ascending: false });

    if (stories) {
      const dates = new Set<string>();
      for (const story of stories) {
        const storyPath = `/read/${story.date}/${story.number}`;
        if (!pages.includes(storyPath)) pages.push(storyPath);
        dates.add(story.date);
      }
      for (const date of dates) {
        const readDatePath = `/read/${date}`;
        const datePath = `/date/${date}`;
        if (!pages.includes(readDatePath)) pages.push(readDatePath);
        if (!pages.includes(datePath)) pages.push(datePath);
      }
    }
  } else {
    // ALL news articles (not archived, with slug) - with pagination to get ALL
    const allNewsItems = await fetchAllNewsWithCountry(supabase);

    console.log(`Found ${allNewsItems.length} news articles to cache`);
    for (const item of allNewsItems) {
      if (item.slug && item.countryCode) {
        pages.push(`/news/${item.countryCode}/${item.slug}`);
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
        // Both routes exist in the SPA; cache both so bots/tools can index either URL.
        pages.push(`/read/${date}`);
        pages.push(`/date/${date}`);
      }
    }
  }

  // Add wiki entity pages (top 100 by search count)
  if (filter !== 'news-7d' && filter !== 'recent-24h') {
    const { data: wikiEntities } = await supabase
      .from('wiki_entities')
      .select('id')
      .order('search_count', { ascending: false })
      .limit(100);

    if (wikiEntities) {
      console.log(`Found ${wikiEntities.length} wiki entities to cache`);
      for (const entity of wikiEntities) {
        pages.push(`/wiki/${entity.id}`);
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

// Process pages in batches with concurrency control
async function processPagesInBatches(
  supabase: any,
  pages: string[],
  serviceKey: string,
  concurrency: number = 5
): Promise<{ path: string; success: boolean; timeMs?: number; error?: string }[]> {
  const results: { path: string; success: boolean; timeMs?: number; error?: string }[] = [];
  
  for (let i = 0; i < pages.length; i += concurrency) {
    const batch = pages.slice(i, i + concurrency);
    const batchPromises = batch.map(async (path) => {
      const result = await generateAndCachePage(supabase, path, serviceKey);
      console.log(`[${i + batch.indexOf(path) + 1}/${pages.length}] ${path}: ${result.success ? 'OK' : result.error}`);
      return { path, ...result };
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }
  
  return results;
}

// Store job status in database
async function updateJobStatus(
  supabase: any, 
  jobId: string, 
  status: 'running' | 'completed' | 'failed',
  data: object
) {
  // Use a simple in-memory approach since we don't have a jobs table
  // The frontend will poll for results
  console.log(`Job ${jobId}: ${status}`, JSON.stringify(data));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'refresh-all';
  const specificPath = url.searchParams.get('path');
  const password = url.searchParams.get('password') || req.headers.get('x-admin-password');
  const batchSize = parseInt(url.searchParams.get('batchSize') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const async = url.searchParams.get('async') === 'true';

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

    // New batch-aware refresh actions
    if (action === 'refresh-all' || action === 'refresh-recent' || action === 'refresh-news') {
      // Determine filter type
      let filter: 'all' | 'recent-24h' | 'news-7d' = 'all';
      if (action === 'refresh-recent') filter = 'recent-24h';
      if (action === 'refresh-news') filter = 'news-7d';

      // Get all pages to cache
      const allPages = await getAllPagesToCache(supabase, filter);
      const totalPages = allPages.length;
      
      // If requesting batch info only
      if (url.searchParams.get('info') === 'true') {
        return new Response(JSON.stringify({
          action,
          filter,
          totalPages,
          recommendedBatches: Math.ceil(totalPages / 50),
          batchSize: 50,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get batch of pages
      const pagesToProcess = allPages.slice(offset, offset + batchSize);
      
      if (pagesToProcess.length === 0) {
        return new Response(JSON.stringify({
          action,
          filter,
          total: totalPages,
          processed: offset,
          batchSize: 0,
          hasMore: false,
          successful: 0,
          failed: 0,
          results: [],
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Processing batch: offset=${offset}, size=${pagesToProcess.length}, total=${totalPages}`);

      // Process batch with concurrency
      const results = await processPagesInBatches(supabase, pagesToProcess, serviceKey, 5);

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      const hasMore = offset + batchSize < totalPages;
      const nextOffset = hasMore ? offset + batchSize : null;

      return new Response(JSON.stringify({
        action,
        filter,
        total: totalPages,
        processed: Math.min(offset + batchSize, totalPages),
        batchStart: offset,
        batchSize: pagesToProcess.length,
        hasMore,
        nextOffset,
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
      // Get cache statistics with pagination to bypass 1000 row limit
      const allPages = await fetchAllRows<{
        path: string;
        title: string | null;
        updated_at: string;
        expires_at: string;
        generation_time_ms: number | null;
        html_size_bytes: number | null;
      }>(
        supabase,
        'cached_pages',
        'path, title, updated_at, expires_at, generation_time_ms, html_size_bytes',
        [],
        { column: 'updated_at', ascending: false }
      );

      const totalSize = allPages.reduce((sum, p) => sum + (p.html_size_bytes || 0), 0);
      const avgTime = allPages.length 
        ? allPages.reduce((sum, p) => sum + (p.generation_time_ms || 0), 0) / allPages.length 
        : 0;

      // Return only recent 1000 pages for the list to avoid huge response, but show accurate totals
      const recentPages = allPages.slice(0, 1000);

      return new Response(JSON.stringify({
        action: 'stats',
        totalPages: allPages.length,
        totalSizeBytes: totalSize,
        totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
        avgGenerationTimeMs: Math.round(avgTime),
        pages: recentPages.map(p => ({
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
