import { useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { uk, enUS, pl } from "date-fns/locale";
import {
  ArrowLeft, Tag, Newspaper, Users, Calendar, TrendingUp,
  Loader2, ExternalLink, Hash, BarChart2, Layers, Clock,
  ChevronRight, Image as ImageIcon, Globe, Flame
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from "recharts";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { slugToTopic, topicPath } from "@/lib/topicSlug";

// ─── types ──────────────────────────────────────────────────────────────────

interface TopicNewsItem {
  id: string;
  slug: string | null;
  title: string;
  title_en: string | null;
  description: string | null;
  description_en: string | null;
  image_url: string | null;
  published_at: string | null;
  themes: string[] | null;
  themes_en: string[] | null;
  likes: number | null;
  dislikes: number | null;
  country: {
    code: string;
    flag: string | null;
    name: string | null;
    name_en: string | null;
  };
}

interface EntityLink {
  news_item_id: string;
  wiki_entity: {
    id: string;
    name: string;
    name_en: string | null;
    entity_type: string;
    image_url: string | null;
    slug: string | null;
  } | null;
}

interface Caricature {
  id: string;
  image_url: string;
  title: string | null;
  likes: number | null;
  dislikes: number | null;
  news_item_id: string | null;
}

// ─── helpers ────────────────────────────────────────────────────────────────

const ENTITY_TYPE_COLORS: Record<string, string> = {
  person: "from-blue-500/20 to-blue-600/10 border-blue-500/30",
  company: "from-green-500/20 to-green-600/10 border-green-500/30",
  organization: "from-purple-500/20 to-purple-600/10 border-purple-500/30",
};

const ENTITY_TYPE_LABELS: Record<string, { uk: string; en: string }> = {
  person: { uk: "Особа", en: "Person" },
  company: { uk: "Компанія", en: "Company" },
  organization: { uk: "Організація", en: "Org" },
};

function formatChartDate(dateStr: string, lang: string): string {
  try {
    const d = parseISO(dateStr);
    const locale = lang === "en" ? enUS : lang === "pl" ? pl : uk;
    return format(d, "d MMM", { locale });
  } catch {
    return dateStr;
  }
}

// ─── component ──────────────────────────────────────────────────────────────

export default function NewsTopicPage() {
  const { topicSlug = "" } = useParams<{ topicSlug: string }>();
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const topic = slugToTopic(topicSlug);

  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [timelineExpanded, setTimelineExpanded] = useState(false);

  const dateLocale = language === "en" ? enUS : language === "pl" ? pl : uk;

  // ── total news count (real count, no limit, 24-hour cache) ────────────────
  const { data: totalNewsCount = 0 } = useQuery<number>({
    queryKey: ["topic-news-count", topic],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("news_rss_items")
        .select("*", { count: "exact", head: true })
        .contains("themes", [topic]);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!topic,
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
  });

  // ── admin-edited topic meta (description + SEO texts) ────────────────
  const { data: topicMeta } = useQuery<{
    description: string | null;
    description_en: string | null;
    seo_text: string | null;
    seo_text_en: string | null;
    seo_keywords: string | null;
    seo_keywords_en: string | null;
  } | null>({
    queryKey: ["topic-meta-page", topic],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("topic_meta")
        .select("description,description_en,seo_text,seo_text_en,seo_keywords,seo_keywords_en")
        .eq("topic", topic)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!topic,
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
  });

  // ── fetch news for this topic ────────────────────────────────────────────
  const { data: newsItems = [], isLoading: newsLoading } = useQuery<TopicNewsItem[]>({
    queryKey: ["topic-news", topic],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news_rss_items")
        .select(`
          id, slug, title, title_en, description, description_en,
          image_url, published_at, themes, themes_en, likes, dislikes,
          country:news_countries(code, flag, name, name_en)
        `)
        .contains("themes", [topic])
        .order("published_at", { ascending: false });

      if (error) throw error;
      return (data || []).map((item: any) => ({
        ...item,
        country: Array.isArray(item.country) ? item.country[0] : item.country,
      })) as TopicNewsItem[];
    },
    enabled: !!topic,
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
  });

  // ── IDs for dependent queries ────────────────────────────────────────────
  const newsIds = useMemo(() => newsItems.map((n) => n.id), [newsItems]);

  // ── fetch wiki entities linked to these news ─────────────────────────────
  const { data: entityLinks = [], isLoading: entitiesLoading } = useQuery<EntityLink[]>({
    queryKey: ["topic-entities", topic, newsIds.length],
    queryFn: async () => {
      if (!newsIds.length) return [];
      // batch in chunks of 100 to stay within URL limits
      const chunks: string[][] = [];
      for (let i = 0; i < newsIds.length; i += 100) {
        chunks.push(newsIds.slice(i, i + 100));
      }
      const results: EntityLink[] = [];
      for (const chunk of chunks) {
        const { data } = await supabase
          .from("news_wiki_entities")
          .select(`
            news_item_id,
            wiki_entity:wiki_entities(id, name, name_en, entity_type, image_url, slug)
          `)
          .in("news_item_id", chunk);
        if (data) results.push(...(data as unknown as EntityLink[]));
      }
      return results;
    },
    enabled: newsIds.length > 0,
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
  });

  // ── fetch caricatures ────────────────────────────────────────────────────
  const { data: caricatures = [] } = useQuery<Caricature[]>({
    queryKey: ["topic-caricatures", topic, newsIds.length],
    queryFn: async () => {
      if (!newsIds.length) return [];
      const { data } = await supabase
        .from("outrage_ink")
        .select("id, image_url, title, likes, dislikes, news_item_id")
        .in("news_item_id", newsIds.slice(0, 100))
        .limit(6);
      return (data || []) as Caricature[];
    },
    enabled: newsIds.length > 0,
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
  });

  // ── derived data ─────────────────────────────────────────────────────────

  /** Array of entity stats sorted by count descending */
  const entityStats = useMemo(() => {
    const map = new Map<string, { entity: NonNullable<EntityLink["wiki_entity"]>; count: number }>();
    for (const link of entityLinks) {
      if (!link.wiki_entity) continue;
      const e = link.wiki_entity;
      const existing = map.get(e.id);
      if (existing) {
        existing.count++;
      } else {
        map.set(e.id, { entity: e, count: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [entityLinks]);

  /** Entity count per news_item_id for the per-date chart */
  const entityCountByNewsId = useMemo(() => {
    const map = new Map<string, number>();
    for (const link of entityLinks) {
      if (!link.wiki_entity) continue;
      map.set(link.news_item_id, (map.get(link.news_item_id) || 0) + 1);
    }
    return map;
  }, [entityLinks]);

  /** Chart data: { date, newsCount, entityCount } grouped by day */
  const chartData = useMemo(() => {
    const byDate = new Map<string, { newsCount: number; entityCount: number }>();
    for (const n of newsItems) {
      if (!n.published_at) continue;
      try {
        const day = format(parseISO(n.published_at), "yyyy-MM-dd");
        const existing = byDate.get(day) ?? { newsCount: 0, entityCount: 0 };
        existing.newsCount++;
        existing.entityCount += entityCountByNewsId.get(n.id) || 0;
        byDate.set(day, existing);
      } catch {
        // ignore invalid dates
      }
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats]) => ({
        date,
        label: formatChartDate(date, language),
        newsCount: stats.newsCount,
        entityCount: stats.entityCount,
      }));
  }, [newsItems, entityCountByNewsId, language]);

  /** Hero image – first news with an image */
  const heroImage = useMemo(
    () => newsItems.find((n) => n.image_url)?.image_url ?? null,
    [newsItems]
  );

  /** Related topics that appear together in same news */
  const relatedTopics = useMemo(() => {
    const topicCount = new Map<string, number>();
    for (const n of newsItems) {
      const themes = (n.themes || []).filter((t) => t !== topic);
      for (const t of themes) {
        topicCount.set(t, (topicCount.get(t) || 0) + 1);
      }
    }
    return Array.from(topicCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([t, count]) => ({ topic: t, count }));
  }, [newsItems, topic]);

  /** Timeline items (limited or full depending on expanded state) */
  const timelineItems = timelineExpanded ? newsItems : newsItems.slice(0, 30);

  /** Timeline grouped by day for visual separation */
  const groupedByDay = useMemo(() => {
    const groups: { date: string; label: string; items: TopicNewsItem[] }[] = [];
    let currentDay = '';
    for (const n of timelineItems) {
      if (!n.published_at) continue;
      try {
        const day = format(parseISO(n.published_at), "yyyy-MM-dd");
        const dayLabel = format(parseISO(n.published_at), "EEEE, d MMMM yyyy", { locale: dateLocale });
        if (day !== currentDay) {
          currentDay = day;
          groups.push({ date: day, label: dayLabel, items: [n] });
        } else {
          groups[groups.length - 1].items.push(n);
        }
      } catch { /* skip */ }
    }
    return groups;
  }, [timelineItems, dateLocale]);

  // ── local helpers ────────────────────────────────────────────────────────
  function getLocalTitle(n: TopicNewsItem): string {
    if (language === "en" && n.title_en) return n.title_en;
    return n.title;
  }
  function getLocalDesc(n: TopicNewsItem): string | null {
    if (language === "en" && n.description_en) return n.description_en;
    return n.description;
  }
  function countryName(n: TopicNewsItem) {
    if (language === "en" && n.country?.name_en) return n.country.name_en;
    return n.country?.name || n.country?.code || "";
  }
  function newsUrl(n: TopicNewsItem) {
    if (n.slug && n.country?.code) {
      return `/news/${n.country.code.toLowerCase()}/${n.slug}`;
    }
    return "#";
  }

  // ── SEO ──────────────────────────────────────────────────────────────────
  const seoTitle =
    language === "en"
      ? `${topic} – News Category, Timeline & Entities | BraveNNow`
      : `${topic} – Категорія новин, таймлайн та сутності | BraveNNow`;
  const seoDescription =
    language === "en"
      ? `${totalNewsCount} news articles on the topic "${topic}". Chronological timeline, ${entityStats.length} key entities (people, companies, organisations), statistics charts and in-depth analysis on BraveNNow.`
      : `${totalNewsCount} новинних статей на тему «${topic}». Хронологічний таймлайн, ${entityStats.length} ключових сутностей (особи, компанії, організації), графіки статистики та поглиблений аналіз на BraveNNow.`;

  const seoKeywords = [
    topic,
    language === "en" ? "news" : "новини",
    language === "en" ? "category" : "категорія",
    language === "en" ? "timeline" : "таймлайн",
    language === "en" ? "analysis" : "аналіз",
    ...entityStats.slice(0, 5).map(e => language === "en" && e.entity.name_en ? e.entity.name_en : e.entity.name),
    ...relatedTopics.slice(0, 4).map(r => r.topic),
  ];

  const seoTopName = language === "en" ? "Topics" : "Категорії";
  const seoBreadcrumbs = [
    { name: language === "en" ? "Home" : "Головна", url: "https://bravennow.com" },
    { name: seoTopName, url: "https://bravennow.com/topics" },
    { name: topic, url: `https://bravennow.com/topics/${topicSlug}` },
  ];

  const itemListSchema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: topic,
    description: seoDescription,
    url: `https://bravennow.com/topics/${topicSlug}`,
    numberOfItems: newsItems.length,
    itemListElement: newsItems.slice(0, 10).map((n, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      url: n.slug && n.country?.code
        ? `https://bravennow.com/news/${n.country.code.toLowerCase()}/${n.slug}`
        : "https://bravennow.com/news",
      name: (language === "en" && n.title_en ? n.title_en : n.title),
    })),
  };

  // ── render ────────────────────────────────────────────────────────────────

  if (newsLoading) {
    return (
      <>
        <Header />
        <div className="container mx-auto px-4 py-12 flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">
            {language === "en" ? "Loading category..." : "Завантаження категорії..."}
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        keywords={seoKeywords}
        canonicalUrl={`https://bravennow.com/topics/${topicSlug}`}
        image={heroImage || undefined}
        type="website"
        schemaType="CollectionPage"
        breadcrumbs={seoBreadcrumbs}
        additionalSchemas={[itemListSchema]}
      />
      <Header />

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* ── breadcrumb / back ── */}
        <div className="flex items-center gap-2 mb-6 text-sm text-muted-foreground">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 px-2"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-4 h-4" />
            {language === "en" ? "Back" : "Назад"}
          </Button>
          <span>/</span>
          <Link to="/topics" className="hover:text-primary transition-colors">
            {language === "en" ? "Topics" : "Категорії"}
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium truncate max-w-[200px]">{topic}</span>
        </div>

        {/* ── page title ── */}
        <div className="flex flex-wrap items-center gap-3 mb-8">
          <div className="flex items-center gap-2">
            <Tag className="w-6 h-6 text-primary" />
            <h1 className="text-3xl md:text-4xl font-bold text-glow">{topic}</h1>
          </div>
          <Badge variant="secondary" className="text-sm px-3 py-1">
            <Newspaper className="w-3.5 h-3.5 mr-1" />
            {newsItems.length}{" "}
            {language === "en" ? "articles" : "статей"}
          </Badge>
          <Badge variant="outline" className="text-sm px-3 py-1 border-primary/40 text-primary">
            <Users className="w-3.5 h-3.5 mr-1" />
            {entityStats.length}{" "}
            {language === "en" ? "entities" : "сутностей"}
          </Badge>
        </div>

        {/* ── main 2 + 1 column grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ╔══════════════════════════════╗
              ║  LEFT — 2 cols  (content)    ║
              ╚══════════════════════════════╝ */}
          <div className="lg:col-span-2 space-y-8">

            {/* ── Hero image + description ── */}
            <Card className="overflow-hidden border-primary/20">
              {heroImage ? (
                <div className="relative">
                  <img
                    src={heroImage}
                    alt={topic}
                    className="w-full h-56 md:h-72 object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 p-4">
                    <Badge className="bg-primary/80 text-primary-foreground">
                      <Tag className="w-3 h-3 mr-1" />
                      {topic}
                    </Badge>
                  </div>
                </div>
              ) : (
                <div className="w-full h-32 bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                  <Hash className="w-12 h-12 text-primary/40" />
                </div>
              )}
              <CardContent className="p-5">
                <p className="text-muted-foreground leading-relaxed">
                  {language === "en"
                    ? (topicMeta?.description_en ||
                        `"${topic}" is a live news category on BraveNNow. We've collected ${totalNewsCount} articles from different countries, published over ${chartData.length} days. Each article is automatically linked to real-world entities — people, companies and organisations — so you can instantly see who is involved and click through to their full profiles. Right now this category is connected to ${entityStats.length} such entities.`)
                    : (topicMeta?.description ||
                        `«${topic}» — це жива категорія новин на BraveNNow. Ми зібрали ${totalNewsCount} статей з різних країн, опублікованих протягом ${chartData.length} днів. Кожна стаття автоматично пов'язана з реальними персонами, компаніями та організаціями — тож ви одразу бачите, хто причетний, і можете перейти до їхніх повних профілів. Зараз у цій категорії є ${entityStats.length} таких сутностей.`)}
                </p>

                {/* Related topics */}
                {relatedTopics.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-border/40">
                    <span className="text-xs text-muted-foreground self-center">
                      {language === "en" ? "Related topics:" : "Пов'язані теми:"}
                    </span>
                    {relatedTopics.slice(0, 8).map(({ topic: rt, count }) => (
                      <Link key={rt} to={topicPath(rt)}>
                        <Badge
                          variant="secondary"
                          className="text-xs cursor-pointer hover:bg-primary/20 hover:text-primary transition-colors"
                        >
                          {rt}
                          <span className="ml-1 text-muted-foreground">({count})</span>
                        </Badge>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Timeline with day groups (moved to left col) ── */}
            <section>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                {language === "en" ? "News Timeline" : "Таймлайн новин"}
                <Badge variant="outline" className="ml-auto text-xs">
                  {newsItems.length}
                </Badge>
              </h2>

              {newsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 rounded-lg" />
                  ))}
                </div>
              ) : newsItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {language === "en" ? "No news found." : "Новин не знайдено."}
                </p>
              ) : (
                <div className="relative">
                  {/* Vertical timeline line */}
                  <div className="absolute left-4 top-0 bottom-0 w-px bg-primary/15" />

                  <div className="space-y-0">
                    {groupedByDay.map((group) => (
                      <div key={group.date}>
                        {/* Day separator header — brick-style date */}
                        <div className="relative flex items-center gap-3 py-4 px-4">
                          <div className="relative z-10 flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 border border-primary/50 flex items-center justify-center">
                            <Calendar className="w-3 h-3 text-primary" />
                          </div>
                          <div className="flex-1 flex items-center gap-2.5">
                            <span className="inline-flex items-center gap-1.5 bg-primary/15 border border-primary/35 text-primary text-sm font-bold px-3 py-1 rounded-md tracking-wide">
                              <Calendar className="w-3.5 h-3.5" />
                              {group.label}
                            </span>
                            <span className="text-xs text-muted-foreground bg-secondary/60 border border-border px-2 py-0.5 rounded-full font-medium">
                              {group.items.length} {language === "en" ? "articles" : "статей"}
                            </span>
                          </div>
                        </div>

                        {/* News items within the day */}
                        {group.items.map((n) => {
                          const url = newsUrl(n);
                          const otherThemes = (n.themes || []).filter((t) => t !== topic);
                          return (
                            <div key={n.id} className="relative flex gap-3 px-4 py-3 hover:bg-primary/5 transition-colors group">
                              {/* dot */}
                              <div className="relative z-10 flex-shrink-0 w-2.5 h-2.5 mt-1.5 rounded-full bg-primary/60 border border-primary/40 ring-2 ring-background" style={{ marginLeft: '3px' }} />

                              <div className="flex-1 min-w-0 flex gap-3">
                                {/* Thumbnail */}
                                {n.image_url && (
                                  <Link to={url} className="flex-shrink-0">
                                    <img
                                      src={n.image_url}
                                      alt=""
                                      className="w-20 h-14 object-cover rounded border border-border group-hover:border-primary/40 transition-colors"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).parentElement!.style.display = "none";
                                      }}
                                    />
                                  </Link>
                                )}

                                <div className="flex-1 min-w-0">
                                  {/* Country flag + time */}
                                  <p className="text-[10px] text-muted-foreground font-mono mb-0.5 flex items-center gap-1">
                                    {n.country?.flag && (
                                      <span className="text-sm leading-none">{n.country.flag}</span>
                                    )}
                                    <span>{n.country?.name || n.country?.code}</span>
                                    {n.published_at && (
                                      <span className="opacity-60">
                                        · {format(parseISO(n.published_at), "HH:mm")}
                                      </span>
                                    )}
                                  </p>

                                  {/* Title */}
                                  <Link to={url}>
                                    <p className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors mb-1.5">
                                      {getLocalTitle(n)}
                                    </p>
                                  </Link>

                                  {/* Topics as links */}
                                  {otherThemes.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      <Link to={topicPath(topic)}>
                                        <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 font-medium">
                                          {topic}
                                        </span>
                                      </Link>
                                      {otherThemes.slice(0, 3).map((t) => (
                                        <Link key={t} to={topicPath(t)}>
                                          <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-secondary/60 text-secondary-foreground hover:bg-primary/10 hover:text-primary transition-colors">
                                            {t}
                                          </span>
                                        </Link>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  {/* Show more / less */}
                  {newsItems.length > 30 && (
                    <div className="pt-4 border-t border-border/40 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => setTimelineExpanded(!timelineExpanded)}
                      >
                        {timelineExpanded
                          ? language === "en" ? "Show less" : "Сховати"
                          : language === "en"
                          ? `Show all ${newsItems.length} articles`
                          : `Показати всі ${newsItems.length} статей`}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ── Caricature section ── */}
            {caricatures.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-400" />
                  {language === "en" ? "Caricatures" : "Карикатури"}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {caricatures.map((c) => (
                    <button
                      key={c.id}
                      className="group relative rounded-lg overflow-hidden border border-border hover:border-primary/50 transition-colors cursor-zoom-in"
                      onClick={() => setLightboxSrc(c.image_url)}
                    >
                      <img
                        src={c.image_url}
                        alt={c.title || "Caricature"}
                        className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).parentElement!.style.display = "none";
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                        {c.title && (
                          <p className="text-xs text-foreground line-clamp-2">{c.title}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* ── Charts ── */}
            {chartData.length > 1 && (
              <section className="space-y-6">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-primary" />
                  {language === "en" ? "Statistics by Date" : "Статистика по датах"}
                </h2>

                {/* Chart 1: News count per date */}
                <Card className="border-primary/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Newspaper className="w-4 h-4" />
                      {language === "en" ? "News publications per day" : "Кількість новин за день"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10, fill: "#94a3b8" }}
                          interval={Math.floor(chartData.length / 8)}
                        />
                        <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{
                            background: "#0f1929",
                            border: "1px solid rgba(99,102,241,0.3)",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                          labelStyle={{ color: "#e2e8f0" }}
                          formatter={(v) => [
                            v,
                            language === "en" ? "articles" : "статей",
                          ]}
                        />
                        <Bar dataKey="newsCount" fill="#6366f1" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Chart 2: Entity count per date */}
                {entityStats.length > 0 && (
                  <Card className="border-primary/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Layers className="w-4 h-4" />
                        {language === "en"
                          ? "Number of entities per day (in news)"
                          : "Кількість сутностей за день (у новинах)"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                          <defs>
                            <linearGradient id="entityGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                          <XAxis
                            dataKey="label"
                            tick={{ fontSize: 10, fill: "#94a3b8" }}
                            interval={Math.floor(chartData.length / 8)}
                          />
                          <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{
                              background: "#0f1929",
                              border: "1px solid rgba(34,211,238,0.3)",
                              borderRadius: "8px",
                              fontSize: "12px",
                            }}
                            labelStyle={{ color: "#e2e8f0" }}
                            formatter={(v) => [
                              v,
                              language === "en" ? "entities" : "сутностей",
                            ]}
                          />
                          <Area
                            type="monotone"
                            dataKey="entityCount"
                            stroke="#22d3ee"
                            fill="url(#entityGrad)"
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
              </section>
            )}

            {/* ── SEO text block ── */}
            <Card className="border-border/40 bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  {language === "en" ? `About the topic: ${topic}` : `Про тему: ${topic}`}
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-invert prose-sm max-w-none text-muted-foreground space-y-4">
                {/* If admin wrote a custom SEO text, show it; otherwise show auto-generated */}
                {language === "en" && topicMeta?.seo_text_en ? (
                  topicMeta.seo_text_en.split("\n\n").map((para, i) => <p key={i}>{para}</p>)
                ) : language !== "en" && topicMeta?.seo_text ? (
                  topicMeta.seo_text.split("\n\n").map((para, i) => <p key={i}>{para}</p>)
                ) : language === "en" ? (
                  <>
                    <p>
                      The topic <strong className="text-foreground">"{topic}"</strong> is one of the key
                      categories on BraveNNow, aggregating <strong className="text-foreground">{totalNewsCount} news articles</strong> from
                      various countries and sources. This page provides a fully interactive chronological
                      timeline, allows you to follow global events as they unfold, and highlights the most
                      frequently mentioned entities — {entityStats.slice(0, 3).map(e =>
                        e.entity.name_en || e.entity.name
                      ).join(", ")}{entityStats.length > 3 ? " and others" : ""}.
                    </p>
                    <p>
                      Using advanced data aggregation, BraveNNow extracts and links all key entities
                      (people, companies, organisations) mentioned across every article in this category.
                      {entityStats.length > 0 && (
                        <> The current topic is connected to <strong className="text-foreground">{entityStats.length} unique entities</strong> and
                        spans <strong className="text-foreground">{chartData.length} days</strong> of coverage.
                        Each entity has its own dedicated wiki page with a full history of news mentions,
                        relationship graphs, and AI-generated analyses.</>
                      )}
                    </p>
                    <p>
                      The activity chart reveals the dynamics of publication intensity: peaks often
                      correspond to major events or breaking news in the <em>{topic}</em> space.
                      {relatedTopics.length > 0 && (
                        <> Closely related topics include {relatedTopics.slice(0, 4).map(r => `"${r.topic}"`).join(", ")},
                        which frequently appear alongside this category in the same news articles.</>
                      )}
                    </p>
                    <p>
                      BraveNNow continuously monitors hundreds of RSS feeds and news sources, automatically
                      classifying each article into relevant categories. By browsing topic pages you get a
                      structured, entity-linked, and visually rich overview of any subject area — far beyond
                      a simple keyword search. Explore the full <Link to="/topics" className="text-primary hover:underline">Topics catalogue</Link> or
                      dive deeper into individual entities via the <Link to="/wiki" className="text-primary hover:underline">Wiki section</Link>.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      Тема <strong className="text-foreground">"{topic}"</strong> є однією з ключових
                      категорій на BraveNNow, що об'єднує <strong className="text-foreground">{totalNewsCount} новинних статей</strong> з
                      різних країн та джерел. Ця сторінка надає повністю інтерактивний хронологічний
                      таймлайн, дозволяє стежити за розвитком подій у реальному часі та виділяє
                      найчастіше згадувані сутності — {entityStats.slice(0, 3).map(e => e.entity.name).join(", ")}{entityStats.length > 3 ? " та інші" : ""}.
                    </p>
                    <p>
                      За допомогою просунутої агрегації даних BraveNNow автоматично витягує та пов'язує
                      всі ключові сутності (особи, компанії, організації), згадані в кожній статті цієї
                      категорії.
                      {entityStats.length > 0 && (
                        <> Поточна тема пов'язана з <strong className="text-foreground">{entityStats.length} унікальними сутностями</strong> та
                        охоплює <strong className="text-foreground">{chartData.length} днів</strong> висвітлення.
                        Кожна сутність має власну вікі-сторінку з повною історією згадувань у новинах,
                        графами зв'язків та AI-генерованими аналізами.</>
                      )}
                    </p>
                    <p>
                      Графік активності показує динаміку інтенсивності публікацій: піки зазвичай
                      відповідають ключовим подіям або резонансним новинам у сфері <em>{topic}</em>.
                      {relatedTopics.length > 0 && (
                        <> Тісно пов'язані теми: {relatedTopics.slice(0, 4).map(r => `«${r.topic}»`).join(", ")},
                        які часто з'являються поряд з цією категорією в одних і тих самих новинних статтях.</>
                      )}
                    </p>
                    <p>
                      BraveNNow безперервно моніторить сотні RSS-стрічок та новинних джерел,
                      автоматично класифікуючи кожну статтю за відповідними категоріями. Перегляд
                      тематичних сторінок дає структурований, пов'язаний із сутностями та візуально
                      насичений огляд будь-якої предметної області — набагато більше, ніж звичайний
                      пошук за ключовим словом. Досліджуйте повний{" "}
                      <Link to="/topics" className="text-primary hover:underline">каталог тем</Link> або
                      заглиблюйтесь у конкретні сутності через розділ{" "}
                      <Link to="/wiki" className="text-primary hover:underline">Wiki</Link>.
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

          </div>

          {/* ╔═══════════════════════════╗
              ║  RIGHT — 1 col            ║
              ║  Key Entities sidebar     ║
              ╚═══════════════════════════╝ */}
          <div className="lg:col-span-1">
            <div className="sticky top-20">
              <Card className="border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    {language === "en" ? "Key Entities" : "Ключові сутності"}
                    <Badge variant="outline" className="ml-auto text-xs">
                      {entityStats.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  {entitiesLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-14 rounded" />
                      ))}
                    </div>
                  ) : entityStats.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      {language === "en" ? "No entities found." : "Сутностей не знайдено."}
                    </p>
                  ) : (
                    <div className="space-y-2 pr-1">
                      {entityStats.slice(0, 30).map(({ entity, count }) => (
                        <Link
                          key={entity.id}
                          to={`/wiki/${entity.slug || entity.id}`}
                          className="group flex items-center gap-2.5 p-2 rounded-lg hover:bg-primary/5 transition-colors"
                        >
                          {entity.image_url ? (
                            <img
                              src={entity.image_url}
                              alt={entity.name}
                              className="w-9 h-9 rounded-full object-cover border border-border flex-shrink-0"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold border ${ENTITY_TYPE_COLORS[entity.entity_type] || "border-border bg-secondary/40 text-muted-foreground"}`}>
                              {(entity.name_en || entity.name).charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium leading-snug line-clamp-1 group-hover:text-primary transition-colors">
                              {language === "en" && entity.name_en ? entity.name_en : entity.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {ENTITY_TYPE_LABELS[entity.entity_type]?.[language === "en" ? "en" : "uk"] || entity.entity_type}
                              {" · "}{count} {language === "en" ? "news" : "новин"}
                            </p>
                          </div>
                          <div className="w-1.5 h-1.5 rounded-full bg-primary/40 flex-shrink-0" />
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* ── Lightbox ── */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setLightboxSrc(null)}
        >
          <img
            src={lightboxSrc}
            alt="Caricature"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white"
            onClick={() => setLightboxSrc(null)}
          >
            ✕
          </Button>
        </div>
      )}
      <Footer />
    </>
  );
}
