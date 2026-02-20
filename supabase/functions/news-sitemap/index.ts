import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_URL = "https://bravennow.com";
const CACHE_TTL_HOURS = 2; // Cache sitemap for 2 hours (news updates frequently)

// Helper to add hreflang links for multilingual pages
function addHreflangLinks(url: string): string {
  return `
    <xhtml:link rel="alternate" hreflang="uk" href="${url}" />
    <xhtml:link rel="alternate" hreflang="en" href="${url}" />
    <xhtml:link rel="alternate" hreflang="pl" href="${url}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${url}" />`;
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
async function cacheSitemap(
  supabase: any,
  functionsBaseUrl: string,
  cachePath: string,
  xml: string,
  countryName?: string
): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL_HOURS * 60 * 60 * 1000);

  await supabase
    .from("cached_pages")
    .upsert({
      path: cachePath,
      html: xml,
      title: `News Sitemap: ${countryName || 'Index'}`,
      description: `XML News Sitemap for ${BASE_URL}`,
      canonical_url: `${functionsBaseUrl}${cachePath}`,
      expires_at: expiresAt.toISOString(),
      updated_at: now.toISOString(),
      html_size_bytes: new TextEncoder().encode(xml).length,
    }, { onConflict: 'path' });

  console.log(`Cached news sitemap: ${cachePath}, expires: ${expiresAt.toISOString()}`);
}

// Ping search engines about sitemap updates
async function pingSitemapToSearchEngines(sitemapUrl: string): Promise<{ google: boolean; bing: boolean }> {
  const results = { google: false, bing: false };

  try {
    // Ping Google
    const googlePingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;
    const googleResponse = await fetch(googlePingUrl, { method: 'GET' });
    results.google = googleResponse.ok;
    console.log(`Google ping for ${sitemapUrl}: ${googleResponse.status}`);
  } catch (error) {
    console.error('Google ping failed:', error);
  }

  try {
    // Ping Bing (IndexNow style - more reliable)
    const bingPingUrl = `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;
    const bingResponse = await fetch(bingPingUrl, { method: 'GET' });
    results.bing = bingResponse.ok;
    console.log(`Bing ping for ${sitemapUrl}: ${bingResponse.status}`);
  } catch (error) {
    console.error('Bing ping failed:', error);
  }

  return results;
}

// Update ping status in metadata
async function updatePingStatus(
  supabase: any,
  sitemapType: string,
  pingResults: { google: boolean; bing: boolean }
) {
  await supabase
    .from("sitemap_metadata")
    .update({
      last_ping_at: new Date().toISOString(),
      google_ping_success: pingResults.google,
      bing_ping_success: pingResults.bing,
    })
    .eq('sitemap_type', sitemapType);
}

// Background task helper - use globalThis if available

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const functionsBaseUrl = `${supabaseUrl}/functions/v1`;

    const url = new URL(req.url);
    const countryCode = url.searchParams.get("country")?.toLowerCase();
    const action = url.searchParams.get("action"); // 'generate' to force regeneration
    const forceRefresh = url.searchParams.get("refresh") === "true";
    const pingEnabled = url.searchParams.get("ping") !== "false"; // Enable ping by default

    // If no country specified, return sitemap index
    if (!countryCode) {
      return await generateSitemapIndex(supabase, functionsBaseUrl, startTime, forceRefresh);
    }

    // Validate country code
    const { data: country, error: countryError } = await supabase
      .from("news_countries")
      .select("id, code, name")
      .eq("code", countryCode.toUpperCase())
      .eq("is_active", true)
      .single();

    if (countryError || !country) {
      return new Response(
        JSON.stringify({ error: "Country not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cachePath = `/news-sitemap?country=${countryCode}`;

    // Check cache first (unless force refresh or action=generate)
    if (!forceRefresh && action !== "generate") {
      const cachedXml = await getCachedSitemap(supabase, cachePath);
      if (cachedXml) {
        return new Response(cachedXml, {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/xml; charset=utf-8",
            "X-Cache": "HIT",
            "Cache-Control": "public, max-age=21600",
          },
          status: 200
        });
      }
    }

    // Generate sitemap for specific country
    const { xml, urlCount } = await generateCountrySitemap(supabase, country, startTime);

    // Cache the generated sitemap
    await cacheSitemap(supabase, functionsBaseUrl, cachePath, xml, country.name);

    // Ping search engines in background if action=generate and ping not disabled
    if (action === "generate" && pingEnabled && urlCount > 0) {
      const sitemapUrl = `${functionsBaseUrl}/news-sitemap?country=${countryCode}`;
      const sitemapType = `news-${countryCode}`;

      // Fire and forget - don't await
      pingSitemapToSearchEngines(sitemapUrl).then(results =>
        updatePingStatus(supabase, sitemapType, results)
      ).catch(err => console.error('Ping failed:', err));
    }

    const generationTime = Date.now() - startTime;

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
        "X-Cache": "MISS",
        "X-Generation-Time": `${generationTime}ms`,
        "Cache-Control": "public, max-age=21600",
      },
      status: 200
    });

  } catch (error) {
    console.error("News sitemap generation error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function generateSitemapIndex(
  supabase: any,
  functionsBaseUrl: string,
  startTime: number,
  forceRefresh: boolean
): Promise<Response> {
  const cachePath = "/news-sitemap-index";

  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cachedXml = await getCachedSitemap(supabase, cachePath);
    if (cachedXml) {
      return new Response(cachedXml, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/xml; charset=utf-8",
          "X-Cache": "HIT",
          "Cache-Control": "public, max-age=21600",
        },
        status: 200
      });
    }
  }

  // Get all active countries
  const { data: countries, error } = await supabase
    .from("news_countries")
    .select("id, code, name")
    .eq("is_active", true)
    .order("sort_order");

  if (error) throw error;

  const now = new Date().toISOString();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  
  <!-- News Sitemap Index for ${BASE_URL} -->
  <!-- Generated: ${now} -->
  <!-- Cache TTL: ${CACHE_TTL_HOURS} hours -->
`;

  // Add main sitemap
  xml += `
  <sitemap>
    <loc>${BASE_URL}/sitemap.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`;

  // Add country-specific news sitemaps
  for (const country of countries || []) {
    xml += `
  <sitemap>
    <loc>${functionsBaseUrl}/news-sitemap?country=${country.code.toLowerCase()}</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`;
  }

  xml += `
</sitemapindex>`;

  // Cache the index
  await cacheSitemap(supabase, functionsBaseUrl, cachePath, xml, 'Index');

  return new Response(xml, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/xml; charset=utf-8",
      "X-Cache": "MISS",
      "Cache-Control": "public, max-age=21600",
    },
    status: 200
  });
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

