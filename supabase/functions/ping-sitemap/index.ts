const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITEMAP_URL = "https://echoes2.com/sitemap.xml";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const results: { service: string; success: boolean; status?: number; error?: string }[] = [];

    // Ping Google
    try {
      const googleUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`;
      const googleRes = await fetch(googleUrl, { method: "GET" });
      results.push({
        service: "Google",
        success: googleRes.ok,
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
      results.push({
        service: "Bing",
        success: bingRes.ok,
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

    const allSuccess = results.every(r => r.success);

    return new Response(
      JSON.stringify({
        success: allSuccess,
        message: allSuccess 
          ? "Sitemap ping sent to all search engines" 
          : "Some pings failed",
        results,
        sitemap: SITEMAP_URL,
        timestamp: new Date().toISOString(),
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