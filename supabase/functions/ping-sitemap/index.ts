import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITEMAP_URL = "https://bravennow.com/sitemap.xml";
const TOPICS_SITEMAP_URL = "https://bravennow.com/api/topics-sitemap";
const INDEXNOW_KEY = "d82c5f1a3e7b9042c6d8f1e3a5b70924";
const INDEXNOW_HOST = "bravennow.com";
const INDEXNOW_KEY_LOCATION = `https://bravennow.com/${INDEXNOW_KEY}.txt`;
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/IndexNow";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results: { service: string; success: boolean; status?: number; error?: string }[] = [];
    let googleSuccess = false;
    let bingSuccess = false;


    // Ping Google (main sitemap)
    try {
      const googleUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`;
      const googleRes = await fetch(googleUrl, { method: "GET" });
      googleSuccess = googleRes.ok;
      results.push({
        service: "Google",
        sitemap: SITEMAP_URL,
        success: googleSuccess,
        status: googleRes.status,
      });
      console.log(`Google ping: ${googleRes.status}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      results.push({
        service: "Google",
        sitemap: SITEMAP_URL,
        success: false,
        error: errorMessage,
      });
      console.error("Google ping error:", err);
    }

    // Ping Google (topics sitemap)
    try {
      const googleTopicsUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(TOPICS_SITEMAP_URL)}`;
      const googleTopicsRes = await fetch(googleTopicsUrl, { method: "GET" });
      results.push({
        service: "Google",
        sitemap: TOPICS_SITEMAP_URL,
        success: googleTopicsRes.ok,
        status: googleTopicsRes.status,
      });
      console.log(`Google topics-sitemap ping: ${googleTopicsRes.status}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      results.push({
        service: "Google",
        sitemap: TOPICS_SITEMAP_URL,
        success: false,
        error: errorMessage,
      });
      console.error("Google topics-sitemap ping error:", err);
    }

    // Ping Bing (main sitemap)
    try {
      const bingUrl = `https://www.bing.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`;
      const bingRes = await fetch(bingUrl, { method: "GET" });
      bingSuccess = bingRes.ok;
      results.push({
        service: "Bing",
        sitemap: SITEMAP_URL,
        success: bingSuccess,
        status: bingRes.status,
      });
      console.log(`Bing ping: ${bingRes.status}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      results.push({
        service: "Bing",
        sitemap: SITEMAP_URL,
        success: false,
        error: errorMessage,
      });
      console.error("Bing ping error:", err);
    }

    // Ping Bing (topics sitemap)
    try {
      const bingTopicsUrl = `https://www.bing.com/ping?sitemap=${encodeURIComponent(TOPICS_SITEMAP_URL)}`;
      const bingTopicsRes = await fetch(bingTopicsUrl, { method: "GET" });
      results.push({
        service: "Bing",
        sitemap: TOPICS_SITEMAP_URL,
        success: bingTopicsRes.ok,
        status: bingTopicsRes.status,
      });
      console.log(`Bing topics-sitemap ping: ${bingTopicsRes.status}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      results.push({
        service: "Bing",
        sitemap: TOPICS_SITEMAP_URL,
        success: false,
        error: errorMessage,
      });
      console.error("Bing topics-sitemap ping error:", err);
    }

    // --- IndexNow: відправити нещодавно оновлені URL ---
    try {
      // Отримуємо URL з останніх 48 годин (новини + вікі)
      const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

      const [{ data: recentNews }, { data: recentWiki }] = await Promise.all([
        supabase
          .from("news")
          .select("slug, updated_at")
          .gte("updated_at", since)
          .order("updated_at", { ascending: false })
          .limit(100),
        supabase
          .from("wiki_characters")
          .select("slug, updated_at")
          .gte("updated_at", since)
          .order("updated_at", { ascending: false })
          .limit(50),
      ]);

      const urlList: string[] = [
        ...(recentNews || []).map((n: { slug: string }) => `https://bravennow.com/news/${n.slug}`),
        ...(recentWiki || []).map((w: { slug: string }) => `https://bravennow.com/wiki/${w.slug}`),
      ];

      // Завжди включаємо головну сторінку та sitemap
      urlList.unshift("https://bravennow.com/");

      let indexNowSuccess = false;
      if (urlList.length > 0) {
        const indexNowRes = await fetch(INDEXNOW_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({
            host: INDEXNOW_HOST,
            key: INDEXNOW_KEY,
            keyLocation: INDEXNOW_KEY_LOCATION,
            urlList,
          }),
        });
        indexNowSuccess = indexNowRes.ok || indexNowRes.status === 202;
        results.push({
          service: "IndexNow",
          success: indexNowSuccess,
          status: indexNowRes.status,
        });
        console.log(`IndexNow: ${indexNowRes.status}, urls: ${urlList.length}`);
      } else {
        results.push({ service: "IndexNow", success: true, status: 0 });
        console.log("IndexNow: no new URLs in last 48h");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      results.push({ service: "IndexNow", success: false, error: errorMessage });
      console.error("IndexNow error:", err);
    }

    // Save ping results to sitemap_metadata (for main sitemap)
    const now = new Date().toISOString();
    await supabase
      .from("sitemap_metadata")
      .upsert({
        sitemap_type: "main",
        last_ping_at: now,
        google_ping_success: googleSuccess,
        bing_ping_success: bingSuccess,
        updated_at: now,
      }, { onConflict: 'sitemap_type' });

    // Also update all news sitemaps with ping status
    const { data: newsSitemaps } = await supabase
      .from("sitemap_metadata")
      .select("sitemap_type")
      .like("sitemap_type", "news-%");

    for (const sitemap of newsSitemaps || []) {
      await supabase
        .from("sitemap_metadata")
        .update({
          last_ping_at: now,
          google_ping_success: googleSuccess,
          bing_ping_success: bingSuccess,
        })
        .eq("sitemap_type", sitemap.sitemap_type);
    }

    const allSuccess = results.every(r => r.success);

    return new Response(
      JSON.stringify({
        success: allSuccess,
        message: allSuccess
          ? "Sitemap ping sent to all search engines"
          : "Some pings failed",
        results,
        sitemap: SITEMAP_URL,
        timestamp: now,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("Ping sitemap error:", err);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
