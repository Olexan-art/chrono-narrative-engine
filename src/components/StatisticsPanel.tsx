import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Loader2, TrendingUp, Eye, BarChart3, FileText, BookOpen, Library, Bot, Activity, Sparkles, Globe, Clock, Calendar, Users, MessageSquare, Twitter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { adminAction } from "@/lib/api";
import { format, subDays } from "date-fns";
import { uk } from "date-fns/locale";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AutoGenChart } from "@/components/AutoGenChart";

import { RecentRetoldNewsList } from "@/components/RecentRetoldNewsList";

interface Props {
  password: string;
}

interface PeriodStats {
  retold: number;
  dialogues: number;
  tweets: number;
  entities: number;
}

interface DailyStats {
  date: string;
  label: string;
  retold: number;
  dialogues: number;
  tweets: number;
  entities: number;
}

interface AutoGenStats {
  h24: PeriodStats;
  d3: PeriodStats;
  d7: PeriodStats;
  d30: PeriodStats;
  daily: DailyStats[];
}

const CATEGORY_COLORS: Record<string, string> = {
  search: 'hsl(217, 91%, 60%)',
  ai: 'hsl(280, 87%, 60%)',
  social: 'hsl(142, 71%, 45%)',
  other: 'hsl(38, 92%, 50%)',
};

