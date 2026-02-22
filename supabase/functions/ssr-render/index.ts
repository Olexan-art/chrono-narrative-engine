import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_URL = "https://bravennow.com";

// Bot detection patterns
const BOT_PATTERNS: Record<string, { type: string; category: string }> = {
  // Search engines
  googlebot: { type: 'googlebot', category: 'search' },
  'google-inspectiontool': { type: 'google-inspection', category: 'search' },
  bingbot: { type: 'bingbot', category: 'search' },
  slurp: { type: 'yahoobot', category: 'search' },
  duckduckbot: { type: 'duckduckbot', category: 'search' },
  baiduspider: { type: 'baiduspider', category: 'search' },
  yandexbot: { type: 'yandexbot', category: 'search' },
  sogou: { type: 'sogoubot', category: 'search' },
  exabot: { type: 'exabot', category: 'search' },
  'mj12bot': { type: 'majesticbot', category: 'search' },
  'ahrefsbot': { type: 'ahrefsbot', category: 'search' },
  'semrushbot': { type: 'semrushbot', category: 'search' },

  // AI bots
  gptbot: { type: 'gptbot', category: 'ai' },
  chatgpt: { type: 'chatgpt', category: 'ai' },
  'chatgpt-user': { type: 'chatgpt-user', category: 'ai' },
  claudebot: { type: 'claudebot', category: 'ai' },
  'claude-web': { type: 'claude-web', category: 'ai' },
  anthropic: { type: 'anthropic', category: 'ai' },
  perplexitybot: { type: 'perplexitybot', category: 'ai' },
  'cohere-ai': { type: 'cohere', category: 'ai' },
  'bytespider': { type: 'bytedance', category: 'ai' },
  'ccbot': { type: 'commoncrawl', category: 'ai' },
  'diffbot': { type: 'diffbot', category: 'ai' },
  'omgili': { type: 'omgili', category: 'ai' },
  'youbot': { type: 'youbot', category: 'ai' },
  'applebot': { type: 'applebot', category: 'ai' },
  'ia_archiver': { type: 'alexa', category: 'ai' },

  // Social
  facebookexternalhit: { type: 'facebook', category: 'social' },
  twitterbot: { type: 'twitter', category: 'social' },
  linkedinbot: { type: 'linkedin', category: 'social' },
  pinterestbot: { type: 'pinterest', category: 'social' },
  slackbot: { type: 'slack', category: 'social' },
  telegrambot: { type: 'telegram', category: 'social' },
  whatsapp: { type: 'whatsapp', category: 'social' },
  discordbot: { type: 'discord', category: 'social' },

  // Other crawlers
  'site-shot': { type: 'screenshot', category: 'other' },
  'headlesschrome': { type: 'headless', category: 'other' },
  phantomjs: { type: 'phantomjs', category: 'other' },
  'lighthouse': { type: 'lighthouse', category: 'other' },
  'chrome-lighthouse': { type: 'lighthouse', category: 'other' },
  'pagespeed': { type: 'pagespeed', category: 'other' },
  'gtmetrix': { type: 'gtmetrix', category: 'other' },
};

function detectBot(userAgent: string): { type: string; category: string } | null {
  if (!userAgent) return null;

  const ua = userAgent.toLowerCase();

  for (const [pattern, info] of Object.entries(BOT_PATTERNS)) {
    if (ua.includes(pattern)) {
      return info;
    }
  }

  // Generic bot detection
  if (ua.includes('bot') || ua.includes('crawl') || ua.includes('spider') || ua.includes('scraper')) {
    return { type: 'unknown-bot', category: 'other' };
  }

  return null;
}

async function logBotVisit(
  supabase: any,
  botInfo: { type: string; category: string },
  path: string,
  userAgent: string,
  referer: string | null,
  startTime: number,
  cacheStatus: 'HIT' | 'MISS'
) {
  try {
    const responseTime = Date.now() - startTime;

    await supabase.from('bot_visits').insert({
      bot_type: botInfo.type,
      bot_category: botInfo.category,
      path,
      user_agent: userAgent?.substring(0, 500),
      referer: referer?.substring(0, 500),
      response_time_ms: responseTime,
      status_code: 200,
      cache_status: cacheStatus
    });

    console.log(`Bot visit logged: ${botInfo.type} (${botInfo.category}) -> ${path} [${cacheStatus}]`);
  } catch (error) {
    console.error('Failed to log bot visit:', error);
  }
}

