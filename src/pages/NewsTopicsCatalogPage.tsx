import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Search, Tag, Hash, TrendingUp, Loader2, X,
  Newspaper, Zap, Globe, Shield, Heart, Scale,
  Briefcase, Flame, BookOpen, Swords, Megaphone
} from "lucide-react";
import { Header } from "@/components/Header";
import { SEOHead } from "@/components/SEOHead";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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

  const { data: topicsData, isLoading } = useQuery({
    queryKey: ["topics-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news_rss_items")
        .select("themes")
        .not("themes", "is", null);

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
    staleTime: 1000 * 60 * 10,
  });

  const filtered = useMemo(() => {
    if (!topicsData) return [];
    if (!search.trim()) return topicsData;
    const q = search.toLowerCase();
    return topicsData.filter((t) => t.topic.toLowerCase().includes(q));
  }, [topicsData, search]);

  const topTopics = filtered.slice(0, 6);
  const restTopics = filtered.slice(6);

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
                    return (
                      <Link key={topic} to={topicPath(topic)}>
                        <Card className="group hover:border-primary/50 transition-all hover:scale-[1.02] cursor-pointer h-full">
                          <CardContent className="p-5 flex flex-col gap-3">
                            <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${color}`}>
                              {icon}
                            </div>
                            <div>
                              <h3 className="font-semibold leading-tight group-hover:text-primary transition-colors">
                                {topic}
                              </h3>
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <Newspaper className="w-3 h-3" />
                                {count} {language === "en" ? "articles" : "статей"}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {/* All remaining topics – compact badges grid */}
            <section>
              {!search && restTopics.length > 0 && (
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-muted-foreground" />
                  {language === "en" ? `All topics (${filtered.length})` : `Всі теми (${filtered.length})`}
                </h2>
              )}
              <div className="flex flex-wrap gap-2">
                {(search ? filtered : restTopics).map(({ topic, count }) => (
                  <Link key={topic} to={topicPath(topic)}>
                    <Badge
                      variant="secondary"
                      className="text-sm px-3 py-1.5 cursor-pointer hover:bg-primary/20 hover:text-primary transition-colors border border-border hover:border-primary/40"
                    >
                      <Tag className="w-3 h-3 mr-1.5 opacity-60" />
                      {topic}
                      <span className="ml-1.5 text-muted-foreground text-xs">({count})</span>
                    </Badge>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </>
  );
}
