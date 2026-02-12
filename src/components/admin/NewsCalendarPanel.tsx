import { useQuery } from "@tanstack/react-query";
import { Calendar as CalendarIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

interface DailyStats {
  date: string;
  count: number;
}

export function NewsCalendarPanel() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["news-calendar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news_items")
        .select("published_at")
        .gte("published_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order("published_at", { ascending: false });

      if (error) throw error;

      // Group by date
      const grouped = data.reduce((acc: Record<string, number>, item) => {
        const date = new Date(item.published_at).toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {});

      return Object.entries(grouped)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => b.date.localeCompare(a.date)) as DailyStats[];
    }
  });

  return (
    <Card className="cosmic-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5" />
          Календар новин
        </CardTitle>
        <CardDescription>
          Статистика публікацій новин за останні 30 днів
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Завантаження...
          </div>
        ) : stats && stats.length > 0 ? (
          <div className="space-y-2">
            {stats.map((stat) => (
              <div
                key={stat.date}
                className="flex items-center justify-between p-3 border border-primary/20 rounded-lg hover:bg-primary/5 transition-colors"
              >
                <span className="font-mono text-sm">
                  {new Date(stat.date).toLocaleDateString('uk-UA', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </span>
                <span className="text-lg font-bold text-primary">
                  {stat.count}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Немає даних
          </div>
        )}
      </CardContent>
    </Card>
  );
}