export function StatisticsPanel({ password }: Props) {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewsTimeRange, setViewsTimeRange] = useState<'24h' | '7d' | '14d' | '30d'>('14d');

  // Dashboard stats
  const { data: dashboardStats, isLoading: dashboardLoading } = useQuery({
    queryKey: ['statistics-dashboard'],
    queryFn: async () => {
      const now = new Date();
      const last24h = subDays(now, 1);
      const last7d = subDays(now, 7);

      const [
        { count: volumesCount },
        { count: chaptersCount },
        { count: partsCount },
        { count: publishedPartsCount },
        { count: charactersCount },
        { count: newsItemsCount },
        { count: generationsCount },
        { data: viewStats },
        { data: countriesWithCounts }
      ] = await Promise.all([
        supabase.from('volumes').select('*', { count: 'exact', head: true }),
        supabase.from('chapters').select('*', { count: 'exact', head: true }),
        supabase.from('parts').select('*', { count: 'exact', head: true }),
        supabase.from('parts').select('*', { count: 'exact', head: true }).eq('status', 'published'),
        supabase.from('characters').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('news_rss_items').select('*', { count: 'exact', head: true }),
        supabase.from('generations').select('*', { count: 'exact', head: true }),
        supabase.from('view_counts').select('views, unique_visitors'),
        supabase.from('news_countries').select(`
          id, name, flag, code,
          news_rss_items(id, published_at, fetched_at, is_archived)
        `).eq('is_active', true)
      ]);

      const totalViews = viewStats?.reduce((sum, v) => sum + (v.views || 0), 0) || 0;
      const uniqueVisitors = viewStats?.reduce((sum, v) => sum + (v.unique_visitors || 0), 0) || 0;

      const countriesStats = countriesWithCounts?.map(c => {
        const items = c.news_rss_items as Array<{ id: string; published_at: string | null; fetched_at: string; is_archived: boolean }> || [];
        const activeItems = items.filter(i => !i.is_archived);
        const total = activeItems.length;
        const last24hCount = activeItems.filter(i => {
          const itemDate = i.published_at ? new Date(i.published_at) : new Date(i.fetched_at);
          return itemDate >= last24h;
        }).length;
        const last7dCount = activeItems.filter(i => {
          const itemDate = i.published_at ? new Date(i.published_at) : new Date(i.fetched_at);
          return itemDate >= last7d;
        }).length;

        return { id: c.id, name: c.name, flag: c.flag, code: c.code, total, last24h: last24hCount, last7d: last7dCount };
      }).sort((a, b) => b.total - a.total) || [];

      return {
        volumes: volumesCount || 0,
        chapters: chaptersCount || 0,
        parts: partsCount || 0,
        publishedParts: publishedPartsCount || 0,
        characters: charactersCount || 0,
        newsItems: newsItemsCount || 0,
        generations: generationsCount || 0,
        totalViews,
        uniqueVisitors,
        countriesStats
      };
    }
  });

  // View analytics
  const { data: viewSummary } = useQuery({
    queryKey: ['statistics-views'],
    queryFn: async () => {
      const [partsViews, chaptersViews, volumesViews] = await Promise.all([
        supabase.from('view_counts').select('views').eq('entity_type', 'part'),
        supabase.from('view_counts').select('views').eq('entity_type', 'chapter'),
        supabase.from('view_counts').select('views').eq('entity_type', 'volume')
      ]);

      const totalParts = (partsViews.data || []).reduce((sum, v) => sum + (v.views || 0), 0);
      const totalChapters = (chaptersViews.data || []).reduce((sum, v) => sum + (v.views || 0), 0);
      const totalVolumes = (volumesViews.data || []).reduce((sum, v) => sum + (v.views || 0), 0);

      return { parts: totalParts, chapters: totalChapters, volumes: totalVolumes, total: totalParts + totalChapters + totalVolumes };
    }
  });

  // Daily views chart with dynamic range
  const { data: dailyViews = [] } = useQuery({
    queryKey: ['statistics-daily-views', viewsTimeRange],
    queryFn: async () => {
      const daysCount = viewsTimeRange === '24h' ? 1 : viewsTimeRange === '7d' ? 7 : viewsTimeRange === '14d' ? 14 : 30;
      const endDate = format(new Date(), 'yyyy-MM-dd');
      const startDate = format(subDays(new Date(), daysCount - 1), 'yyyy-MM-dd');

      const { data } = await supabase
        .from('daily_views')
        .select('view_date, views, entity_type, entity_id')
        .gte('view_date', startDate)
        .lte('view_date', endDate)
        .order('view_date', { ascending: true });

      // Fetch country info for news items
      const { data: countries } = await supabase
        .from('news_countries')
        .select('id, code, name, flag')
        .eq('is_active', true);

      const countriesMap = new Map(countries?.map(c => [c.id, c]) || []);

      // Aggregate by date
      const grouped: Record<string, { date: string; parts: number; chapters: number; volumes: number; news: number; total: number }> = {};

      for (let i = 0; i < daysCount; i++) {
        const d = format(subDays(new Date(), daysCount - 1 - i), 'yyyy-MM-dd');
        grouped[d] = { date: d, parts: 0, chapters: 0, volumes: 0, news: 0, total: 0 };
      }

      for (const row of (data || [])) {
        if (grouped[row.view_date]) {
          if (row.entity_type === 'part') grouped[row.view_date].parts += row.views;
          else if (row.entity_type === 'chapter') grouped[row.view_date].chapters += row.views;
          else if (row.entity_type === 'volume') grouped[row.view_date].volumes += row.views;
          else if (row.entity_type === 'news') grouped[row.view_date].news += row.views;
          grouped[row.view_date].total += row.views;
        }
      }

      return Object.values(grouped).map(d => ({ ...d, label: format(new Date(d.date), 'd MMM', { locale: uk }) }));
    }
  });

  // News views by country
  const { data: newsViewsByCountry = [] } = useQuery({
    queryKey: ['statistics-news-views-by-country', viewsTimeRange],
    queryFn: async () => {
      const daysCount = viewsTimeRange === '24h' ? 1 : viewsTimeRange === '7d' ? 7 : viewsTimeRange === '14d' ? 14 : 30;
      const startDate = format(subDays(new Date(), daysCount - 1), 'yyyy-MM-dd');

      // Get all news views
      const { data: newsViews } = await supabase
        .from('daily_views')
        .select('entity_id, views')
        .eq('entity_type', 'news')
        .gte('view_date', startDate);

      if (!newsViews?.length) return [];

      // Get news items with country info
      const newsIds = [...new Set(newsViews.map(v => v.entity_id))];
      const { data: newsItems } = await supabase
        .from('news_rss_items')
        .select('id, country_id')
        .in('id', newsIds);

      const { data: countries } = await supabase
        .from('news_countries')
        .select('id, code, name, flag')
        .eq('is_active', true);

      const newsCountryMap = new Map(newsItems?.map(n => [n.id, n.country_id]) || []);
      const countriesMap = new Map(countries?.map(c => [c.id, c]) || []);

      // Aggregate views by country
      const byCountry: Record<string, { id: string; code: string; name: string; flag: string; views: number }> = {};

      for (const view of newsViews) {
        const countryId = newsCountryMap.get(view.entity_id);
        if (countryId) {
          const country = countriesMap.get(countryId);
          if (country) {
            if (!byCountry[country.code]) {
              byCountry[country.code] = { ...country, views: 0 };
            }
            byCountry[country.code].views += view.views;
          }
        }
      }

      return Object.values(byCountry).sort((a, b) => b.views - a.views);
    }
  });

  // Top content
  const { data: topContent = [] } = useQuery({
    queryKey: ['statistics-top-content'],
    queryFn: async () => {
      const { data: viewCounts } = await supabase
        .from('view_counts')
        .select('entity_type, entity_id, views')
        .order('views', { ascending: false })
        .limit(10);

      if (!viewCounts || viewCounts.length === 0) return [];

      const results = [];
      for (const vc of viewCounts) {
        let title = 'Невідомо';
        if (vc.entity_type === 'part') {
          const { data } = await supabase.from('parts').select('title, date').eq('id', vc.entity_id).single();
          if (data) title = `${data.title} (${format(new Date(data.date), 'd MMM', { locale: uk })})`;
        } else if (vc.entity_type === 'chapter') {
          const { data } = await supabase.from('chapters').select('title').eq('id', vc.entity_id).single();
          if (data) title = data.title;
        } else if (vc.entity_type === 'volume') {
          const { data } = await supabase.from('volumes').select('title').eq('id', vc.entity_id).single();
          if (data) title = data.title;
        }
        results.push({ type: vc.entity_type, title, views: vc.views });
      }
      return results;
    }
  });

  // Auto-generation stats
  const { data: autoGenStats } = useQuery<AutoGenStats>({
    queryKey: ['statistics-auto-gen'],
    queryFn: async () => {
      const result = await adminAction<{ success: boolean; stats: AutoGenStats }>('getAutoGenStats', password, { periods: true, daily: true });
      return result.stats ?? {
        h24: { retold: 0, dialogues: 0, tweets: 0, entities: 0 },
        d3: { retold: 0, dialogues: 0, tweets: 0, entities: 0 },
        d7: { retold: 0, dialogues: 0, tweets: 0, entities: 0 },
        d30: { retold: 0, dialogues: 0, tweets: 0, entities: 0 },
        daily: [],
      };
    }
  });

  // Bot visits stats
  const { data: botStats } = useQuery({
    queryKey: ['statistics-bots'],
    queryFn: async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('bot_visits')
        .select('bot_type, bot_category, created_at')
        .gte('created_at', sevenDaysAgo);

      if (!data) return { total: 0, byCategory: {}, byBot: {}, daily: [] };

      const byCategory: Record<string, number> = {};
      const byBot: Record<string, number> = {};
      const dailyMap: Record<string, number> = {};

      for (const v of data) {
        byCategory[v.bot_category] = (byCategory[v.bot_category] || 0) + 1;
        byBot[v.bot_type] = (byBot[v.bot_type] || 0) + 1;
        const day = v.created_at.split('T')[0];
        dailyMap[day] = (dailyMap[day] || 0) + 1;
      }

      // Create daily array for chart
      const daily = [];
      for (let i = 6; i >= 0; i--) {
        const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
        daily.push({
          date: d,
          label: format(subDays(new Date(), i), 'd MMM', { locale: uk }),
          visits: dailyMap[d] || 0
        });
      }

      const categoryData = Object.entries(byCategory).map(([name, value]) => ({ name, value }));
      const topBots = Object.entries(byBot)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, value]) => ({ name, value }));

      return { total: data.length, byCategory: categoryData, topBots, daily };
    }
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['statistics-dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['statistics-views'] }),
      queryClient.invalidateQueries({ queryKey: ['statistics-daily-views'] }),
      queryClient.invalidateQueries({ queryKey: ['statistics-news-views-by-country'] }),
      queryClient.invalidateQueries({ queryKey: ['statistics-top-content'] }),
      queryClient.invalidateQueries({ queryKey: ['statistics-auto-gen'] }),
      queryClient.invalidateQueries({ queryKey: ['statistics-bots'] }),
      queryClient.invalidateQueries({ queryKey: ['recent-retold-news'] }),
    ]);
    setIsRefreshing(false);
  };

  const chartConfig = {
    parts: { label: "Оповідання", color: "hsl(var(--primary))" },
    chapters: { label: "Глави", color: "hsl(var(--primary) / 0.6)" },
    volumes: { label: "Томи", color: "hsl(var(--primary) / 0.4)" },
    news: { label: "Новини", color: "hsl(var(--chart-2))" },
  };

  const viewsTimeRangeLabel = viewsTimeRange === '24h' ? '24 години' : viewsTimeRange === '7d' ? '7 днів' : viewsTimeRange === '14d' ? '14 днів' : '30 днів';

  if (dashboardLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Зведена статистика</h3>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm" disabled={isRefreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Оновити
        </Button>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {[
          { label: 'Томів', value: dashboardStats?.volumes, icon: BookOpen, color: 'text-blue-500' },
          { label: 'Глав', value: dashboardStats?.chapters, icon: FileText, color: 'text-green-500' },
          { label: 'Частин', value: dashboardStats?.parts, icon: FileText, color: 'text-amber-500' },
          { label: 'Опубліковано', value: dashboardStats?.publishedParts, icon: Sparkles, color: 'text-primary' },
          { label: 'Персонажів', value: dashboardStats?.characters, icon: Users, color: 'text-pink-500' },
          { label: 'Новин', value: dashboardStats?.newsItems, icon: Globe, color: 'text-cyan-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="cosmic-card">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${color}`} />
                <div>
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Views & Generations Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cosmic-card border-primary/20">
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
                <p className="text-sm text-muted-foreground">Унікальних відвідувачів</p>
                <p className="text-3xl font-bold">{dashboardStats?.uniqueVisitors || 0}</p>
              </div>
              <Users className="w-8 h-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="cosmic-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">AI генерацій</p>
                <p className="text-3xl font-bold">{dashboardStats?.generations || 0}</p>
              </div>
              <Sparkles className="w-8 h-8 text-amber-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Auto-generation Stats Table */}
      {autoGenStats && (
        <Card className="cosmic-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="w-4 h-4 text-primary" />
              Авто-генерація контенту
            </CardTitle>
            <CardDescription>Статистика автоматично згенерованого контенту</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Тип</th>
                    <th className="text-center py-2 px-3 text-muted-foreground font-medium">24г</th>
                    <th className="text-center py-2 px-3 text-muted-foreground font-medium">3 дні</th>
                    <th className="text-center py-2 px-3 text-muted-foreground font-medium">7 днів</th>
                    <th className="text-center py-2 px-3 text-muted-foreground font-medium">30 днів</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/30">
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-500" />
                        <span>Переказів</span>
                      </div>
                    </td>
                    <td className="text-center py-2 px-3 font-bold text-blue-500">{autoGenStats.h24.retold}</td>
                    <td className="text-center py-2 px-3 font-medium">{autoGenStats.d3.retold}</td>
                    <td className="text-center py-2 px-3 font-medium">{autoGenStats.d7.retold}</td>
                    <td className="text-center py-2 px-3 font-medium">{autoGenStats.d30.retold}</td>
                  </tr>
                  <tr className="border-b border-border/30">
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-green-500" />
                        <span>Діалогів</span>
                      </div>
                    </td>
                    <td className="text-center py-2 px-3 font-bold text-green-500">{autoGenStats.h24.dialogues}</td>
                    <td className="text-center py-2 px-3 font-medium">{autoGenStats.d3.dialogues}</td>
                    <td className="text-center py-2 px-3 font-medium">{autoGenStats.d7.dialogues}</td>
                    <td className="text-center py-2 px-3 font-medium">{autoGenStats.d30.dialogues}</td>
                  </tr>
                  <tr className="border-b border-border/30">
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <Twitter className="w-4 h-4 text-sky-500" />
                        <span>Твітів</span>
                      </div>
                    </td>
                    <td className="text-center py-2 px-3 font-bold text-sky-500">{autoGenStats.h24.tweets}</td>
                    <td className="text-center py-2 px-3 font-medium">{autoGenStats.d3.tweets}</td>
                    <td className="text-center py-2 px-3 font-medium">{autoGenStats.d7.tweets}</td>
                    <td className="text-center py-2 px-3 font-medium">{autoGenStats.d30.tweets}</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-purple-500" />
                        <span>Сутностей</span>
                      </div>
                    </td>
                    <td className="text-center py-2 px-3 font-bold text-purple-500">{autoGenStats.h24.entities}</td>
                    <td className="text-center py-2 px-3 font-medium">{autoGenStats.d3.entities}</td>
                    <td className="text-center py-2 px-3 font-medium">{autoGenStats.d7.entities}</td>
                    <td className="text-center py-2 px-3 font-medium">{autoGenStats.d30.entities}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Auto-gen Chart */}
      {autoGenStats?.daily && autoGenStats.daily.length > 0 && (
        <AutoGenChart data={autoGenStats.daily} />
      )}

      {/* Recent Retold News List */}
      <RecentRetoldNewsList />

      {/* Daily Views Chart */}
      <Card className="cosmic-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Перегляди за {viewsTimeRangeLabel}
            </CardTitle>
            <CardDescription>Динаміка переглядів контенту та новин</CardDescription>
          </div>
          <Select value={viewsTimeRange} onValueChange={(v) => setViewsTimeRange(v as any)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">24 години</SelectItem>
              <SelectItem value="7d">7 днів</SelectItem>
              <SelectItem value="14d">14 днів</SelectItem>
              <SelectItem value="30d">30 днів</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyViews}>
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="parts" name="Оповідання" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} stackId="a" />
                <Bar dataKey="chapters" name="Глави" fill="hsl(var(--primary) / 0.6)" radius={[4, 4, 0, 0]} stackId="a" />
                <Bar dataKey="volumes" name="Томи" fill="hsl(var(--primary) / 0.4)" radius={[4, 4, 0, 0]} stackId="a" />
                <Bar dataKey="news" name="Новини" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>

          {/* News Views by Country */}
          {newsViewsByCountry.length > 0 && (
            <div className="mt-6 pt-4 border-t border-border">
              <p className="text-sm font-medium text-muted-foreground mb-3">Перегляди новин по країнах:</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {newsViewsByCountry.map((country) => (
                  <div key={country.code} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{country.flag}</span>
                      <span className="text-sm font-medium">{country.code.toUpperCase()}</span>
                    </div>
                    <Badge variant="secondary" className="font-mono">{country.views}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bot Stats Bar Chart - same as in BotCacheAnalyticsPanel */}
      {botStats && botStats.topBots && botStats.topBots.length > 0 && (
        <Card className="cosmic-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="w-4 h-4 text-emerald-500" />
              Статистика ботів (7 днів)
            </CardTitle>
            <CardDescription>Топ боти по кількості запитів</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={botStats.topBots.slice(0, 8)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis
                  dataKey="name"
                  type="category"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  width={120}
                  tickFormatter={(value) => value.length > 15 ? value.substring(0, 15) + '...' : value}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="value" name="Запитів" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Bot Stats & News by Country Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Bot Visits Daily */}
        <Card className="cosmic-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="w-4 h-4 text-emerald-500" />
              Бот-трафік (7 днів)
            </CardTitle>
            <CardDescription>Відвідування пошуковими та AI ботами</CardDescription>
          </CardHeader>
          <CardContent>
            {botStats && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <span className="text-sm">Всього відвідувань</span>
                  <Badge variant="secondary" className="font-bold">{botStats.total}</Badge>
                </div>

                {botStats.daily && botStats.daily.length > 0 && (
                  <div className="h-[120px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={botStats.daily}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="visits" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* News by Country */}
        <Card className="cosmic-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="w-4 h-4 text-cyan-500" />
              Новини по країнах
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {dashboardStats?.countriesStats.slice(0, 4).map((country) => (
                <Card key={country.id} className="border-border/50">
                  <CardContent className="pt-3 pb-2 px-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{country.flag}</span>
                      <span className="font-medium text-sm">{country.name}</span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Всього:</span>
                        <Badge variant="secondary" className="text-xs">{country.total}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" /> 24г:
                        </span>
                        <span className="text-green-500 font-medium">+{country.last24h}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>



      {/* Top Content */}
      <Card className="cosmic-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Топ контент
          </CardTitle>
          <CardDescription>Найпопулярніші матеріали</CardDescription>
        </CardHeader>
        <CardContent>
          {topContent.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Поки немає даних про перегляди</p>
          ) : (
            <div className="space-y-2">
              {topContent.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-muted-foreground w-6">#{i + 1}</span>
                    {item.type === 'part' && <FileText className="w-4 h-4 text-primary" />}
                    {item.type === 'chapter' && <BookOpen className="w-4 h-4 text-primary" />}
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