Deno.serve(async (req) => {
  const startTime = Date.now();

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    // NOTE: Support POST body for tooling/testing; GET+query is still the canonical interface.
    const body = req.method !== "GET" ? await req.json().catch(() => null) : null;
    const path = url.searchParams.get("path") || body?.url || body?.path || "/";
    const lang = url.searchParams.get("lang") || body?.lang || "en";
    const useCache = (url.searchParams.get("cache") || body?.cache) === "true"; // Default: NO internal cache (Cloudflare only)
    const userAgent = req.headers.get("user-agent") || "";
    const referer = req.headers.get("referer");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Detect bot
    const botInfo = detectBot(userAgent);

    // Try to serve from cache first (if enabled)
    if (useCache) {
      const { data: cached } = await supabase
        .from("cached_pages")
        .select("html, expires_at")
        .eq("path", path)
        .maybeSingle();

      if (cached && new Date(cached.expires_at) > new Date()) {
        console.log(`Serving cached page for ${path} [CACHE HIT]`);

        // Log bot visit with CACHE HIT
        if (botInfo) {
          logBotVisit(supabase, botInfo, path, userAgent, referer, startTime, 'HIT');
        }

        return new Response(cached.html, {
          headers: {
            ...corsHeaders,
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=86400",
            "X-Cache": "HIT",
          },
        });
      }
    }

    // Log bot visit with CACHE MISS (will generate fresh content)
    if (botInfo) {
      logBotVisit(supabase, botInfo, path, userAgent, referer, startTime, 'MISS');
    }

    // Parse the path to determine content type
    const readMatch = path.match(/^\/read\/(\d{4}-\d{2}-\d{2})\/(\d+)$/);
    const readDateMatch = path.match(/^\/read\/(\d{4}-\d{2}-\d{2})$/);
    // Support both canonical numeric route (/chapter/15) and legacy UUID route (/chapter/<uuid>)
    const chapterNumberMatch = path.match(/^\/chapter\/(\d+)$/);
    const chapterUuidMatch = path.match(/^\/chapter\/([a-f0-9-]+)$/);
    const volumeMatch = path.match(/^\/volume\/(\d{4}-\d{2})$/);
    const dateMatch = path.match(/^\/date\/(\d{4}-\d{2}-\d{2})$/);
    // News article match: /news/us/some-slug or /news/US/some-slug
    const newsArticleMatch = path.match(/^\/news\/([a-zA-Z]{2})\/([a-z0-9-]+)$/i);
    // News country list: /news/us or /news/ua or /news/US
    const newsCountryMatch = path.match(/^\/news\/([a-zA-Z]{2})$/i);
    // Wiki entity page: /wiki/entity-slug-uuid or /wiki/uuid
    const wikiEntityMatch = path.match(/^\/wiki\/([a-z0-9-]+)$/);

    let html = "";
    let title = "BravenNow | Brave New World";
    let description = "Brave New World — A book that writes itself through smart news based on real news events.";
    let image = `${BASE_URL}/favicon.svg`;
    let canonicalUrl = BASE_URL + path;
    let faqItems: { question: string; answer: string }[] = [];

    if (path === "/sitemap") {
      // HTML sitemap page (critical for crawlers like Screaming Frog)
      title = "Sitemap | Точка Синхронізації";
      description = "HTML sitemap with links to all major sections and content pages.";

      const [{ data: countries }, { data: volumes }, { data: chapters }, { data: partsForDates }, { data: partsForStories }] = await Promise.all([
        supabase
          .from("news_countries")
          .select("code, name, name_en, flag, sort_order")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        supabase
          .from("volumes")
          .select("id, year, month, title, title_en, title_pl")
          .order("year", { ascending: false })
          .order("month", { ascending: false })
          .limit(300),
        supabase
          .from("chapters")
          .select("number, title, title_en, title_pl")
          .order("number", { ascending: false })
          .limit(300),
        // dates list (used for /date/:date links)
        supabase
          .from("parts")
          .select("date")
          .eq("status", "published")
          .order("date", { ascending: false })
          .limit(1000),
        // story links (sample up to 1000 newest; full coverage via sitemap.xml)
        supabase
          .from("parts")
          .select("date, number, title, title_en, title_pl")
          .eq("status", "published")
          .order("date", { ascending: false })
          .order("number", { ascending: false })
          .limit(1000),
      ]);

      const uniqueDates = [...new Set((partsForDates || []).map((p: { date: string }) => p.date))].slice(0, 120);
      html = generateSitemapHTML(
        {
          countries: countries || [],
          volumes: volumes || [],
          chapters: chapters || [],
          dates: uniqueDates,
          stories: partsForStories || [],
        },
        lang,
      );
    } else if (path === "/news") {
      // News hub (/news)
      title = "News | Точка Синхронізації";
      description = "AI-curated news by country.";
      const { data: countries } = await supabase
        .from("news_countries")
        .select("code, name, name_en, flag, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      html = generateNewsHubHTML(countries || [], lang);
    } else if (path === "/chapters") {
      title = "Chapters | Точка Синхронізації";
      description = "All chapters.";

      const { data: chapters } = await supabase
        .from("chapters")
        .select("number, title, title_en, title_pl")
        .order("number", { ascending: false })
        .limit(1000);

      html = generateChaptersIndexHTML(chapters || [], lang);
    } else if (path === "/volumes") {
      title = "Volumes | Точка Синхронізації";
      description = "All volumes.";

      const { data: volumes } = await supabase
        .from("volumes")
        .select("year, month, title, title_en, title_pl")
        .order("year", { ascending: false })
        .order("month", { ascending: false })
        .limit(1000);

      html = generateVolumesIndexHTML(volumes || [], lang);
    } else if (path === "/wiki") {
      // Wiki catalog page
      title = "Entity Catalog | Echoes Wiki";
      description = "People, companies and organizations in the news. Browse entities mentioned in our AI-curated news coverage.";

      const { data: entities } = await supabase
        .from("wiki_entities")
        .select("id, slug, name, name_en, description, description_en, image_url, entity_type, search_count")
        .order("search_count", { ascending: false })
        .limit(100);

      html = generateWikiCatalogHTML(entities || [], lang);
    } else if (path === "/topics") {
      // Topics catalog page
      title = lang === "en"
        ? "News Topics & Categories | BraveNNow"
        : "Теми та Категорії Новин | BraveNNow";
      description = lang === "en"
        ? "Browse all news topics and categories. Find articles grouped by subject, track key entities and follow chronological timelines."
        : "Перегляньте всі теми та категорії новин. Знайдіть статті згруповані за предметом, відстежуйте ключові сутності та слідкуйте за хронологічними таймлайнами.";
      canonicalUrl = `${BASE_URL}/topics`;

      // Fetch themes from recent news items and aggregate counts
      const { data: themeRows } = await supabase
        .from("news_rss_items")
        .select("themes")
        .not("themes", "is", null)
        .order("published_at", { ascending: false })
        .limit(10000);

      const topicCounts = new Map<string, number>();
      for (const row of themeRows || []) {
        if (Array.isArray(row.themes)) {
          for (const t of row.themes) {
            if (t && typeof t === "string") {
              topicCounts.set(t, (topicCounts.get(t) || 0) + 1);
            }
          }
        }
      }
      const topicList = Array.from(topicCounts.entries())
        .filter(([, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1])
        .map(([topic, count]) => ({ topic, count }));

      html = generateTopicsCatalogHTML(topicList, lang);
    } else if (path.startsWith("/topics/") && path.length > "/topics/".length) {
      // Individual topic page
      const topicSlug = path.slice("/topics/".length);
      const topic = decodeURIComponent(topicSlug);

      title = lang === "en"
        ? `${topic} | News Topics | BraveNNow`
        : `${topic} | Теми Новин | BraveNNow`;
      description = lang === "en"
        ? `Latest news articles tagged with "${topic}". Follow the timeline of events, related topics, and entities.`
        : `Останні новинні статті з тегом "${topic}". Відстежуйте хронологію подій, пов'язані теми та сутності.`;
      canonicalUrl = `${BASE_URL}/topics/${topicSlug}`;

      // Fetch recent news items for this topic
      const { data: topicNews, error: topicNewsError } = await supabase
        .from("news_rss_items")
        .select("id, slug, title, title_en, description, description_en, published_at, country:news_countries(code, name, name_en, flag), image_url, themes, themes_en")
        .contains("themes", [topic])
        .order("published_at", { ascending: false })
        .limit(30);

      if (topicNewsError) console.error("[ssr-render] topics query error:", topicNewsError);
      html = generateTopicPageHTML(topic, topicNews || [], lang);
    } else if (path === "/ink-abyss") {
      // Ink Abyss gallery page
      title = "The Ink Abyss | Satirical Art Gallery";
      description = "A timeline gallery of satirical political artwork and caricatures inspired by world news.";

      const { data: inkItems } = await supabase
        .from("outrage_ink")
        .select(`
          id, image_url, title, likes, dislikes, created_at,
          news_item:news_rss_items(slug, title, title_en, country:news_countries(code))
        `)
        .order("created_at", { ascending: false })
        .limit(50);

      html = generateInkAbyssHTML(inkItems || [], lang);
    } else if (path === "/calendar" || path === "/read") {
      // Lightweight crawler-friendly index of recent dates
      title = "Archive | Точка Синхронізації";
      description = "Browse recent dates.";

      const { data: datesRaw } = await supabase
        .from("parts")
        .select("date")
        .eq("status", "published")
        .order("date", { ascending: false })
        .limit(1000);
      const dates = [...new Set((datesRaw || []).map((d: { date: string }) => d.date))].slice(0, 120);

      html = generateCalendarIndexHTML(dates, lang);
    } else if (volumeMatch) {
      const [, yearMonth] = volumeMatch;
      const [yearStr, monthStr] = yearMonth.split("-");
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);

      const { data: volume } = await supabase
        .from("volumes")
        .select("*")
        .eq("year", year)
        .eq("month", month)
        .maybeSingle();

      if (volume) {
        const titleField = lang === "en" ? "title_en" : lang === "pl" ? "title_pl" : "title";
        title = volume[titleField] || volume.title;
        description = volume.summary_en || volume.summary || description;
        image = volume.cover_image_url || image;

        const { data: chapters } = await supabase
          .from("chapters")
          .select("number, title, title_en, title_pl")
          .eq("volume_id", volume.id)
          .order("number", { ascending: true });

        html = generateVolumeHTML(volume, chapters || [], lang);
      }
    } else if (readMatch) {
      // Story page
      const [, date, storyNumber] = readMatch;
      const partIndex = parseInt(storyNumber, 10) - 1;

      const { data: parts } = await supabase
        .from("parts")
        .select("*, chapter:chapters(*, volume:volumes(*))")
        .eq("date", date)
        .eq("status", "published")
        .order("number", { ascending: true });

      const part = parts?.[partIndex];

      if (part) {
        const titleField = lang === "en" ? "title_en" : lang === "pl" ? "title_pl" : "title";
        const contentField = lang === "en" ? "content_en" : lang === "pl" ? "content_pl" : "content";

        title = part[titleField] || part.title;
        description = (part[contentField] || part.content)?.substring(0, 160) + "...";
        image = part.cover_image_url || image;

        html = generateStoryHTML(part, lang, canonicalUrl);
      }
    } else if (readDateMatch) {
      // Date list under /read/:date (canonical SPA route)
      const [, date] = readDateMatch;

      const { data: parts } = await supabase
        .from("parts")
        .select("*, chapter:chapters(*)")
        .eq("date", date)
        .eq("status", "published")
        .order("number", { ascending: true });

      if (parts && parts.length > 0) {
        title = `${date} | Точка Синхронізації`;
        description = `${parts.length} ${parts.length === 1 ? "історія" : "історій"} за ${date}`;
        html = generateDateHTML(parts, date, lang, canonicalUrl);
      }
    } else if (chapterNumberMatch || chapterUuidMatch) {
      // Chapter page
      const chapterNumber = chapterNumberMatch ? parseInt(chapterNumberMatch[1], 10) : null;
      const chapterUuid = chapterUuidMatch ? chapterUuidMatch[1] : null;

      const chapterQuery = supabase
        .from("chapters")
        .select("*, volume:volumes(*)");

      const { data: chapter } = chapterNumber !== null
        ? await chapterQuery.eq("number", chapterNumber).maybeSingle()
        : await chapterQuery.eq("id", chapterUuid).maybeSingle();

      if (chapter) {
        const titleField = lang === "en" ? "title_en" : lang === "pl" ? "title_pl" : "title";
        const descField = lang === "en" ? "description_en" : lang === "pl" ? "description_pl" : "description";

        title = chapter[titleField] || chapter.title;
        description = chapter[descField] || chapter.description || description;
        image = chapter.cover_image_url || image;

        html = generateChapterHTML(chapter, lang, canonicalUrl);
      }
    } else if (newsArticleMatch) {
      // News article page: /news/us/slug - include "More from country" and "Other countries" links
      const [, countryCode, slug] = newsArticleMatch;

      // Fetch article and all countries for cross-linking (include original_content and news_analysis for SSR)
      const [{ data: newsItem }, { data: allCountries }] = await Promise.all([
        supabase
          .from("news_rss_items")
          .select("*, original_content, news_analysis, country:news_countries(*)")
          .eq("slug", slug)
          .maybeSingle(),
        supabase
          .from("news_countries")
          .select("id, code, name, name_en, flag")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
      ]);

      if (newsItem) {
        title = newsItem.title_en || newsItem.title;
        description = (newsItem.content_en || newsItem.content || newsItem.description_en || newsItem.description)?.substring(0, 160) + "...";
        image = newsItem.image_url || image;

        // Fetch "More from country" links (6 articles), and wiki entities
        const [{ data: moreFromCountry }, { data: wikiLinks }] = await Promise.all([
          supabase
            .from("news_rss_items")
            .select("slug, title, title_en, published_at, country:news_countries(code, name_en, flag)")
            .eq("country_id", newsItem.country_id)
            .eq("is_archived", false)
            .neq("id", newsItem.id)
            .order("published_at", { ascending: false })
            .limit(6),
          supabase
            .from("news_wiki_entities")
            .select("wiki_entity:wiki_entities(id, name, name_en, description, description_en, extract, extract_en, image_url, wiki_url, wiki_url_en, entity_type)")
            .eq("news_item_id", newsItem.id)
            .limit(10)
        ]);

        // Extract wiki entities from response
        const wikiEntities = (wikiLinks || []).map((link: any) => link.wiki_entity).filter(Boolean);

        // Find the most mentioned entity (for Entity Intersection Graph)
        let mainEntityForGraph: any = null;
        let relatedEntitiesForGraph: any[] = [];

        if (wikiEntities.length > 0) {
          // Use the first entity as main (most relevant based on order)
          mainEntityForGraph = wikiEntities[0];

          // Find other entities mentioned with this main entity in other news
          if (mainEntityForGraph) {
            const { data: relatedNewsLinks } = await supabase
              .from("news_wiki_entities")
              .select("news_item_id")
              .eq("wiki_entity_id", mainEntityForGraph.id)
              .neq("news_item_id", newsItem.id)
              .limit(50);

            if (relatedNewsLinks && relatedNewsLinks.length > 0) {
              const relatedNewsIds = relatedNewsLinks.map((l: any) => l.news_item_id);

              const { data: otherEntityLinks } = await supabase
                .from("news_wiki_entities")
                .select("wiki_entity:wiki_entities(id, name, name_en, slug, image_url, entity_type)")
                .in("news_item_id", relatedNewsIds)
                .neq("wiki_entity_id", mainEntityForGraph.id);

              // Count and dedupe
              const entityCounts = new Map<string, { entity: any; count: number }>();
              for (const link of otherEntityLinks || []) {
                if (!link.wiki_entity) continue;
                const e = link.wiki_entity as any;
                const existing = entityCounts.get(e.id);
                if (existing) existing.count++;
                else entityCounts.set(e.id, { entity: e, count: 1 });
              }

              relatedEntitiesForGraph = Array.from(entityCounts.values())
                .sort((a, b) => b.count - a.count)
                .slice(0, 12)
                .map(({ entity: e, count }) => ({ ...e, shared_news_count: count }));
            }
          }
        }

        // Fetch "Other countries" news (3 per country)
        const otherCountries = (allCountries || []).filter((c: any) => c.id !== newsItem.country_id);
        const otherCountriesNewsPromises = otherCountries.map((c: any) =>
          supabase
            .from("news_rss_items")
            .select("slug, title, title_en, published_at, country:news_countries(code, name_en, flag)")
            .eq("country_id", c.id)
            .eq("is_archived", false)
            .order("published_at", { ascending: false })
            .limit(3)
        );
        const otherCountriesResults = await Promise.all(otherCountriesNewsPromises);
        const otherCountriesNews = otherCountriesResults.flatMap(r => r.data || []);

        // Generate FAQ items from key_points for FAQPage schema
        const keyPoints = newsItem.key_points_en || newsItem.key_points || [];
        const parsedKeyPoints = Array.isArray(keyPoints) ? keyPoints : (typeof keyPoints === 'string' ? JSON.parse(keyPoints) : []);
        if (parsedKeyPoints.length > 0) {
          const articleTitle = newsItem.title_en || newsItem.title;
          faqItems = parsedKeyPoints.map((point: string, index: number) => ({
            question: `What is key point ${index + 1} about "${articleTitle}"?`,
            answer: point
          }));
        }

        html = generateNewsHTML(newsItem, lang, canonicalUrl, moreFromCountry || [], otherCountriesNews, wikiEntities, mainEntityForGraph, relatedEntitiesForGraph);
      }
    } else if (newsCountryMatch) {
      // News country listing page: /news/us - include cross-country links
      const [, countryCode] = newsCountryMatch;

      // Fetch country info and all countries for cross-linking
      const [{ data: country }, { data: allCountries }] = await Promise.all([
        supabase
          .from("news_countries")
          .select("*")
          .ilike("code", countryCode)
          .maybeSingle(),
        supabase
          .from("news_countries")
          .select("id, code, name, name_en, flag")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
      ]);

      // Fetch recent news for this country (99 items for full listing)
      const { data: newsItems } = await supabase
        .from("news_rss_items")
        .select("*, country:news_countries(*)")
        .eq("country_id", country?.id)
        .eq("is_archived", false)
        .order("published_at", { ascending: false })
        .limit(99);

      // Fetch news from other countries for cross-linking
      const otherCountries = (allCountries || []).filter((c: any) => c.id !== country?.id);
      const otherCountriesNewsPromises = otherCountries.map((c: any) =>
        supabase
          .from("news_rss_items")
          .select("slug, title, title_en, published_at, country:news_countries(code, name_en, flag)")
          .eq("country_id", c.id)
          .eq("is_archived", false)
          .order("published_at", { ascending: false })
          .limit(3)
      );
      const otherCountriesResults = await Promise.all(otherCountriesNewsPromises);
      const otherCountriesNews = otherCountriesResults.flatMap(r => r.data || []);

      if (country) {
        const countryName = country.name_en || country.name;
        title = `${country.flag} ${countryName} News | Synchronization Point`;
        description = `Latest news from ${countryName}. AI-curated news digest with retelling and character dialogues.`;

        html = generateNewsCountryHTML(newsItems || [], country, lang, canonicalUrl, otherCountriesNews);
      }
    } else if (wikiEntityMatch) {
      // Wiki entity page: /wiki/slug or /wiki/uuid
      const [, entitySlug] = wikiEntityMatch;

      // Try slug first, then id
      let entityQuery = supabase.from("wiki_entities").select("*");
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entitySlug);

      if (isUuid) {
        entityQuery = entityQuery.eq("id", entitySlug);
      } else {
        entityQuery = entityQuery.eq("slug", entitySlug);
      }

      const { data: entity } = await entityQuery.maybeSingle();

      if (entity) {
        const entityName = entity.name_en || entity.name;
        title = `${entityName} | Echoes Wiki`;
        description = entity.description_en || entity.description || entity.extract_en?.substring(0, 160) || entity.extract?.substring(0, 160) || `Information about ${entityName}`;
        image = entity.image_url || image;
        canonicalUrl = `${BASE_URL}/wiki/${entity.slug || entity.id}`;

        // Fetch related news, wiki entity links, narrative analysis, caricatures, and categories in parallel
        const [{ data: newsLinks }, { data: wikiLinksOut }, { data: wikiLinksIn }, { data: narrativeData }, { data: caricaturesData }, { data: categoriesData }] = await Promise.all([
          // Fetch ALL linked news (not just 30, to match React component)
          supabase
            .from("news_wiki_entities")
            .select(`
              news_item:news_rss_items(id, slug, title, title_en, description_en, published_at, themes, themes_en, keywords, likes, dislikes, country:news_countries(code, flag, name_en))
            `)
            .eq("wiki_entity_id", entity.id)
            .order("created_at", { ascending: false })
            .limit(500),
          // Wiki entity links (outbound)
          supabase
            .from("wiki_entity_links")
            .select("target_entity:wiki_entities!wiki_entity_links_target_entity_id_fkey(id, name, name_en, slug, image_url, entity_type, description_en, description)")
            .eq("source_entity_id", entity.id),
          // Wiki entity links (inbound)
          supabase
            .from("wiki_entity_links")
            .select("source_entity:wiki_entities!wiki_entity_links_source_entity_id_fkey(id, name, name_en, slug, image_url, entity_type, description_en, description)")
            .eq("target_entity_id", entity.id),
          // Latest narrative analysis
          supabase
            .from("narrative_analyses")
            .select("analysis, year_month, language, news_count")
            .eq("entity_id", entity.id)
            .eq("language", "en")
            .order("year_month", { ascending: false })
            .limit(1),
          // Caricatures (both direct and via linked news items)
          supabase
            .from("outrage_ink_entities")
            .select("outrage_ink_id")
            .eq("wiki_entity_id", entity.id)
            .limit(100),
          // Wiki categories
          supabase
            .from("wiki_entity_categories")
            .select("category")
            .eq("wiki_entity_id", entity.id)
            .limit(50)
        ]);

        const linkedNews = (newsLinks || [])
          .map((l: any) => l.news_item)
          .filter(Boolean);

        // Merge wiki entity links (both directions, deduped)
        const wikiLinkedEntities: any[] = [];
        const seenIds = new Set<string>();
        for (const link of (wikiLinksOut || [])) {
          const e = (link as any).target_entity;
          if (e && !seenIds.has(e.id)) { seenIds.add(e.id); wikiLinkedEntities.push(e); }
        }
        for (const link of (wikiLinksIn || [])) {
          const e = (link as any).source_entity;
          if (e && !seenIds.has(e.id)) { seenIds.add(e.id); wikiLinkedEntities.push(e); }
        }

        // Latest narrative analysis
        const latestNarrative = narrativeData?.[0] || null;

        // Aggregate topics and keywords from linked news
        const topicCounts: Record<string, number> = {};
        const keywordCounts: Record<string, number> = {};
        for (const news of linkedNews) {
          const themes = news.themes_en || news.themes || [];
          for (const t of themes) { topicCounts[t] = (topicCounts[t] || 0) + 1; }
          const kws = news.keywords || [];
          for (const k of kws) { keywordCounts[k] = (keywordCounts[k] || 0) + 1; }
        }
        const topTopics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 12);
        const topKeywords = Object.entries(keywordCounts).sort((a, b) => b[1] - a[1]).slice(0, 20);

        // Fetch related entities
        const newsIdsForEntity = linkedNews.map((n: any) => n.id);
        let relatedEntities: any[] = [];

        if (newsIdsForEntity.length > 0) {
          const { data: otherLinks } = await supabase
            .from("news_wiki_entities")
            .select(`wiki_entity:wiki_entities(id, name, name_en, slug, image_url, entity_type)`)
            .in("news_item_id", newsIdsForEntity)
            .neq("wiki_entity_id", entity.id);

          // Count and dedupe
          const entityCounts = new Map<string, { entity: any; count: number }>();
          for (const link of otherLinks || []) {
            if (!link.wiki_entity) continue;
            const e = link.wiki_entity as any;
            const existing = entityCounts.get(e.id);
            if (existing) existing.count++;
            else entityCounts.set(e.id, { entity: e, count: 1 });
          }

          relatedEntities = Array.from(entityCounts.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 10)
            .map(({ entity: e, count }) => ({ ...e, shared_news_count: count }));
        }

        // Aggregate stats
        const totalLikes = linkedNews.reduce((s: number, n: any) => s + (n.likes || 0), 0);
        const totalDislikes = linkedNews.reduce((s: number, n: any) => s + (n.dislikes || 0), 0);

        // Extract caricature IDs and categories
        const caricatureIds = (caricaturesData || []).map((c: any) => c.outrage_ink_id).filter(Boolean);
        const categories = (categoriesData || []).map((c: any) => c.category).filter(Boolean);

        // Expand caricatures to include those linked via news items
        let expandedCaricatureIds = new Set<string>(caricatureIds);
        const newsItemIds = linkedNews.map((n: any) => n.id).filter(Boolean);
        if (newsItemIds.length > 0) {
          const { data: newsBasedInks } = await supabase
            .from("outrage_ink")
            .select("id")
            .in("news_item_id", newsItemIds)
            .limit(100);
          
          if (newsBasedInks) {
            newsBasedInks.forEach(ink => expandedCaricatureIds.add(ink.id));
          }
        }
        const finalCaricatureIds = Array.from(expandedCaricatureIds);

        // Extract Information Card from raw_data
        const rawData = entity.raw_data as Record<string, any> | null;
        const infoCardContent = rawData?.info_card_content || null;
        const infoCardSources = (rawData?.info_card_sources as { title: string; url: string }[]) || [];

        html = generateWikiEntityHTML(entity, linkedNews, relatedEntities, lang, canonicalUrl, topTopics, topKeywords, totalLikes, totalDislikes, wikiLinkedEntities, latestNarrative, finalCaricatureIds, categories, infoCardContent, infoCardSources);
      }
    } else if (dateMatch) {
      // Date stories page
      const [, date] = dateMatch;

      const { data: parts } = await supabase
        .from("parts")
        .select("*, chapter:chapters(*)")
        .eq("date", date)
        .eq("status", "published")
        .order("number", { ascending: true });

      if (parts && parts.length > 0) {
        title = `${date} | Точка Синхронізації`;
        description = `${parts.length} ${parts.length === 1 ? "історія" : "історій"} за ${date}`;

        html = generateDateHTML(parts, date, lang, canonicalUrl);
      }
    } else if (path === "/" || path === "") {
      // Home page - fetch all sections for full content
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [
        { data: latestParts },
        { data: latestUsNews },
        { data: latestNewsAll },
        { data: latestChapters },
        { data: countries },
        { data: trendingEntityMentions24h },
        { data: trendingEntityMentionsWeek },
        { data: latestSimpleUsNews }
      ] = await Promise.all([
        supabase
          .from("parts")
          .select("*, chapter:chapters(*)")
          .eq("status", "published")
          .order("date", { ascending: false })
          .order("number", { ascending: false })
          .limit(6),
        // Full Retelling (with content_en) - USA only
        supabase
          .from("news_rss_items")
          .select("id, slug, title, title_en, content_en, published_at, country:news_countries!inner(code, name_en, flag)")
          .eq("country.code", "US")
          .eq("is_archived", false)
          .not("content_en", "is", null)
          .order("published_at", { ascending: false })
          .limit(6),
        // Latest news for proportional distribution (100 items to work with)
        supabase
          .from("news_rss_items")
          .select("id, slug, title, title_en, content_en, published_at, category, country:news_countries(id, code)")
          .eq("is_archived", false)
          .not("slug", "is", null)
          .order("published_at", { ascending: false })
          .limit(100),
        supabase
          .from("chapters")
          .select("number, title, title_en, title_pl, description, description_en")
          .not("narrator_monologue", "is", null)
          .order("created_at", { ascending: false })
          .limit(6),
        supabase
          .from("news_countries")
          .select("id, code, name, name_en, flag")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        // Trending wiki entities from last 24 hours
        supabase
          .from("news_wiki_entities")
          .select(`
            wiki_entity_id,
            news_item_id,
            wiki_entity:wiki_entities(id, name, name_en, description, description_en, image_url, wiki_url, wiki_url_en),
            news_item:news_rss_items(id, title, title_en, slug, country_id)
          `)
          .gte("created_at", twentyFourHoursAgo)
          .order("created_at", { ascending: false }),
        // Trending wiki entities from last week
        supabase
          .from("news_wiki_entities")
          .select(`
            wiki_entity_id,
            news_item_id,
            wiki_entity:wiki_entities(id, name, name_en, description, description_en, image_url, wiki_url, wiki_url_en),
            news_item:news_rss_items(id, title, title_en, slug, country_id)
          `)
          .gte("created_at", oneWeekAgo)
          .order("created_at", { ascending: false }),
        // Latest Simple US News (List)
        supabase
          .from("news_rss_items")
          .select("slug, title, title_en, published_at, category, country:news_countries!inner(code)")
          .eq("country.code", "US")
          .eq("is_archived", false)
          .order("published_at", { ascending: false })
          .limit(10)
      ]);

      // Process proportional news feed (50% USA, 25% PL, 25% UA - NO India)
      const retoldIds = new Set((latestUsNews || []).map((n: any) => n.id));
      const countryIdToCode = new Map((countries || []).map((c: any) => [c.id, c.code.toUpperCase()]));

      // Group by country (USA, PL, UA only)
      const byCountry: Record<string, any[]> = { US: [], PL: [], UA: [], OTHER: [] };
      for (const item of (latestNewsAll || []) as any[]) {
        if (retoldIds.has(item.id)) continue; // Skip retold items
        const code = (item.country as any)?.code?.toUpperCase() || 'OTHER';
        if (['US', 'PL', 'UA'].includes(code)) {
          byCountry[code].push(item);
        } else {
          byCountry.OTHER.push(item);
        }
      }

      // Take proportional amounts: 50% USA (10), 25% PL (5), 25% UA (5)
      const latestNewsProportional = [
        ...byCountry.US.slice(0, 10),
        ...byCountry.PL.slice(0, 5),
        ...byCountry.UA.slice(0, 5),
      ].sort((a: any, b: any) =>
        new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime()
      ).slice(0, 20);

      // Process trending entities - 24 hours
      const entityMap24h = new Map<string, { entity: any; mentionCount: number; news: any[] }>();
      const countryIdToCodeLower = new Map((countries || []).map((c: any) => [c.id, c.code.toLowerCase()]));

      for (const mention of (trendingEntityMentions24h || [])) {
        if (!mention.wiki_entity || !mention.news_item) continue;
        const entity = mention.wiki_entity as any;
        const newsItem = mention.news_item as any;

        if (!entityMap24h.has(entity.id)) {
          entityMap24h.set(entity.id, { entity, mentionCount: 0, news: [] });
        }
        const existing = entityMap24h.get(entity.id)!;
        existing.mentionCount++;

        if (existing.news.length < 4 && !existing.news.some(n => n.id === newsItem.id) && newsItem.slug) {
          existing.news.push({
            id: newsItem.id,
            title: newsItem.title,
            title_en: newsItem.title_en,
            slug: newsItem.slug,
            countryCode: countryIdToCodeLower.get(newsItem.country_id) || 'us'
          });
        }
      }
      const trendingEntities24h = Array.from(entityMap24h.values())
        .filter(e => e.entity.image_url)
        .sort((a, b) => b.mentionCount - a.mentionCount)
        .slice(0, 5);

      // Process trending entities - Week
      const entityMapWeek = new Map<string, { entity: any; mentionCount: number; news: any[] }>();

      for (const mention of (trendingEntityMentionsWeek || [])) {
        if (!mention.wiki_entity || !mention.news_item) continue;
        const entity = mention.wiki_entity as any;
        const newsItem = mention.news_item as any;

        if (!entityMapWeek.has(entity.id)) {
          entityMapWeek.set(entity.id, { entity, mentionCount: 0, news: [] });
        }
        const existing = entityMapWeek.get(entity.id)!;
        existing.mentionCount++;

        if (existing.news.length < 4 && !existing.news.some(n => n.id === newsItem.id) && newsItem.slug) {
          existing.news.push({
            id: newsItem.id,
            title: newsItem.title,
            title_en: newsItem.title_en,
            slug: newsItem.slug,
            countryCode: countryIdToCodeLower.get(newsItem.country_id) || 'us'
          });
        }
      }
      const trendingEntitiesWeek = Array.from(entityMapWeek.values())
        .filter(e => e.entity.image_url)
        .sort((a, b) => b.mentionCount - a.mentionCount)
        .slice(0, 5);

      // Fetch latest news per country for "News by Country" section
      const countryNewsPromises = (countries || []).map((c: any) =>
        supabase
          .from("news_rss_items")
          .select("slug, title, title_en, published_at, country:news_countries(code, name_en, flag)")
          .eq("country_id", c.id)
          .eq("is_archived", false)
          .order("published_at", { ascending: false })
          .limit(4)
      );
      const countryNewsResults = await Promise.all(countryNewsPromises);
      const countryNewsMap = (countries || []).map((c: any, i: number) => ({
        country: c,
        news: countryNewsResults[i]?.data || []
      }));

      // Fetch top wiki entities for direct links
      const { data: topWikiEntities } = await supabase
        .from("wiki_entities")
        .select("id, slug, name, name_en, entity_type, image_url")
        .not("slug", "is", null)
        .order("search_count", { ascending: false })
        .limit(20);

      html = generateHomeHTML(latestParts || [], lang, canonicalUrl, latestUsNews || [], latestChapters || [], countryNewsMap, latestNewsProportional, trendingEntities24h, trendingEntitiesWeek, topWikiEntities || [], latestSimpleUsNews || []);
    }

    // Generate full HTML document
    const fullHtml = generateFullDocument({
      title,
      description,
      image,
      canonicalUrl,
      lang,
      content: html,
      path,
      faqItems,
    });

    // Save to cache for paths that benefit from caching (homepage: 30 min, others: 1 hour)
    const cacheTtlMinutes = (path === "/" || path === "") ? 30 : 60;
    const expiresAt = new Date(Date.now() + cacheTtlMinutes * 60 * 1000).toISOString();

    try {
      await supabase
        .from("cached_pages")
        .upsert({
          path,
          html: fullHtml,
          title,
          description,
          canonical_url: canonicalUrl,
          expires_at: expiresAt,
          generation_time_ms: Date.now() - startTime,
          html_size_bytes: new TextEncoder().encode(fullHtml).length,
          updated_at: new Date().toISOString(),
        }, { onConflict: "path" });
      console.log(`Cached ${path} (TTL: ${cacheTtlMinutes}min)`);
    } catch (cacheErr) {
      console.error("Cache save failed:", cacheErr);
    }

    return new Response(fullHtml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": `public, max-age=${cacheTtlMinutes * 60}, s-maxage=86400`,
        "X-Cache": "MISS",
      },
    });
  } catch (error) {
    console.error("SSR Error:", error);
    return new Response(
      `<!DOCTYPE html><html><head><title>Error</title></head><body><h1>Error loading content</h1></body></html>`,
      { headers: { ...corsHeaders, "Content-Type": "text/html" }, status: 500 }
    );
  }
});


