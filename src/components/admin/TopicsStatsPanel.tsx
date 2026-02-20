import { useQuery } from "@tanstack/react-query";
import { Tags, TrendingUp, Hash, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TopicStat {
  topic: string;
  count: number;
}

export function TopicsStatsPanel({ password }: { password: string }) {
  // Fetch all themes from news_rss_items
  const { data: topicsData, isLoading } = useQuery({
    queryKey: ["topics-stats"],
    queryFn: async () => {
      // Fetch all news items with themes
      const { data, error } = await supabase
        .from("news_rss_items")
        .select("themes")
        .not("themes", "is", null);

      if (error) throw error;

      // Count all topics
      const topicCounts = new Map<string, number>();
      let totalTopicsCount = 0;

      for (const item of data || []) {
        if (item.themes && Array.isArray(item.themes)) {
          for (const theme of item.themes) {
            if (theme && typeof theme === 'string') {
              totalTopicsCount++;
              topicCounts.set(theme, (topicCounts.get(theme) || 0) + 1);
            }
          }
        }
      }

      // Convert to array and sort by count
      const topicsArray: TopicStat[] = Array.from(topicCounts.entries())
        .map(([topic, count]) => ({ topic, count }))
        .sort((a, b) => b.count - a.count);

      return {
        totalUnique: topicCounts.size,
        totalMentions: totalTopicsCount,
        top100: topicsArray.slice(0, 100),
        all: topicsArray
      };
    },
    enabled: !!password,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!topicsData) {
    return (
      <Card className="cosmic-card">
        <CardHeader>
          <CardTitle>Немає даних</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cosmic-card border-primary/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Hash className="w-8 h-8 text-primary" />
              <div>
                <p className="text-3xl font-bold text-glow">{topicsData.totalUnique}</p>
                <p className="text-sm text-muted-foreground font-mono">Унікальних Topics</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cosmic-card border-blue-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Tags className="w-8 h-8 text-blue-400" />
              <div>
                <p className="text-3xl font-bold text-glow">{topicsData.totalMentions}</p>
                <p className="text-sm text-muted-foreground font-mono">Всього згадувань</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cosmic-card border-purple-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-purple-400" />
              <div>
                <p className="text-3xl font-bold text-glow">
                  {topicsData.totalMentions > 0 
                    ? (topicsData.totalMentions / topicsData.totalUnique).toFixed(1)
                    : 0
                  }
                </p>
                <p className="text-sm text-muted-foreground font-mono">Середня частота</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top 100 Topics Table */}
      <Card className="cosmic-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Топ 100 Topics
          </CardTitle>
          <CardDescription>
            Найпопулярніші теми в новинах за кількістю згадувань
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] w-full rounded-md border border-primary/20">
            <div className="p-4">
              <table className="w-full">
                <thead className="sticky top-0 bg-background/95 backdrop-blur z-10">
                  <tr className="border-b border-primary/20">
                    <th className="text-left p-2 font-mono text-sm text-muted-foreground w-16">#</th>
                    <th className="text-left p-2 font-mono text-sm text-muted-foreground">Topic</th>
                    <th className="text-right p-2 font-mono text-sm text-muted-foreground w-32">
                      Кількість
                    </th>
                    <th className="text-right p-2 font-mono text-sm text-muted-foreground w-24">
                      %
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topicsData.top100.map((topic, index) => {
                    const percentage = ((topic.count / topicsData.totalMentions) * 100).toFixed(2);
                    return (
                      <tr
                        key={topic.topic}
                        className="border-b border-primary/10 hover:bg-primary/5 transition-colors"
                      >
                        <td className="p-2 font-mono text-sm text-muted-foreground">
                          {index + 1}
                        </td>
                        <td className="p-2 font-medium">
                          <div className="flex items-center gap-2">
                            <Tags className="w-4 h-4 text-primary/60" />
                            {topic.topic}
                          </div>
                        </td>
                        <td className="p-2 text-right font-mono text-lg font-bold text-primary">
                          {topic.count}
                        </td>
                        <td className="p-2 text-right font-mono text-sm text-muted-foreground">
                          {percentage}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Extended stats */}
      <Card className="cosmic-card">
        <CardHeader>
          <CardTitle className="text-sm font-mono">Детальна статистика</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm font-mono">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Топ-10 складають:</span>
            <span className="font-bold">
              {topicsData.top100.slice(0, 10).reduce((sum, t) => sum + t.count, 0)} згадувань
              {' '}
              ({((topicsData.top100.slice(0, 10).reduce((sum, t) => sum + t.count, 0) / topicsData.totalMentions) * 100).toFixed(1)}%)
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Топ-50 складають:</span>
            <span className="font-bold">
              {topicsData.top100.slice(0, 50).reduce((sum, t) => sum + t.count, 0)} згадувань
              {' '}
              ({((topicsData.top100.slice(0, 50).reduce((sum, t) => sum + t.count, 0) / topicsData.totalMentions) * 100).toFixed(1)}%)
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Рідкісні топіки (1-2 згадки):</span>
            <span className="font-bold">
              {topicsData.all.filter(t => t.count <= 2).length} топіків
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
