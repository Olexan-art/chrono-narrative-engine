import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_URL = "https://echoes2.com";
const CACHE_TTL_HOURS = 1;
const DEFAULT_FEED_SIZE = 50;
const MIN_CONTENT_LENGTH = 300; // US news retold threshold

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '').trim();
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
    const feedSize = parseInt(url.searchParams.get("limit") || String(DEFAULT_FEED_SIZE));
    const cachePath = "/api/rss-feed";

    // Check cache
    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from("cached_pages")
        .select("html, expires_at")
        .eq("path", cachePath)
        .single();

      if (cached && new Date(cached.expires_at) > new Date()) {
        return new Response(cached.html, {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/rss+xml; charset=utf-8",
            "X-Cache": "HIT",
            "Cache-Control": "public, max-age=3600",
          },
        });
      }
    }

    // Get US country ID
    const { data: usCountry } = await supabase
      .from("news_countries")
      .select("id")
      .eq("code", "us")
      .single();

    if (!usCountry) throw new Error("US country not found");

    // Fetch fully retold US news (content length > threshold OR has dialogue)
    const { data: newsItems } = await supabase
      .from("news_rss_items")
      .select("id, title, title_en, description, description_en, content, content_en, slug, published_at, image_url, url, category, themes_en, key_points_en")
      .eq("country_id", usCountry.id)
      .eq("is_archived", false)
      .not("content_en", "is", null)
      .order("published_at", { ascending: false })
      .limit(feedSize * 2); // Fetch extra to filter

    // Filter for fully retold
    const retoldNews = (newsItems || []).filter(item => {
      const contentLen = (item.content_en || item.content || '').length;
      return contentLen >= MIN_CONTENT_LENGTH;
    }).slice(0, feedSize);

    const now = new Date().toISOString();
    const pubDate = retoldNews[0]?.published_at || now;

    let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Echoes - US News Retold</title>
    <link>${BASE_URL}/news/us</link>
    <description>Fully retold and analyzed US news stories from Echoes</description>
    <language>en-us</language>
    <lastBuildDate>${new Date(pubDate).toUTCString()}</lastBuildDate>
    <atom:link href="${BASE_URL}/api/rss-feed" rel="self" type="application/rss+xml" />
    <generator>Echoes RSS Generator</generator>
    <ttl>60</ttl>
`;

    for (const item of retoldNews) {
      const title = escapeXml(item.title_en || item.title);
      const description = escapeXml(stripHtml(item.description_en || item.description || '').substring(0, 500));
      const link = `${BASE_URL}/news/us/${item.slug || item.id}`;
      const date = item.published_at ? new Date(item.published_at).toUTCString() : new Date(now).toUTCString();
      const categories = (item.themes_en || []).map((t: string) => `    <category>${escapeXml(t)}</category>`).join('\n');

      rss += `
    <item>
      <title>${title}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${date}</pubDate>
      <description>${description}</description>
${categories}${item.image_url ? `
      <media:content url="${escapeXml(item.image_url)}" medium="image" />` : ''}
      <source url="${escapeXml(item.url)}">Original Source</source>
    </item>`;
    }

    rss += `
  </channel>
</rss>`;

    // Cache the RSS
    const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000);
    await supabase
      .from("cached_pages")
      .upsert({
        path: cachePath,
        html: rss,
        title: "US News RSS Feed",
        description: "RSS feed for fully retold US news",
        canonical_url: `${BASE_URL}${cachePath}`,
        expires_at: expiresAt.toISOString(),
        updated_at: now,
        html_size_bytes: new TextEncoder().encode(rss).length,
      }, { onConflict: 'path' });

    console.log(`RSS feed generated: ${retoldNews.length} retold US news items`);

    return new Response(rss, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/rss+xml; charset=utf-8",
        "X-Cache": "MISS",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("RSS feed error:", error);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Error</title><description>Feed generation failed</description></channel></rss>`,
      { headers: { ...corsHeaders, "Content-Type": "application/rss+xml; charset=utf-8" }, status: 200 }
    );
  }
});
