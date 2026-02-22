import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { entityId, yearMonth, language = 'uk', regenerate = false, model = 'gpt-4o-mini' } = await req.json();
    
    if (!entityId || !yearMonth) {
      return new Response(JSON.stringify({ error: "entityId and yearMonth required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if we already have a saved analysis (unless regenerating)
    if (!regenerate) {
      const { data: existing } = await supabase
        .from("narrative_analyses")
        .select("*")
        .eq("entity_id", entityId)
        .eq("year_month", yearMonth)
        .eq("language", language)
        .single();

      if (existing) {
        return new Response(JSON.stringify({
          success: true,
          yearMonth,
          entityName: existing.analysis?.entityName || '',
          newsCount: existing.news_count,
          analysis: existing.analysis,
          relatedEntities: existing.related_entities,
          is_regenerated: existing.is_regenerated,
          saved_at: existing.updated_at,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Parse yearMonth
    const [year, month] = yearMonth.split("-").map(Number);
    const startDate = `${yearMonth}-01`;
    const endDate = new Date(year, month, 0).toISOString().split("T")[0];

    // Get entity info
    const { data: entity } = await supabase
      .from("wiki_entities")
      .select("id, name, name_en, entity_type")
      .eq("id", entityId)
      .single();

    if (!entity) {
      return new Response(JSON.stringify({ error: "Entity not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get news linked to this entity for the given month
    const { data: newsLinks } = await supabase
      .from("news_wiki_entities")
      .select("news_item_id")
      .eq("wiki_entity_id", entityId);

    if (!newsLinks?.length) {
      return new Response(JSON.stringify({ error: "No news found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newsItemIds = newsLinks.map((l) => l.news_item_id);

    const { data: newsItems } = await supabase
      .from("news_rss_items")
      .select("id, title, title_en, description, description_en, slug, published_at, themes, themes_en, keywords, country_id, country:news_countries(code, name)")
      .in("id", newsItemIds)
      .gte("published_at", startDate)
      .lte("published_at", `${endDate}T23:59:59`)
      .order("published_at", { ascending: true });

    if (!newsItems?.length) {
      return new Response(JSON.stringify({ error: "No news in this period" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get related entities
    const { data: relatedLinks } = await supabase
      .from("news_wiki_entities")
      .select("wiki_entity_id, news_item_id, wiki_entity:wiki_entities(id, name, name_en, slug)")
      .in("news_item_id", newsItems.map((n) => n.id))
      .neq("wiki_entity_id", entityId);

    const relatedEntityCounts: Record<string, { name: string; name_en: string | null; slug: string | null; count: number }> = {};
    relatedLinks?.forEach((link) => {
      const e = link.wiki_entity as any;
      if (!e) return;
      if (!relatedEntityCounts[e.id]) {
        relatedEntityCounts[e.id] = { name: e.name, name_en: e.name_en, slug: e.slug, count: 0 };
      }
      relatedEntityCounts[e.id].count++;
    });

    const topRelated = Object.entries(relatedEntityCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([id, data]) => ({ id, ...data }));

    // Build AI context
    const entityName = language === "en" && entity.name_en ? entity.name_en : entity.name;
    const newsContext = newsItems.slice(0, 30).map((n, i) => {
      const title = language === "en" && n.title_en ? n.title_en : n.title;
      const desc = language === "en" && n.description_en ? n.description_en : n.description;
      const country = (n.country as any)?.name || "";
      return `${i + 1}. [${n.published_at?.slice(0, 10)}] ${title}${desc ? ` — ${desc}` : ""} (${country})`;
    }).join("\n");

    const relatedContext = topRelated
      .map((r) => `${language === "en" && r.name_en ? r.name_en : r.name} (${r.count} mentions)`)
      .join(", ");

    // Read OpenAI API key from settings table
    const { data: settingsRow } = await supabase
      .from("settings")
      .select("openai_api_key")
      .limit(1)
      .single();

    const OPENAI_API_KEY = settingsRow?.openai_api_key;
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OpenAI API key not configured in settings" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = language === "uk"
      ? `Ти аналітик наративів. Проаналізуй як сутність "${entityName}" згадується у новинах за ${yearMonth}. Створи структурований аналіз.`
      : `You are a narrative analyst. Analyze how entity "${entityName}" is mentioned in news for ${yearMonth}. Create a structured analysis.`;

    const userPrompt = language === "uk"
      ? `Сутність: ${entityName} (${entity.entity_type})\nПеріод: ${yearMonth}\nНовин: ${newsItems.length}\n\nПов'язані сутності: ${relatedContext}\n\nНовини:\n${newsContext}\n\nСтвори JSON з полями:\n- key_takeaways: масив об'єктів {point: "текст тези", news_indices: [номери новин 1-based]}\n- narrative_summary: короткий опис загальної наративної лінії (2-3 речення)\n- sentiment: "positive" | "negative" | "neutral" | "mixed"\n- related_entity_roles: масив {name: "ім'я", role: "роль у наративі"}\n\nВідповідай ТІЛЬКИ валідним JSON без markdown.`
      : `Entity: ${entityName} (${entity.entity_type})\nPeriod: ${yearMonth}\nNews count: ${newsItems.length}\n\nRelated entities: ${relatedContext}\n\nNews:\n${newsContext}\n\nCreate JSON with fields:\n- key_takeaways: array of {point: "takeaway text", news_indices: [1-based news indices]}\n- narrative_summary: brief summary of the narrative arc (2-3 sentences)\n- sentiment: "positive" | "negative" | "neutral" | "mixed"\n- related_entity_roles: array of {name: "entity name", role: "role in narrative"}\n\nRespond with VALID JSON only, no markdown.`;

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: `AI error: ${aiResponse.status}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    let analysis;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      analysis = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enrich takeaways with news links
    const enrichedTakeaways = (analysis.key_takeaways || []).map((kt: any) => ({
      point: kt.point,
      newsLinks: (kt.news_indices || [])
        .filter((idx: number) => idx >= 1 && idx <= newsItems.length)
        .map((idx: number) => {
          const n = newsItems[idx - 1];
          const country = (n.country as any)?.code?.toLowerCase() || "ua";
          return {
            title: language === "en" && n.title_en ? n.title_en : n.title,
            slug: n.slug,
            id: n.id,
            url: `/news/${country}/${n.slug || n.id}`,
          };
        }),
    }));

    const fullAnalysis = {
      ...analysis,
      key_takeaways: enrichedTakeaways,
      entityName,
    };

    // Save to database (upsert)
    const isRegenerated = regenerate;
    const { error: upsertError } = await supabase
      .from("narrative_analyses")
      .upsert({
        entity_id: entityId,
        year_month: yearMonth,
        language,
        news_count: newsItems.length,
        analysis: fullAnalysis,
        related_entities: topRelated,
        is_regenerated: isRegenerated,
        updated_at: new Date().toISOString(),
      }, { onConflict: "entity_id,year_month,language" });

    if (upsertError) {
      console.error("DB save error:", upsertError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        yearMonth,
        entityName,
        newsCount: newsItems.length,
        analysis: fullAnalysis,
        relatedEntities: topRelated,
        is_regenerated: isRegenerated,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("analyze-narratives error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
