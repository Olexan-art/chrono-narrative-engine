import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Search, Tag, Hash, TrendingUp, Loader2, X,
  Zap, Globe, Shield, Heart, Scale,
  Briefcase, Flame, BookOpen, Swords, Megaphone, BarChart3,
  ChevronLeft, ChevronRight
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { topicPath } from "@/lib/topicSlug";

// ─── topic icons ─────────────────────────────────────────────────────────────

const TOPIC_ICONS: Array<{ keywords: string[]; icon: React.ReactNode; color: string }> = [
  { keywords: ["war", "війн", "conflict", "military", "армі", "зброя", "weapon"], icon: <Swords className="w-5 h-5" />, color: "text-red-400 bg-red-500/10 border-red-500/20" },
  { keywords: ["politic", "полі", "election", "вибор", "government", "уряд"], icon: <Scale className="w-5 h-5" />, color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  { keywords: ["economy", "економ", "finance", "фінанс", "market", "ринок", "business", "бізнес"], icon: <Briefcase className="w-5 h-5" />, color: "text-green-400 bg-green-500/10 border-green-500/20" },
  { keywords: ["tech", "технол", "digital", "цифров", "ai", "штучн", "internet", "інтернет"], icon: <Zap className="w-5 h-5" />, color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" },
  { keywords: ["health", "здоров", "medical", "медицин", "covid", "pandemic", "пандем"], icon: <Heart className="w-5 h-5" />, color: "text-pink-400 bg-pink-500/10 border-pink-500/20" },
  { keywords: ["sport", "спорт", "football", "футбол", "olympic", "олімп"], icon: <Flame className="w-5 h-5" />, color: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
  { keywords: ["science", "наук", "research", "дослідж", "space", "космос"], icon: <BookOpen className="w-5 h-5" />, color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
  { keywords: ["security", "безпек", "defense", "оборон", "nato", "нато"], icon: <Shield className="w-5 h-5" />, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
  { keywords: ["media", "медіа", "press", "преса", "news", "новини"], icon: <Megaphone className="w-5 h-5" />, color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20" },
  { keywords: ["world", "світ", "global", "глобал", "international", "міжнарод"], icon: <Globe className="w-5 h-5" />, color: "text-teal-400 bg-teal-500/10 border-teal-500/20" },
];

function getTopicIconData(topic: string): { icon: React.ReactNode; color: string } {
  const lower = topic.toLowerCase();
  for (const def of TOPIC_ICONS) {
    if (def.keywords.some((kw) => lower.includes(kw))) {
      return { icon: def.icon, color: def.color };
    }
  }
  return { icon: <Tag className="w-5 h-5" />, color: "text-muted-foreground bg-secondary/50 border-border" };
}

// ─── component ────────────────────────────────────────────────────────────────

interface TopicStat {
  topic: string;
  count: number;
}

export default function NewsTopicsCatalogPage() {
  const { language } = useLanguage();
  const [search, setSearch] = useState("");
  const [allTopicsPage, setAllTopicsPage] = useState(0);
  const ALL_TOPICS_PAGE_SIZE = 100;

  // Mosaic images: last 30 days, up to 30 per topic, refreshed once per week
  const { data: mosaicImagesData } = useQuery({
    queryKey: ["topics-mosaic-images"],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data } = await supabase
        .from("news_rss_items")
        .select("themes, image_url")
        .not("image_url", "is", null)
        .not("themes", "is", null)
        .gte("published_at", since.toISOString())
        .order("published_at", { ascending: false })
        .limit(3000);
      // Build theme → image[] map (up to 30 per topic)
      const map = new Map<string, string[]>();
      for (const item of data || []) {
        if (!item.image_url || !Array.isArray(item.themes)) continue;
        for (const t of item.themes) {
          if (!t) continue;
          const list = map.get(t) || [];
          if (list.length < 30) list.push(item.image_url);
          map.set(t, list);
        }
      }
      return map;
    },
    staleTime: 1000 * 60 * 60 * 24 * 7, // 7 days
    gcTime: 1000 * 60 * 60 * 24 * 7,
  });

  // All-time topics for Top Topics section (no recent limit)
  const { data: allTimeTopicsData } = useQuery({
    queryKey: ["topics-all-time"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news_rss_items")
        .select("themes")
        .not("themes", "is", null)
        .limit(30000);
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const item of data || []) {
        if (Array.isArray(item.themes)) {
          for (const t of item.themes) {
            if (t && typeof t === "string") counts.set(t, (counts.get(t) || 0) + 1);
          }
        }
      }
      return Array.from(counts.entries())
        .map(([topic, count]) => ({ topic, count }))
        .sort((a, b) => b.count - a.count);
    },
    staleTime: 1000 * 60 * 60 * 6, // 6 hours
    gcTime: 1000 * 60 * 60 * 12,
  });

  const { data: topicsData, isLoading } = useQuery({
    queryKey: ["topics-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news_rss_items")
        .select("themes")
        .not("themes", "is", null)
        .order("published_at", { ascending: false })
        .limit(4000);

      if (error) throw error;

      const counts = new Map<string, number>();
      for (const item of data || []) {
        if (Array.isArray(item.themes)) {
          for (const t of item.themes) {
            if (t && typeof t === "string") {
              counts.set(t, (counts.get(t) || 0) + 1);
            }
          }
        }
      }
      const sorted: TopicStat[] = Array.from(counts.entries())
        .map(([topic, count]) => ({ topic, count }))
        .sort((a, b) => b.count - a.count);
      return sorted;
    },
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
  });

  const filtered = useMemo(() => {
    if (!topicsData) return [];
    if (!search.trim()) return topicsData;
    const q = search.toLowerCase();
    return topicsData.filter((t) => t.topic.toLowerCase().includes(q));
  }, [topicsData, search]);

  // All-time data filtered by search
  const allTimeFiltered = useMemo(() => {
    if (!allTimeTopicsData) return [];
    if (!search.trim()) return allTimeTopicsData;
    const q = search.toLowerCase();
    return allTimeTopicsData.filter((t) => t.topic.toLowerCase().includes(q));
  }, [allTimeTopicsData, search]);

  // Trending Topics: top 12 from ALL-TIME data (ensures Finance/Politics/Sports always visible)
  const topTopics = allTimeFiltered.slice(0, 12);
  // Top Topics 13-30: all-time ranked list
  const topNextTopics = allTimeFiltered.slice(12, 30);
  // All topics: positions 30+ from all-time (no duplicates with above sections)
  const restTopics = allTimeFiltered.slice(30);

  // Pagination for All topics
  const totalAllPages = Math.ceil(restTopics.length / ALL_TOPICS_PAGE_SIZE);
  const pagedRestTopics = restTopics.slice(
    allTopicsPage * ALL_TOPICS_PAGE_SIZE,
    (allTopicsPage + 1) * ALL_TOPICS_PAGE_SIZE
  );

  // Reset page when search changes
  useMemo(() => { setAllTopicsPage(0); }, [search]);

  const seoTitle =
    language === "en"
      ? "News Topics & Categories | BraveNNow"
      : "Теми та Категорії Новин | BraveNNow";
  const seoDescription =
    language === "en"
      ? "Browse all news topics and categories. Find articles grouped by subject, track key entities and follow chronological timelines."
      : "Перегляньте всі теми та категорії новин. Знайдіть статті згруповані за предметом, відстежуйте ключові сутності та слідкуйте за хронологічними таймлайнами.";

  return (
    <>
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        canonicalUrl="https://bravennow.com/topics"
      />
      <Header />

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Page title */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Hash className="w-7 h-7 text-primary" />
            <h1 className="text-3xl md:text-4xl font-bold text-glow">
              {language === "en" ? "News Topics" : "Теми Новин"}
            </h1>
          </div>
          <p className="text-muted-foreground max-w-xl">
            {language === "en"
              ? "Explore all topics mentioned in news articles. Each topic has its own page with a timeline, entities, and statistics."
              : "Перегляньте всі теми, згадані в новинних статтях. Кожна тема має свою сторінку з таймлайном, сутностями та статистикою."}
          </p>
        </div>

        {/* Stats bar */}
        {!isLoading && topicsData && (
          <div className="flex flex-wrap gap-4 mb-8 p-4 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">
                {language === "en" ? "Total topics:" : "Всього тем:"}
              </span>
              <span className="font-bold text-primary">{topicsData.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span className="text-sm text-muted-foreground">
                {language === "en" ? "Most popular:" : "Найпопулярніша:"}
              </span>
              <span className="font-medium text-foreground">{topicsData[0]?.topic}</span>
              <span className="text-xs text-muted-foreground">({topicsData[0]?.count})</span>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={language === "en" ? "Search topics..." : "Пошук тем..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-9"
          />
          {search && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setSearch("")}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Tag className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>{language === "en" ? "No topics found." : "Теми не знайдено."}</p>
          </div>
        ) : (
          <>
            {/* Top topics – large cards */}
            {topTopics.length > 0 && !search && (
              <section className="mb-8">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  {language === "en" ? "Trending Topics" : "Популярні теми"}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {topTopics.map(({ topic, count }) => {
                    const { icon, color } = getTopicIconData(topic);
                    const mosaicImgs = mosaicImagesData?.get(topic) || [];
                    const neonColor = color.includes('red') ? '#ff3855' : color.includes('blue') ? '#00b4ff' : color.includes('green') ? '#00ff9d' : color.includes('yellow') ? '#ffe600' : color.includes('pink') ? '#ff4dab' : color.includes('orange') ? '#ff6a00' : color.includes('purple') ? '#b14dff' : color.includes('cyan') ? '#00e5ff' : color.includes('indigo') ? '#6060ff' : color.includes('teal') ? '#00d4c8' : '#00e5ff';
                    return (
                      <Link key={topic} to={topicPath(topic)}>
                        <div
                          className="group relative overflow-hidden cursor-pointer bg-black border border-white/10 hover:border-white/30 transition-all duration-200"
                          style={{ minHeight: '180px', boxShadow: 'inset 1px 1px 0 rgba(255,255,255,0.04)' }}
                        >
                          {/* Mosaic background */}
                          {mosaicImgs.length >= 4 && (
                            <div
                              className="absolute inset-0 grid"
                              style={{
                                gridTemplateColumns: `repeat(6, 1fr)`,
                                gridTemplateRows: `repeat(5, 1fr)`,
                                gap: '2px',
                              }}
                            >
                              {mosaicImgs.slice(0, 30).map((url, i) => (
                                <img
                                  key={i}
                                  src={url}
                                  alt=""
                                  className="w-full h-full object-cover opacity-40 group-hover:opacity-55 transition-opacity"
                                  loading="lazy"
                                  onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }}
                                />
                              ))}
                            </div>
                          )}
                          {/* Dark overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/30" />
                          {/* Left neon bar */}
                          <div className="absolute left-0 top-0 bottom-0 w-[3px] transition-all duration-200" style={{ background: neonColor, opacity: 0.7, boxShadow: `0 0 8px ${neonColor}` }} />
                          {/* Rank */}
                          <div className="absolute top-2.5 right-2.5 z-10 font-mono text-[10px] tracking-widest" style={{ color: neonColor, opacity: 0.6 }}>#{String(topTopics.indexOf(topTopics.find(t => t.topic === topic)!) + 1).padStart(2,'0')}</div>
                          {/* Content */}
                          <div className="relative z-10 p-4 flex flex-col justify-end" style={{ minHeight: '180px' }}>
                            <div className="mt-auto">
                              <p className="font-mono text-[9px] uppercase tracking-[0.25em] mb-1" style={{ color: neonColor, opacity: 0.7 }}>// TOPIC</p>
                              <h3 className="font-mono font-bold uppercase tracking-tight text-sm text-white group-hover:text-white transition-colors leading-tight" style={{ textShadow: `0 0 12px ${neonColor}40` }}>
                                {topic}
                              </h3>
                              <p className="font-mono text-[11px] mt-1.5" style={{ color: neonColor, opacity: 0.6 }}>
                                {count.toString().padStart(4, '0')}&nbsp;ART
                              </p>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Top Topics (7-20) — ranked list with article counts */}
            {topNextTopics.length > 0 && !search && (
              <section className="mb-8">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  {language === "en" ? "Top Topics" : "Топ Теми"}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {topNextTopics.map(({ topic, count }, index) => {
                    const { icon, color } = getTopicIconData(topic);
                    const rank = index + 7;
                    return (
                      <Link key={topic} to={topicPath(topic)}>
                        <div className="group flex items-center gap-3 px-4 py-2.5 border-b border-white/5 hover:bg-white/3 border-l-2 border-l-transparent hover:border-l-primary transition-all cursor-pointer" style={{ borderLeftColor: 'transparent' }} onMouseEnter={e => (e.currentTarget.style.borderLeftColor = 'hsl(var(--primary))')} onMouseLeave={e => (e.currentTarget.style.borderLeftColor = 'transparent')}>
                          <span className="flex-shrink-0 w-9 font-mono text-[11px] text-primary/30 tabular-nums">[{String(rank).padStart(2,'0')}]</span>
                          <span className={`flex-shrink-0 w-5 h-5 flex items-center justify-center ${color} rounded-none`}>
                            {icon}
                          </span>
                          <span className="flex-1 font-mono text-sm text-foreground/80 group-hover:text-primary transition-colors truncate uppercase tracking-wide">
                            {topic}
                          </span>
                          <div className="flex-shrink-0 flex items-center gap-2">
                            <div
                              className="h-[2px] bg-primary/25 group-hover:bg-primary/50 transition-colors"
                              style={{ width: `${Math.max(12, Math.round((count / (allTimeTopicsData?.[0]?.count || 1)) * 64))}px` }}
                            />
                            <span className="font-mono text-xs text-primary/60 tabular-nums w-10 text-right">{count}</span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {/* All remaining topics – compact badges grid with pagination */}
            <section>
              {!search && restTopics.length > 0 && (
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-muted-foreground" />
                  {language === "en"
                    ? `All topics (${allTimeFiltered.length})`
                    : `Всі теми (${allTimeFiltered.length})`}
                </h2>
              )}
              <div className="flex flex-wrap gap-2">
                {(search ? allTimeFiltered : pagedRestTopics).map(({ topic, count }) => (
                  <Link key={topic} to={topicPath(topic)}>
                    <Badge
                      variant="outline"
                      className="font-mono text-xs px-3 py-1.5 cursor-pointer rounded-none uppercase tracking-wider border-white/10 hover:border-primary/60 hover:bg-primary/10 hover:text-primary transition-colors bg-transparent text-foreground/60"
                    >
                      <Tag className="w-3 h-3 mr-1.5 opacity-60" />
                      {topic}
                      <span className="ml-1.5 text-muted-foreground text-xs">({count})</span>
                    </Badge>
                  </Link>
                ))}
              </div>
              {/* Pagination */}
              {!search && totalAllPages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAllTopicsPage((p) => Math.max(0, p - 1))}
                    disabled={allTopicsPage === 0}
                    className="gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    {language === "en" ? "Prev" : "Назад"}
                  </Button>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {allTopicsPage + 1} / {totalAllPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAllTopicsPage((p) => Math.min(totalAllPages - 1, p + 1))}
                    disabled={allTopicsPage === totalAllPages - 1}
                    className="gap-1"
                  >
                    {language === "en" ? "Next" : "Далі"}
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </section>
          </>
        )}
      </div>
      <Footer />
    </>
  );
}
