import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_URL = "https://bravennow.com";
const CACHE_TTL_HOURS = 24;
const ENTRIES_PER_PAGE = 40000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const pageParam = url.searchParams.get("page");
    const page = pageParam ? parseInt(pageParam, 10) : null;
    const forceRefresh = url.searchParams.get("refresh") === "true";

    // Get total count of wiki entities
    const { count, error: countError } = await supabase
      .from("wiki_entities")
      .select("*", { count: "exact", head: true });

    if (countError) throw countError;
    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / ENTRIES_PER_PAGE);

    const cachePath = page ? `/api/wiki-sitemap?page=${page}` : "/api/wiki-sitemap";

    // Check cache first
    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from("cached_pages")
        .select("html, expires_at")
        .eq("path", cachePath)
        .single();

      if (cached && new Date(cached.expires_at) > new Date()) {
        console.log(`Wiki sitemap cache HIT: ${cachePath}`);
        return new Response(cached.html, {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/xml; charset=utf-8",
            "X-Cache": "HIT",
            "Cache-Control": "public, max-age=21600",
          },
          status: 200,
        });
      }
    }

    let xml = "";
    const now = new Date().toISOString();

    if (page === null) {
      // 1. Generate Sitemap Index
      xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Wiki Entities Sitemap Index -->
  <!-- Generated: ${now} -->
  <!-- Total entities: ${totalCount} -->
  <!-- Pages: ${totalPages} (Limit: ${ENTRIES_PER_PAGE} per page) -->
`;

      for (let i = 1; i <= totalPages; i++) {
        xml += `  <sitemap>
    <loc>${BASE_URL}/api/wiki-sitemap?page=${i}</loc>
    <lastmod>${now}</lastmod>
  </sitemap>\n`;
      }
      xml += `</sitemapindex>`;

    } else {
      // 2. Generate specific Sitemap page
      if (page < 1 || page > totalPages) {
        return new Response("Page not found", { status: 404 });
      }

      const offset = (page - 1) * ENTRIES_PER_PAGE;
      const { data: entities, error: entitiesError } = await supabase
        .from("wiki_entities")
        .select("id, slug, updated_at")
        .order("search_count", { ascending: false }) // Prioritize popular
        .range(offset, offset + ENTRIES_PER_PAGE - 1);

      if (entitiesError) throw entitiesError;

      xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <!-- Wiki Entities Sitemap - Page ${page} -->
  <!-- Generated: ${now} -->
  <!-- Entries: ${entities?.length || 0} (Offset: ${offset}) -->

  <url>
    <loc>${BASE_URL}/wiki</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
`;

      for (const entity of entities || []) {
        const path = entity.slug || entity.id;
        xml += `  <url>
    <loc>${BASE_URL}/wiki/${path}</loc>
    <lastmod>${entity.updated_at || now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>\n`;
      }
      xml += `</urlset>`;
    }

    // Save to cache
    const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000);
    await supabase
      .from("cached_pages")
      .upsert({
        path: cachePath,
        html: xml,
        title: `Wiki Sitemap ${page ? 'Page ' + page : 'Index'}`,
        description: `XML Wiki Sitemap for ${BASE_URL}`,
        canonical_url: `${BASE_URL}${cachePath}`,
        expires_at: expiresAt.toISOString(),
        updated_at: now,
        html_size_bytes: new TextEncoder().encode(xml).length,
      }, { onConflict: 'path' });

    console.log(`Wiki sitemap generated & cached: ${cachePath}`);

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
        "X-Cache": "MISS",
        "Cache-Control": "public, max-age=21600",
      },
      status: 200,
    });

  } catch (error) {
    console.error("Wiki sitemap error:", error);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${BASE_URL}/wiki</loc></url></urlset>`,
      { headers: { ...corsHeaders, "Content-Type": "application/xml; charset=utf-8" }, status: 200 }
    );
  }
});