const ICONS = {
  bookOpen: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
  globe: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  palette: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>`,
  calendar: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>`,
  users: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  menu: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>`,
};

function generateHeaderHTML(lang: string, baseUrl: string) {
  const t = (key: string) => {
    // Simplified translation map for header
    const map: any = {
      'en': { 'hero.title': 'BravenNow', 'header.subtitle': 'Brave New World', 'nav.read': 'Read', 'nav.newsdigest': 'News Digest', 'nav.calendar': 'Calendar', 'nav.admin': 'Admin' },
      'uk': { 'hero.title': 'BravenNow', 'header.subtitle': 'Brave New World', 'nav.read': 'Читати', 'nav.newsdigest': 'Дайджест', 'nav.calendar': 'Календар', 'nav.admin': 'Адмін' },
      'pl': { 'hero.title': 'BravenNow', 'header.subtitle': 'Brave New World', 'nav.read': 'Czytaj', 'nav.newsdigest': 'Przegląd', 'nav.calendar': 'Kalendarz', 'nav.admin': 'Admin' }
    };
    return map[lang]?.[key] || map['en'][key] || key;
  };

  return `
    <header class="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div class="container mx-auto px-4 py-3 md:py-4 flex items-center justify-between">
        <a href="${baseUrl}/" class="flex items-center gap-2 md:gap-3 group text-foreground no-underline">
          <div class="w-8 h-8 md:w-10 md:h-10 rounded overflow-hidden border border-primary/30 group-hover:border-primary transition-all">
            <img src="${baseUrl}/favicon.png" alt="SP" class="w-full h-full object-cover" width="40" height="40" />
          </div>
          <div>
            <h1 class="font-sans font-bold text-base md:text-lg tracking-tight text-foreground m-0">
              ${t("hero.title")}
            </h1>
            <p class="text-[10px] md:text-xs text-muted-foreground font-mono hidden sm:block m-0">
              ${t("header.subtitle")}
            </p>
          </div>
        </a>

        <!-- Desktop Navigation -->
        <nav class="hidden md:flex items-center gap-2">
          <a href="${baseUrl}/" class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 px-3 text-foreground no-underline gap-2">
            ${ICONS.bookOpen}
            <span>${t("nav.read")}</span>
          </a>
          <a href="${baseUrl}/news-digest" class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 px-3 text-foreground no-underline gap-2">
            ${ICONS.globe}
            <span>${t("nav.newsdigest")}</span>
          </a>
          <a href="${baseUrl}/ink-abyss" class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 px-3 text-foreground no-underline gap-2">
            ${ICONS.palette}
            <span>Ink Abyss</span>
          </a>
          <a href="${baseUrl}/media-calendar" class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 px-3 text-foreground no-underline gap-2">
            ${ICONS.calendar}
            <span>${t('nav.calendar')}</span>
          </a>
          <a href="${baseUrl}/wiki" class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 px-3 text-foreground no-underline gap-2">
            ${ICONS.users}
            <span>Wiki</span>
          </a>
        </nav>

        <!-- Mobile Navigation Trigger -->
        <div class="md:hidden flex items-center">
          <label for="mobile-menu-toggle" class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 w-9 p-0 cursor-pointer text-foreground">
             ${ICONS.menu}
          </label>
        </div>
      </div>
      
      <!-- Mobile Menu -->
      <input type="checkbox" id="mobile-menu-toggle" class="hidden peer" />
      <div class="hidden peer-checked:block md:hidden border-t border-border bg-card/95 backdrop-blur-sm">
        <nav class="container mx-auto px-4 py-3 flex flex-col gap-1">
          <a href="${baseUrl}/" class="inline-flex w-full items-center justify-start rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 text-foreground no-underline gap-3">
            ${ICONS.bookOpen}
            ${t("nav.read")}
          </a>
          <a href="${baseUrl}/news-digest" class="inline-flex w-full items-center justify-start rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 text-foreground no-underline gap-3">
             ${ICONS.globe}
            ${t("nav.newsdigest")}
          </a>
          <a href="${baseUrl}/ink-abyss" class="inline-flex w-full items-center justify-start rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 text-foreground no-underline gap-3">
             ${ICONS.palette}
            Ink Abyss
          </a>
          <a href="${baseUrl}/media-calendar" class="inline-flex w-full items-center justify-start rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 text-foreground no-underline gap-3">
             ${ICONS.calendar}
            ${t('nav.calendar')}
          </a>
           <a href="${baseUrl}/wiki" class="inline-flex w-full items-center justify-start rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 text-foreground no-underline gap-3">
             ${ICONS.users}
            Wiki
          </a>
        </nav>
      </div>
    </header>
  `;
}

function generateFooterHTML(lang: string, baseUrl: string) {
  const t = (key: string) => {
    const map: any = {
      'en': { 'footer.style': 'BravenNow - AI Generated History' },
      'uk': { 'footer.style': 'BravenNow - Історія, згенерована ШІ' },
      'pl': { 'footer.style': 'BravenNow - Historia generowana przez SI' }
    };
    return map[lang]?.[key] || map['en'][key] || key;
  };

  return `
    <footer class="border-t border-border/40 bg-[#030711]/95 backdrop-blur-md transition-colors duration-300">
      <div class="container mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between">
        <a href="${baseUrl}/" class="flex items-center gap-2">
          <img src="${baseUrl}/favicon.svg" alt="logo" class="h-6 w-6" />
        </a>
        <nav class="flex flex-wrap items-center gap-2 justify-center">
          <a href="${baseUrl}/" class="inline-flex items-center gap-1 text-sm hover:underline">${t('nav.read')}</a>
          <a href="${baseUrl}/news-digest" class="inline-flex items-center gap-1 text-sm hover:underline">${t('nav.newsdigest')}</a>
          <a href="${baseUrl}/ink-abyss" class="inline-flex items-center gap-1 text-sm hover:underline">Ink Abyss</a>
          <a href="${baseUrl}/media-calendar" class="inline-flex items-center gap-1 text-sm hover:underline">${t('nav.calendar')}</a>
          <a href="${baseUrl}/wiki" class="inline-flex items-center gap-1 text-sm hover:underline">Wiki</a>
        </nav>
        <div class="mt-2 md:mt-0"></div>
      </div>
      <div class="container mx-auto px-4 text-center text-sm text-muted-foreground font-mono py-2">
        ${t('footer.style')} © ${new Date().getFullYear()}
      </div>
    </footer>
  `;
}

function generateFullDocument(opts: {
  title: string;
  description: string;
  image: string;
  canonicalUrl: string;
  lang: string;
  content: string;
  path: string;
  faqItems?: { question: string; answer: string }[];
}) {
  const { title, description, image, canonicalUrl, lang, content, path, faqItems } = opts;
  const BASE_URL = "https://bravennow.com";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": path.includes("/read/") ? "NewsArticle" : path.includes("/news/") && path.split("/").length === 4 ? "NewsArticle" : "WebSite",
    name: title,
    headline: title,
    description,
    image,
    url: canonicalUrl,
    inLanguage: lang === "uk" ? "uk-UA" : lang === "pl" ? "pl-PL" : "en-US",
    publisher: {
      "@type": "Organization",
      name: "BravenNow",
      logo: { "@type": "ImageObject", url: `${BASE_URL}/favicon.svg` },
    },
    author: {
      "@type": "Organization",
      name: "BravenNow AI",
    },
  };

  // Generate FAQPage JSON-LD if faqItems are provided
  const faqJsonLd = faqItems && faqItems.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqItems.map(item => ({
      "@type": "Question",
      "name": item.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": item.answer
      }
    }))
  } : null;

  return `<!DOCTYPE html>
<html lang="${lang}" class="dark"> <!-- Force dark mode class -->
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="apple-touch-icon" href="/favicon.svg" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  
  <!-- Canonical & Language -->
  <link rel="canonical" href="${canonicalUrl}">
  <link rel="alternate" hreflang="uk" href="${canonicalUrl}">
  <link rel="alternate" hreflang="en" href="${canonicalUrl}">
  <link rel="alternate" hreflang="pl" href="${canonicalUrl}">
  <link rel="alternate" hreflang="x-default" href="${canonicalUrl}">
  
  <!-- Open Graph -->
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${image}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:type" content="${path.includes("/read/") || (path.includes("/news/") && path.split("/").length === 4) ? "article" : "website"}">
  <meta property="og:locale" content="${lang === "uk" ? "uk_UA" : lang === "pl" ? "pl-PL" : "en_US"}">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${image}">
  
  <!-- AI/LLM Tags -->
  <meta name="ai:summary" content="${escapeHtml(description)}">
  <meta name="ai:content_type" content="${path.includes("/read/") || (path.includes("/news/") && path.split("/").length === 4) ? "narrative_story" : "website"}">
  <meta name="ai:language" content="${lang}">
  
  <!-- Dublin Core -->
  <meta name="DC.title" content="${escapeHtml(title)}">
  <meta name="DC.description" content="${escapeHtml(description)}">
  <meta name="DC.language" content="${lang === "uk" ? "uk-UA" : lang === "pl" ? "pl-PL" : "en-US"}">
  
  <!-- Robots -->
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
  <meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large">
  
  <!-- JSON-LD -->
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  ${faqJsonLd ? `<script type="application/ld+json">${JSON.stringify(faqJsonLd)}</script>` : ""}
  
  <!-- Tailwind CSS via CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class', // Enable class-based dark mode
      theme: {
        extend: {
          colors: {
            border: "hsl(var(--border))",
            input: "hsl(var(--input))",
            ring: "hsl(var(--ring))",
            background: "hsl(var(--background))",
            foreground: "hsl(var(--foreground))",
            primary: {
              DEFAULT: "hsl(var(--primary))",
              foreground: "hsl(var(--primary-foreground))",
            },
            secondary: {
              DEFAULT: "hsl(var(--secondary))",
              foreground: "hsl(var(--secondary-foreground))",
            },
            destructive: {
              DEFAULT: "hsl(var(--destructive))",
              foreground: "hsl(var(--destructive-foreground))",
            },
            muted: {
              DEFAULT: "hsl(var(--muted))",
              foreground: "hsl(var(--muted-foreground))",
            },
            accent: {
              DEFAULT: "hsl(var(--accent))",
              foreground: "hsl(var(--accent-foreground))",
            },
            popover: {
              DEFAULT: "hsl(var(--popover))",
              foreground: "hsl(var(--popover-foreground))",
            },
            card: {
              DEFAULT: "hsl(var(--card))",
              foreground: "hsl(var(--card-foreground))",
            },
          },
          borderRadius: {
            lg: "var(--radius)",
            md: "calc(var(--radius) - 2px)",
            sm: "calc(var(--radius) - 4px)",
          },
          fontFamily: {
            sans: ["Space Grotesk", "ui-sans-serif", "system-ui", "sans-serif"],
            serif: ["Lora", "ui-serif", "Georgia", "serif"],
            mono: ["Space Mono", "ui-monospace", "monospace"],
          },
        }
      }
    }
  </script>
  
  <style type="text/tailwindcss">
    @layer base {
      :root {
        --background: 220 15% 8%;
        --foreground: 210 20% 96%;
        
        --card: 220 18% 14%;
        --card-foreground: 210 20% 92%;
        
        --popover: 220 18% 10%;
        --popover-foreground: 210 20% 92%;
        
        --primary: 195 100% 50%;
        --primary-foreground: 220 15% 8%;
        
        --secondary: 280 80% 60%;
        --secondary-foreground: 210 20% 95%;
        
        --muted: 220 15% 18%;
        --muted-foreground: 210 15% 60%;
        
        --accent: 35 100% 55%;
        --accent-foreground: 220 15% 8%;
        
        --destructive: 0 75% 55%;
        --destructive-foreground: 210 20% 95%;
        
        --border: 220 20% 22%;
        --input: 220 20% 18%;
        --ring: 195 100% 50%;
        
        --radius: 1rem;
      }
      
      body {
        @apply bg-background text-foreground font-sans;
        min-height: 100vh;
      }
      
      h1, h2, h3, h4, h5, h6 {
        @apply font-sans tracking-tight font-bold scroll-m-20;
      }
      
      h1 { @apply text-4xl lg:text-5xl mb-6; }
      h2 { @apply text-3xl pb-2 first:mt-0 mt-10 mb-4 border-b border-border; }
      h3 { @apply text-2xl mt-8 mb-4; }
      
      p { @apply leading-7 [&:not(:first-child)]:mt-6; }
      
      a { @apply font-medium underline underline-offset-4 decoration-primary/50 hover:decoration-primary; }
      
      img { @apply rounded-lg border border-border bg-muted; }
      
      ul { @apply my-6 ml-6 list-disc [&>li]:mt-2; }
      
      .story-content { @apply font-serif text-lg leading-relaxed text-foreground/90; }
      
      /* Legacy Classes Support */
      .meta { @apply text-muted-foreground text-sm font-medium mb-4 flex flex-wrap gap-2 items-center; }
      .keywords { @apply flex flex-wrap gap-2 mt-4 mb-6; }
      .keyword { @apply px-2 py-1 bg-secondary/10 text-secondary text-xs rounded-full border border-secondary/20; }
      .category { @apply text-accent text-xs uppercase tracking-wider font-bold ml-2; }
      blockquote { @apply border-l-4 border-primary/50 pl-4 py-2 my-4 bg-muted/30 italic rounded-r-lg; }
    }
  </style>

  <!-- Noscript: content stays visible -->
  <noscript>
    <style>.js-redirect-notice { display: none; }</style>
  </noscript>
