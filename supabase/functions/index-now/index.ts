/**
 * IndexNow Edge Function
 * Відправляє конкретні URL до всіх пошукових систем через протокол IndexNow.
 *
 * Використання (POST):
 *   Body: { "urls": ["https://bravennow.com/news/some-slug", ...] }
 *
 * Або без body — функція сама збере URL з останніх 48 годин.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INDEXNOW_KEY = "d82c5f1a3e7b9042c6d8f1e3a5b70924";
const INDEXNOW_HOST = "bravennow.com";
const INDEXNOW_KEY_LOCATION = `https://bravennow.com/${INDEXNOW_KEY}.txt`;

// IndexNow підтримують декілька пошукових систем — достатньо відправити в одну
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/IndexNow";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let urlList: string[] = [];

    // Якщо URL передані явно — використовуємо їх
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (Array.isArray(body?.urls) && body.urls.length > 0) {
          urlList = body.urls.filter((u: unknown) => typeof u === "string" && u.startsWith("https://bravennow.com"));
        }
      } catch {
        // ігноруємо помилку парсингу — знімаємо URL автоматично
      }
    }

    // Якщо URL не передані — беремо з бази за останні 48 годин
    if (urlList.length === 0) {
      const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

      const [{ data: recentNews }, { data: recentWiki }] = await Promise.all([
        supabase
          .from("news")
          .select("slug")
          .gte("updated_at", since)
          .order("updated_at", { ascending: false })
          .limit(100),
        supabase
          .from("wiki_characters")
          .select("slug")
          .gte("updated_at", since)
          .order("updated_at", { ascending: false })
          .limit(50),
      ]);

      urlList = [
        "https://bravennow.com/",
        ...(recentNews || []).map((n: { slug: string }) => `https://bravennow.com/news/${n.slug}`),
        ...(recentWiki || []).map((w: { slug: string }) => `https://bravennow.com/wiki/${w.slug}`),
      ];
    }

    if (urlList.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Немає URL для відправки", submitted: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // IndexNow обмежує до 10 000 URL за запит; при потребі розбиваємо на пачки
    const BATCH_SIZE = 1000;
    const batches: string[][] = [];
    for (let i = 0; i < urlList.length; i += BATCH_SIZE) {
      batches.push(urlList.slice(i, i + BATCH_SIZE));
    }

    const batchResults: { batch: number; status: number; ok: boolean }[] = [];

    for (let i = 0; i < batches.length; i++) {
      const res = await fetch(INDEXNOW_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          host: INDEXNOW_HOST,
          key: INDEXNOW_KEY,
          keyLocation: INDEXNOW_KEY_LOCATION,
          urlList: batches[i],
        }),
      });

      batchResults.push({ batch: i + 1, status: res.status, ok: res.ok || res.status === 202 });
      console.log(`IndexNow batch ${i + 1}/${batches.length}: ${res.status}`);
    }

    const allOk = batchResults.every((r) => r.ok);

    return new Response(
      JSON.stringify({
        success: allOk,
        submitted: urlList.length,
        batches: batchResults,
        key: INDEXNOW_KEY,
        keyLocation: INDEXNOW_KEY_LOCATION,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("IndexNow error:", err);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
