import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/xml; charset=utf-8",
};

const BASE_URL = "https://echoes2.com";
const CACHE_TTL_HOURS = 6; // Cache sitemap for 6 hours

// Helper to add hreflang links for multilingual pages
function addHreflangLinks(url: string): string {
  return `
    <xhtml:link rel="alternate" hreflang="uk" href="${url}" />
    <xhtml:link rel="alternate" hreflang="en" href="${url}" />
    <xhtml:link rel="alternate" hreflang="pl" href="${url}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${url}" />`;
}

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

// Check cached sitemap
async function getCachedSitemap(supabase: any, cachePath: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("cached_pages")
    .select("html, expires_at")
    .eq("path", cachePath)
    .single();

  if (error || !data) return null;
  
  // Check if cache is still valid
  if (new Date(data.expires_at) > new Date()) {
    console.log(`Cache HIT for sitemap: ${cachePath}`);
    return data.html;
  }
  
  console.log(`Cache EXPIRED for sitemap: ${cachePath}`);
  return null;
}

// Save sitemap to cache
async function cacheSitemap(supabase: any, cachePath: string, xml: string): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL_HOURS * 60 * 60 * 1000);
  
  await supabase
    .from("cached_pages")
    .upsert({
      path: cachePath,
      html: xml,
      title: `Sitemap: ${cachePath}`,
      description: `XML Sitemap for ${BASE_URL}`,
      canonical_url: `${BASE_URL}${cachePath}`,
      expires_at: expiresAt.toISOString(),
      updated_at: now.toISOString(),
      html_size_bytes: new TextEncoder().encode(xml).length,
    }, { onConflict: 'path' });
  
  console.log(`Cached sitemap: ${cachePath}, expires: ${expiresAt.toISOString()}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const forceRefresh = url.searchParams.get("refresh") === "true";
    const cachePath = "/api/sitemap";

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cachedXml = await getCachedSitemap(supabase, cachePath);
      if (cachedXml) {
        return new Response(cachedXml, { 
          headers: {
            ...corsHeaders,
            "X-Cache": "HIT",
            "Cache-Control": "public, max-age=21600", // 6 hours
          },
          status: 200 
        });
      }
    }

    // Generate fresh sitemap
    const startTime = Date.now();

    // Fetch all published parts
    const { data: parts, error: partsError } = await supabase
      .from("parts")
      .select("date, updated_at, title")
      .eq("status", "published")
      .order("date", { ascending: false });

    if (partsError) throw partsError;

    // Fetch all chapters
    const { data: chapters, error: chaptersError } = await supabase
      .from("chapters")
      .select("id, number, updated_at, title")
      .order("created_at", { ascending: false });

    if (chaptersError) throw chaptersError;

    // Fetch all volumes
    const { data: volumes, error: volumesError } = await supabase
      .from("volumes")
      .select("id, year, month, updated_at, title")
      .order("created_at", { ascending: false });

    if (volumesError) throw volumesError;

    // Fetch news countries and items for sitemap
    const { data: newsCountries, error: countriesError } = await supabase
      .from("news_countries")
      .select("id, code, name")
      .eq("is_active", true);

    if (countriesError) throw countriesError;

    // Fetch ALL news items with slugs using pagination
    const newsItems = await fetchAllRows<{ id: string; slug: string; country_id: string; fetched_at: string }>(
      supabase,
      'news_rss_items',
      'id, slug, country_id, fetched_at',
      [{ column: 'slug', op: 'not.is.null', value: null }],
      { column: 'fetched_at', ascending: false }
    );

    // Group parts by date to count stories per day and get latest update
    const partsByDate = new Map<string, { count: number; updated_at: string }>();
    for (const part of parts || []) {
      const existing = partsByDate.get(part.date);
      if (existing) {
        existing.count++;
        if (part.updated_at > existing.updated_at) {
          existing.updated_at = part.updated_at;
        }
      } else {
        partsByDate.set(part.date, { count: 1, updated_at: part.updated_at });
      }
    }

    // Map country IDs to codes
    const countryCodeMap = new Map<string, string>();
    for (const country of newsCountries || []) {
      countryCodeMap.set(country.id, country.code.toLowerCase());
    }

    // Build sitemap XML
    const now = new Date().toISOString();
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  
  <!-- Main Sitemap for ${BASE_URL} -->
  <!-- Generated: ${now} -->
  <!-- Cache TTL: ${CACHE_TTL_HOURS} hours -->
  
  <!-- Static pages -->
  <url>
    <loc>${BASE_URL}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>${addHreflangLinks(`${BASE_URL}/`)}
  </url>
  
  <url>
    <loc>${BASE_URL}/calendar</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>${addHreflangLinks(`${BASE_URL}/calendar`)}
  </url>
  
  <url>
    <loc>${BASE_URL}/chapters</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>${addHreflangLinks(`${BASE_URL}/chapters`)}
  </url>
  
  <url>
    <loc>${BASE_URL}/volumes</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>${addHreflangLinks(`${BASE_URL}/volumes`)}
  </url>
  
  <url>
    <loc>${BASE_URL}/news</loc>
    <lastmod>${now}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.8</priority>${addHreflangLinks(`${BASE_URL}/news`)}
  </url>
  
  <url>
    <loc>${BASE_URL}/sitemap</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>${addHreflangLinks(`${BASE_URL}/sitemap`)}
  </url>
`;

    // Add date listing pages (/date/:date) for each unique date with stories
    for (const [date, info] of partsByDate) {
      const url = `${BASE_URL}/date/${date}`;
      xml += `
  <url>
    <loc>${url}</loc>
    <lastmod>${info.updated_at || now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>${addHreflangLinks(url)}
  </url>`;
    }

    // Add individual story pages (/read/:date/:storyNumber)
    for (const [date, info] of partsByDate) {
      for (let i = 1; i <= info.count; i++) {
        const url = `${BASE_URL}/read/${date}/${i}`;
        xml += `
  <url>
    <loc>${url}</loc>
    <lastmod>${info.updated_at || now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>${addHreflangLinks(url)}
  </url>`;
      }
    }

    // Add chapter pages (friendly URLs using chapter number)
    for (const chapter of chapters || []) {
      const url = `${BASE_URL}/chapter/${chapter.number}`;
      xml += `
  <url>
    <loc>${url}</loc>
    <lastmod>${chapter.updated_at || now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>${addHreflangLinks(url)}
  </url>`;
    }

    // Add volume pages (friendly URLs using year-month)
    for (const volume of volumes || []) {
      const yearMonth = `${volume.year}-${String(volume.month).padStart(2, '0')}`;
      const url = `${BASE_URL}/volume/${yearMonth}`;
      xml += `
  <url>
    <loc>${url}</loc>
    <lastmod>${volume.updated_at || now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>${addHreflangLinks(url)}
  </url>`;
    }

    // Add country news hub pages (/news/:countryCode)
    for (const country of newsCountries || []) {
      const url = `${BASE_URL}/news/${country.code.toLowerCase()}`;
      xml += `
  <url>
    <loc>${url}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.7</priority>${addHreflangLinks(url)}
  </url>`;
    }

    // Add news article pages (/news/:country/:slug)
    for (const item of newsItems || []) {
      const countryCode = countryCodeMap.get(item.country_id);
      if (!countryCode || !item.slug) continue;
      
      const url = `${BASE_URL}/news/${countryCode}/${item.slug}`;
      xml += `
  <url>
    <loc>${url}</loc>
    <lastmod>${item.fetched_at || now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>${addHreflangLinks(url)}
  </url>`;
    }

    xml += `
</urlset>`;

    // Cache the generated sitemap
    await cacheSitemap(supabase, cachePath, xml);

    const generationTime = Date.now() - startTime;
    console.log(`Sitemap generated in ${generationTime}ms, ${newsItems.length + (parts?.length || 0)} URLs`);

    return new Response(xml, { 
      headers: {
        ...corsHeaders,
        "X-Cache": "MISS",
        "X-Generation-Time": `${generationTime}ms`,
        "Cache-Control": "public, max-age=21600",
      },
      status: 200 
    });

  } catch (error) {
    console.error("Sitemap generation error:", error);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${BASE_URL}/</loc>
    <priority>1.0</priority>
  </url>
</urlset>`,
      { headers: corsHeaders, status: 200 }
    );
  }
});