</head>
<body class="min-h-screen bg-background text-foreground antialiased font-sans">
  ${generateHeaderHTML(lang, BASE_URL)}
  
  <main class="container mx-auto px-4 py-8">
    ${content}
  </main>
  
  ${generateFooterHTML(lang, BASE_URL)}
  
  <script>
    // Redirect real users to SPA, keep bots on static content
    if (typeof window !== 'undefined' && !navigator.userAgent.match(/bot|crawl|spider|slurp|googlebot|bingbot|yandex|baidu|duckduckbot|gptbot|claudebot|perplexitybot/i)) {
      window.location.replace('${BASE_URL}${path}');
    }
  </script>
</body>
</html>`;
}


function generateBreadcrumbsHTML(items: { label: string; url?: string }[]) {
  return `
    <nav aria-label="Breadcrumb" style="margin-bottom: 24px;">
      <ol itemscope itemtype="https://schema.org/BreadcrumbList" style="list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 8px; font-size: 14px; color: hsl(var(--muted-foreground));">
        ${items.map((item, index) => {
    const isLast = index === items.length - 1;
    return `
            <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem" style="display: flex; align-items: center;">
              ${index > 0 ? `<span style="margin-right: 8px;">/</span>` : ""}
              ${item.url && !isLast ? `
                <a href="${item.url}" itemprop="item" style="color: inherit; text-decoration: none;">
                  <span itemprop="name">${escapeHtml(item.label)}</span>
                </a>
              ` : `
                <span itemprop="name" aria-current="page" style="color: hsl(var(--foreground)); font-weight: 500;">
                  ${escapeHtml(item.label)}
                </span>
              `}
              <meta itemprop="position" content="${index + 1}" />
            </li>
          `;
  }).join("")}
      </ol>
    </nav>
  `;
}

function generateStoryHTML(part: any, lang: string, canonicalUrl: string) {
  const titleField = lang === "en" ? "title_en" : lang === "pl" ? "title_pl" : "title";
  const contentField = lang === "en" ? "content_en" : lang === "pl" ? "content_pl" : "content";

  const title = part[titleField] || part.title;
  const content = part[contentField] || part.content;
  const chapterTitle = part.chapter?.[titleField] || part.chapter?.title || "";

  return `
    <article itemscope itemtype="https://schema.org/NewsArticle">
      ${part.cover_image_url ? `<img src="${part.cover_image_url}" alt="${escapeHtml(title)}" itemprop="image">` : ""}
      
      <div class="meta">
        <time datetime="${part.date}" itemprop="datePublished">${part.date}</time>
        ${chapterTitle ? ` | <span itemprop="articleSection">${escapeHtml(chapterTitle)}</span>` : ""}
        ${part.is_flash_news ? " | <strong>⚡ Flash News</strong>" : ""}
      </div>
      
      <h2 itemprop="headline">${escapeHtml(title)}</h2>
      
      <div class="story-content" itemprop="articleBody">
        ${escapeHtml(content)}
      </div>
      
      ${generateNewsSourcesHTML(part.news_sources)}
    </article>
  `;
}

function generateChapterHTML(chapter: any, lang: string, canonicalUrl: string) {
  const titleField = lang === "en" ? "title_en" : lang === "pl" ? "title_pl" : "title";
  const descField = lang === "en" ? "description_en" : lang === "pl" ? "description_pl" : "description";
  const monologueField = lang === "en" ? "narrator_monologue_en" : lang === "pl" ? "narrator_monologue_pl" : "narrator_monologue";

  const title = chapter[titleField] || chapter.title;
  const description = chapter[descField] || chapter.description;
  const monologue = chapter[monologueField] || chapter.narrator_monologue;

  return `
    <article itemscope itemtype="https://schema.org/Article">
      ${chapter.cover_image_url ? `<img src="${chapter.cover_image_url}" alt="${escapeHtml(title)}" itemprop="image">` : ""}
      
      <div class="meta">
        Week ${chapter.week_of_month} | ${chapter.volume?.title || ""}
      </div>
      
      <h2 itemprop="headline">${escapeHtml(title)}</h2>
      
      ${description ? `<p itemprop="description">${escapeHtml(description)}</p>` : ""}
      
      ${monologue ? `
        <section>
          <h3>Narrator's Monologue</h3>
          <div class="story-content">${escapeHtml(monologue)}</div>
        </section>
      ` : ""}
    </article>
  `;
}

function generateNewsHTML(newsItem: any, lang: string, canonicalUrl: string, moreFromCountry: any[] = [], otherCountriesNews: any[] = [], wikiEntities: any[] = [], mainEntityForGraph: any = null, relatedEntitiesForGraph: any[] = []) {
  const title = newsItem.title_en || newsItem.title;
  const content = newsItem.content_en || newsItem.content || newsItem.description_en || newsItem.description || "";
  const countryName = newsItem.country?.name_en || newsItem.country?.name || "";
  const countryCode = newsItem.country?.code?.toLowerCase() || "us";

  // Parse key_points from JSON field
  const keyPoints = newsItem.key_points_en || newsItem.key_points || [];
  const parsedKeyPoints = Array.isArray(keyPoints) ? keyPoints : (typeof keyPoints === 'string' ? JSON.parse(keyPoints) : []);

  // Parse themes
  const themes = newsItem.themes_en || newsItem.themes || [];
  const parsedThemes = Array.isArray(themes) ? themes : (typeof themes === 'string' ? JSON.parse(themes) : []);

  // Parse keywords
  const keywords = newsItem.keywords || [];
  const parsedKeywords = Array.isArray(keywords) ? keywords : (typeof keywords === 'string' ? JSON.parse(keywords) : []);

  // Parse tweets
  const tweets = newsItem.tweets || [];
  const parsedTweets = Array.isArray(tweets) ? tweets : (typeof tweets === 'string' ? JSON.parse(tweets) : []);

  // Parse dialogue
  const dialogue = newsItem.chat_dialogue || [];
  const parsedDialogue = Array.isArray(dialogue) ? dialogue : (typeof dialogue === 'string' ? JSON.parse(dialogue) : []);

  // Group other countries news by country
  const otherByCountry: Record<string, any[]> = {};
  for (const item of otherCountriesNews) {
    const code = item.country?.code?.toLowerCase() || "unknown";
    if (!otherByCountry[code]) otherByCountry[code] = [];
    otherByCountry[code].push(item);
  }

  return `
    ${generateBreadcrumbsHTML([
    { label: "Home", url: `${BASE_URL}/` },
    { label: "News", url: `${BASE_URL}/news` },
    { label: countryName, url: `${BASE_URL}/news/${countryCode}` },
    { label: title }
  ])}
    <article itemscope itemtype="https://schema.org/NewsArticle">
      ${newsItem.image_url ? `<img src="${newsItem.image_url}" alt="${escapeHtml(title)}" itemprop="image">` : `<img src="https://bravennow.com/favicon.png" alt="${escapeHtml(title)}" itemprop="image" style="opacity:0.6;">`}
      
      <div class="meta">
        <time datetime="${newsItem.published_at || newsItem.created_at}" itemprop="datePublished">
          ${new Date(newsItem.published_at || newsItem.created_at).toLocaleDateString()}
        </time>
        ${countryName ? ` | <span>${escapeHtml(countryName)}</span>` : ""}
        ${newsItem.category ? ` | <span itemprop="articleSection">${escapeHtml(newsItem.category)}</span>` : ""}
      </div>
      
      <h2 itemprop="headline">${escapeHtml(title)}</h2>
      
      ${parsedKeywords.length > 0 ? `
        <p class="keywords" itemprop="keywords">
          ${parsedKeywords.map((kw: string) => `<span class="keyword">#${escapeHtml(kw)}</span>`).join(" ")}
        </p>
      ` : ""}
      
      ${parsedKeyPoints.length > 0 ? `
        <section>
          <h3>📌 Key Takeaways</h3>
          <ul>
            ${parsedKeyPoints.map((point: string) => `<li>${escapeHtml(point)}</li>`).join("")}
          </ul>
        </section>
      ` : ""}
      
      ${content.length > 100 ? `
        <section>
          <h3>📖 Full Retelling</h3>
          <div class="story-content" itemprop="articleBody">
            ${escapeHtml(content)}
          </div>
        </section>
      ` : `
        <div class="story-content" itemprop="articleBody">
          ${escapeHtml(content)}
        </div>
      `}
      
      ${parsedTweets.length > 0 ? `
        <section>
          <h3>🐦 Character Reactions (Tweets)</h3>
          ${parsedTweets.map((tweet: any) => `
            <blockquote style="border-left:3px solid #1DA1F2;padding:8px 12px;margin:8px 0;">
              <strong>${escapeHtml(tweet.character || tweet.author || 'Character')}</strong>
              <p>${escapeHtml(tweet.text || tweet.content || '')}</p>
            </blockquote>
          `).join("")}
        </section>
      ` : ""}
      
      ${parsedDialogue.length > 0 ? `
        <section>
          <h3>💬 Character Dialogue</h3>
          ${parsedDialogue.map((msg: any) => `
            <div style="margin:4px 0;padding:6px 10px;background:${msg.role === 'user' || msg.character ? '#f0f4ff' : '#f5f5f5'};border-radius:8px;">
              <strong>${escapeHtml(msg.character || msg.role || 'Character')}:</strong>
              <span>${escapeHtml(msg.text || msg.content || msg.message || '')}</span>
            </div>
          `).join("")}
        </section>
      ` : ""}
      
      ${parsedThemes.length > 0 ? `
        <section>
          <h3>🏷️ Themes</h3>
          <p>${parsedThemes.map((theme: string) => escapeHtml(theme)).join(", ")}</p>
        </section>
      ` : ""}
      
      ${wikiEntities.length > 0 ? `
        <section itemscope itemtype="https://schema.org/ItemList">
          <h3>📚 Related People & Topics</h3>
          ${wikiEntities.map((entity: any, index: number) => {
    const name = entity.name_en || entity.name;
    const description = entity.description_en || entity.description || "";
    const extract = entity.extract_en || entity.extract || "";
    const wikiUrl = entity.wiki_url_en || entity.wiki_url || "";
    const imageUrl = entity.image_url || "";
    const entityType = entity.entity_type || "topic";
    const entitySlug = entity.slug || entity.id;
    const internalUrl = `${BASE_URL}/wiki/${entitySlug}`;

    return `
              <div itemprop="itemListElement" itemscope itemtype="https://schema.org/${entityType === 'person' ? 'Person' : 'Thing'}" style="margin-bottom:16px;padding:12px;border:1px solid hsl(var(--border));border-radius:8px;background:hsl(var(--card));">
                <meta itemprop="position" content="${index + 1}">
                ${imageUrl ? `<img src="${imageUrl}" alt="${escapeHtml(name)}" itemprop="image" style="width:64px;height:64px;border-radius:50%;float:left;margin-right:12px;">` : ""}
                <h4 itemprop="name" style="margin:0 0 8px 0;"><a href="${internalUrl}" style="color:hsl(var(--primary));text-decoration:none;">${escapeHtml(name)}</a></h4>
                ${description ? `<p itemprop="description" style="margin:4px 0;font-size:0.9rem;color:hsl(var(--muted-foreground));">${escapeHtml(description)}</p>` : ""}
                ${extract ? `<p style="margin:4px 0;font-size:0.85rem;color:hsl(var(--muted-foreground));font-style:italic;"><em>${escapeHtml(extract.substring(0, 300))}${extract.length > 300 ? "..." : ""}</em></p>` : ""}
                <div style="margin-top:8px;display:flex;gap:12px;font-size:0.85rem;">
                  <a href="${internalUrl}" style="color:hsl(var(--primary));text-decoration:none;">View Profile →</a>
                  ${wikiUrl ? `<a href="${escapeHtml(wikiUrl)}" rel="noopener" target="_blank" itemprop="sameAs" style="color:hsl(var(--muted-foreground));text-decoration:none;">Wikipedia ↗</a>` : ""}
                </div>
                <div style="clear:both;"></div>
              </div>
            `;
  }).join("")}
        </section>
      ` : ""}
      
      ${mainEntityForGraph && relatedEntitiesForGraph.length > 0 ? `
        <section>
          <h3>🔗 Entity Intersection Graph</h3>
          <p>Connections for <strong>${escapeHtml(mainEntityForGraph.name_en || mainEntityForGraph.name)}</strong>:</p>
          <ul>
            ${relatedEntitiesForGraph.map((e: any) => {
    const eName = e.name_en || e.name;
    const eSlug = e.slug || e.id;
    const typeIcon = e.entity_type === 'person' ? '👤' : e.entity_type === 'company' ? '🏢' : '🌐';
    return `
                <li>
                  ${typeIcon} <a href="${BASE_URL}/wiki/${eSlug}">${escapeHtml(eName)}</a>
                  <span>(${e.shared_news_count} shared articles)</span>
                </li>
              `;
  }).join("")}
          </ul>
          <p><a href="${BASE_URL}/wiki/${mainEntityForGraph.slug || mainEntityForGraph.id}">View full profile →</a></p>
        </section>
      ` : ""}
      
      ${newsItem.news_analysis ? `
        <section style="margin-top:24px;padding:20px;border:1px solid hsl(var(--border));border-radius:12px;background:linear-gradient(to bottom right, hsl(var(--card)), hsl(var(--muted)/0.3));">
          <h3 style="margin:0 0 16px 0;font-size:1.25rem;font-weight:700;display:flex;align-items:center;gap:8px;">
            <svg style="width:20px;height:20px;color:hsl(var(--primary));" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            Deep Analysis
          </h3>
          
          ${newsItem.news_analysis.why_it_matters ? `
            <div style="margin-bottom:16px;padding:12px;border-left:3px solid #f97316;background:rgba(249,115,22,0.05);border-radius:6px;">
              <h4 style="margin:0 0 8px 0;font-size:0.95rem;font-weight:600;color:#f97316;display:flex;align-items:center;gap:6px;">
                <svg style="width:16px;height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                Why It Matters
              </h4>
              <p style="margin:0;font-size:0.875rem;line-height:1.6;color:hsl(var(--foreground));">${escapeHtml(newsItem.news_analysis.why_it_matters)}</p>
            </div>
          ` : ""}
          
          ${newsItem.news_analysis.context_background && newsItem.news_analysis.context_background.length > 0 ? `
            <div style="margin-bottom:16px;padding:12px;border-left:3px solid #3b82f6;background:rgba(59,130,246,0.05);border-radius:6px;">
              <h4 style="margin:0 0 8px 0;font-size:0.95rem;font-weight:600;color:#3b82f6;display:flex;align-items:center;gap:6px;">
                <svg style="width:16px;height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                </svg>
                Context & Background
              </h4>
              <ul style="margin:0;padding-left:20px;font-size:0.875rem;line-height:1.6;color:hsl(var(--foreground));">
                ${newsItem.news_analysis.context_background.map((item: string) => `<li>${escapeHtml(item)}</li>`).join("")}
              </ul>
            </div>
          ` : ""}
          
          ${newsItem.news_analysis.what_happens_next ? `
            <div style="margin-bottom:16px;padding:12px;border-left:3px solid #8b5cf6;background:rgba(139,92,246,0.05);border-radius:6px;">
              <h4 style="margin:0 0 8px 0;font-size:0.95rem;font-weight:600;color:#8b5cf6;display:flex;align-items:center;gap:6px;">
                <svg style="width:16px;height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M5 12h14"></path>
                  <path d="m12 5 7 7-7 7"></path>
                </svg>
                What Happens Next
              </h4>
              <p style="margin:0;font-size:0.875rem;line-height:1.6;color:hsl(var(--foreground));">${escapeHtml(newsItem.news_analysis.what_happens_next)}</p>
            </div>
          ` : ""}
          
          ${newsItem.news_analysis.faq && newsItem.news_analysis.faq.length > 0 ? `
            <div style="padding:12px;border-left:3px solid #10b981;background:rgba(16,185,129,0.05);border-radius:6px;">
              <h4 style="margin:0 0 12px 0;font-size:0.95rem;font-weight:600;color:#10b981;display:flex;align-items:center;gap:6px;">
                <svg style="width:16px;height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                Frequently Asked Questions
              </h4>
              ${newsItem.news_analysis.faq.map((item: any) => `
                <div style="margin-bottom:12px;font-size:0.875rem;">
                  <strong style="color:hsl(var(--foreground));">${escapeHtml(item.question)}</strong>
                  <p style="margin:4px 0 0 0;color:hsl(var(--muted-foreground));line-height:1.6;">${escapeHtml(item.answer)}</p>
                </div>
              `).join("")}
            </div>
          ` : ""}
        </section>
      ` : ""}
      
      ${newsItem.original_content && newsItem.original_content.length > 100 ? `
        <section style="margin-top:24px;padding:16px;border:1px dashed hsl(var(--border));border-radius:8px;background:hsl(var(--muted)/0.3);">
          <details open>
            <summary style="cursor:pointer;font-weight:600;padding:8px 0;display:flex;align-items:center;gap:8px;color:hsl(var(--muted-foreground));font-size:0.875rem;">
              <svg style="width:16px;height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              Original Source
            </summary>
            <div style="margin-top:12px;font-size:0.875rem;color:hsl(var(--muted-foreground));line-height:1.6;white-space:pre-wrap;">
              ${escapeHtml(newsItem.original_content.substring(0, 2000))}${newsItem.original_content.length > 2000 ? '...' : ''}
            </div>
            ${newsItem.url ? `
              <a href="${escapeHtml(newsItem.url)}" target="_blank" rel="noopener noreferrer nofollow" style="display:inline-flex;align-items:center;gap:6px;margin-top:12px;font-size:0.75rem;color:hsl(var(--primary));text-decoration:none;">
                <svg style="width:12px;height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
                Read full article at source
              </a>
            ` : ''}
          </details>
        </section>
      ` : ""}
      
      ${newsItem.url ? `<p><a href="${escapeHtml(newsItem.url)}" rel="nofollow noopener" target="_blank">Original source</a></p>` : ""}
    </article>
    
    
    ${moreFromCountry.length > 0 ? `
      <section>
        <h3>More from ${escapeHtml(countryName)}</h3>
        <ul>
          ${moreFromCountry.map(item => `
            <li><a href="${BASE_URL}/news/${countryCode}/${item.slug}">${escapeHtml(item.title_en || item.title)}</a></li>
          `).join("")}
        </ul>
      </section>
    ` : ""}
    
    ${Object.keys(otherByCountry).length > 0 ? `
      <section>
        <h3>News from Other Countries</h3>
        ${Object.entries(otherByCountry).map(([code, items]) => {
    const first = items[0];
    const flag = first?.country?.flag || "";
    const name = first?.country?.name_en || code;
    return `
            <h4>${escapeHtml(flag)} ${escapeHtml(name)}</h4>
            <ul>
              ${items.map(item => `
                <li><a href="${BASE_URL}/news/${code}/${item.slug}">${escapeHtml(item.title_en || item.title)}</a></li>
              `).join("")}
            </ul>
          `;
  }).join("")}
      </section>
    ` : ""}
    
    <nav>
      <a href="${BASE_URL}/news/${countryCode}">← Back to ${escapeHtml(countryName)} News</a> |
      <a href="${BASE_URL}/news">All Countries</a>
    </nav>
  `;
}

