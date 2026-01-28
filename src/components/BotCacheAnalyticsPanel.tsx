import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Database, CheckCircle2, XCircle, TrendingUp, RefreshCw, Loader2, Globe, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, BarChart, Bar } from "recharts";

interface BotVisitWithCache {
  id: string;
  bot_type: string;
  bot_category: string;
  path: string;
  cache_status: string | null;
  response_time_ms: number | null;
  created_at: string;
}

const CACHE_COLORS = {
  HIT: 'hsl(var(--chart-1))',
  MISS: 'hsl(var(--chart-2))',
};

export function BotCacheAnalyticsPanel({ password }: { password: string }) {
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d');

  const getTimeRangeDate = () => {
    const now = new Date();
    switch (timeRange) {
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }
  };

  const { data: visits, isLoading, refetch } = useQuery({
    queryKey: ['bot-cache-analytics', timeRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bot_visits')
        .select('id, bot_type, bot_category, path, cache_status, response_time_ms, created_at')
        .gte('created_at', getTimeRangeDate())
        .order('created_at', { ascending: false })
        .limit(5000);

      if (error) throw error;
      return data as BotVisitWithCache[];
    },
    refetchInterval: 60000,
  });

  // Stats calculations
  const stats = useMemo(() => {
    if (!visits?.length) return { 
      total: 0, 
      hits: 0, 
      misses: 0, 
      hitRate: 0, 
      avgHitTime: 0, 
      avgMissTime: 0,
      timeSaved: 0
    };

    const hits = visits.filter(v => v.cache_status === 'HIT');
    const misses = visits.filter(v => v.cache_status === 'MISS');
    
    const avgHitTime = hits.length 
      ? Math.round(hits.reduce((sum, v) => sum + (v.response_time_ms || 0), 0) / hits.length)
      : 0;
    const avgMissTime = misses.length 
      ? Math.round(misses.reduce((sum, v) => sum + (v.response_time_ms || 0), 0) / misses.length)
      : 0;
    
    // Time saved = hits * (avg miss time - avg hit time)
    const timeSaved = hits.length * (avgMissTime - avgHitTime);

    return {
      total: visits.length,
      hits: hits.length,
      misses: misses.length,
      hitRate: visits.length ? Math.round((hits.length / visits.length) * 100) : 0,
      avgHitTime,
      avgMissTime,
      timeSaved: Math.round(timeSaved / 1000), // in seconds
    };
  }, [visits]);

  // Chart data - HIT/MISS over time
  const chartData = useMemo(() => {
    if (!visits?.length) return [];

    const grouped: Record<string, { hits: number; misses: number }> = {};
    const format = timeRange === '24h' ? 'hour' : 'day';

    visits.forEach(v => {
      const date = new Date(v.created_at);
      let key: string;
      
      if (format === 'hour') {
        key = `${date.getHours()}:00`;
      } else {
        key = `${date.getDate()}.${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!grouped[key]) {
        grouped[key] = { hits: 0, misses: 0 };
      }
      
      if (v.cache_status === 'HIT') {
        grouped[key].hits++;
      } else if (v.cache_status === 'MISS') {
        grouped[key].misses++;
      }
    });

    return Object.entries(grouped)
      .map(([label, data]) => ({
        label,
        ...data,
        total: data.hits + data.misses,
        hitRate: data.hits + data.misses > 0 
          ? Math.round((data.hits / (data.hits + data.misses)) * 100) 
          : 0
      }))
      .reverse();
  }, [visits, timeRange]);

  // Pie chart data
  const pieData = useMemo(() => {
    return [
      { name: 'Cache HIT', value: stats.hits, color: CACHE_COLORS.HIT },
      { name: 'Cache MISS', value: stats.misses, color: CACHE_COLORS.MISS },
    ].filter(d => d.value > 0);
  }, [stats]);

  // Top paths by visits (with HIT/MISS breakdown)
  const topPaths = useMemo(() => {
    if (!visits?.length) return [];
    
    const pathStats: Record<string, { total: number; hits: number; misses: number }> = {};
    
    visits.forEach(v => {
      if (!pathStats[v.path]) {
        pathStats[v.path] = { total: 0, hits: 0, misses: 0 };
      }
      pathStats[v.path].total++;
      if (v.cache_status === 'HIT') pathStats[v.path].hits++;
      else if (v.cache_status === 'MISS') pathStats[v.path].misses++;
    });

    return Object.entries(pathStats)
      .map(([path, data]) => ({
        path,
        ...data,
        hitRate: data.total > 0 ? Math.round((data.hits / data.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);
  }, [visits]);

  // Top paths for bar chart
  const topPathsBarData = useMemo(() => {
    return topPaths.slice(0, 8).map(p => ({
      name: p.path.length > 25 ? p.path.substring(0, 25) + '...' : p.path,
      fullPath: p.path,
      HIT: p.hits,
      MISS: p.misses,
    }));
  }, [topPaths]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold">Bot SSR / Cache Analytics</h2>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as any)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">24 години</SelectItem>
              <SelectItem value="7d">7 днів</SelectItem>
              <SelectItem value="30d">30 днів</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="cosmic-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-primary" />
              <div>
                <p className="text-2xl font-bold text-glow">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Запитів ботів</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cosmic-card border-green-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold text-green-500">{stats.hits}</p>
                <p className="text-xs text-muted-foreground">Cache HIT</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cosmic-card border-orange-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <XCircle className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-2xl font-bold text-orange-500">{stats.misses}</p>
                <p className="text-xs text-muted-foreground">Cache MISS</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cosmic-card border-primary/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-primary" />
              <div>
                <p className="text-2xl font-bold text-glow">{stats.hitRate}%</p>
                <p className="text-xs text-muted-foreground">Hit Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cosmic-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{stats.avgHitTime}ms</p>
                <p className="text-xs text-muted-foreground">HIT час</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cosmic-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{stats.avgMissTime}ms</p>
                <p className="text-xs text-muted-foreground">MISS час</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Time saved banner */}
      {stats.timeSaved > 0 && (
        <Card className="cosmic-card bg-gradient-to-r from-green-500/10 to-primary/10 border-green-500/30">
          <CardContent className="py-4">
            <div className="flex items-center justify-center gap-3">
              <Zap className="w-6 h-6 text-green-500" />
              <span className="text-lg">
                Кешування зекономило <strong className="text-green-500">{stats.timeSaved}с</strong> часу генерації за цей період
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Area Chart - HIT/MISS over time */}
        <Card className="cosmic-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Динаміка Cache HIT/MISS</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number, name: string) => [value, name === 'hits' ? 'HIT' : 'MISS']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="hits" 
                    stackId="1" 
                    stroke={CACHE_COLORS.HIT} 
                    fill={CACHE_COLORS.HIT}
                    fillOpacity={0.6}
                    name="HIT"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="misses" 
                    stackId="1" 
                    stroke={CACHE_COLORS.MISS} 
                    fill={CACHE_COLORS.MISS}
                    fillOpacity={0.6}
                    name="MISS"
                  />
                  <Legend />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                Немає даних для відображення
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pie Chart */}
        <Card className="cosmic-card">
          <CardHeader>
            <CardTitle className="text-base">Розподіл HIT/MISS</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name.split(' ')[1]} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                Немає даних
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Paths Bar Chart */}
      <Card className="cosmic-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Топ сторінок для ботів (HIT/MISS)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topPathsBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={topPathsBarData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={10} 
                  width={180}
                  tickFormatter={(value) => value}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number, name: string) => [value, name]}
                  labelFormatter={(label) => topPathsBarData.find(d => d.name === label)?.fullPath || label}
                />
                <Legend />
                <Bar dataKey="HIT" stackId="a" fill={CACHE_COLORS.HIT} radius={[0, 0, 0, 0]} />
                <Bar dataKey="MISS" stackId="a" fill={CACHE_COLORS.MISS} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[350px] text-muted-foreground">
              Немає даних
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Paths Table */}
      <Card className="cosmic-card">
        <CardHeader>
          <CardTitle className="text-base">Деталі по сторінках</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[400px] overflow-y-auto">
            <div className="space-y-2">
              {topPaths.map((item, i) => (
                <div 
                  key={item.path} 
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-muted-foreground text-sm w-6">{i + 1}.</span>
                    <span className="font-mono text-sm truncate" title={item.path}>
                      {item.path}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant="outline" className="text-green-500 border-green-500/30">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      {item.hits}
                    </Badge>
                    <Badge variant="outline" className="text-orange-500 border-orange-500/30">
                      <XCircle className="w-3 h-3 mr-1" />
                      {item.misses}
                    </Badge>
                    <Badge 
                      variant={item.hitRate >= 80 ? "default" : item.hitRate >= 50 ? "secondary" : "destructive"}
                      className="min-w-[50px] justify-center"
                    >
                      {item.hitRate}%
                    </Badge>
                  </div>
                </div>
              ))}
              {topPaths.length === 0 && (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                  Немає даних про відвідування ботів
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
