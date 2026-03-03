import { useState, useRef, useCallback, useEffect, memo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Play, Square, Loader2, CheckCircle2, XCircle,
  Calendar, Globe, RefreshCw, BarChart3, Clock,
  AlertTriangle, FileText, MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { callEdgeFunction } from "@/lib/api";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { isNewsRetold, hasNewsDialogue, getCountryConfig } from "@/lib/countryContentConfig";

const AI_MODELS = [
  { value: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash (швидкий)' },
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro (точний)' },
  { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini' },
  { value: 'GLM-4.7', label: 'Z.AI GLM-4.7 (найпотужніший)', provider: 'zai' },
  { value: 'GLM-4.7-Flash', label: 'Z.AI GLM-4.7-Flash (швидкий)', provider: 'zai' },
  { value: 'GLM-4.5-Air', label: 'Z.AI GLM-4.5-Air (легкий)', provider: 'zai' },
  { value: 'deepseek-chat', label: 'DeepSeek-V3 (швидкий)', provider: 'deepseek' },
  { value: 'deepseek-reasoner', label: 'DeepSeek-R1 (міркування)', provider: 'deepseek' },
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
  content: string | null;
  content_en: string | null;
  content_hi: string | null;
  content_ta: string | null;
  content_te: string | null;
  content_bn: string | null;
  chat_dialogue: unknown;
  fetched_at: string;
  country_id: string;
  [key: string]: unknown; // Allow indexing for config functions
}

type TabMode = 'retell' | 'dialogue';

function BatchRetellPanelComponent() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabMode>('retell');
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedModel, setSelectedModel] = useState<string>(AI_MODELS[0].value);
  const [retellMode, setRetellMode] = useState<'all' | 'every2nd'>('all');
  const [maxCount, setMaxCount] = useState<number>(0); // 0 means unlimited
  const [generateDialogues, setGenerateDialogues] = useState(false);
  const [onlyWithoutRetell, setOnlyWithoutRetell] = useState(true); // Default: only news without retell
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<BatchStats>({ total: 0, processed: 0, success: 0, failed: 0, skipped: 0 });
  const [startTime, setStartTime] = useState<number | null>(null);
  const [avgTimePerItem, setAvgTimePerItem] = useState<number>(0);
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
        .select('id, title, content, content_en, content_hi, content_ta, content_te, content_bn, chat_dialogue, fetched_at, country_id')
        .eq('country_id', selectedCountry)
        .gte('fetched_at', startOfDay)
        .lte('fetched_at', endOfDay)
        .order('fetched_at', { ascending: true });

      return (data || []) as NewsItem[];
    },
    enabled: !!selectedCountry && !!selectedDate
  });

  // Get country code for config lookup
  const selectedCountryCode = countries.find(c => c.id === selectedCountry)?.code || '';

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
    setStartTime(Date.now());
    setAvgTimePerItem(0);
    abortControllerRef.current = new AbortController();

    // Filter news based on mode - use config for proper field checking
    let newsToProcess = onlyWithoutRetell
      ? newsForDate.filter(n => !isNewsRetold(n, selectedCountryCode))
      : [...newsForDate]; // All news (including already retold for re-processing)

    if (retellMode === 'every2nd') {
      newsToProcess = newsToProcess.filter((_, idx) => idx % 2 === 0);
    }

    // Apply max count limit
    if (maxCount > 0 && newsToProcess.length > maxCount) {
      newsToProcess = newsToProcess.slice(0, maxCount);
    }

    const initialStats: BatchStats = {
      total: newsToProcess.length * (generateDialogues ? 2 : 1), // Double if generating dialogues
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
    if (generateDialogues) {
      addLog('info', `💬 Генерація діалогів: увімкнено`);
    }

    for (let i = 0; i < newsToProcess.length; i++) {
      if (abortControllerRef.current?.signal.aborted) {
        addLog('warning', '⚠️ Переказ зупинено користувачем');
        break;
      }

      const news = newsToProcess[i];

      // Step 1: Retell
      addLog('info', `[${i + 1}/${newsToProcess.length}] Переказую: ${news.title.slice(0, 60)}...`, news.id, news.title);

      try {
        const result = await callEdgeFunction<{ success: boolean; error?: string; content?: string }>(
          'retell-news',
          { newsId: news.id, model: selectedModel }
        );

        if (result.success) {
          addLog('success', `✅ Успішно переказано: ${news.title.slice(0, 50)}...`, news.id, news.title);
          setStats(prev => {
            const newProcessed = prev.processed + 1;
            const newSuccess = prev.success + 1;
            // Update average time per item
            if (startTime) {
              const elapsed = Date.now() - startTime;
              setAvgTimePerItem(elapsed / newProcessed);
            }
            // Refresh retold news list every 5 successful retells
            if (newSuccess % 5 === 0) {
              queryClient.invalidateQueries({ queryKey: ['recent-retold-news'] });
            }
            return { ...prev, processed: newProcessed, success: newSuccess };
          });

          // Step 2: Generate dialogue if enabled
          if (generateDialogues && !abortControllerRef.current?.signal.aborted) {
            addLog('info', `💬 Генерую діалог для: ${news.title.slice(0, 50)}...`, news.id, news.title);
            try {
              const dialogueResult = await callEdgeFunction<{ success: boolean; error?: string; dialogue?: Record<string, unknown>[] }>(
                'generate-dialogue',
                { newsId: news.id, model: selectedModel }
              );

              if (dialogueResult.success && dialogueResult.dialogue) {
                await supabase
                  .from('news_rss_items')
                  .update({ chat_dialogue: JSON.parse(JSON.stringify(dialogueResult.dialogue)) })
                  .eq('id', news.id);
                addLog('success', `💬 Діалог створено: ${news.title.slice(0, 50)}...`, news.id, news.title);
                setStats(prev => {
                  const newProcessed = prev.processed + 1;
                  if (startTime) {
                    const elapsed = Date.now() - startTime;
                    setAvgTimePerItem(elapsed / newProcessed);
                  }
                  return { ...prev, processed: newProcessed, success: prev.success + 1 };
                });
              } else {
                addLog('error', `💬 Помилка діалогу: ${dialogueResult.error || 'Unknown'}`, news.id, news.title);
                setStats(prev => {
                  const newProcessed = prev.processed + 1;
                  if (startTime) {
                    const elapsed = Date.now() - startTime;
                    setAvgTimePerItem(elapsed / newProcessed);
                  }
                  return { ...prev, processed: newProcessed, failed: prev.failed + 1 };
                });
              }
            } catch (dialogueError) {
              const errorMsg = dialogueError instanceof Error ? dialogueError.message : 'Unknown error';
              addLog('error', `💬 Виняток діалогу: ${errorMsg}`, news.id, news.title);
              setStats(prev => {
                const newProcessed = prev.processed + 1;
                if (startTime) {
                  const elapsed = Date.now() - startTime;
                  setAvgTimePerItem(elapsed / newProcessed);
                }
                return { ...prev, processed: newProcessed, failed: prev.failed + 1 };
              });
            }
          }
        } else {
          addLog('error', `❌ Помилка: ${result.error || 'Unknown error'}`, news.id, news.title);
          setStats(prev => {
            const newProcessed = prev.processed + 1;
            if (startTime) {
              const elapsed = Date.now() - startTime;
              setAvgTimePerItem(elapsed / newProcessed);
            }
            return { ...prev, processed: newProcessed, failed: prev.failed + 1 };
          });
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

    addLog('info', `🏁 Завершено! Успішно: ${stats.success}, Помилок: ${stats.failed}`);
    setIsRunning(false);
    // Invalidate all related queries to refresh stats everywhere
    queryClient.invalidateQueries({ queryKey: ['news-rss-items-stats'] });
    queryClient.invalidateQueries({ queryKey: ['news-for-date'] });
    queryClient.invalidateQueries({ queryKey: ['latest-usa-retold-news'] });
    queryClient.invalidateQueries({ queryKey: ['country-news'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    queryClient.invalidateQueries({ queryKey: ['recent-retold-news'] });
  }, [selectedCountry, newsForDate, retellMode, selectedModel, countries, selectedDate, addLog, queryClient, maxCount, generateDialogues, selectedCountryCode, onlyWithoutRetell]);

  // Batch dialogue generation only
  const startBatchDialogue = useCallback(async () => {
    if (!selectedCountry || newsForDate.length === 0) return;

    setIsRunning(true);
    setLogs([]);
    setStartTime(Date.now());
    setAvgTimePerItem(0);
    abortControllerRef.current = new AbortController();

    // Filter news that are retold but don't have dialogues
    let newsToProcess = newsForDate.filter(n =>
      isNewsRetold(n, selectedCountryCode) && !hasNewsDialogue(n)
    );

    if (retellMode === 'every2nd') {
      newsToProcess = newsToProcess.filter((_, idx) => idx % 2 === 0);
    }

    // Apply max count limit
    if (maxCount > 0 && newsToProcess.length > maxCount) {
      newsToProcess = newsToProcess.slice(0, maxCount);
    }

    const alreadyHasDialogue = newsForDate.filter(n => hasNewsDialogue(n)).length;
    const notRetold = newsForDate.filter(n => !isNewsRetold(n, selectedCountryCode)).length;

    const initialStats: BatchStats = {
      total: newsToProcess.length,
      processed: 0,
      success: 0,
      failed: 0,
      skipped: alreadyHasDialogue + notRetold
    };
    setStats(initialStats);

    const countryName = countries.find(c => c.id === selectedCountry)?.name || 'Unknown';
    addLog('info', `💬 Запуск генерації діалогів для ${countryName} за ${format(new Date(selectedDate), 'd MMMM yyyy', { locale: uk })}`);
    addLog('info', `📊 Всього новин: ${newsForDate.length}, До генерації: ${newsToProcess.length}`);
    addLog('info', `⊘ Пропущено: ${alreadyHasDialogue} (вже є діалоги) + ${notRetold} (не переказано)`);
    addLog('info', `🤖 Модель: ${AI_MODELS.find(m => m.value === selectedModel)?.label || selectedModel}`);

    for (let i = 0; i < newsToProcess.length; i++) {
      if (abortControllerRef.current?.signal.aborted) {
        addLog('warning', '⚠️ Генерацію зупинено користувачем');
        break;
      }

      const news = newsToProcess[i];
      addLog('info', `[${i + 1}/${newsToProcess.length}] 💬 Генерую діалог: ${news.title.slice(0, 60)}...`, news.id, news.title);

      try {
        const result = await callEdgeFunction<{ success: boolean; error?: string; dialogue?: Record<string, unknown>[] }>(
          'generate-dialogue',
          { newsId: news.id, model: selectedModel }
        );

        if (result.success && result.dialogue) {
          await supabase
            .from('news_rss_items')
            .update({ chat_dialogue: JSON.parse(JSON.stringify(result.dialogue)) })
            .eq('id', news.id);
          addLog('success', `✅ Діалог створено: ${news.title.slice(0, 50)}...`, news.id, news.title);
          setStats(prev => {
            const newProcessed = prev.processed + 1;
            if (startTime) {
              const elapsed = Date.now() - startTime;
              setAvgTimePerItem(elapsed / newProcessed);
            }
            return { ...prev, processed: newProcessed, success: prev.success + 1 };
          });
        } else {
          addLog('error', `❌ Помилка: ${result.error || 'Unknown error'}`, news.id, news.title);
          setStats(prev => {
            const newProcessed = prev.processed + 1;
            if (startTime) {
              const elapsed = Date.now() - startTime;
              setAvgTimePerItem(elapsed / newProcessed);
            }
            return { ...prev, processed: newProcessed, failed: prev.failed + 1 };
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        addLog('error', `❌ Виняток: ${errorMessage}`, news.id, news.title);
        setStats(prev => {
          const newProcessed = prev.processed + 1;
          if (startTime) {
            const elapsed = Date.now() - startTime;
            setAvgTimePerItem(elapsed / newProcessed);
          }
          return { ...prev, processed: newProcessed, failed: prev.failed + 1 };
        });
      }

      // Small delay between requests to avoid rate limiting
      if (i < newsToProcess.length - 1 && !abortControllerRef.current?.signal.aborted) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    addLog('info', `🏁 Завершено! Успішно: ${stats.success}, Помилок: ${stats.failed}`);
    setIsRunning(false);
    // Invalidate all related queries to refresh stats everywhere
    queryClient.invalidateQueries({ queryKey: ['news-rss-items-stats'] });
    queryClient.invalidateQueries({ queryKey: ['news-for-date'] });
    queryClient.invalidateQueries({ queryKey: ['country-news'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    queryClient.invalidateQueries({ queryKey: ['recent-retold-news'] });
  }, [selectedCountry, newsForDate, retellMode, selectedModel, countries, selectedDate, addLog, queryClient, maxCount, selectedCountryCode]);

  const stopBatchRetell = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsRunning(false);
    addLog('warning', '⏹️ Переказ зупинено');
  }, [addLog]);

  // Format duration from milliseconds to human readable
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}г ${minutes % 60}хв`;
    } else if (minutes > 0) {
      return `${minutes}хв ${seconds % 60}с`;
    } else {
      return `${seconds}с`;
    }
  };

  const getLogIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'error': return <XCircle className="w-4 h-4 text-destructive" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      default: return <FileText className="w-4 h-4 text-muted-foreground" />;
    }
  };

  // Use proper config-based counting
  const notRetoldCount = newsForDate.filter(n => !isNewsRetold(n, selectedCountryCode)).length;
  const retoldCount = newsForDate.filter(n => isNewsRetold(n, selectedCountryCode)).length;
  const dialogueCount = newsForDate.filter(n => hasNewsDialogue(n)).length;
  const retoldNoDialogue = newsForDate.filter(n =>
    isNewsRetold(n, selectedCountryCode) && !hasNewsDialogue(n)
  ).length;

  // Calculate actual count to process for retell
  const getRetellProcessCount = () => {
    // If onlyWithoutRetell is off, count all news; otherwise only not retold
    const baseCount = onlyWithoutRetell ? notRetoldCount : newsForDate.length;
    let count = retellMode === 'every2nd' ? Math.ceil(baseCount / 2) : baseCount;
    if (maxCount > 0 && count > maxCount) {
      count = maxCount;
    }
    return count;
  };
  const retellProcessCount = getRetellProcessCount();

  // Calculate actual count to process for dialogue
  const getDialogueProcessCount = () => {
    let count = retellMode === 'every2nd' ? Math.ceil(retoldNoDialogue / 2) : retoldNoDialogue;
    if (maxCount > 0 && count > maxCount) {
      count = maxCount;
    }
    return count;
  };
  const dialogueProcessCount = getDialogueProcessCount();

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
            <Label>Кількість</Label>
            <Select value={maxCount.toString()} onValueChange={(v) => setMaxCount(parseInt(v, 10))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Без ліміту</SelectItem>
                <SelectItem value="5">5 новин</SelectItem>
                <SelectItem value="10">10 новин</SelectItem>
                <SelectItem value="20">20 новин</SelectItem>
                <SelectItem value="50">50 новин</SelectItem>
                <SelectItem value="100">100 новин</SelectItem>
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
              <div className="flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Новин за день:</span>
                  <span className="font-bold">{newsForDate.length}</span>
                </div>
                <div className="flex items-center gap-3 text-sm flex-wrap">
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                    Переказано: {retoldCount}
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Clock className="w-3 h-3" />
                    Не переказано: {notRetoldCount}
                  </Badge>
                  <Badge variant="secondary" className="gap-1">
                    <MessageSquare className="w-3 h-3 text-blue-500" />
                    Діалоги: {dialogueCount}
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <MessageSquare className="w-3 h-3" />
                    Без діалогів: {retoldNoDialogue}
                  </Badge>
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

        {/* Tabs for Retell vs Dialogue */}
        {selectedCountry && newsForDate.length > 0 && (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabMode)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="retell" className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Масовий переказ
              </TabsTrigger>
              <TabsTrigger value="dialogue" className="gap-2">
                <MessageSquare className="w-4 h-4" />
                Масова генерація діалогів
              </TabsTrigger>
            </TabsList>

            <TabsContent value="retell" className="space-y-4 mt-4">
              {/* Toggle: only without retell */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="onlyWithoutRetell"
                    checked={onlyWithoutRetell}
                    onCheckedChange={(checked) => setOnlyWithoutRetell(checked === true)}
                    disabled={isRunning}
                  />
                  <Label htmlFor="onlyWithoutRetell" className="text-sm cursor-pointer">
                    🔄 Тільки новини без переказу
                  </Label>
                </div>

                {/* Checkbox for generating dialogues */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="generateDialogues"
                    checked={generateDialogues}
                    onCheckedChange={(checked) => setGenerateDialogues(checked === true)}
                    disabled={isRunning}
                  />
                  <Label htmlFor="generateDialogues" className="text-sm cursor-pointer">
                    💬 Генерувати діалоги після переказу
                  </Label>
                </div>
              </div>

              {/* Hint about what will be processed */}
              <Card className="border-muted bg-muted/30">
                <CardContent className="py-3 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="text-lg">💡</span>
                    <div className="space-y-1">
                      <p className="font-medium">
                        {onlyWithoutRetell
                          ? `Буде оброблено: ${retellProcessCount} новин без переказу`
                          : `Буде оброблено: ${retellProcessCount} новин (включно з уже переказаними — буде оновлено)`
                        }
                      </p>
                      <p className="text-muted-foreground">
                        {onlyWithoutRetell
                          ? `Пропущено: ${retoldCount} вже переказаних`
                          : `⚠️ Увага: переказ буде перезаписано для всіх вибраних новин!`
                        }
                        {retellMode === 'every2nd' && ' • Режим: кожна 2-га новина'}
                        {maxCount > 0 && ` • Ліміт: ${maxCount}`}
                        {generateDialogues && ' • + діалоги'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Action buttons for retell */}
              <div className="flex gap-2">
                {!isRunning ? (
                  <Button
                    onClick={startBatchRetell}
                    disabled={retellProcessCount === 0}
                    className="gap-2"
                  >
                    <Play className="w-4 h-4" />
                    {onlyWithoutRetell ? 'Почати переказ' : 'Оновити переказ'} ({retellProcessCount})
                    {generateDialogues && " + діалоги"}
                  </Button>
                ) : (
                  <Button variant="destructive" onClick={stopBatchRetell} className="gap-2">
                    <Square className="w-4 h-4" />
                    Зупинити
                  </Button>
                )}
              </div>

              {retellProcessCount === 0 && onlyWithoutRetell && (
                <p className="text-sm text-muted-foreground">
                  ✅ Всі новини за цю дату вже переказані
                </p>
              )}
            </TabsContent>

            <TabsContent value="dialogue" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">
                Генерація діалогів для новин, які вже переказані, але ще не мають діалогів.
              </p>

              {/* Action buttons for dialogue */}
              <div className="flex gap-2">
                {!isRunning ? (
                  <Button
                    onClick={startBatchDialogue}
                    disabled={retoldNoDialogue === 0}
                    className="gap-2"
                  >
                    <Play className="w-4 h-4" />
                    <MessageSquare className="w-4 h-4" />
                    Генерувати діалоги ({dialogueProcessCount})
                  </Button>
                ) : (
                  <Button variant="destructive" onClick={stopBatchRetell} className="gap-2">
                    <Square className="w-4 h-4" />
                    Зупинити
                  </Button>
                )}
              </div>

              {retoldNoDialogue === 0 && retoldCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  ✅ Всі переказані новини вже мають діалоги
                </p>
              )}
              {retoldCount === 0 && (
                <p className="text-sm text-muted-foreground">
                  ⚠️ Спочатку потрібно переказати новини
                </p>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Progress */}
        {(isRunning || stats.processed > 0) && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>Прогрес: {stats.processed} / {stats.total}</span>
              <span className="flex items-center gap-3">
                <span className="text-green-500">✓ {stats.success}</span>
                <span className="text-destructive">✗ {stats.failed}</span>
                {stats.skipped > 0 && <span className="text-muted-foreground">⊘ {stats.skipped}</span>}
              </span>
            </div>
            <Progress value={stats.total > 0 ? (stats.processed / stats.total) * 100 : 0} />

            {/* Time estimation */}
            {isRunning && stats.processed > 0 && avgTimePerItem > 0 && (
              <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Середній час: {Math.round(avgTimePerItem / 1000)}с / елемент
                  </span>
                  <span>
                    Пройшло: {formatDuration(Date.now() - (startTime || Date.now()))}
                  </span>
                </div>
                <span className="font-medium text-primary">
                  ⏱ Залишилось: ~{formatDuration((stats.total - stats.processed) * avgTimePerItem)}
                </span>
              </div>
            )}

            {!isRunning && stats.processed > 0 && startTime && (
              <div className="text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
                ✅ Виконано за {formatDuration(Date.now() - startTime)}
              </div>
            )}
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