function generateDateHTML(parts: any[], date: string, lang: string, canonicalUrl: string) {
  const titleField = lang === "en" ? "title_en" : lang === "pl" ? "title_pl" : "title";

  return `
    <h2>Stories for ${date}</h2>
    <p>${parts.length} ${parts.length === 1 ? "story" : "stories"}</p>
    
    <ul>
      ${parts.map((part, index) => `
        <li>
          <a href="${BASE_URL}/read/${date}/${index + 1}">
            ${escapeHtml(part[titleField] || part.title)}
          </a>
          ${part.is_flash_news ? " ⚡" : ""}
        </li>
      `).join("")}
    </ul>
  `;
}

function generateHomeHTML(
  parts: any[],
  lang: string,
  canonicalUrl: string,
  latestUsNews: any[] = [],
  latestChapters: any[] = [],
  countryNewsMap: { country: any; news: any[] }[] = [],
  latestNewsProportional: any[] = [],
  trendingEntities24h: { entity: any; mentionCount: number; news: any[] }[] = [],
  trendingEntitiesWeek: { entity: any; mentionCount: number; news: any[] }[] = [],
  topWikiEntities: any[] = [],
  latestSimpleUsNews: any[] = []
) {
  const titleField = lang === "en" ? "title_en" : lang === "pl" ? "title_pl" : "title";

  return `
    <h2>Latest Stories</h2>
    <ul itemscope itemtype="https://schema.org/ItemList">
      ${parts.map((part, index) => `
        <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
          <meta itemprop="position" content="${index + 1}">
          <a href="${BASE_URL}/read/${part.date}/${part.number}" itemprop="url">
            <span itemprop="name">${escapeHtml(part[titleField] || part.title)}</span>
          </a>
          <span class="meta">${part.date}</span>
          ${part.is_flash_news ? " ⚡" : ""}
        </li>
      `).join("")}
    </ul>
    
    ${latestUsNews.length > 0 ? `
      <section>
        <h2>✨ Full Retelling (USA News)</h2>
        <ul>
          ${latestUsNews.map(item => `
            <li>
              <a href="${BASE_URL}/news/${item.country?.code || 'us'}/${item.slug}">
                ${escapeHtml(item.title_en || item.title)}
              </a>
              <span class="meta"> - Full retelling</span>
            </li>
          `).join("")}
        </ul>
      </section>
      </section>
    ` : ""}
    
    ${latestSimpleUsNews.length > 0 ? `
      <section>
        <h2>🇺🇸 Latest USA News</h2>
        <ul>
          ${latestSimpleUsNews.map((item: any) => `
            <li>
              <a href="${BASE_URL}/news/us/${item.slug}">
                ${escapeHtml(item.title_en || item.title)}
              </a>
              ${item.category ? ` <span class="category">[${escapeHtml(item.category)}]</span>` : ""}
            </li>
          `).join("")}
        </ul>
        <p><a href="${BASE_URL}/news/us">→ View all USA news</a></p>
      </section>
    ` : ""}
    
    ${latestNewsProportional.length > 0 ? `
      <section>
        <h2>📰 Latest News (USA, PL, UA)</h2>
        <ul>
          ${latestNewsProportional.map((item: any) => {
    const countryCode = (item.country as any)?.code?.toLowerCase() || 'us';
    return `
            <li>
              <a href="${BASE_URL}/news/${countryCode}/${item.slug}">
                ${escapeHtml(item.title_en || item.title)}
              </a>
              ${item.category ? ` <span class="category">[${escapeHtml(item.category)}]</span>` : ""}
            </li>
          `}).join("")}
        </ul>
        <p><a href="${BASE_URL}/news">→ View all news</a></p>
      </section>
    ` : ""}
    
    ${trendingEntities24h.length > 0 ? `
      <section>
        <h2>🔥 Trending People & Companies (24h)</h2>
        ${trendingEntities24h.map((item: any) => {
      const name = item.entity.name_en || item.entity.name;
      const description = item.entity.description_en || item.entity.description || "";
      const wikiUrl = item.entity.wiki_url_en || item.entity.wiki_url;
      return `
            <div style="margin-bottom: 1rem; padding: 0.5rem; border: 1px solid #eee; border-radius: 4px;">
              ${item.entity.image_url ? `<img src="${item.entity.image_url}" alt="${escapeHtml(name)}" style="width:48px;height:48px;border-radius:50%;float:left;margin-right:12px;">` : ""}
              <h4 style="margin:0;">${escapeHtml(name)} <small>(${item.mentionCount} mentions)</small></h4>
              ${description ? `<p style="margin:0.25rem 0;font-size:0.9rem;">${escapeHtml(description)}</p>` : ""}
              ${wikiUrl ? `<a href="${escapeHtml(wikiUrl)}" rel="noopener" target="_blank" style="font-size:0.8rem;">Wikipedia</a>` : ""}
              ${item.news.length > 0 ? `
                <p style="font-size:0.8rem;margin:0.25rem 0;">Related news:</p>
                <ul style="font-size:0.8rem;margin:0;">
                  ${item.news.map((n: any) => `
                    <li><a href="${BASE_URL}/news/${n.countryCode}/${n.slug}">${escapeHtml(n.title_en || n.title)}</a></li>
                  `).join("")}
                </ul>
              ` : ""}
              <div style="clear:both;"></div>
            </div>
          `;
    }).join("")}
      </section>
    ` : ""}
    
    ${trendingEntitiesWeek.length > 0 ? `
      <section>
        <h2>📅 Trending This Week (7 days)</h2>
        ${trendingEntitiesWeek.map((item: any) => {
      const name = item.entity.name_en || item.entity.name;
      const description = item.entity.description_en || item.entity.description || "";
      const wikiUrl = item.entity.wiki_url_en || item.entity.wiki_url;
      return `
            <div style="margin-bottom: 1rem; padding: 0.5rem; border: 1px solid #eee; border-radius: 4px;">
              ${item.entity.image_url ? `<img src="${item.entity.image_url}" alt="${escapeHtml(name)}" style="width:48px;height:48px;border-radius:50%;float:left;margin-right:12px;">` : ""}
              <h4 style="margin:0;">${escapeHtml(name)} <small>(${item.mentionCount} mentions)</small></h4>
              ${description ? `<p style="margin:0.25rem 0;font-size:0.9rem;">${escapeHtml(description)}</p>` : ""}
              ${wikiUrl ? `<a href="${escapeHtml(wikiUrl)}" rel="noopener" target="_blank" style="font-size:0.8rem;">Wikipedia</a>` : ""}
              ${item.news.length > 0 ? `
                <p style="font-size:0.8rem;margin:0.25rem 0;">Related news:</p>
                <ul style="font-size:0.8rem;margin:0;">
                  ${item.news.map((n: any) => `
                    <li><a href="${BASE_URL}/news/${n.countryCode}/${n.slug}">${escapeHtml(n.title_en || n.title)}</a></li>
                  `).join("")}
                </ul>
              ` : ""}
              <div style="clear:both;"></div>
            </div>
          `;
    }).join("")}
      </section>
    ` : ""}
    
    ${latestChapters.length > 0 ? `
      <section>
        <h2>📚 Weekly Chapters</h2>
        <ul>
          ${latestChapters.map(ch => `
            <li>
              <a href="${BASE_URL}/chapter/${ch.number}">
                Chapter ${ch.number}: ${escapeHtml(ch[titleField] || ch.title)}
              </a>
            </li>
          `).join("")}
        </ul>
      </section>
    ` : ""}
    
    ${countryNewsMap.length > 0 ? `
      <section>
        <h2>📰 News by Country</h2>
        ${countryNewsMap.map(({ country, news }) => {
      if (!news || news.length === 0) return "";
      return `
            <h3><a href="${BASE_URL}/news/${country.code}">${country.flag || ""} ${escapeHtml(country.name_en || country.name)}</a></h3>
            <ul>
              ${news.map(item => `
                <li>
                  <a href="${BASE_URL}/news/${item.country?.code || country.code}/${item.slug}">
                    ${escapeHtml(item.title_en || item.title)}
                  </a>
                </li>
              `).join("")}
            </ul>
          `;
    }).join("")}
      </section>
    ` : ""}
    
    ${topWikiEntities.length > 0 ? `
      <section>
        <h2>🌐 Wiki: People & Organizations</h2>
        <ul>
          ${topWikiEntities.map(e => {
      const name = e.name_en || e.name;
      const slug = e.slug || e.id;
      const typeIcon = e.entity_type === 'person' ? '👤' : '🏢';
      return `
              <li>${typeIcon} <a href="${BASE_URL}/wiki/${slug}">${escapeHtml(name)}</a></li>
            `;
    }).join("")}
        </ul>
        <p><a href="${BASE_URL}/wiki">→ Browse all entities</a></p>
      </section>
    ` : ""}
    
    <nav>
      <a href="${BASE_URL}/news">📰 News</a> |
      <a href="${BASE_URL}/wiki">🌐 Wiki</a> |
      <a href="${BASE_URL}/ink-abyss">🎨 Ink Abyss</a> |
      <a href="${BASE_URL}/calendar">📅 Calendar</a> |
      <a href="${BASE_URL}/chapters">📚 Chapters</a> |
      <a href="${BASE_URL}/sitemap">🗺️ Sitemap</a>
    </nav>
  `;
}

