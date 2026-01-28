import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw, Loader2, ExternalLink, Bot, Filter, Trash2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

interface BotError {
  id: string;
  bot_type: string;
  bot_category: string;
  path: string;
  status_code: number;
  user_agent: string | null;
  ip_country: string | null;
  response_time_ms: number | null;
  created_at: string;
}

const ERROR_COLORS: Record<string, string> = {
  '404': 'hsl(var(--chart-1))',
  '500': 'hsl(var(--chart-2))',
  '502': 'hsl(var(--chart-3))',
  '503': 'hsl(var(--chart-4))',
  '504': 'hsl(var(--chart-5))',
  'other': 'hsl(var(--muted-foreground))',
};

const getErrorLabel = (code: number): string => {
  switch (code) {
    case 400: return 'Bad Request';
    case 401: return 'Unauthorized';
    case 403: return 'Forbidden';
    case 404: return 'Not Found';
    case 500: return 'Server Error';
    case 502: return 'Bad Gateway';
    case 503: return 'Service Unavailable';
    case 504: return 'Gateway Timeout';
    default: return `Error ${code}`;
  }
};

const getErrorBadgeVariant = (code: number): "destructive" | "secondary" | "outline" => {
  if (code >= 500) return "destructive";
  if (code === 404) return "secondary";
  return "outline";
};

