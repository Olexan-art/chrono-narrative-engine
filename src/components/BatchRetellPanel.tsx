import { useState, useRef, useCallback, useEffect, memo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Play, Square, Loader2, CheckCircle2, XCircle, 
  Calendar, Globe, RefreshCw, BarChart3, Clock,
  AlertTriangle, FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { callEdgeFunction } from "@/lib/api";
import { format } from "date-fns";
import { uk } from "date-fns/locale";

const AI_MODELS = [
  { value: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash (швидкий)' },
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro (точний)' },
  { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini' },
  { value: 'openai/gpt-5', label: 'GPT-5 (потужний)' },
];

interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
  newsId?: string;
  newsTitle?: string;
}

interface BatchStats {
  total: number;
  processed: number;
  success: number;
  failed: number;
  skipped: number;
}

interface NewsCountry {
  id: string;
  code: string;
  name: string;
  flag: string;
}

interface NewsItem {
  id: string;
  title: string;
  content_en: string | null;
  fetched_at: string;
}

function BatchRetellPanelComponent() {
  const queryClient = useQueryClient();
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedModel, setSelectedModel] = useState<string>(AI_MODELS[0].value);
  const [retellMode, setRetellMode] = useState<'all' | 'every2nd'>('all');
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<BatchStats>({ total: 0, processed: 0, success: 0, failed: 0, skipped: 0 });
  const abortControllerRef = useRef<AbortController | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Fetch countries
  const { data: countries = [] } = useQuery({
    queryKey: ['news-countries-batch'],
    queryFn: async () => {
      const { data } = await supabase
        .from('news_countries')
        .select('id, code, name, flag')
        .eq('is_active', true)
        .order('sort_order');
      return (data || []) as NewsCountry[];
    }
  });

  // Fetch news count for selected date and country
  const { data: newsForDate = [] } = useQuery({
    queryKey: ['news-for-date', selectedCountry, selectedDate],
    queryFn: async () => {
      if (!selectedCountry || !selectedDate) return [];
      
      const startOfDay = `${selectedDate}T00:00:00`;
      const endOfDay = `${selectedDate}T23:59:59`;
      
      const { data } = await supabase
        .from('news_rss_items')
        .select('id, title, content_en, fetched_at')
        .eq('country_id', selectedCountry)
        .gte('fetched_at', startOfDay)
        .lte('fetched_at', endOfDay)
        .order('fetched_at', { ascending: true });
      
      return (data || []) as NewsItem[];
    },
    enabled: !!selectedCountry && !!selectedDate
  });

  const addLog = useCallback((type: LogEntry['type'], message: string, newsId?: string, newsTitle?: string) => {
    setLogs(prev => [...prev, {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type,
      message,
      newsId,
      newsTitle
    }]);
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const startBatchRetell = useCallback(async () => {
    if (!selectedCountry || newsForDate.length === 0) return;

    setIsRunning(true);
    setLogs([]);
    abortControllerRef.current = new AbortController();

    // Filter news based on mode
    let newsToProcess = newsForDate.filter(n => !n.content_en || n.content_en.trim().length === 0);
    
    if (retellMode === 'every2nd') {
      newsToProcess = newsToProcess.filter((_, idx) => idx % 2 === 0);
    }

    const initialStats: BatchStats = {
      total: newsToProcess.length,
      processed: 0,
      success: 0,
      failed: 0,
      skipped: newsForDate.length - newsToProcess.length
    };
    setStats(initialStats);

    const countryName = countries.find(c => c.id === selectedCountry)?.name || 'Unknown';
    addLog('info', `🚀 Запуск переказу для ${countryName} за ${format(new Date(selectedDate), 'd MMMM yyyy', { locale: uk })}`);
    addLog('info', `📊 Всього новин: ${newsForDate.length}, До переказу: ${newsToProcess.length}, Пропущено (вже переказано): ${initialStats.skipped}`);
    addLog('info', `🤖 Модель: ${AI_MODELS.find(m => m.value === selectedModel)?.label || selectedModel}`);

    for (let i = 0; i < newsToProcess.length; i++) {
      if (abortControllerRef.current?.signal.aborted) {
        addLog('warning', '⚠️ Переказ зупинено користувачем');
        break;
      }

      const news = newsToProcess[i];
      addLog('info', `[${i + 1}/${newsToProcess.length}] Переказую: ${news.title.slice(0, 60)}...`, news.id, news.title);

      try {
        const result = await callEdgeFunction<{ success: boolean; error?: string; content?: string }>(
          'retell-news',
          { newsId: news.id, model: selectedModel }
        );

        if (result.success) {
          addLog('success', `✅ Успішно переказано: ${news.title.slice(0, 50)}...`, news.id, news.title);
          setStats(prev => ({ ...prev, processed: prev.processed + 1, success: prev.success + 1 }));
        } else {
          addLog('error', `❌ Помилка: ${result.error || 'Unknown error'}`, news.id, news.title);
          setStats(prev => ({ ...prev, processed: prev.processed + 1, failed: prev.failed + 1 }));
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        addLog('error', `❌ Виняток: ${errorMessage}`, news.id, news.title);
        setStats(prev => ({ ...prev, processed: prev.processed + 1, failed: prev.failed + 1 }));
      }

      // Small delay between requests to avoid rate limiting
      if (i < newsToProcess.length - 1 && !abortControllerRef.current?.signal.aborted) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    addLog('info', `🏁 Завершено! Успішно: ${stats.success + (newsToProcess.length > 0 ? 1 : 0)}, Помилок: ${stats.failed}`);
    setIsRunning(false);
    queryClient.invalidateQueries({ queryKey: ['news-rss-items-stats'] });
  }, [selectedCountry, newsForDate, retellMode, selectedModel, countries, selectedDate, addLog, queryClient, stats.success, stats.failed]);

  const stopBatchRetell = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsRunning(false);
    addLog('warning', '⏹️ Переказ зупинено');
  }, [addLog]);

  const getLogIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'error': return <XCircle className="w-4 h-4 text-destructive" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      default: return <FileText className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const notRetoldCount = newsForDate.filter(n => !n.content_en || n.content_en.trim().length === 0).length;
  const retoldCount = newsForDate.length - notRetoldCount;

  return (
    <Card className="cosmic-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-primary" />
          Масовий переказ новин
        </CardTitle>
        <CardDescription>
          Запустіть AI переказ для новин за вибраний день та країну
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Країна
            </Label>
            <Select value={selectedCountry} onValueChange={setSelectedCountry}>
              <SelectTrigger>
                <SelectValue placeholder="Оберіть країну" />
              </SelectTrigger>
              <SelectContent>
                {countries.map(country => (
                  <SelectItem key={country.id} value={country.id}>
                    {country.flag} {country.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Дата
            </Label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={format(new Date(), 'yyyy-MM-dd')}
            />
          </div>

          <div className="space-y-2">
            <Label>Режим</Label>
            <Select value={retellMode} onValueChange={(v) => setRetellMode(v as 'all' | 'every2nd')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Всі новини</SelectItem>
                <SelectItem value="every2nd">Кожна 2-га новина</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>AI Модель</Label>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_MODELS.map(model => (
                  <SelectItem key={model.value} value={model.value}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats for selected date */}
        {selectedCountry && newsForDate.length > 0 && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    <span className="text-sm text-muted-foreground">Новин за день:</span>
                    <span className="font-bold">{newsForDate.length}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                      Переказано: {retoldCount}
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <Clock className="w-3 h-3" />
                      Не переказано: {notRetoldCount}
                    </Badge>
                  </div>
                </div>
                
                {/* Action buttons */}
                <div className="flex gap-2">
                  {!isRunning ? (
                    <Button
                      onClick={startBatchRetell}
                      disabled={notRetoldCount === 0}
                      className="gap-2"
                    >
                      <Play className="w-4 h-4" />
                      Почати переказ ({retellMode === 'every2nd' ? Math.ceil(notRetoldCount / 2) : notRetoldCount})
                    </Button>
                  ) : (
                    <Button variant="destructive" onClick={stopBatchRetell} className="gap-2">
                      <Square className="w-4 h-4" />
                      Зупинити
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {selectedCountry && newsForDate.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Новин за цю дату не знайдено</p>
          </div>
        )}

        {/* Progress */}
        {(isRunning || stats.processed > 0) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Прогрес: {stats.processed} / {stats.total}</span>
              <span className="flex items-center gap-3">
                <span className="text-green-500">✓ {stats.success}</span>
                <span className="text-destructive">✗ {stats.failed}</span>
                {stats.skipped > 0 && <span className="text-muted-foreground">⊘ {stats.skipped}</span>}
              </span>
            </div>
            <Progress value={stats.total > 0 ? (stats.processed / stats.total) * 100 : 0} />
          </div>
        )}

        {/* Logs */}
        {logs.length > 0 && (
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Лог виконання
            </Label>
            <ScrollArea className="h-64 border rounded-lg p-3 bg-muted/30">
              <div className="space-y-1 font-mono text-xs">
                {logs.map(log => (
                  <div key={log.id} className="flex items-start gap-2">
                    <span className="text-muted-foreground whitespace-nowrap">
                      {format(log.timestamp, 'HH:mm:ss')}
                    </span>
                    {getLogIcon(log.type)}
                    <span className={
                      log.type === 'error' ? 'text-destructive' :
                      log.type === 'success' ? 'text-green-500' :
                      log.type === 'warning' ? 'text-amber-500' :
                      'text-foreground'
                    }>
                      {log.message}
                    </span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export const BatchRetellPanel = memo(BatchRetellPanelComponent);