function generateNewsCountryHTML(newsItems: any[], country: any, lang: string, canonicalUrl: string, otherCountriesNews: any[] = []) {
  const countryName = country?.name_en || country?.name || "News";
  const flag = country?.flag || "";
  const countryCode = country?.code || "us";

  // Group other countries news by country
  const otherByCountry: Record<string, any[]> = {};
  for (const item of otherCountriesNews) {
    const code = item.country?.code || "unknown";
    if (!otherByCountry[code]) otherByCountry[code] = [];
    otherByCountry[code].push(item);
  }

  return `
    <h2>${flag} ${escapeHtml(countryName)} News</h2>
    <p>${newsItems.length} articles</p>
    
    <ul itemscope itemtype="https://schema.org/ItemList">
      ${newsItems.map((item, index) => {
    const title = item.title_en || item.title;
    const date = item.published_at ? new Date(item.published_at).toLocaleDateString() : "";
    const slug = item.slug || "";

    return `
          <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
            <meta itemprop="position" content="${index + 1}">
            <a href="${BASE_URL}/news/${countryCode}/${slug}" itemprop="url">
              <span itemprop="name">${escapeHtml(title)}</span>
            </a>
            ${date ? `<span class="meta"> - ${date}</span>` : ""}
            ${item.category ? ` <span class="category">[${escapeHtml(item.category)}]</span>` : ""}
          </li>
        `;
  }).join("")}
    </ul>
    
    ${Object.keys(otherByCountry).length > 0 ? `
      <section>
        <h3>News from Other Countries</h3>
        ${Object.entries(otherByCountry).map(([code, items]) => {
    const first = items[0];
    const otherFlag = first?.country?.flag || "";
    const otherName = first?.country?.name_en || code;
    return `
            <h4><a href="${BASE_URL}/news/${code}">${escapeHtml(otherFlag)} ${escapeHtml(otherName)}</a></h4>
            <ul>
              ${items.map(item => `
                <li><a href="${BASE_URL}/news/${code}/${item.slug}">${escapeHtml(item.title_en || item.title)}</a></li>
              `).join("")}
            </ul>
          `;
  }).join("")}
      </section>
    ` : ""}
    
    <nav>
      <a href="${BASE_URL}/news">← All Countries</a> |
      <a href="${BASE_URL}/news/us">🇺🇸 USA</a> |
      <a href="${BASE_URL}/news/ua">🇺🇦 Ukraine</a> |
      <a href="${BASE_URL}/news/pl">🇵🇱 Poland</a> |
      <a href="${BASE_URL}/news/in">🇮🇳 India</a>
    </nav>
  `;
}