async function generateCountrySitemap(
  supabase: any,
  country: { id: string; code: string; name: string },
  startTime: number
): Promise<{ xml: string; urlCount: number }> {
  // Fetch ALL non-archived news items with slugs for this country (with pagination)
  const newsItems = await fetchAllRows<{ id: string; slug: string; published_at: string; fetched_at: string }>(
    supabase,
    'news_rss_items',
    'id, slug, published_at, fetched_at',
    [
      { column: 'country_id', op: 'eq', value: country.id },
      { column: 'is_archived', op: 'eq', value: false },
      { column: 'slug', op: 'not.is.null', value: null },
    ],
    { column: 'published_at', ascending: false }
  );

  const now = new Date().toISOString();
  const countryCodeLower = country.code.toLowerCase();
  const urlCount = newsItems?.length || 0;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
  
  <!-- News sitemap for ${country.name} (${country.code}) -->
  <!-- Generated: ${now} -->
  <!-- Total URLs: ${urlCount} -->
  <!-- Cache TTL: ${CACHE_TTL_HOURS} hours -->
`;

  // Add news article pages
  for (const item of newsItems || []) {
    const url = `${BASE_URL}/news/${countryCodeLower}/${item.slug}`;
    const lastmod = item.published_at || item.fetched_at || now;

    xml += `
  <url>
    <loc>${url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>${addHreflangLinks(url)}
  </url>`;
  }

  xml += `
</urlset>`;

  // Update sitemap metadata
  const endTime = Date.now();
  const generationTimeMs = endTime - startTime;
  const fileSizeBytes = new TextEncoder().encode(xml).length;

  await supabase
    .from("sitemap_metadata")
    .upsert({
      sitemap_type: `news-${countryCodeLower}`,
      country_code: countryCodeLower,
      url_count: urlCount,
      last_generated_at: now,
      generation_time_ms: generationTimeMs,
      file_size_bytes: fileSizeBytes,
      updated_at: now,
    }, { onConflict: 'sitemap_type' });

  return { xml, urlCount };
}
