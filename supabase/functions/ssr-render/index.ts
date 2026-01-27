import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_URL = "https://echoes2.com";

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
  startTime: number
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
      status_code: 200
    });
    
    console.log(`Bot visit logged: ${botInfo.type} (${botInfo.category}) -> ${path}`);
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
    const path = url.searchParams.get("path") || "/";
    const lang = url.searchParams.get("lang") || "uk";
    const userAgent = req.headers.get("user-agent") || "";
    const referer = req.headers.get("referer");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Detect and log bot visit
    const botInfo = detectBot(userAgent);
    if (botInfo) {
      // Log asynchronously - don't wait
      logBotVisit(supabase, botInfo, path, userAgent, referer, startTime);
    }

    // Parse the path to determine content type
    const readMatch = path.match(/^\/read\/(\d{4}-\d{2}-\d{2})\/(\d+)$/);
    const chapterMatch = path.match(/^\/chapter\/([a-f0-9-]+)$/);
    const dateMatch = path.match(/^\/date\/(\d{4}-\d{2}-\d{2})$/);
    // News article match: /us/some-slug or /ua/some-slug
    const newsMatch = path.match(/^\/([a-z]{2})\/([a-z0-9-]+)$/);

    let html = "";
    let title = "Точка Синхронізації";
    let description = "AI-генерована наукова фантастика на основі реальних новин";
    let image = `${BASE_URL}/favicon.png`;
    let canonicalUrl = BASE_URL + path;

    if (readMatch) {
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
    } else if (chapterMatch) {
      // Chapter page
      const [, chapterId] = chapterMatch;

      const { data: chapter } = await supabase
        .from("chapters")
        .select("*, volume:volumes(*)")
        .eq("id", chapterId)
        .single();

      if (chapter) {
        const titleField = lang === "en" ? "title_en" : lang === "pl" ? "title_pl" : "title";
        const descField = lang === "en" ? "description_en" : lang === "pl" ? "description_pl" : "description";

        title = chapter[titleField] || chapter.title;
        description = chapter[descField] || chapter.description || description;
        image = chapter.cover_image_url || image;

        html = generateChapterHTML(chapter, lang, canonicalUrl);
      }
    } else if (newsMatch) {
      // News article page
      const [, countryCode, slug] = newsMatch;
      
      const { data: newsItem } = await supabase
        .from("news_rss_items")
        .select("*, country:news_countries(*)")
        .eq("slug", slug)
        .maybeSingle();

      if (newsItem) {
        title = newsItem.title_en || newsItem.title;
        description = (newsItem.content_en || newsItem.content || newsItem.description_en || newsItem.description)?.substring(0, 160) + "...";
        image = newsItem.image_url || image;
        
        html = generateNewsHTML(newsItem, lang, canonicalUrl);
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
      // Home page
      const { data: latestParts } = await supabase
        .from("parts")
        .select("*, chapter:chapters(*)")
        .eq("status", "published")
        .order("date", { ascending: false })
        .order("number", { ascending: false })
        .limit(10);

      html = generateHomeHTML(latestParts || [], lang, canonicalUrl);
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
    });

    return new Response(fullHtml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
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

function generateFullDocument(opts: {
  title: string;
  description: string;
  image: string;
  canonicalUrl: string;
  lang: string;
  content: string;
  path: string;
}) {
  const { title, description, image, canonicalUrl, lang, content, path } = opts;
  const BASE_URL = "https://echoes2.com";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": path.includes("/read/") ? "NewsArticle" : "WebSite",
    name: title,
    headline: title,
    description,
    image,
    url: canonicalUrl,
    inLanguage: lang === "uk" ? "uk-UA" : lang === "pl" ? "pl-PL" : "en-US",
    publisher: {
      "@type": "Organization",
      name: "Synchronization Point",
      logo: { "@type": "ImageObject", url: `${BASE_URL}/favicon.png` },
    },
    author: {
      "@type": "Organization",
      name: "Synchronization Point AI",
    },
  };

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
  <meta property="og:type" content="${path.includes("/read/") ? "article" : "website"}">
  <meta property="og:locale" content="${lang === "uk" ? "uk_UA" : lang === "pl" ? "pl_PL" : "en_US"}">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${image}">
  
  <!-- AI/LLM Tags -->
  <meta name="ai:summary" content="${escapeHtml(description)}">
  <meta name="ai:content_type" content="${path.includes("/read/") ? "narrative_story" : "website"}">
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
  
  <!-- Redirect to SPA after content is indexed -->
  <noscript>
    <meta http-equiv="refresh" content="0; url=${BASE_URL}${path}">
  </noscript>
  
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    h1 { font-size: 2rem; margin-bottom: 1rem; }
    article { margin: 2rem 0; }
    .story-content { white-space: pre-wrap; }
    .meta { color: #666; font-size: 0.9rem; margin-bottom: 1rem; }
    a { color: #0066cc; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <header>
    <h1><a href="${BASE_URL}">Точка Синхронізації</a></h1>
    <p>AI Archive of Human History</p>
  </header>
  
  <main>
    ${content}
  </main>
  
  <footer>
    <p><a href="${BASE_URL}">← Back to main site</a></p>
    <p>© Synchronization Point. AI-generated content based on real news.</p>
  </footer>
  
  <script>
    // Redirect real users to SPA, keep bots on static content
    if (typeof window !== 'undefined' && !navigator.userAgent.match(/bot|crawl|spider|slurp|googlebot|bingbot|yandex|baidu|duckduckbot|gptbot|claudebot|perplexitybot/i)) {
      window.location.replace('${BASE_URL}${path}');
    }
  </script>
</body>
</html>`;
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

function generateNewsHTML(newsItem: any, lang: string, canonicalUrl: string) {
  const title = newsItem.title_en || newsItem.title;
  const content = newsItem.content_en || newsItem.content || newsItem.description_en || newsItem.description || "";
  const countryName = newsItem.country?.name_en || newsItem.country?.name || "";

  return `
    <article itemscope itemtype="https://schema.org/NewsArticle">
      ${newsItem.image_url ? `<img src="${newsItem.image_url}" alt="${escapeHtml(title)}" itemprop="image">` : ""}
      
      <div class="meta">
        <time datetime="${newsItem.published_at || newsItem.created_at}" itemprop="datePublished">
          ${new Date(newsItem.published_at || newsItem.created_at).toLocaleDateString()}
        </time>
        ${countryName ? ` | <span>${escapeHtml(countryName)}</span>` : ""}
        ${newsItem.category ? ` | <span itemprop="articleSection">${escapeHtml(newsItem.category)}</span>` : ""}
      </div>
      
      <h2 itemprop="headline">${escapeHtml(title)}</h2>
      
      <div class="story-content" itemprop="articleBody">
        ${escapeHtml(content)}
      </div>
      
      ${newsItem.url ? `<p><a href="${escapeHtml(newsItem.url)}" rel="nofollow noopener" target="_blank">Original source</a></p>` : ""}
    </article>
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
          <a href="${canonicalUrl.replace(/\/date\/.*/, `/read/${date}/${index + 1}`)}">
            ${escapeHtml(part[titleField] || part.title)}
          </a>
          ${part.is_flash_news ? " ⚡" : ""}
        </li>
      `).join("")}
    </ul>
  `;
}

function generateHomeHTML(parts: any[], lang: string, canonicalUrl: string) {
  const titleField = lang === "en" ? "title_en" : lang === "pl" ? "title_pl" : "title";

  return `
    <h2>Latest Stories</h2>
    
    <ul itemscope itemtype="https://schema.org/ItemList">
      ${parts.map((part, index) => `
        <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
          <meta itemprop="position" content="${index + 1}">
          <a href="https://echoes2.com/read/${part.date}/${part.number}" itemprop="url">
            <span itemprop="name">${escapeHtml(part[titleField] || part.title)}</span>
          </a>
          <span class="meta">${part.date}</span>
          ${part.is_flash_news ? " ⚡" : ""}
        </li>
      `).join("")}
    </ul>
    
    <nav>
      <a href="https://echoes2.com/calendar">📅 Calendar Archive</a> |
      <a href="https://echoes2.com/chapters">📚 Chapters</a> |
      <a href="https://echoes2.com/volumes">📖 Volumes</a>
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