function generateNewsHubHTML(countries: any[], lang: string) {
  const nameField = lang === "en" ? "name_en" : lang === "pl" ? "name_pl" : "name";

  return `
    <h2>News by Country</h2>
    <p>Select a country to browse the latest news articles.</p>

    <ul>
      ${countries.map((c) => {
    const code = c.code;
    const flag = c.flag || "";
    const name = c[nameField] || c.name_en || c.name || code;
    return `<li><a href="${BASE_URL}/news/${escapeHtml(code)}">${escapeHtml(flag)} ${escapeHtml(name)}</a></li>`;
  }).join("")}
    </ul>

    <nav>
      <a href="${BASE_URL}/">← Home</a> |
      <a href="${BASE_URL}/sitemap">🗺️ Sitemap</a>
    </nav>
  `;
}

function generateChaptersIndexHTML(chapters: any[], lang: string) {
  const titleField = lang === "en" ? "title_en" : lang === "pl" ? "title_pl" : "title";

  return `
    <h2>Chapters</h2>
    <p>${chapters.length} chapters</p>

    <ul>
      ${chapters.map((ch) => {
    const title = ch[titleField] || ch.title;
    return `<li><a href="${BASE_URL}/chapter/${ch.number}">Chapter ${ch.number}: ${escapeHtml(title)}</a></li>`;
  }).join("")}
    </ul>

    <nav>
      <a href="${BASE_URL}/">← Home</a> |
      <a href="${BASE_URL}/volumes">📖 Volumes</a> |
      <a href="${BASE_URL}/sitemap">🗺️ Sitemap</a>
    </nav>
  `;
}

function generateVolumesIndexHTML(volumes: any[], lang: string) {
  const titleField = lang === "en" ? "title_en" : lang === "pl" ? "title_pl" : "title";

  return `
    <h2>Volumes</h2>
    <p>${volumes.length} volumes</p>

    <ul>
      ${volumes.map((v) => {
    const monthStr = String(v.month).padStart(2, "0");
    const yearMonth = `${v.year}-${monthStr}`;
    const title = v[titleField] || v.title || yearMonth;
    return `<li><a href="${BASE_URL}/volume/${yearMonth}">${escapeHtml(title)} (${yearMonth})</a></li>`;
  }).join("")}
    </ul>

    <nav>
      <a href="${BASE_URL}/">← Home</a> |
      <a href="${BASE_URL}/chapters">📚 Chapters</a> |
      <a href="${BASE_URL}/sitemap">🗺️ Sitemap</a>
    </nav>
  `;
}

function generateVolumeHTML(volume: any, chapters: any[], lang: string) {
  const titleField = lang === "en" ? "title_en" : lang === "pl" ? "title_pl" : "title";
  const title = volume[titleField] || volume.title;
  const monthStr = String(volume.month).padStart(2, "0");
  const yearMonth = `${volume.year}-${monthStr}`;

  return `
    <h2>${escapeHtml(title)} (${yearMonth})</h2>
    ${volume.cover_image_url ? `<img src="${escapeHtml(volume.cover_image_url)}" alt="${escapeHtml(title)}">` : ""}
    ${volume.summary ? `<p>${escapeHtml(volume.summary_en || volume.summary)}</p>` : ""}

    <h3>Chapters in this volume</h3>
    <ul>
      ${chapters.map((ch) => {
    const chTitle = ch[titleField] || ch.title;
    return `<li><a href="${BASE_URL}/chapter/${ch.number}">Chapter ${ch.number}: ${escapeHtml(chTitle)}</a></li>`;
  }).join("")}
    </ul>

    <nav>
      <a href="${BASE_URL}/volumes">← Volumes</a> |
      <a href="${BASE_URL}/sitemap">🗺️ Sitemap</a>
    </nav>
  `;
}

function generateCalendarIndexHTML(dates: string[], lang: string) {
  return `
    <h2>Archive</h2>
    <p>Recent dates (${dates.length})</p>

    <ul>
      ${dates.map((d) => {
    const date = escapeHtml(d);
    return `<li><a href="${BASE_URL}/date/${date}">${date}</a> | <a href="${BASE_URL}/read/${date}">/read/${date}</a></li>`;
  }).join("")}
    </ul>

    <nav>
      <a href="${BASE_URL}/">← Home</a> |
      <a href="${BASE_URL}/sitemap">🗺️ Sitemap</a>
    </nav>
  `;
}

function generateSitemapHTML(
  data: {
    countries: any[];
    volumes: any[];
    chapters: any[];
    dates: string[];
    stories: any[];
  },
  lang: string,
) {
  const titleField = lang === "en" ? "title_en" : lang === "pl" ? "title_pl" : "title";
  const nameField = lang === "en" ? "name_en" : lang === "pl" ? "name_pl" : "name";

  return `
    <h2>HTML Sitemap</h2>
    <p>
      Full XML sitemap: <a href="${BASE_URL}/sitemap.xml">sitemap.xml</a>
    </p>

    <h3>Sections</h3>
    <ul>
      <li><a href="${BASE_URL}/">Home</a></li>
      <li><a href="${BASE_URL}/news">News</a></li>
      <li><a href="${BASE_URL}/calendar">Calendar</a></li>
      <li><a href="${BASE_URL}/chapters">Chapters</a></li>
      <li><a href="${BASE_URL}/volumes">Volumes</a></li>
    </ul>

    <h3>Countries</h3>
    <ul>
      ${data.countries.map((c) => {
    const code = c.code;
    const flag = c.flag || "";
    const name = c[nameField] || c.name_en || c.name || code;
    return `<li><a href="${BASE_URL}/news/${escapeHtml(code)}">${escapeHtml(flag)} ${escapeHtml(name)}</a></li>`;
  }).join("")}
    </ul>

    <h3>Volumes (recent)</h3>
    <ul>
      ${data.volumes.map((v) => {
    const monthStr = String(v.month).padStart(2, "0");
    const yearMonth = `${v.year}-${monthStr}`;
    const title = v[titleField] || v.title || yearMonth;
    return `<li><a href="${BASE_URL}/volume/${yearMonth}">${escapeHtml(title)}</a></li>`;
  }).join("")}
    </ul>

    <h3>Chapters (recent)</h3>
    <ul>
      ${data.chapters.map((ch) => {
    const title = ch[titleField] || ch.title;
    return `<li><a href="${BASE_URL}/chapter/${ch.number}">Chapter ${ch.number}: ${escapeHtml(title)}</a></li>`;
  }).join("")}
    </ul>

    <h3>Dates (recent)</h3>
    <ul>
      ${data.dates.map((d) => `<li><a href="${BASE_URL}/date/${escapeHtml(d)}">${escapeHtml(d)}</a></li>`).join("")}
    </ul>

    <h3>Stories (latest 1000)</h3>
    <p>For full coverage, use <a href="${BASE_URL}/sitemap.xml">sitemap.xml</a>.</p>
    <ul>
      ${data.stories.map((p) => {
    const t = p[titleField] || p.title;
    return `<li><a href="${BASE_URL}/read/${escapeHtml(p.date)}/${p.number}">${escapeHtml(t)}</a></li>`;
  }).join("")}
    </ul>
  `;
}

function generateInkAbyssHTML(items: any[], lang: string) {
  const titleField = lang === "en" ? "title_en" : "title";

  // Group by date
  const grouped = new Map<string, any[]>();
  for (const item of items) {
    const date = item.created_at ? item.created_at.split('T')[0] : 'unknown';
    if (!grouped.has(date)) grouped.set(date, []);
    grouped.get(date)!.push(item);
  }

  return `
    <h2>The Ink Abyss - Satirical Art Gallery</h2>
    <p>A timeline of satirical political artwork inspired by world news.</p>
    
    ${Array.from(grouped.entries()).map(([date, dateItems]) => `
      <section>
        <h3>${escapeHtml(date)}</h3>
        <ul>
          ${dateItems.map(item => {
    const newsTitle = item.news_item?.[titleField] || item.news_item?.title || item.title || 'Satirical artwork';
    const countryCode = item.news_item?.country?.code?.toLowerCase() || 'us';
    const newsLink = item.news_item?.slug
      ? `${BASE_URL}/news/${countryCode}/${item.news_item.slug}`
      : null;
    return `
              <li>
                <img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(newsTitle)}" title="${escapeHtml(newsTitle)}" width="300">
                <p>👍 ${item.likes} | 👎 ${item.dislikes}</p>
                ${newsLink ? `<a href="${newsLink}">${escapeHtml(newsTitle)}</a>` : `<span>${escapeHtml(newsTitle)}</span>`}
              </li>
            `;
  }).join("")}
        </ul>
      </section>
    `).join("")}
    
    <nav>
      <a href="${BASE_URL}/">← Home</a> |
      <a href="${BASE_URL}/news">📰 News</a> |
      <a href="${BASE_URL}/sitemap">🗺️ Sitemap</a>
    </nav>
  `;
}

function generateStaticIntersectionGraph(mainEntity: any, relatedEntities: any[], width = 600, height = 400) {
  if (!mainEntity || relatedEntities.length === 0) return "";

  const centerX = width / 2;
  const centerY = height / 2;
  const mainRadius = 40;
  const orbitRadius = Math.min(width, height) / 2 - 60;

  // Sort by shared count to put most important ones closer or larger
  const topEntities = relatedEntities.slice(0, 12); // Limit to 12 for static graph

  let svgContent = "";

  // Draw connections first (so they are behind nodes)
  topEntities.forEach((entity, index) => {
    const angle = (index / topEntities.length) * 2 * Math.PI - Math.PI / 2;
    const x = centerX + orbitRadius * Math.cos(angle);
    const y = centerY + orbitRadius * Math.sin(angle);

    // Line style
    const strokeWidth = 1 + (entity.shared_news_count > 5 ? 2 : 0);
    const opacity = 0.3 + (entity.shared_news_count > 5 ? 0.3 : 0);

    svgContent += `<line x1="${centerX}" y1="${centerY}" x2="${x}" y2="${y}" stroke="hsl(var(--primary))" stroke-width="${strokeWidth}" stroke-opacity="${opacity}" />`;
  });

  // Draw peripheral nodes
  topEntities.forEach((entity, index) => {
    const angle = (index / topEntities.length) * 2 * Math.PI - Math.PI / 2;
    const x = centerX + orbitRadius * Math.cos(angle);
    const y = centerY + orbitRadius * Math.sin(angle);
    const radius = 15 + (entity.shared_news_count > 5 ? 10 : 0);

    // Node circle
    svgContent += `<circle cx="${x}" cy="${y}" r="${radius}" fill="hsl(var(--card))" stroke="hsl(var(--primary))" stroke-width="2" />`;

    // Entity image (clipped) or icon
    if (entity.image_url) {
      // Clip path definition would be needed, but for simplicity we use pattern or just overlay text
      // For simple static SVG without defs overhead, we might just color it
    }

    // Text label
    const name = entity.name_en || entity.name;
    const labelX = x;
    const labelY = y + radius + 15;

    svgContent += `<text x="${labelX}" y="${labelY}" text-anchor="middle" fill="hsl(var(--foreground))" font-size="10" font-family="sans-serif">${escapeHtml(name)}</text>`;
    svgContent += `<text x="${labelX}" y="${labelY + 10}" text-anchor="middle" fill="hsl(var(--muted-foreground))" font-size="8" font-family="sans-serif">(${entity.shared_news_count})</text>`;

    // Link area (transparent rect on top)
    const url = `${BASE_URL}/wiki/${entity.slug || entity.id}`;
    svgContent += `<a href="${url}"><rect x="${x - radius}" y="${y - radius}" width="${radius * 2}" height="${radius * 2}" fill="transparent" style="cursor:pointer"/></a>`;
  });

  // Draw main center node
  svgContent += `<circle cx="${centerX}" cy="${centerY}" r="${mainRadius}" fill="hsl(var(--primary))" stroke="hsl(var(--primary))" stroke-width="4" fill-opacity="0.2" />`;
  svgContent += `<circle cx="${centerX}" cy="${centerY}" r="${mainRadius - 5}" fill="none" stroke="hsl(var(--primary))" stroke-width="1" />`;

  const mainName = mainEntity.name_en || mainEntity.name;

  // Main label
  svgContent += `<text x="${centerX}" y="${centerY + 5}" text-anchor="middle" fill="hsl(var(--foreground))" font-weight="bold" font-size="12" font-family="sans-serif">${escapeHtml(mainName)}</text>`;

  return `
    <svg viewBox="0 0 ${width} ${height}" class="w-full h-auto border rounded-xl bg-card/50" style="max-width: 100%; border: 1px solid hsl(var(--border)); border-radius: 0.75rem; background: hsl(var(--card)); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
      ${svgContent}
    </svg>
  `;
}

