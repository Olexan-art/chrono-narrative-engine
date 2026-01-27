import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_URL = "https://echoes2.com";

// Helper to add hreflang links for multilingual pages
function addHreflangLinks(url: string): string {
  return `
    <xhtml:link rel="alternate" hreflang="uk" href="${url}" />
    <xhtml:link rel="alternate" hreflang="en" href="${url}" />
    <xhtml:link rel="alternate" hreflang="pl" href="${url}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${url}" />`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const countryCode = url.searchParams.get("country")?.toLowerCase();
    const action = url.searchParams.get("action"); // 'generate' to force regeneration

    // If no country specified, return sitemap index
    if (!countryCode) {
      return await generateSitemapIndex(supabase, startTime);
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

    // Generate sitemap for specific country
    const xml = await generateCountrySitemap(supabase, country, startTime);
    
    return new Response(xml, { 
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=86400", // Cache for 24 hours
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

async function generateSitemapIndex(supabase: any, startTime: number): Promise<Response> {
  // Get all active countries
  const { data: countries, error } = await supabase
    .from("news_countries")
    .select("id, code, name")
    .eq("is_active", true)
    .order("sort_order");

  if (error) throw error;

  const now = new Date().toISOString();
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

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
    <loc>https://bgdwxnoildvvepsoaxrf.supabase.co/functions/v1/news-sitemap?country=${country.code.toLowerCase()}</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`;
  }

  xml += `
</sitemapindex>`;

  return new Response(xml, { 
    headers: {
      ...corsHeaders,
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
    status: 200 
  });
}

async function generateCountrySitemap(
  supabase: any, 
  country: { id: string; code: string; name: string },
  startTime: number
): Promise<string> {
  // Fetch all non-archived news items with slugs for this country
  const { data: newsItems, error } = await supabase
    .from("news_rss_items")
    .select("id, slug, published_at, fetched_at")
    .eq("country_id", country.id)
    .eq("is_archived", false)
    .not("slug", "is", null)
    .order("published_at", { ascending: false });

  if (error) throw error;

  const now = new Date().toISOString();
  const countryCodeLower = country.code.toLowerCase();
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
  
  <!-- News sitemap for ${country.name} (${country.code}) -->
  <!-- Generated: ${now} -->
  <!-- Total URLs: ${newsItems?.length || 0} -->
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
      url_count: newsItems?.length || 0,
      last_generated_at: now,
      generation_time_ms: generationTimeMs,
      file_size_bytes: fileSizeBytes,
      updated_at: now,
    }, { onConflict: 'sitemap_type' });

  return xml;
}
