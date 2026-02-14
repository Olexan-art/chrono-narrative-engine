import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_URL = "https://echoes2.com";
const CACHE_TTL_HOURS = 24;
const MAX_SITEMAP_ENTRIES = 2000;

async function fetchAllRows<T>(
  supabase: any,
  tableName: string,
  selectQuery: string,
  orderBy?: { column: string; ascending: boolean }
): Promise<T[]> {
  const PAGE_SIZE = 1000;
  let allRows: T[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase.from(tableName).select(selectQuery);
    if (orderBy) {
      query = query.order(orderBy.column, { ascending: orderBy.ascending });
    }
    query = query.range(offset, offset + PAGE_SIZE - 1);
    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      hasMore = false;
    } else {
      allRows = allRows.concat(data);
      offset += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    }
  }
  return allRows;
}

// gzip compression is done inline via CompressionStream below

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
    const cachePath = "/api/wiki-sitemap";

    // Check cache first
    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from("cached_pages")
        .select("html, expires_at")
        .eq("path", cachePath)
        .single();

      if (cached && new Date(cached.expires_at) > new Date()) {
        console.log("Wiki sitemap cache HIT");
        
        // Compress cached XML
        const xmlBytes = new TextEncoder().encode(cached.html);
        const compressedStream = new Response(cached.html).body!.pipeThrough(new CompressionStream("gzip"));
        const compressedBody = await new Response(compressedStream).arrayBuffer();
        
        return new Response(compressedBody, {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/xml; charset=utf-8",
            "Content-Encoding": "gzip",
            "X-Cache": "HIT",
            "Cache-Control": "public, max-age=21600",
          },
          status: 200,
        });
      }
    }

    // Fetch top entities by search_count, limited to MAX_SITEMAP_ENTRIES
    const entities = await fetchAllRows<{
      id: string; slug: string | null; updated_at: string; search_count: number;
    }>(
      supabase,
      "wiki_entities",
      "id, slug, updated_at, search_count",
      { column: "search_count", ascending: false }
    );

    // Limit to top entries
    const limitedEntities = entities.slice(0, MAX_SITEMAP_ENTRIES);
    const now = new Date().toISOString();

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">

  <!-- Wiki Entities Sitemap for ${BASE_URL} -->
  <!-- Generated: ${now} -->
  <!-- Total entities: ${limitedEntities.length} (of ${entities.length}) -->

  <url>
    <loc>${BASE_URL}/wiki</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
`;

    for (const entity of limitedEntities) {
      const path = entity.slug || entity.id;
      const entityUrl = `${BASE_URL}/wiki/${path}`;
      const priority = entity.search_count > 50 ? "0.7" : entity.search_count > 10 ? "0.6" : "0.5";
      xml += `
  <url>
    <loc>${entityUrl}</loc>
    <lastmod>${entity.updated_at || now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;
    }

    xml += `
</urlset>`;

    // Save uncompressed to cache
    const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000);
    await supabase
      .from("cached_pages")
      .upsert({
        path: cachePath,
        html: xml,
        title: `Wiki Sitemap`,
        description: `XML Wiki Sitemap for ${BASE_URL}`,
        canonical_url: `${BASE_URL}${cachePath}`,
        expires_at: expiresAt.toISOString(),
        updated_at: now,
        html_size_bytes: new TextEncoder().encode(xml).length,
      }, { onConflict: 'path' });

    console.log(`Wiki sitemap generated & cached: ${limitedEntities.length} of ${entities.length} entities`);

    // Return GZIP compressed
    const compressedStream = new Response(xml).body!.pipeThrough(new CompressionStream("gzip"));
    const compressedBody = await new Response(compressedStream).arrayBuffer();

    return new Response(compressedBody, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Encoding": "gzip",
        "X-Cache": "MISS",
        "Cache-Control": "public, max-age=21600",
      },
      status: 200,
    });
  } catch (error) {
    console.error("Wiki sitemap error:", error);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${BASE_URL}/wiki</loc><priority>0.8</priority></url>
</urlset>`,
      { headers: { ...corsHeaders, "Content-Type": "application/xml; charset=utf-8" }, status: 200 }
    );
  }
});
