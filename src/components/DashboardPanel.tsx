import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  PolarGrid, PolarAngleAxis, Radar
} from "recharts";
import { callEdgeFunction } from "@/lib/api";

interface Props {
  password: string;
}

export function DashboardPanel({ password }: Props) {
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
    </div>
  );
}