export function BotErrorsPanel({ password }: { password: string }) {
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | 'all'>('7d');
  const [filterBot, setFilterBot] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchPath, setSearchPath] = useState('');

  const getTimeRangeDate = () => {
    const now = new Date();
    switch (timeRange) {
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      case 'all':
        return null;
    }
  };

  const { data: errors, isLoading, refetch } = useQuery({
    queryKey: ['bot-errors', timeRange],
    queryFn: async () => {
      let query = supabase
        .from('bot_visits')
        .select('*')
        .or('status_code.neq.200,status_code.is.null')
        .order('created_at', { ascending: false })
        .limit(500);

      const fromDate = getTimeRangeDate();
      if (fromDate) {
        query = query.gte('created_at', fromDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as BotError[];
    },
  });

  // Unique bot types for filter
  const botTypes = useMemo(() => {
    if (!errors) return [];
    const types = [...new Set(errors.map(e => e.bot_type))];
    return types.sort();
  }, [errors]);

  // Unique status codes for filter
  const statusCodes = useMemo(() => {
    if (!errors) return [];
    const codes = [...new Set(errors.map(e => e.status_code))].filter(Boolean);
    return codes.sort((a, b) => a - b);
  }, [errors]);

  // Filtered errors
  const filteredErrors = useMemo(() => {
    if (!errors) return [];
    return errors.filter(e => {
      if (filterBot !== 'all' && e.bot_type !== filterBot) return false;
      if (filterStatus !== 'all' && String(e.status_code) !== filterStatus) return false;
      if (searchPath && !e.path.toLowerCase().includes(searchPath.toLowerCase())) return false;
      return true;
    });
  }, [errors, filterBot, filterStatus, searchPath]);

  // Stats by error code
  const errorsByCode = useMemo(() => {
    if (!errors) return [];
    const counts: Record<string, number> = {};
    errors.forEach(e => {
      const key = String(e.status_code || 'unknown');
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([code, count]) => ({
        code,
        label: code === 'null' ? 'Unknown' : `${code} ${getErrorLabel(Number(code))}`,
        count,
        fill: ERROR_COLORS[code] || ERROR_COLORS.other,
      }))
      .sort((a, b) => b.count - a.count);
  }, [errors]);

  // Stats by bot type
  const errorsByBot = useMemo(() => {
    if (!errors) return [];
    const counts: Record<string, number> = {};
    errors.forEach(e => {
      counts[e.bot_type] = (counts[e.bot_type] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([bot, count]) => ({ bot, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [errors]);

  // Stats by path
  const errorsByPath = useMemo(() => {
    if (!errors) return [];
    const counts: Record<string, { count: number; codes: Set<number> }> = {};
    errors.forEach(e => {
      if (!counts[e.path]) {
        counts[e.path] = { count: 0, codes: new Set() };
      }
      counts[e.path].count++;
      if (e.status_code) counts[e.path].codes.add(e.status_code);
    });
    return Object.entries(counts)
      .map(([path, { count, codes }]) => ({ 
        path, 
        count, 
        codes: [...codes].sort((a, b) => a - b) 
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [errors]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <h2 className="text-xl font-semibold">Помилки ботів</h2>
          {errors && (
            <Badge variant="destructive">{errors.length}</Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2 ml-auto">
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">24 години</SelectItem>
              <SelectItem value="7d">7 днів</SelectItem>
              <SelectItem value="30d">30 днів</SelectItem>
              <SelectItem value="all">Усі</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Всього помилок
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">
              {errors?.length || 0}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              404 Not Found
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-500">
              {errors?.filter(e => e.status_code === 404).length || 0}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              5xx Server Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-500">
              {errors?.filter(e => e.status_code && e.status_code >= 500).length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Errors by Code */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Помилки за кодом</CardTitle>
          </CardHeader>
          <CardContent>
            {errorsByCode.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={errorsByCode}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ label, count }) => `${label}: ${count}`}
                  >
                    {errorsByCode.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Немає помилок
              </div>
            )}
          </CardContent>
        </Card>

        {/* Errors by Bot */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Помилки за ботом</CardTitle>
          </CardHeader>
          <CardContent>
            {errorsByBot.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={errorsByBot} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                  <YAxis 
                    type="category" 
                    dataKey="bot" 
                    width={100} 
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))' 
                    }} 
                  />
                  <Bar dataKey="count" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Немає помилок
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Error Paths */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <XCircle className="w-4 h-4 text-destructive" />
            Топ сторінок з помилками
          </CardTitle>
        </CardHeader>
        <CardContent>
          {errorsByPath.length > 0 ? (
            <div className="space-y-2">
              {errorsByPath.map((item, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center justify-between p-2 rounded bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-muted-foreground font-mono w-6">
                      {idx + 1}.
                    </span>
                    <code className="text-sm truncate max-w-md">{item.path}</code>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.codes.map(code => (
                      <Badge 
                        key={code} 
                        variant={getErrorBadgeVariant(code)}
                        className="text-xs"
                      >
                        {code}
                      </Badge>
                    ))}
                    <Badge variant="outline">{item.count}×</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Немає помилок для відображення
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Фільтри
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Пошук по шляху..."
                value={searchPath}
                onChange={(e) => setSearchPath(e.target.value)}
                className="w-full"
              />
            </div>
            <Select value={filterBot} onValueChange={setFilterBot}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Бот" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Усі боти</SelectItem>
                {botTypes.map(bot => (
                  <SelectItem key={bot} value={bot}>{bot}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Код" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Усі коди</SelectItem>
                {statusCodes.map(code => (
                  <SelectItem key={code} value={String(code)}>
                    {code} {getErrorLabel(code)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Error Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Bot className="w-4 h-4" />
            Лог помилок ({filteredErrors.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {filteredErrors.length > 0 ? (
                filteredErrors.map((error) => (
                  <div 
                    key={error.id}
                    className="flex items-start gap-3 p-3 rounded-lg border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 transition-colors"
                  >
                    <Badge 
                      variant={getErrorBadgeVariant(error.status_code)}
                      className="shrink-0"
                    >
                      {error.status_code || '???'}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-sm font-medium truncate max-w-sm">
                          {error.path}
                        </code>
                        <a
                          href={`https://echoes2.com${error.path}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-2">
                        <span className="font-medium">{error.bot_type}</span>
                        <span>•</span>
                        <span>{formatDate(error.created_at)}</span>
                        {error.ip_country && (
                          <>
                            <span>•</span>
                            <span>{error.ip_country}</span>
                          </>
                        )}
                        {error.response_time_ms && (
                          <>
                            <span>•</span>
                            <span>{error.response_time_ms}ms</span>
                          </>
                        )}
                      </div>
                      {error.user_agent && (
                        <div className="text-xs text-muted-foreground mt-1 truncate max-w-full">
                          UA: {error.user_agent.substring(0, 100)}...
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  {isLoading ? (
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  ) : (
                    <>
                      <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                      <p>Немає помилок для відображення</p>
                      <p className="text-sm mt-1">Це гарна новина! 🎉</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
