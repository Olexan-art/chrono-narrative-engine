import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, BookOpen, FileText, Users, MessageSquare, Globe, TrendingUp, Eye, Calendar, Sparkles, Clock } from "lucide-react";
import { format, subDays } from "date-fns";
import { uk } from "date-fns/locale";

interface Props {
  password: string;
}

export function DashboardPanel({ password }: Props) {
  // Fetch aggregated statistics
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const now = new Date();
      const last24h = subDays(now, 1);
      const last7d = subDays(now, 7);
      const last30d = subDays(now, 30);

      // Parallel queries for all stats
      const [
        { count: volumesCount },
        { count: chaptersCount },
        { count: partsCount },
        { count: publishedPartsCount },
        { count: charactersCount },
        { count: newsItemsCount },
        { count: generationsCount },
        { data: recentParts },
        { data: recentNews },
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
        supabase.from('parts').select('id, title, date, status').order('created_at', { ascending: false }).limit(5),
        supabase.from('news_rss_items').select('id, title, fetched_at, country_id').order('fetched_at', { ascending: false }).limit(5),
        supabase.from('view_counts').select('views, unique_visitors'),
        supabase.from('news_countries').select(`
          id, name, flag, code,
          news_rss_items(id, published_at, fetched_at, is_archived)
        `).eq('is_active', true)
      ]);

      // Calculate view totals
      const totalViews = viewStats?.reduce((sum, v) => sum + (v.views || 0), 0) || 0;
      const uniqueVisitors = viewStats?.reduce((sum, v) => sum + (v.unique_visitors || 0), 0) || 0;

      // Calculate news per country with time-based stats
      const countriesStats = countriesWithCounts?.map(c => {
        const items = c.news_rss_items as Array<{ id: string; published_at: string | null; fetched_at: string; is_archived: boolean }> || [];
        // Only count non-archived items
        const activeItems = items.filter(i => !i.is_archived);
        const total = activeItems.length;
        // Use published_at for time stats, fallback to fetched_at
        const last24hCount = activeItems.filter(i => {
          const itemDate = i.published_at ? new Date(i.published_at) : new Date(i.fetched_at);
          return itemDate >= last24h;
        }).length;
        const last7dCount = activeItems.filter(i => {
          const itemDate = i.published_at ? new Date(i.published_at) : new Date(i.fetched_at);
          return itemDate >= last7d;
        }).length;
        
        return {
          id: c.id,
          name: c.name,
          flag: c.flag,
          code: c.code,
          total,
          last24h: last24hCount,
          last7d: last7dCount
        };
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
        recentParts: recentParts || [],
        recentNews: recentNews || [],
        countriesStats
      };
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">Аггрегована статистика</h3>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {[
          { label: 'Томів', value: stats?.volumes, icon: BookOpen, color: 'text-blue-500' },
          { label: 'Глав', value: stats?.chapters, icon: FileText, color: 'text-green-500' },
          { label: 'Частин', value: stats?.parts, icon: FileText, color: 'text-amber-500' },
          { label: 'Опубліковано', value: stats?.publishedParts, icon: Sparkles, color: 'text-primary' },
          { label: 'Персонажів', value: stats?.characters, icon: Users, color: 'text-pink-500' },
          { label: 'Новин', value: stats?.newsItems, icon: Globe, color: 'text-cyan-500' },
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

      {/* Views Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="cosmic-card border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              Перегляди
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-3xl font-bold text-primary">{stats?.totalViews?.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Всього переглядів</p>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-3xl font-bold">{stats?.uniqueVisitors?.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Унікальних відвідувачів</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cosmic-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Генерації
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 p-4 rounded-lg text-center">
              <p className="text-3xl font-bold">{stats?.generations?.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Всього AI генерацій</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* News by Country */}
      <Card className="cosmic-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-500" />
            Кротовиина Новин по країнах
          </CardTitle>
          <CardDescription>Статистика новин з розбивкою по країнах та часових періодах</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats?.countriesStats.map((country) => (
              <Card key={country.id} className="border-border/50">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">{country.flag}</span>
                    <span className="font-medium">{country.name}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Всього:</span>
                      <Badge variant="secondary" className="font-bold">{country.total}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" /> 24 год:
                      </span>
                      <span className="text-green-500 font-medium text-sm">+{country.last24h}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> 7 днів:
                      </span>
                      <span className="text-blue-500 font-medium text-sm">+{country.last7d}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="cosmic-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Останні частини
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats?.recentParts.map((part) => (
                <div key={part.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                  <span className="text-sm truncate max-w-[200px]">{part.title}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(part.date), 'd MMM', { locale: uk })}
                    </span>
                    <Badge 
                      variant={part.status === 'published' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {part.status === 'published' ? '✓' : '○'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="cosmic-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-500" />
              Останні новини
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats?.recentNews.map((news) => (
                <div key={news.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                  <span className="text-sm truncate max-w-[250px]">{news.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(news.fetched_at), 'd MMM HH:mm', { locale: uk })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
