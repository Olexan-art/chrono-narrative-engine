import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Hash, TrendingUp, Swords, Scale, Briefcase, Zap, Heart, Flame, BookOpen, Shield, Megaphone, Globe, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { topicPath } from "@/lib/topicSlug";

const TOPIC_ICONS: Array<{ keywords: string[]; icon: React.ReactNode; neon: string }> = [
  { keywords: ["war", "війн", "conflict", "military", "армі", "зброя", "weapon"], icon: <Swords className="w-4 h-4" />, neon: "#ff3855" },
  { keywords: ["politic", "полі", "election", "вибор", "government", "уряд"],     icon: <Scale className="w-4 h-4" />,  neon: "#00b4ff" },
  { keywords: ["economy", "економ", "finance", "фінанс", "market", "ринок", "business", "бізнес"], icon: <Briefcase className="w-4 h-4" />, neon: "#00ff9d" },
  { keywords: ["tech", "технол", "digital", "цифров", "ai", "штучн", "internet"], icon: <Zap className="w-4 h-4" />,       neon: "#ffe600" },
  { keywords: ["health", "здоров", "medical", "медицин", "covid", "pandemic"],     icon: <Heart className="w-4 h-4" />,    neon: "#ff4dab" },
  { keywords: ["sport", "спорт", "football", "футбол", "olympic"],                icon: <Flame className="w-4 h-4" />,    neon: "#ff6a00" },
  { keywords: ["science", "наук", "research", "дослідж", "space", "космос"],       icon: <BookOpen className="w-4 h-4" />, neon: "#b14dff" },
  { keywords: ["security", "безпек", "defense", "оборон", "nato"],                icon: <Shield className="w-4 h-4" />,   neon: "#00e5ff" },
  { keywords: ["media", "медіа", "press", "преса", "news", "новини"],             icon: <Megaphone className="w-4 h-4" />,neon: "#6060ff" },
  { keywords: ["world", "світ", "global", "глобал", "international", "міжнарод"], icon: <Globe className="w-4 h-4" />,    neon: "#00d4c8" },
];

function getTopicMeta(topic: string): { icon: React.ReactNode; neon: string } {
  const lower = topic.toLowerCase();
  for (const def of TOPIC_ICONS) {
    if (def.keywords.some((kw) => lower.includes(kw))) return { icon: def.icon, neon: def.neon };
  }
  return { icon: <Tag className="w-4 h-4" />, neon: "#00e5ff" };
}

function processThemes(items: { themes: string[] | null }[]): { topic: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!Array.isArray(item.themes)) continue;
    for (const t of item.themes) {
      if (t && typeof t === "string") counts.set(t, (counts.get(t) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count);
}

interface TopicTileProps {
  topic: string;
  count: number;
  rank?: number;
}

function TopicTile({ topic, count, rank }: TopicTileProps) {
  const { neon, icon } = getTopicMeta(topic);
  return (
    <Link to={topicPath(topic)} className="block group">
      <div
        className="relative overflow-hidden bg-black border border-white/10 group-hover:border-white/25 transition-all duration-200 h-24"
        style={{ boxShadow: `inset 0 0 20px rgba(0,0,0,0.8)` }}
      >
        {/* Left neon bar */}
        <div
          className="absolute left-0 top-0 bottom-0 w-[3px]"
          style={{ background: neon, boxShadow: `0 0 8px ${neon}` }}
        />
        {/* Rank */}
        {rank !== undefined && (
          <span
            className="absolute top-2 right-2 font-mono text-[10px] tracking-widest opacity-40"
            style={{ color: neon }}
          >
            #{String(rank).padStart(2, "0")}
          </span>
        )}
        {/* Content */}
        <div className="pl-4 pr-3 pt-3 pb-2 h-full flex flex-col justify-between">
          <div className="flex items-center gap-2" style={{ color: neon, opacity: 0.7 }}>
            {icon}
            <span className="font-mono text-[9px] uppercase tracking-[0.2em]">// TOPIC</span>
          </div>
          <div>
            <p
              className="font-mono font-bold uppercase text-xs text-white leading-tight line-clamp-2"
              style={{ textShadow: `0 0 10px ${neon}30` }}
            >
              {topic}
            </p>
            <p className="font-mono text-[10px] mt-0.5" style={{ color: neon, opacity: 0.5 }}>
              {count.toString().padStart(4, "0")}&nbsp;ART
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function HomeTopicsBanner() {
  const { language } = useLanguage();

  // All-time top topics
  const { data: allTimeItems } = useQuery({
    queryKey: ["home-topics-alltime"],
    queryFn: async () => {
      const { data } = await supabase
        .from("news_rss_items")
        .select("themes")
        .not("themes", "is", null)
        .limit(15000);
      return data || [];
    },
    staleTime: 1000 * 60 * 60 * 6,
    gcTime: 1000 * 60 * 60 * 12,
  });

  // Trending 14-day topics
  const { data: recentItems } = useQuery({
    queryKey: ["home-topics-14d"],
    queryFn: async () => {
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("news_rss_items")
        .select("themes")
        .not("themes", "is", null)
        .gte("published_at", since)
        .limit(5000);
      return data || [];
    },
    staleTime: 1000 * 60 * 60 * 2,
    gcTime: 1000 * 60 * 60 * 6,
  });

  const topAllTime = useMemo(() => processThemes(allTimeItems || []).slice(0, 3), [allTimeItems]);
  const top14d     = useMemo(() => processThemes(recentItems  || []).slice(0, 3), [recentItems]);

  if (!allTimeItems && !recentItems) return null;

  return (
    <section className="container mx-auto px-4 py-6 max-w-5xl">
      {/* Top Topics */}
      {topAllTime.length > 0 && (
        <div className="mb-6">
          <h2 className="flex items-center gap-2 text-sm font-mono uppercase tracking-[0.2em] text-muted-foreground mb-3">
            <Hash className="w-4 h-4 text-primary" />
            {language === "uk" ? "Топ Теми" : "Top Topics"}
            <span className="ml-auto text-xs">
              <Link to="/topics" className="text-primary/60 hover:text-primary transition-colors">
                {language === "uk" ? "всі →" : "all →"}
              </Link>
            </span>
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {topAllTime.map((t, i) => (
              <TopicTile key={t.topic} topic={t.topic} count={t.count} rank={i + 1} />
            ))}
          </div>
        </div>
      )}

      {/* Trending 14d */}
      {top14d.length > 0 && (
        <div>
          <h2 className="flex items-center gap-2 text-sm font-mono uppercase tracking-[0.2em] text-muted-foreground mb-3">
            <TrendingUp className="w-4 h-4 text-primary" />
            {language === "uk" ? "Трендові за 14 днів" : "Trending 14 Days"}
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {top14d.map((t, i) => (
              <TopicTile key={t.topic} topic={t.topic} count={t.count} rank={i + 1} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
