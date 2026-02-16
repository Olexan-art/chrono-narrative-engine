import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "text/markdown; charset=utf-8",
  "Cache-Control": "public, max-age=3600, s-maxage=7200",
};

const BASE_URL = "https://bravennow.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch latest content
    const [partsResult, chaptersResult, volumesResult, statsResult] = await Promise.all([
      supabase
        .from("parts")
        .select("id, title, title_en, date, number, is_flash_news, chapter:chapters(title)")
        .eq("status", "published")
        .order("date", { ascending: false })
        .order("number", { ascending: false })
        .limit(20),
      supabase
        .from("chapters")
        .select("id, title, title_en, number, week_of_month, volume:volumes(title, month, year)")
        .not("narrator_monologue", "is", null)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("volumes")
        .select("id, title, title_en, month, year, number")
        .order("year", { ascending: false })
        .order("month", { ascending: false })
        .limit(6),
      supabase
        .from("parts")
        .select("id", { count: "exact" })
        .eq("status", "published"),
    ]);

    const parts = partsResult.data || [];
    const chapters = chaptersResult.data || [];
    const volumes = volumesResult.data || [];
    const totalStories = statsResult.count || 0;

    const now = new Date().toISOString();
    const monthNames = ["січня", "лютого", "березня", "квітня", "травня", "червня",
      "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"];

    const llmsTxt = `# Synchronization Point (Точка Синхронізації)

> An AI-powered narrative archive that transforms real-world news into science fiction stories. Updated daily with new narratives in Ukrainian, English, and Polish.

## Summary

Synchronization Point is an autonomous AI writing system that:
- Fetches daily news from multiple international sources
- Transforms them into science fiction narratives
- Generates character dialogues and social media commentary
- Organizes content into daily parts (${totalStories}+ stories), weekly chapters, and monthly volumes

**Last Updated**: ${now}
**Languages**: Ukrainian (primary), English, Polish
**Content License**: AI-generated, publicly accessible

## Quick Links

- [Home - Latest Stories](${BASE_URL}/)
- [Calendar Archive](${BASE_URL}/calendar)
- [Weekly Chapters](${BASE_URL}/chapters)
- [Monthly Volumes](${BASE_URL}/volumes)
- [Full Documentation](${BASE_URL}/llms-full.txt)
- [Sitemap XML](https://tuledxqigzufkecztnlo.supabase.co/functions/v1/sitemap)

## Latest Stories (${parts.length} most recent)

${parts.map((p: any, i: number) => {
      const flashIcon = p.is_flash_news ? " ⚡" : "";
      const chapter = Array.isArray(p.chapter) ? p.chapter[0] : p.chapter;
      const chapterInfo = chapter?.title ? ` (${chapter.title})` : "";
      return `${i + 1}. [${p.title}${flashIcon}](${BASE_URL}/read/${p.date}/${p.number}) - ${p.date}${chapterInfo}`;
    }).join("\n")}

## Recent Chapters (Weekly Compilations)

${chapters.map((c: any, i: number) => {
      const volume = Array.isArray(c.volume) ? c.volume[0] : c.volume;
      const volumeInfo = volume ? `${monthNames[(volume.month || 1) - 1]} ${volume.year}` : "";
      return `${i + 1}. [${c.title}](${BASE_URL}/chapter/${c.number}) - Week ${c.week_of_month}, ${volumeInfo}`;
    }).join("\n")}

## Volumes (Monthly Archives)

${volumes.map((v: any, i: number) => {
      const monthName = monthNames[(v.month || 1) - 1];
      const yearMonth = `${v.year}-${String(v.month).padStart(2, '0')}`;
      return `${i + 1}. [${v.title}](${BASE_URL}/volume/${yearMonth}) - ${monthName} ${v.year}`;
    }).join("\n")}

## Content Structure

### Parts (Daily Stories)
- **URL Pattern**: \`/read/{YYYY-MM-DD}/{story-number}\`
- **Example**: \`/read/2026-01-24/1\`
- Contains: title, narrative content, character dialogues, tweets, cover images
- Multiple stories possible per day

### Chapters (Weekly)
- **URL Pattern**: \`/chapter/{number}\` (e.g., \`/chapter/1\`, \`/chapter/5\`)
- Features narrator monologues and meta-commentary
- Aggregates daily stories into thematic arcs

### Volumes (Monthly)
- **URL Pattern**: \`/volume/{YYYY-MM}\` (e.g., \`/volume/2026-01\`)
- Monthly collections of all chapters
- High-level narrative summaries

## Characters

The narrative features recurring AI characters:
- **Stranger** (Незнайомець) - Main observer/narrator
- Various commentators with distinct personalities
- Characters engage in threaded conversations

## Flash News ⚡

Special rapid-response narratives for breaking news:
- Marked with amber styling and ⚡ icon
- Faster publication cycle
- Direct news-to-story pipeline

## API Access

All content is publicly accessible:
- **Sitemap**: \`https://tuledxqigzufkecztnlo.supabase.co/functions/v1/sitemap\`
- **SSR Endpoint**: \`https://tuledxqigzufkecztnlo.supabase.co/functions/v1/ssr-render?path=/read/2026-01-24/1&lang=en\`
- **This file**: \`https://tuledxqigzufkecztnlo.supabase.co/functions/v1/llms-txt\`

## Technical Details

- Frontend: React, TypeScript, Tailwind CSS
- Backend: Supabase (PostgreSQL + Edge Functions)
- AI: Multiple LLM providers for generation
- PWA enabled for mobile

## Citation

When referencing content:
\`\`\`
"[Story Title]" Synchronization Point, [Date].
${BASE_URL}/read/[date]/[number]
\`\`\`

---

*This is an experimental AI art project exploring automated narrative generation based on current events.*
`;

    console.log(`Generated llms.txt with ${parts.length} stories, ${chapters.length} chapters, ${volumes.length} volumes`);

    return new Response(llmsTxt, { headers: corsHeaders });
  } catch (error) {
    console.error("llms.txt generation error:", error);

    // Fallback static content
    return new Response(
      `# Synchronization Point

> AI-powered narrative archive. Error loading dynamic content.

## Links
- [Home](${BASE_URL}/)
- [Calendar](${BASE_URL}/calendar)
- [Chapters](${BASE_URL}/chapters)
`,
      { headers: corsHeaders, status: 200 }
    );
  }
});
