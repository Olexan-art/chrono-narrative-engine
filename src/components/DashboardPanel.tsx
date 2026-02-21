import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2, BookOpen, FileText, Users, Globe, TrendingUp, Eye,
  Sparkles, Clock, ShieldCheck, Activity,
  ArrowUpRight, BarChart3, Library
} from "lucide-react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Legend, RadarChart,
  PolarGrid, PolarAngleAxis, Radar, Cell
} from "recharts";
import { callEdgeFunction } from "@/lib/api";

interface Props {
  password: string;
}

export function DashboardPanel({ password }: Props) {
  const [botVisitsTimeRange, setBotVisitsTimeRange] = useState<'24h' | '7d' | '30d'>('24h');
  
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard-stats-unified-refined'],
    queryFn: async () => {
      const unified = await callEdgeFunction<{
        success: boolean;
        stats: {
          counts: any,
          lifecycle: any[],
          performance: any[],
          seo: any,
          countriesStats: any[],
          recentWiki: any[],
          recentNews: any[]
        }
      }>('get-dashboard-stats', { password });

      return unified.stats;
    }
  });

  // Bot visits statistics
  const { data: botVisits } = useQuery({
    queryKey: ['bot-visits-stats', botVisitsTimeRange],
    queryFn: async () => {
      const resp = await callEdgeFunction('admin', { 
        action: 'getBotVisitsStats', 
        password,
        timeRange: botVisitsTimeRange 
      }) as { success: boolean; stats?: any };
      if (!resp.success) throw new Error('Failed to fetch bot visits');
      return resp.stats;
    },
    refetchInterval: 15000,
    enabled: !!password,
  });

  // Unique visitors statistics
  const { data: uniqueVisitors } = useQuery({
    queryKey: ['unique-visitors-stats'],
    queryFn: async () => {
      const resp = await callEdgeFunction('admin', { action: 'getUniqueVisitorsStats', password }) as { success: boolean; stats?: any };
      if (!resp.success) throw new Error('Failed to fetch unique visitors');
      return resp.stats;
    },
    refetchInterval: 30000,
    enabled: !!password,
  });

  // Cloudflare analytics
  const { data: cloudflareStats } = useQuery({
    queryKey: ['cloudflare-analytics'],
    queryFn: async () => {
      const resp = await callEdgeFunction('admin', { action: 'getCloudflareAnalytics', password }) as { success: boolean; stats?: any };
      return resp.stats;
    },
    refetchInterval: 60000,
    enabled: !!password,
  });

  // Page views hourly statistics
  const { data: pageViewsHourly } = useQuery({
    queryKey: ['page-views-hourly'],
    queryFn: async () => {
      const resp = await callEdgeFunction('admin', { action: 'getPageViewsHourly', password }) as { success: boolean; stats?: any };
      if (!resp.success) throw new Error('Failed to fetch page views');
      return resp.stats;
    },
    refetchInterval: 30000,
    enabled: !!password,
  });

  // Unique visitors hourly statistics
  const { data: uniqueVisitorsHourly } = useQuery({
    queryKey: ['unique-visitors-hourly'],
    queryFn: async () => {
      const resp = await callEdgeFunction('admin', { action: 'getUniqueVisitorsHourly', password }) as { success: boolean; stats?: any };
      if (!resp.success) throw new Error('Failed to fetch hourly unique visitors');
      return resp.stats;
    },
    refetchInterval: 30000,
    enabled: !!password,
  });

  // Top traffic countries statistics
  const { data: topCountries } = useQuery({
    queryKey: ['top-traffic-countries'],
    queryFn: async () => {
      const resp = await callEdgeFunction('admin', { action: 'getTopTrafficCountries', password }) as { success: boolean; stats?: any };
      if (!resp.success) throw new Error('Failed to fetch top countries');
      return resp.stats;
    },
    refetchInterval: 60000,
    enabled: !!password,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" strokeWidth={1.5} />
          <p className="text-muted-foreground animate-pulse font-mono uppercase tracking-widest text-xs">Loading Cosmic Data...</p>
        </div>
      </div>
    );
  }

  const stats = dashboardData?.counts;
  const lifecycle = dashboardData?.lifecycle || [];
  const performance = dashboardData?.performance || [];
  const seo = dashboardData?.seo || {};
  const recentWiki = dashboardData?.recentWiki || [];
  const recentNews = dashboardData?.recentNews || [];
  const countriesStats = dashboardData?.countriesStats || [];

  const seoRadarData = [
    { subject: 'Частини (SEO)', A: seo.partsCoverage, fullMark: 100 },
    { subject: 'Новини (Slug)', A: seo.newsCoverage, fullMark: 100 },
    { subject: 'Вікі (Slug)', A: seo.wikiCoverage, fullMark: 100 },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* 🚀 Header Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cosmic-card overflow-hidden group">
          <CardHeader className="pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex justify-between">
              Перегляди
              <Eye className="w-4 h-4 text-primary opacity-50 group-hover:opacity-100 transition-opacity" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">{stats?.totalViews?.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-primary inline-flex items-center">
                <Users className="w-3 h-3 mr-1" /> {stats?.uniqueVisitors?.toLocaleString()}
              </span> унікальних відвідувачів
            </p>
          </CardContent>
        </Card>

        <Card className="cosmic-card overflow-hidden group">
          <CardHeader className="pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex justify-between">
              Контент
              <BookOpen className="w-4 h-4 text-amber-500 opacity-50 group-hover:opacity-100 transition-opacity" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">{stats?.parts?.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              З них <span className="text-amber-500">{stats?.publishedParts}</span> опубліковано
            </p>
          </CardContent>
        </Card>

        <Card className="cosmic-card overflow-hidden group">
          <CardHeader className="pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex justify-between">
              Новини
              <Globe className="w-4 h-4 text-cyan-500 opacity-50 group-hover:opacity-100 transition-opacity" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">{stats?.newsItems?.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Оброблено AI <span className="text-cyan-500">{stats?.generations}</span> разів
            </p>
          </CardContent>
        </Card>

        <Card className="cosmic-card overflow-hidden group">
          <CardHeader className="pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex justify-between">
              SEO Покриття
              <ShieldCheck className="w-4 h-4 text-green-500 opacity-50 group-hover:opacity-100 transition-opacity" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">{seo.partsCoverage}%</div>
            <div className="w-full bg-muted h-1 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-green-500 h-full transition-all duration-1000"
                style={{ width: `${seo.partsCoverage}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 📊 Життєвий цикл новин */}
        <Card className="lg:col-span-2 cosmic-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Життєвий цикл новин (7 днів)
            </CardTitle>
            <CardDescription>Порівняння доданих, переказаних новин та візитів ботів</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={lifecycle}>
                  <defs>
                    <linearGradient id="colorAdded" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorRetold" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ffc658" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ffc658" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorBots" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#82ca9d" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted opacity-30" />
                  <XAxis dataKey="label" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'rgba(10, 10, 15, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  />
                  <Legend verticalAlign="top" height={36} />
                  <Area type="monotone" name="Додано" dataKey="added" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorAdded)" strokeWidth={2} />
                  <Area type="monotone" name="Переказано (зі Slug)" dataKey="retold" stroke="#ffc658" fillOpacity={1} fill="url(#colorRetold)" strokeWidth={2} />
                  <Area type="monotone" name="Бот візити" dataKey="botVisits" stroke="#82ca9d" fillOpacity={1} fill="url(#colorBots)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 🎯 SEO Health */}
        <Card className="cosmic-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-green-500" />
              SEO Здоров'я
            </CardTitle>
            <CardDescription>Покриття мета-даними за типами контенту</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={seoRadarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.1)" />
                  <PolarAngleAxis dataKey="subject" className="text-[10px] uppercase font-mono" />
                  <Radar
                    name="SEO"
                    dataKey="A"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.6}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-1 w-full gap-2 mt-4">
              <div className="flex justify-between items-center text-xs p-2 rounded bg-muted/20">
                <span className="text-muted-foreground">Parts (Description):</span>
                <span className="font-mono font-bold text-green-500">{seo.partsCoverage}%</span>
              </div>
              <div className="flex justify-between items-center text-xs p-2 rounded bg-muted/20">
                <span className="text-muted-foreground">News (Slugs):</span>
                <span className="font-mono font-bold text-cyan-500">{seo.newsCoverage}%</span>
              </div>
              <div className="flex justify-between items-center text-xs p-2 rounded bg-muted/20">
                <span className="text-muted-foreground">Wiki (Slugs):</span>
                <span className="font-mono font-bold text-amber-500">{seo.wikiCoverage}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ⚡ Performance Stats */}
        <Card className="cosmic-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="w-4 h-4 text-primary" />
              Продуктивність AI (24 год)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performance} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted opacity-30" horizontal={true} vertical={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="provider"
                    type="category"
                    width={80}
                    className="text-[10px] font-mono uppercase"
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ backgroundColor: 'rgba(10,10,15,0.9)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                  <Legend />
                  <Bar name="Затримка (ms)" dataKey="avgLatency" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={20} />
                  <Bar name="Успішність (%)" dataKey="successRate" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 🌍 Географія новин */}
        <Card className="cosmic-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="w-4 h-4 text-cyan-500" />
              Географія контенту (без лімітів)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
              {countriesStats.slice(0, 8).map((c: any) => (
                <div key={c.id} className="p-3 rounded-lg bg-muted/10 border border-muted-foreground/10 hover:border-primary/20 transition-all group">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xl">{c.flag}</span>
                    <ArrowUpRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="font-bold text-lg leading-tight">{c.total.toLocaleString()}</div>
                  <div className="text-[10px] uppercase font-mono text-muted-foreground truncate">{c.name}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 📜 Останні події */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="cosmic-card border-l-4 border-l-amber-500">
          <CardHeader className="pb-3 pt-4">
            <CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2">
              <Library className="w-4 h-4 text-amber-500" />
              Останні wiki
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentWiki.map((wiki: any) => (
                <Link
                  key={wiki.id}
                  to={wiki.slug ? `/wiki/${wiki.slug}` : `/wiki/${wiki.id}`}
                  target="_blank"
                  className="flex items-center justify-between p-2 hover:bg-muted/30 rounded transition-colors border border-transparent hover:border-muted-foreground/10"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium truncate max-w-[200px]">{wiki.name}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {format(new Date(wiki.created_at), 'd MMM HH:mm', { locale: uk })}
                    </span>
                  </div>
                  <ArrowUpRight className="w-3 h-3 text-muted-foreground opacity-30 group-hover:opacity-100" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="cosmic-card border-l-4 border-l-cyan-500">
          <CardHeader className="pb-3 pt-4">
            <CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-500" />
              Свіжі новини
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentNews.map((news: any) => (
                <Link
                  key={news.id}
                  to={news.slug ? `/news/${news.slug}` : `/news/${news.id}`}
                  target="_blank"
                  className="flex items-center justify-between p-2 hover:bg-muted/30 rounded transition-colors border border-transparent hover:border-muted-foreground/10"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium truncate max-w-[240px]">{news.title}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {format(new Date(news.fetched_at), 'HH:mm', { locale: uk })}
                    </span>
                  </div>
                  <ArrowUpRight className="w-3 h-3 text-muted-foreground opacity-30 group-hover:opacity-100" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 🤖 Bot Analytics & Unique Visitors */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Bot Visits Chart */}
        <Card className="md:col-span-2 cosmic-card border-t-4 border-t-violet-500">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="w-5 h-5 text-violet-500" />
                  Бот візити
                </CardTitle>
                <CardDescription>
                  Google, Bing, AI боти та інші {botVisitsTimeRange === '24h' ? 'за годинами' : 'за днями'}
                </CardDescription>
              </div>
              <div className="flex gap-1">
                <Button
                  variant={botVisitsTimeRange === '24h' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setBotVisitsTimeRange('24h')}
                  className="text-xs h-7"
                >
                  24 год
                </Button>
                <Button
                  variant={botVisitsTimeRange === '7d' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setBotVisitsTimeRange('7d')}
                  className="text-xs h-7"
                >
                  7 днів
                </Button>
                <Button
                  variant={botVisitsTimeRange === '30d' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setBotVisitsTimeRange('30d')}
                  className="text-xs h-7"
                >
                  30 днів
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {botVisits?.history && (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={botVisits.history}>
                    <defs>
                      <linearGradient id="colorGoogle" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4285f4" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#4285f4" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorBing" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00a4ef" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#00a4ef" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorAI" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorOther" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                    <XAxis 
                      dataKey="time" 
                      tickLine={false} 
                      axisLine={false} 
                      className="text-[10px]"
                    />
                    <YAxis tickLine={false} axisLine={false} className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(10, 10, 15, 0.95)', 
                        border: '1px solid rgba(255,255,255,0.1)', 
                        borderRadius: '8px' 
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Area 
                      type="monotone" 
                      dataKey="googlebot" 
                      name="Google Bot" 
                      stroke="#4285f4" 
                      fill="url(#colorGoogle)" 
                      strokeWidth={2}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="bingbot" 
                      name="Bing Bot" 
                      stroke="#00a4ef" 
                      fill="url(#colorBing)" 
                      strokeWidth={2}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="ai_bots" 
                      name="AI Боти" 
                      stroke="#a78bfa" 
                      fill="url(#colorAI)" 
                      strokeWidth={2}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="other_bots" 
                      name="Інші" 
                      stroke="#94a3b8" 
                      fill="url(#colorOther)" 
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            {!botVisits?.history && (
              <div className="h-[280px] flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Завантаження даних про ботів...</p>
              </div>
            )}
            {botVisits?.totalRequests !== undefined && (
              <div className="mt-4 pt-4 border-t border-muted-foreground/10">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Всього за {botVisitsTimeRange === '24h' ? '24 години' : botVisitsTimeRange === '7d' ? '7 днів' : '30 днів'}:
                  </span>
                  <span className="text-lg font-bold font-mono text-violet-500">{botVisits.totalRequests.toLocaleString()}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Unique Visitors Stats */}
        <div className="space-y-4">
          <Card className="cosmic-card border-t-4 border-t-cyan-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-500" />
                Унікальні відвідувачі — Новини
              </CardTitle>
              <CardDescription className="text-xs">Унікальні візити новин за періодами</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <div className="text-3xl font-bold font-mono text-cyan-500">
                    {uniqueVisitors?.news?.h24?.toLocaleString() ?? '—'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">за останні 24 години</div>
                </div>
                <div className="pt-3 border-t border-muted-foreground/10">
                  <div className="text-2xl font-semibold font-mono">
                    {uniqueVisitors?.news?.d7?.toLocaleString() ?? '—'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">за останні 7 днів</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cosmic-card border-t-4 border-t-amber-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Library className="w-4 h-4 text-amber-500" />
                Унікальні відвідувачі — Wiki
              </CardTitle>
              <CardDescription className="text-xs">Унікальні візити wiki сторінок</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <div className="text-3xl font-bold font-mono text-amber-500">
                    {uniqueVisitors?.wiki?.h24?.toLocaleString() ?? '—'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">за останні 24 години</div>
                </div>
                <div className="pt-3 border-t border-muted-foreground/10">
                  <div className="text-2xl font-semibold font-mono">
                    {uniqueVisitors?.wiki?.d7?.toLocaleString() ?? '—'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">за останні 7 днів</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 📊 Traffic Analytics - New Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Unique Visitors Hourly Chart */}
        <Card className="cosmic-card border-t-4 border-t-emerald-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-500" />
              Унікальні відвідувачі (24 год)
            </CardTitle>
            <CardDescription>Погодинна динаміка унікальних користувачів</CardDescription>
          </CardHeader>
          <CardContent>
            {uniqueVisitorsHourly?.history && (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={uniqueVisitorsHourly.history}>
                    <defs>
                      <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                    <XAxis 
                      dataKey="time" 
                      tickLine={false} 
                      axisLine={false} 
                      className="text-[10px]"
                    />
                    <YAxis tickLine={false} axisLine={false} className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(10, 10, 15, 0.95)', 
                        border: '1px solid rgba(255,255,255,0.1)', 
                        borderRadius: '8px' 
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="visitors" 
                      name="Унікальні" 
                      stroke="#10b981" 
                      fill="url(#colorVisitors)" 
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            {!uniqueVisitorsHourly?.history && (
              <div className="h-[280px] flex items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  {uniqueVisitorsHourly === undefined ? 'Завантаження даних...' : 'Немає даних за цей період'}
                </p>
              </div>
            )}
            {uniqueVisitorsHourly?.history && uniqueVisitorsHourly.history.length === 0 && (
              <div className="h-[280px] flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Немає даних за останні 24 години</p>
              </div>
            )}
            {uniqueVisitorsHourly?.total24h !== undefined && (
              <div className="mt-4 pt-4 border-t border-muted-foreground/10">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Всього унікальних за 24 год:</span>
                  <span className="text-lg font-bold font-mono text-emerald-500">
                    {uniqueVisitorsHourly.total24h.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Page Views by Type Chart */}
        <Card className="cosmic-card border-t-4 border-t-sky-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="w-5 h-5 text-sky-500" />
              Перегляди за типом контенту (24 год)
            </CardTitle>
            <CardDescription>Розподіл переглядів: Новини vs Wiki</CardDescription>
          </CardHeader>
          <CardContent>
            {pageViewsHourly?.history && (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={pageViewsHourly.history}>
                    <defs>
                      <linearGradient id="colorNews" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorWiki" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                    <XAxis 
                      dataKey="time" 
                      tickLine={false} 
                      axisLine={false} 
                      className="text-[10px]"
                    />
                    <YAxis tickLine={false} axisLine={false} className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(10, 10, 15, 0.95)', 
                        border: '1px solid rgba(255,255,255,0.1)', 
                        borderRadius: '8px' 
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Area 
                      type="monotone" 
                      dataKey="news" 
                      name="Новини" 
                      stroke="#0ea5e9" 
                      fill="url(#colorNews)" 
                      strokeWidth={2}
                      stackId="1"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="wiki" 
                      name="Wiki" 
                      stroke="#f59e0b" 
                      fill="url(#colorWiki)" 
                      strokeWidth={2}
                      stackId="1"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            {!pageViewsHourly?.history && (
              <div className="h-[280px] flex items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  {pageViewsHourly === undefined ? 'Завантаження даних...' : 'Немає даних за цей період'}
                </p>
              </div>
            )}
            {pageViewsHourly?.history && pageViewsHourly.history.length === 0 && (
              <div className="h-[280px] flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Немає даних про перегляди за останні 24 години</p>
              </div>
            )}
            {pageViewsHourly?.total24h !== undefined && (
              <div className="mt-4 pt-4 border-t border-muted-foreground/10">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Всього переглядів за 24 год:</span>
                  <span className="text-lg font-bold font-mono text-sky-500">
                    {pageViewsHourly.total24h.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ⚡ Performance Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bot Response Time Chart */}
        <Card className="cosmic-card border-t-4 border-t-pink-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="w-5 h-5 text-pink-500" />
              Час відповіді ботам (24 год)
            </CardTitle>
            <CardDescription>Середній час обробки запитів від різних ботів</CardDescription>
          </CardHeader>
          <CardContent>
            {botVisits?.avgResponseTimes && botVisits.avgResponseTimes.length > 0 && (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={botVisits.avgResponseTimes} layout="vertical" margin={{ left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(255,255,255,0.06)" />
                    <XAxis type="number" tickLine={false} axisLine={false} className="text-xs" />
                    <YAxis 
                      dataKey="bot" 
                      type="category" 
                      width={75}
                      className="text-[11px]"
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(10, 10, 15, 0.95)', 
                        border: '1px solid rgba(255,255,255,0.1)', 
                        borderRadius: '8px' 
                      }}
                      formatter={(value: any) => [`${value} ms`, 'Середній час']}
                    />
                    <Bar 
                      dataKey="avgTime" 
                      fill="#ec4899" 
                      radius={[0, 4, 4, 0]} 
                      barSize={25}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {(!botVisits?.avgResponseTimes || botVisits.avgResponseTimes.length === 0) && (
              <div className="h-[280px] flex items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  {botVisits === undefined ? 'Завантаження даних...' : 'Немає даних про response time'}
                </p>
              </div>
            )}
            {botVisits?.successRate !== undefined && (
              <div className="mt-4 pt-4 border-t border-muted-foreground/10">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Успішність запитів:</span>
                  <span className="text-lg font-bold font-mono text-green-500">
                    {botVisits.successRate}%
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cloudflare Bandwidth Chart */}
        <Card className="cosmic-card border-t-4 border-t-indigo-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-500" />
              Bandwidth & Запити (24 год)
            </CardTitle>
            <CardDescription>Cloudflare трафік та кількість запитів</CardDescription>
          </CardHeader>
          <CardContent>
            {cloudflareStats?.timeseries && cloudflareStats.timeseries.length > 0 && (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cloudflareStats.timeseries}>
                    <defs>
                      <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                    <XAxis 
                      dataKey="since" 
                      tickFormatter={(value) => new Date(value).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                      tickLine={false} 
                      axisLine={false} 
                      className="text-[10px]"
                    />
                    <YAxis tickLine={false} axisLine={false} className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(10, 10, 15, 0.95)', 
                        border: '1px solid rgba(255,255,255,0.1)', 
                        borderRadius: '8px' 
                      }}
                      labelFormatter={(value) => new Date(value).toLocaleString('uk-UA')}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Area 
                      type="monotone" 
                      dataKey="requests.all" 
                      name="Запити" 
                      stroke="#6366f1" 
                      fill="url(#colorRequests)" 
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            {(!cloudflareStats?.timeseries || cloudflareStats.timeseries.length === 0) && (
              <div className="h-[280px] flex items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  {cloudflareStats === null ? 'Cloudflare Analytics недоступна' : 
                   cloudflareStats === undefined ? 'Завантаження даних...' : 
                   'Немає даних від Cloudflare'}
                </p>
              </div>
            )}
            {cloudflareStats?.bandwidth && (
              <div className="mt-4 pt-4 border-t border-muted-foreground/10">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Загальний трафік за 24 год:</span>
                  <span className="text-lg font-bold font-mono text-indigo-500">
                    {(cloudflareStats.bandwidth / 1024 / 1024 / 1024).toFixed(2)} GB
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 🌍 Geographic Analytics */}
      <Card className="cosmic-card border-t-4 border-t-purple-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="w-5 h-5 text-purple-500" />
            Top 10 країн за трафіком (24 год)
          </CardTitle>
          <CardDescription>Географічний розподіл запитів від ботів</CardDescription>
        </CardHeader>
        <CardContent>
          {topCountries?.countries && topCountries.countries.length > 0 && (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topCountries.countries} layout="vertical" margin={{ left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(255,255,255,0.06)" />
                  <XAxis type="number" tickLine={false} axisLine={false} className="text-xs" />
                  <YAxis 
                    dataKey="country" 
                    type="category" 
                    width={55}
                    className="text-[11px]"
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(10, 10, 15, 0.95)', 
                      border: '1px solid rgba(255,255,255,0.1)', 
                      borderRadius: '8px' 
                    }}
                    formatter={(value: any) => [`${value} запитів`, 'Кількість']}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="#a855f7" 
                    radius={[0, 4, 4, 0]} 
                    barSize={18}
                  >
                    {topCountries.countries.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={`hsl(${280 - index * 10}, 70%, ${55 + index * 3}%)`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {(!topCountries?.countries || topCountries.countries.length === 0) && (
            <div className="h-[320px] flex items-center justify-center">
              <p className="text-sm text-muted-foreground">
                {topCountries === undefined ? 'Завантаження даних...' : 'Немає даних про географію запитів'}
              </p>
            </div>
          )}
          {topCountries?.total !== undefined && (
            <div className="mt-4 pt-4 border-t border-muted-foreground/10">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Всього запитів:</span>
                <span className="text-lg font-bold font-mono text-purple-500">
                  {topCountries.total.toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ☁️ Cloudflare Analytics */}
      {cloudflareStats && (
        <Card className="cosmic-card border-t-4 border-t-orange-500">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-500" />
              Cloudflare Analytics (24 год)
            </CardTitle>
            <CardDescription>Статистика CDN та безпеки від Cloudflare</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="p-4 rounded-lg bg-gradient-to-br from-orange-500/10 to-transparent border border-orange-500/20">
                <div className="text-sm text-muted-foreground mb-1">Запити</div>
                <div className="text-2xl font-bold font-mono text-orange-500">
                  {cloudflareStats.requests?.toLocaleString() ?? '—'}
                </div>
              </div>
              <div className="p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20">
                <div className="text-sm text-muted-foreground mb-1">Трафік</div>
                <div className="text-2xl font-bold font-mono text-blue-500">
                  {cloudflareStats.bandwidth ? `${(cloudflareStats.bandwidth / 1024 / 1024 / 1024).toFixed(2)} GB` : '—'}
                </div>
              </div>
              <div className="p-4 rounded-lg bg-gradient-to-br from-red-500/10 to-transparent border border-red-500/20">
                <div className="text-sm text-muted-foreground mb-1">Загрози</div>
                <div className="text-2xl font-bold font-mono text-red-500">
                  {cloudflareStats.threats?.toLocaleString() ?? '—'}
                </div>
              </div>
              <div className="p-4 rounded-lg bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/20">
                <div className="text-sm text-muted-foreground mb-1">Перегляди</div>
                <div className="text-2xl font-bold font-mono text-green-500">
                  {cloudflareStats.pageviews?.toLocaleString() ?? '—'}
                </div>
              </div>
              <div className="p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20">
                <div className="text-sm text-muted-foreground mb-1">Унікальні</div>
                <div className="text-2xl font-bold font-mono text-purple-500">
                  {cloudflareStats.uniques?.toLocaleString() ?? '—'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
