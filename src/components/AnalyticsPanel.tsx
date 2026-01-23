import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { uk } from "date-fns/locale";
import { BarChart3, Eye, TrendingUp, Book, FileText, Library } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line } from "recharts";

interface AnalyticsPanelProps {
  password: string;
}

export function AnalyticsPanel({ password }: AnalyticsPanelProps) {
  // Fetch view counts summary
  const { data: viewSummary } = useQuery({
    queryKey: ['analytics-summary'],
    queryFn: async () => {
      const [partsViews, chaptersViews, volumesViews] = await Promise.all([
        supabase
          .from('view_counts')
          .select('views')
          .eq('entity_type', 'part'),
        supabase
          .from('view_counts')
          .select('views')
          .eq('entity_type', 'chapter'),
        supabase
          .from('view_counts')
          .select('views')
          .eq('entity_type', 'volume')
      ]);

      const totalParts = (partsViews.data || []).reduce((sum, v) => sum + (v.views || 0), 0);
      const totalChapters = (chaptersViews.data || []).reduce((sum, v) => sum + (v.views || 0), 0);
      const totalVolumes = (volumesViews.data || []).reduce((sum, v) => sum + (v.views || 0), 0);

      return {
        parts: totalParts,
        chapters: totalChapters,
        volumes: totalVolumes,
        total: totalParts + totalChapters + totalVolumes
      };
    }
  });

  // Fetch daily views for chart (last 14 days)
  const { data: dailyViews = [] } = useQuery({
    queryKey: ['analytics-daily'],
    queryFn: async () => {
      const endDate = format(new Date(), 'yyyy-MM-dd');
      const startDate = format(subDays(new Date(), 13), 'yyyy-MM-dd');

      const { data } = await supabase
        .from('daily_views')
        .select('view_date, views, entity_type')
        .gte('view_date', startDate)
        .lte('view_date', endDate)
        .order('view_date', { ascending: true });

      // Group by date
      const grouped: Record<string, { date: string; parts: number; chapters: number; volumes: number; total: number }> = {};
      
      // Initialize all days
      for (let i = 0; i < 14; i++) {
        const d = format(subDays(new Date(), 13 - i), 'yyyy-MM-dd');
        grouped[d] = { date: d, parts: 0, chapters: 0, volumes: 0, total: 0 };
      }

      // Fill in actual data
      for (const row of (data || [])) {
        if (grouped[row.view_date]) {
          if (row.entity_type === 'part') {
            grouped[row.view_date].parts += row.views;
          } else if (row.entity_type === 'chapter') {
            grouped[row.view_date].chapters += row.views;
          } else if (row.entity_type === 'volume') {
            grouped[row.view_date].volumes += row.views;
          }
          grouped[row.view_date].total += row.views;
        }
      }

      return Object.values(grouped).map(d => ({
        ...d,
        label: format(new Date(d.date), 'd MMM', { locale: uk })
      }));
    }
  });

  // Fetch top content
  const { data: topContent = [] } = useQuery({
    queryKey: ['analytics-top'],
    queryFn: async () => {
      const { data: viewCounts } = await supabase
        .from('view_counts')
        .select('entity_type, entity_id, views')
        .order('views', { ascending: false })
        .limit(10);

      if (!viewCounts || viewCounts.length === 0) return [];

      // Fetch details for each entity
      const results = [];
      for (const vc of viewCounts) {
        let title = 'Невідомо';
        if (vc.entity_type === 'part') {
          const { data } = await supabase
            .from('parts')
            .select('title, date')
            .eq('id', vc.entity_id)
            .single();
          if (data) title = `${data.title} (${format(new Date(data.date), 'd MMM', { locale: uk })})`;
        } else if (vc.entity_type === 'chapter') {
          const { data } = await supabase
            .from('chapters')
            .select('title')
            .eq('id', vc.entity_id)
            .single();
          if (data) title = data.title;
        } else if (vc.entity_type === 'volume') {
          const { data } = await supabase
            .from('volumes')
            .select('title')
            .eq('id', vc.entity_id)
            .single();
          if (data) title = data.title;
        }
        results.push({
          type: vc.entity_type,
          title,
          views: vc.views
        });
      }

      return results;
    }
  });

  const chartConfig = {
    parts: { label: "Оповідання", color: "hsl(var(--primary))" },
    chapters: { label: "Глави", color: "hsl(var(--secondary))" },
    volumes: { label: "Томи", color: "hsl(var(--accent))" },
    total: { label: "Всього", color: "hsl(var(--primary))" }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="cosmic-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Всього переглядів</p>
                <p className="text-3xl font-bold text-primary">{viewSummary?.total || 0}</p>
              </div>
              <Eye className="w-8 h-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="cosmic-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Оповідання</p>
                <p className="text-2xl font-bold">{viewSummary?.parts || 0}</p>
              </div>
              <FileText className="w-6 h-6 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="cosmic-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Глави</p>
                <p className="text-2xl font-bold">{viewSummary?.chapters || 0}</p>
              </div>
              <Book className="w-6 h-6 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="cosmic-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Томи</p>
                <p className="text-2xl font-bold">{viewSummary?.volumes || 0}</p>
              </div>
              <Library className="w-6 h-6 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Views Chart */}
      <Card className="cosmic-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Перегляди за 14 днів
          </CardTitle>
          <CardDescription>Динаміка переглядів контенту</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyViews}>
                <XAxis 
                  dataKey="label" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar 
                  dataKey="parts" 
                  name="Оповідання"
                  fill="hsl(var(--primary))" 
                  radius={[4, 4, 0, 0]}
                  stackId="a"
                />
                <Bar 
                  dataKey="chapters" 
                  name="Глави"
                  fill="hsl(var(--primary) / 0.6)" 
                  radius={[4, 4, 0, 0]}
                  stackId="a"
                />
                <Bar 
                  dataKey="volumes" 
                  name="Томи"
                  fill="hsl(var(--primary) / 0.3)" 
                  radius={[4, 4, 0, 0]}
                  stackId="a"
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Top Content */}
      <Card className="cosmic-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Топ контент
          </CardTitle>
          <CardDescription>Найпопулярніші матеріали</CardDescription>
        </CardHeader>
        <CardContent>
          {topContent.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Поки немає даних про перегляди
            </p>
          ) : (
            <div className="space-y-3">
              {topContent.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-muted-foreground w-6">#{i + 1}</span>
                    {item.type === 'part' && <FileText className="w-4 h-4 text-primary" />}
                    {item.type === 'chapter' && <Book className="w-4 h-4 text-primary" />}
                    {item.type === 'volume' && <Library className="w-4 h-4 text-primary" />}
                    <span className="text-sm font-medium truncate max-w-[300px]">{item.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-muted-foreground" />
                    <span className="font-mono text-sm">{item.views}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
