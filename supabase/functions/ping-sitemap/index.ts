import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITEMAP_URL = "https://bravennow.com/sitemap.xml";

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

    // Ping Google
    try {
      const googleUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`;
      const googleRes = await fetch(googleUrl, { method: "GET" });
      googleSuccess = googleRes.ok;
      results.push({
        service: "Google",
        success: googleSuccess,
        status: googleRes.status,
      });
      console.log(`Google ping: ${googleRes.status}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      results.push({
        service: "Google",
        success: false,
        error: errorMessage,
      });
      console.error("Google ping error:", err);
    }

    // Ping Bing
    try {
      const bingUrl = `https://www.bing.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`;
      const bingRes = await fetch(bingUrl, { method: "GET" });
      bingSuccess = bingRes.ok;
      results.push({
        service: "Bing",
        success: bingSuccess,
        status: bingRes.status,
      });
      console.log(`Bing ping: ${bingRes.status}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      results.push({
        service: "Bing",
        success: false,
        error: errorMessage,
      });
      console.error("Bing ping error:", err);
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
