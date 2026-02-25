import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Hash, TrendingUp, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { topicPath } from "@/lib/topicSlug";

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

export function TopicTile({ topic, count, rank }: TopicTileProps) {
  return (
    <Link to={topicPath(topic)} className="block group">
      <div className="flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-card hover:border-primary/50 hover:bg-muted/30 transition-all duration-200">
        {rank !== undefined && (
          <span className="text-xs font-mono text-muted-foreground w-5 shrink-0 text-center">{rank}</span>
        )}
        <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium truncate flex-1 group-hover:text-primary transition-colors">{topic}</span>
        <Badge variant="secondary" className="text-[11px] font-mono shrink-0">{count}</Badge>
      </div>
    </Link>
  );
}

/** Top 3 all-time topics — shown BEFORE Latest USA News */
export function HomeTopicsBanner() {
  const { language } = useLanguage();

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

  const topAllTime = useMemo(() => processThemes(allTimeItems || []).slice(0, 3), [allTimeItems]);

  if (!topAllTime.length) return null;

  return (
    <section className="container mx-auto px-4 pt-6 pb-2 max-w-5xl">
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
    </section>
  );
}

/** Trending 14-day topics — shown AFTER Latest USA News (Full retelling) */
export function HomeTrending14dBanner() {
  const { language } = useLanguage();

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

  const top14d = useMemo(() => processThemes(recentItems || []).slice(0, 3), [recentItems]);

  if (!top14d.length) return null;

  return (
    <section className="container mx-auto px-4 py-6 max-w-5xl">
      <h2 className="flex items-center gap-2 text-sm font-mono uppercase tracking-[0.2em] text-muted-foreground mb-3">
        <TrendingUp className="w-4 h-4 text-primary" />
        {language === "uk" ? "Трендові за 14 днів" : "Trending 14 Days"}
        <span className="ml-auto text-xs">
          <Link to="/topics" className="text-primary/60 hover:text-primary transition-colors">
            {language === "uk" ? "всі →" : "all →"}
          </Link>
        </span>
      </h2>
      <div className="grid grid-cols-3 gap-2">
        {top14d.map((t, i) => (
          <TopicTile key={t.topic} topic={t.topic} count={t.count} rank={i + 1} />
        ))}
      </div>
    </section>
  );
}