function generateWikiEntityHTML(entity: any, linkedNews: any[], relatedEntities: any[], lang: string, canonicalUrl: string, topTopics: [string, number][] = [], topKeywords: [string, number][] = [], totalLikes = 0, totalDislikes = 0, wikiLinkedEntities: any[] = [], latestNarrative: any = null, caricatureIds: string[] = [], categories: string[] = [], infoCardContent: string | null = null, infoCardSources: { title: string; url: string }[] = []) {
  const name = entity.name_en || entity.name;
  const description = entity.description_en || entity.description || '';
  const extract = entity.extract_en || entity.extract || '';
  const entityTypeLabel = entity.entity_type === 'person' ? '👤 Person' : entity.entity_type === 'company' ? '🏢 Company' : '🌐 Entity';

  // Parse narrative analysis
  let narrativeHtml = '';
  if (latestNarrative) {
    try {
      const analysis = typeof latestNarrative.analysis === 'string' ? JSON.parse(latestNarrative.analysis) : latestNarrative.analysis;
      const sentiment = analysis?.sentiment || analysis?.overall_sentiment || '';
      const summary = analysis?.summary || analysis?.narrative_summary || '';
      const trends = analysis?.key_trends || analysis?.trends || [];

      narrativeHtml = `
        <section>
          <h2>📊 Narrative Analysis (${latestNarrative.year_month})</h2>
          ${sentiment ? `<p><strong>Sentiment:</strong> ${escapeHtml(sentiment)}</p>` : ''}
          ${summary ? `<p>${escapeHtml(summary)}</p>` : ''}
          ${Array.isArray(trends) && trends.length > 0 ? `
            <h4>Key Trends</h4>
            <ul>${trends.map((t: any) => `<li>${escapeHtml(typeof t === 'string' ? t : t.trend || t.title || JSON.stringify(t))}</li>`).join('')}</ul>
          ` : ''}
          <p><small>Based on ${latestNarrative.news_count} news articles</small></p>
        </section>
      `;
    } catch { /* ignore parse errors */ }
  }

  return `
    ${generateBreadcrumbsHTML([
    { label: "Home", url: `${BASE_URL}/` },
    { label: "Wiki", url: `${BASE_URL}/wiki` },
    { label: name }
  ])}
    <article itemscope itemtype="https://schema.org/${entity.entity_type === 'person' ? 'Person' : 'Organization'}">
      <header style="display: flex; gap: 24px; align-items: start; margin-bottom: 32px;">
        ${entity.image_url ? `
          <img itemprop="image" src="${escapeHtml(entity.image_url)}" alt="${escapeHtml(name)}" 
               style="width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 4px solid hsl(var(--card)); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        ` : `
          <div style="width: 120px; height: 120px; border-radius: 50%; background: hsl(var(--muted)); display: flex; align-items: center; justify-content: center; font-size: 48px;">
            ${entity.entity_type === 'person' ? '👤' : '🏢'}
          </div>
        `}
        <div>
          <span style="display: inline-block; padding: 4px 12px; background: hsl(var(--muted)); border-radius: 9999px; font-size: 14px; font-weight: 500; margin-bottom: 12px;">
            ${entityTypeLabel}
          </span>
          <h1 itemprop="name" style="margin: 0 0 8px 0; font-size: 32px; line-height: 1.2;">
            ${escapeHtml(name)}
          </h1>
          ${description ? `<p itemprop="description" style="font-size: 18px; color: hsl(var(--muted-foreground)); margin: 0;">${escapeHtml(description)}</p>` : ''}
        </div>
      </header>
      
      <section>
        <h2>📊 Rating</h2>
        <p>${linkedNews.length} news mentions · 👍 ${totalLikes} likes · 👎 ${totalDislikes} dislikes</p>
      </section>
      
      ${infoCardContent ? `
        <section itemscope itemtype="https://schema.org/Article">
          <h2>💡 Information Card</h2>
          <meta itemprop="name" content="AI Overview: ${escapeHtml(name)}" />
          <meta itemprop="description" content="Quick AI overview from open sources" />
          <div itemprop="articleBody" style="line-height: 1.6; color: hsl(var(--foreground));">
            ${infoCardContent.split('\n').map(line => {
              // Simple markdown to HTML conversion
              line = line.trim();
              if (!line) return '<br>';
              if (line.startsWith('## ')) return `<h3>${escapeHtml(line.substring(3))}</h3>`;
              if (line.startsWith('- ')) return `<li>${escapeHtml(line.substring(2))}</li>`;
              if (line.startsWith('> ')) return `<blockquote>${escapeHtml(line.substring(2))}</blockquote>`;
              return `<p>${escapeHtml(line)}</p>`;
            }).join('')}
          </div>
          ${infoCardSources.length > 0 ? `
            <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid hsl(var(--border));">
              <p style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: hsl(var(--muted-foreground)); margin-bottom: 8px;">Sources</p>
              <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 8px;">
                ${infoCardSources.map(src => `
                  <li style="display: inline;">
                    <a href="${escapeHtml(src.url)}" target="_blank" rel="noopener noreferrer" style="font-size: 11px; color: hsl(var(--primary)); text-decoration: underline;">
                      🔗 ${escapeHtml(src.title)}
                    </a>
                  </li>
                `).join('')}
              </ul>
            </div>
          ` : ''}
        </section>
      ` : ''}
      
      ${narrativeHtml}
      
      ${topTopics.length > 0 ? `
        <section>
          <h2>📌 Topics</h2>
          <ul>
            ${topTopics.map(([topic, count]) => `<li>${escapeHtml(topic)} (${count})</li>`).join("")}
          </ul>
        </section>
      ` : ''}
      
      ${topKeywords.length > 0 ? `
        <section>
          <h2>🏷️ Keywords</h2>
          <p>${topKeywords.map(([kw, count]) => `<span>${escapeHtml(kw)} (${count})</span>`).join(" · ")}</p>
        </section>
      ` : ''}
      
      <section>
        <h2>📖 Key Information</h2>
        ${extract ? `<div itemprop="description">${escapeHtml(extract)}</div>` : '<p>Information not yet loaded.</p>'}
      </section>
      
      ${linkedNews.length > 0 ? `
        <section>
          <h2>📰 Related News (${linkedNews.length})</h2>
          <ul>
            ${linkedNews.map((news: any) => {
    const newsTitle = news.title_en || news.title;
    const countryCode = (news.country as any)?.code?.toLowerCase() || 'us';
    const countryFlag = (news.country as any)?.flag || '';
    const newsUrl = news.slug ? `${BASE_URL}/news/${countryCode}/${news.slug}` : null;
    return `
                <li>
                  ${countryFlag} ${newsUrl ? `<a href="${newsUrl}">${escapeHtml(newsTitle)}</a>` : escapeHtml(newsTitle)}
                  ${news.published_at ? `<time>(${news.published_at.split('T')[0]})</time>` : ''}
                  ${news.description_en ? `<p>${escapeHtml(news.description_en.substring(0, 150))}...</p>` : ''}
                </li>
              `;
  }).join("")}
          </ul>
        </section>
      ` : ''}
      
      ${relatedEntities.length > 0 ? `
        <section>
          <h2>🔗 Entity Intersection Graph</h2>
          <div style="margin: 24px 0;">
            ${generateStaticIntersectionGraph(entity, relatedEntities)}
          </div>
          <p>People and organizations frequently mentioned alongside <strong>${escapeHtml(name)}</strong>:</p>
          <ul>
            ${relatedEntities.map((e: any) => {
    const eName = e.name_en || e.name;
    const eSlug = e.slug || e.id;
    const typeIcon = e.entity_type === 'person' ? '👤' : e.entity_type === 'company' ? '🏢' : '🌐';
    return `
                <li>
                  ${typeIcon} <a href="${BASE_URL}/wiki/${eSlug}">${escapeHtml(eName)}</a>
                  <span>(${e.shared_news_count} shared articles)</span>
                </li>
              `;
  }).join("")}
          </ul>
        </section>
      ` : ''}
      
      ${wikiLinkedEntities.length > 0 ? `
        <section>
          <h2>🌐 World Wide Web (Direct Links)</h2>
          <p>Entities directly linked to <strong>${escapeHtml(name)}</strong>:</p>
          <ul>
            ${wikiLinkedEntities.map((e: any) => {
    const eName = e.name_en || e.name;
    const eSlug = e.slug || e.id;
    const eDesc = e.description_en || e.description || '';
    const typeIcon = e.entity_type === 'person' ? '👤' : e.entity_type === 'company' ? '🏢' : '🌐';
    return `
                <li>
                  ${typeIcon} <a href="${BASE_URL}/wiki/${eSlug}">${escapeHtml(eName)}</a>
                  ${eDesc ? `<span> — ${escapeHtml(eDesc.substring(0, 100))}</span>` : ''}
                </li>
              `;
  }).join("")}
          </ul>
        </section>
      ` : ''}
      
      ${categories.length > 0 ? `
        <section>
          <h2>📂 Categories</h2>
          <p>${categories.map(c => `<span style="display: inline-block; padding: 4px 12px; background: hsl(var(--muted)); border-radius: 6px; margin: 4px; font-size: 14px;">${escapeHtml(c)}</span>`).join('')}</p>
        </section>
      ` : ''}
      
      ${caricatureIds.length > 0 ? `
        <section>
          <h2>🎨 Caricatures & Art</h2>
          <p>${caricatureIds.length} caricature(s) created about ${escapeHtml(name)}. <a href="${BASE_URL}/ink-abyss?entity=${entity.slug}">View in Ink Abyss →</a></p>
        </section>
      ` : ''}
      
      ${entity.wiki_url ? `
        <section>
          <h2>🔗 External Links</h2>
          <ul>
            <li><a href="${escapeHtml(entity.wiki_url)}" rel="noopener">Wikipedia</a></li>
            ${entity.wiki_url_en ? `<li><a href="${escapeHtml(entity.wiki_url_en)}" rel="noopener">Wikipedia (English)</a></li>` : ''}
          </ul>
        </section>
      ` : ''}
      
      <nav>
        <a href="${BASE_URL}/wiki">← Entity Catalog</a> |
        <a href="${BASE_URL}/news">📰 News</a> |
        <a href="${BASE_URL}/sitemap">🗺️ Sitemap</a>
      </nav>
    </article>
  `;
}

function generateWikiCatalogHTML(entities: any[], lang: string) {
  const titleField = lang === "en" ? "name_en" : "name";
  const descField = lang === "en" ? "description_en" : "description";

  return `
    <h1>Entity Catalog</h1>
    <p>People, companies and organizations mentioned in the news.</p>
    
    <section>
      <h2>All Entities (${entities.length})</h2>
      <ul>
        ${entities.map((e) => {
    const name = e[titleField] || e.name;
    const desc = e[descField] || e.description || '';
    const slug = e.slug || e.id;
    const typeIcon = e.entity_type === 'person' ? '👤' : e.entity_type === 'company' ? '🏢' : '🌐';
    return `
            <li>
              <a href="${BASE_URL}/wiki/${slug}">
                ${typeIcon} ${escapeHtml(name)}
              </a>
              ${desc ? `<span> - ${escapeHtml(desc.substring(0, 100))}${desc.length > 100 ? '...' : ''}</span>` : ''}
            </li>
          `;
  }).join("")}
      </ul>
    </section>
    
    <nav>
      <a href="${BASE_URL}/">← Home</a> |
      <a href="${BASE_URL}/news">📰 News</a> |
      <a href="${BASE_URL}/sitemap">🗺️ Sitemap</a>
    </nav>
  `;
}

function generateTopicsCatalogHTML(topics: { topic: string; count: number }[], lang: string) {
  const titleText = lang === "en" ? "News Topics" : "Теми Новин";
  const subtitleText = lang === "en"
    ? "Explore all topics mentioned in news articles. Each topic has its own page with a timeline, entities, and statistics."
    : "Перегляньте всі теми, згадані в новинних статтях. Кожна тема має свою сторінку з таймлайном, сутностями та статистикою.";

  return `
    <h1>${escapeHtml(titleText)}</h1>
    <p>${escapeHtml(subtitleText)}</p>

    <section>
      <h2>${lang === "en" ? `All Topics (${topics.length})` : `Всі теми (${topics.length})`}</h2>
      <ul>
        ${topics.map(({ topic, count }) => `
          <li>
            <a href="${BASE_URL}/topics/${encodeURIComponent(topic)}">
              #${escapeHtml(topic)}
            </a>
            <span> (${count} ${lang === "en" ? "articles" : "статей"})</span>
          </li>
        `).join("")}
      </ul>
    </section>

    <nav>
      <a href="${BASE_URL}/">← Home</a> |
      <a href="${BASE_URL}/news">📰 News</a> |
      <a href="${BASE_URL}/wiki">🌐 Entities</a> |
      <a href="${BASE_URL}/sitemap">🗺️ Sitemap</a>
    </nav>
  `;
}

function generateTopicPageHTML(topic: string, newsItems: any[], lang: string) {
  const titleField = lang === "en" ? "title_en" : "title";
  const descField = lang === "en" ? "description_en" : "description";
  const countryNameField = lang === "en" ? "name_en" : "name";

  return `
    <h1>#${escapeHtml(topic)}</h1>
    <p>${lang === "en" ? "Latest news articles tagged with this topic." : "Останні новинні статті з цією темою."}</p>

    <section>
      <h2>${lang === "en" ? `Articles (${newsItems.length})` : `Статті (${newsItems.length})`}</h2>
      <ul>
        ${newsItems.map((item) => {
          const t = item[titleField] || item.title || "";
          const s = item[descField] || item.description || "";
          const country = item.country;
          const flag = country?.flag || "";
          const countryName = country?.[countryNameField] || country?.name || "";
          const slug = item.slug || item.id;
          const date = item.published_at ? new Date(item.published_at).toLocaleDateString(lang === "en" ? "en-GB" : "uk-UA") : "";
          const relatedThemes = (item.themes || []).filter((t: string) => t !== topic);
          return `
            <li>
              <a href="${BASE_URL}/news/${country?.code || ""}/${slug}">
                ${flag} ${escapeHtml(t)}
              </a>
              ${date ? `<time> — ${escapeHtml(date)}</time>` : ""}
              ${countryName ? `<span> [${escapeHtml(countryName)}]</span>` : ""}
              ${s ? `<p>${escapeHtml(s.substring(0, 120))}${s.length > 120 ? "..." : ""}</p>` : ""}
              ${relatedThemes.length > 0 ? `<small>${lang === "en" ? "Related:" : "Суміжні:"} ${relatedThemes.slice(0, 4).map((rt: string) => `<a href="${BASE_URL}/topics/${encodeURIComponent(rt)}">#${escapeHtml(rt)}</a>`).join(", ")}</small>` : ""}
            </li>
          `;
        }).join("")}
      </ul>
    </section>

    <nav>
      <a href="${BASE_URL}/topics">← ${lang === "en" ? "All Topics" : "Всі теми"}</a> |
      <a href="${BASE_URL}/news">📰 News</a> |
      <a href="${BASE_URL}/sitemap">🗺️ Sitemap</a>
    </nav>
  `;
}

function generateNewsSourcesHTML(sources: any) {
  if (!sources || !Array.isArray(sources) || sources.length === 0) return "";

  return `
    <section>
      <h3>News Sources</h3>
      <ul>
        ${sources.map((s: any) => `
          <li>
            <a href="${escapeHtml(s.url)}" rel="nofollow noopener" target="_blank">
              ${escapeHtml(s.title || s.source_name || "Source")}
            </a>
          </li>
        `).join("")}
      </ul>
    </section>
  `;
}

function escapeHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
