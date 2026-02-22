import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_URL = "https://bravennow.com";
// Cache refreshes every 12 hours — aligns with the 12h lastmod boundary
const CACHE_TTL_HOURS = 12;

/** Round current time to nearest 12-hour boundary (stable lastmod for caches) */
function get12hLastmod(): string {
  const twelveHour = 12 * 60 * 60 * 1000;
  return new Date(Math.floor(Date.now() / twelveHour) * twelveHour).toISOString();
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

    const cachePath = "/api/topics-sitemap";

    // Check cache first
    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from("cached_pages")
        .select("html, expires_at")
        .eq("path", cachePath)
        .single();

      if (cached && new Date(cached.expires_at) > new Date()) {
        console.log(`Topics sitemap cache HIT`);
        return new Response(cached.html, {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/xml; charset=utf-8",
            "X-Cache": "HIT",
            "Cache-Control": `public, max-age=${CACHE_TTL_HOURS * 3600}`,
          },
          status: 200,
        });
      }
    }

    // Fetch all themes arrays from recent news items (limit to 15000 most recent)
    const { data: rows, error: rowsError } = await supabase
      .from("news_rss_items")
      .select("themes")
      .not("themes", "is", null)
      .order("published_at", { ascending: false })
      .limit(15000);

    if (rowsError) throw rowsError;

    // Aggregate topic counts from the arrays
    const counts = new Map<string, number>();
    for (const row of rows || []) {
      if (Array.isArray(row.themes)) {
        for (const t of row.themes) {
          if (t && typeof t === "string") {
            counts.set(t, (counts.get(t) || 0) + 1);
          }
        }
      }
    }

    // Sort by popularity, discard one-off topics
    const topics = Array.from(counts.entries())
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1]);

    const lastmod = get12hLastmod();
    const now = new Date().toISOString();

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Topics Sitemap -->
  <!-- Generated: ${now} -->
  <!-- Unique topics: ${topics.length} -->

  <!-- Topics catalog page -->
  <url>
    <loc>${BASE_URL}/topics</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
`;

    for (const [topic] of topics) {
      const slug = encodeURIComponent(topic);
      xml += `  <url>
    <loc>${BASE_URL}/topics/${slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>\n`;
    }

    xml += `</urlset>`;

    // Save to cache
    const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000);
    await supabase
      .from("cached_pages")
      .upsert({
        path: cachePath,
        html: xml,
        title: "Topics Sitemap",
        description: `XML Topics Sitemap for ${BASE_URL}`,
        canonical_url: `${BASE_URL}${cachePath}`,
        expires_at: expiresAt.toISOString(),
        updated_at: now,
        html_size_bytes: new TextEncoder().encode(xml).length,
      }, { onConflict: "path" });

    console.log(`Topics sitemap generated & cached: ${topics.length} topics`);

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
        "X-Cache": "MISS",
        "Cache-Control": `public, max-age=${CACHE_TTL_HOURS * 3600}`,
      },
      status: 200,
    });

  } catch (error) {
    console.error("Topics sitemap error:", error);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${BASE_URL}/topics</loc></url></urlset>`,
      { headers: { ...corsHeaders, "Content-Type": "application/xml; charset=utf-8" }, status: 200 }
    );
  }
});
