import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Loader2, Database, Clock, HardDrive, Zap, Calendar, FileText, Settings2, CheckCircle2, XCircle, AlertCircle, Newspaper, Timer, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Props {
  password: string;
}

interface CacheStats {
  action: string;
  totalPages: number;
  totalSizeBytes: number;
  totalSizeMB: string;
  avgGenerationTimeMs: number;
  pages?: Array<{
    path: string;
    title: string | null;
    updatedAt: string;
    expiresAt: string;
    sizeKB: string;
  }>;
}

interface CacheRefreshLog {
  path: string;
  success: boolean;
  timeMs?: number;
  error?: string;
  timestamp: Date;
  isHeader?: boolean;
}

type RefreshAction = 'refresh-all' | 'refresh-recent' | 'refresh-news';

export function CacheStatsPanel({ password }: Props) {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentAction, setCurrentAction] = useState<RefreshAction | null>(null);
  const [isSettingUpCron, setIsSettingUpCron] = useState(false);
  const [refreshLogs, setRefreshLogs] = useState<CacheRefreshLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [refreshStats, setRefreshStats] = useState<{ total: number; successful: number; failed: number } | null>(null);
  const [currentProgress, setCurrentProgress] = useState(0);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs to bottom with smooth animation
  useEffect(() => {
    if (logsContainerRef.current && showLogs) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [refreshLogs, showLogs]);

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

  // Fetch cache stats
  const { data: cacheStats, isLoading } = useQuery<CacheStats | null>({
    queryKey: ['cache-stats'],
    queryFn: async () => {
      try {
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/cache-pages?action=stats&password=${password}`,
          {
            method: 'GET',
          }
        );

        if (!response.ok) {
          if (response.status === 404) return null;
          throw new Error(`HTTP ${response.status}`);
        }

        return response.json();
      } catch (error) {
        console.error('Failed to fetch cache stats:', error);
        return null;
      }
    },
    refetchInterval: 60000,
  });

  // Check cache cron status with frequency
  const { data: cronStatus } = useQuery({
    queryKey: ['cache-cron-status'],
    queryFn: async () => {
      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/manage-cron`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_cache_cron_status', password }),
        });
        
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.error || data?.message || `HTTP ${response.status}`);
        }
        return data;
      } catch {
        return { enabled: false, frequency: '6hours' };
      }
    }
  });

  const handleRefreshCache = async (action: RefreshAction) => {
    setIsRefreshing(true);
    setCurrentAction(action);
    setRefreshLogs([]);
    setRefreshStats(null);
    setShowLogs(true);
    setCurrentProgress(0);
    
    const actionLabels: Record<RefreshAction, string> = {
      'refresh-all': '🔄 Повне оновлення всіх сторінок (батчами)...',
      'refresh-recent': '⏰ Оновлення сторінок за 24 години...',
      'refresh-news': '📰 Оновлення новин за 7 днів...',
    };
    
    try {
      setRefreshLogs([{ 
        path: actionLabels[action], 
        success: true, 
        timestamp: new Date(),
        isHeader: true,
      }]);

      // First, get info about total pages
      const infoResponse = await fetch(
        `${SUPABASE_URL}/functions/v1/cache-pages?action=${action}&password=${password}&info=true`,
        { method: 'GET' }
      );
      
      if (!infoResponse.ok) throw new Error(`HTTP ${infoResponse.status}`);
      const info = await infoResponse.json();
      
      const totalPages = info.totalPages || 0;
      const batchSize = 50; // Process 50 pages per batch
      let offset = 0;
      let totalSuccessful = 0;
      let totalFailed = 0;
      const allResults: { path: string; success: boolean; timeMs?: number; error?: string }[] = [];

      setRefreshLogs(prev => [...prev, { 
        path: `📊 Знайдено ${totalPages} сторінок. Обробка батчами по ${batchSize}...`, 
        success: true, 
        timestamp: new Date(),
        isHeader: true,
      }]);

      // Process in batches
      while (offset < totalPages) {
        const batchNum = Math.floor(offset / batchSize) + 1;
        const totalBatches = Math.ceil(totalPages / batchSize);
        
        setRefreshLogs(prev => [...prev, { 
          path: `🔄 Батч ${batchNum}/${totalBatches} (${offset}-${Math.min(offset + batchSize, totalPages)})...`, 
          success: true, 
          timestamp: new Date(),
          isHeader: true,
        }]);

        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/cache-pages?action=${action}&password=${password}&batchSize=${batchSize}&offset=${offset}`,
          { method: 'GET' }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Batch ${batchNum} failed: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        
        // Process results
        if (result.results && Array.isArray(result.results)) {
          const logs: CacheRefreshLog[] = result.results.map((r: { path: string; success: boolean; timeMs?: number; error?: string }) => ({
            path: r.path,
            success: r.success,
            timeMs: r.timeMs,
            error: r.error,
            timestamp: new Date(),
          }));
          
          setRefreshLogs(prev => [...prev, ...logs]);
          allResults.push(...result.results);
        }

        totalSuccessful += result.successful || 0;
        totalFailed += result.failed || 0;
        offset += batchSize;

        // Update progress
        setCurrentProgress(Math.min(100, Math.round((offset / totalPages) * 100)));
        
        // Small delay between batches to avoid overwhelming the server
        if (result.hasMore) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      setRefreshStats({
        total: totalPages,
        successful: totalSuccessful,
        failed: totalFailed,
      });

      setCurrentProgress(100);
      toast.success(`Кеш оновлено: ${totalSuccessful}/${totalPages} сторінок`);
      queryClient.invalidateQueries({ queryKey: ['cache-stats'] });
    } catch (error) {
      console.error('Failed to refresh cache:', error);
      setRefreshLogs(prev => [...prev, { 
        path: `❌ Помилка: ${error instanceof Error ? error.message : 'Невідома помилка'}`, 
        success: false, 
        timestamp: new Date() 
      }]);
      toast.error('Не вдалося оновити кеш');
    } finally {
      setIsRefreshing(false);
      setCurrentAction(null);
    }
  };

  const handleSetCronFrequency = async (frequency: string) => {
    if (frequency === 'off') {
      await handleRemoveCron();
      return;
    }
    
    setIsSettingUpCron(true);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/manage-cron`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'setup_cache_cron',
          password,
          data: { frequency },
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || data?.message || `HTTP ${response.status}`);

      const labels: Record<string, string> = {
        '1hour': '1 годину',
        '3hours': '3 години',
        '6hours': '6 годин',
        '12hours': '12 годин',
        '24hours': '24 години',
      };
      
      toast.success(`Автооновлення: кожні ${labels[frequency]}`);
      queryClient.invalidateQueries({ queryKey: ['cache-cron-status'] });
    } catch (error) {
      console.error('Failed to set cache cron:', error);
      toast.error(`Не вдалося налаштувати автооновлення: ${error instanceof Error ? error.message : 'помилка'}`);
    } finally {
      setIsSettingUpCron(false);
    }
  };

  const handleRemoveCron = async () => {
    setIsSettingUpCron(true);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/manage-cron`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_cache_cron', password }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || data?.message || `HTTP ${response.status}`);

      toast.success('Автооновлення вимкнено');
      queryClient.invalidateQueries({ queryKey: ['cache-cron-status'] });
    } catch (error) {
      console.error('Failed to remove cache cron:', error);
      toast.error(`Не вдалося вимкнути автооновлення: ${error instanceof Error ? error.message : 'помилка'}`);
    } finally {
      setIsSettingUpCron(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Кеш HTML сторінок</h3>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Main refresh button with dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="default" 
                size="sm" 
                disabled={isRefreshing}
                className="min-w-[140px]"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Оновлюється...' : 'Оновити кеш'}
                <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem 
                onClick={() => handleRefreshCache('refresh-all')}
                disabled={isRefreshing}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Все повністю
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleRefreshCache('refresh-recent')}
                disabled={isRefreshing}
              >
                <Timer className="w-4 h-4 mr-2" />
                За 24 години
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleRefreshCache('refresh-news')}
                disabled={isRefreshing}
              >
                <Newspaper className="w-4 h-4 mr-2" />
                Новини (7 днів)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Real-time Refresh Logs */}
      {showLogs && (
        <Card className="cosmic-card border-primary/30 overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                {isRefreshing && (
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                  </span>
                )}
                <Database className="w-4 h-4" />
                Лог оновлення
              </CardTitle>
              <div className="flex items-center gap-4">
                {isRefreshing && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-300 ease-out"
                        style={{ width: `${currentProgress}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums">{currentProgress}%</span>
                  </div>
                )}
                {refreshStats && (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="flex items-center gap-1 text-green-500">
                      <CheckCircle2 className="w-4 h-4" />
                      {refreshStats.successful}
                    </span>
                    {refreshStats.failed > 0 && (
                      <span className="flex items-center gap-1 text-destructive">
                        <XCircle className="w-4 h-4" />
                        {refreshStats.failed}
                      </span>
                    )}
                    <span className="text-muted-foreground">/ {refreshStats.total}</span>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div 
              ref={logsContainerRef}
              className="max-h-[350px] overflow-y-auto space-y-0.5 font-mono text-xs bg-background/50 rounded-lg p-3 border border-border/30"
            >
              {refreshLogs.map((log, i) => (
                <div 
                  key={i} 
                  className={`flex items-start gap-2 py-1 px-2 rounded transition-all duration-300 ${
                    log.isHeader 
                      ? 'bg-primary/10 text-primary font-medium' 
                      : log.success 
                        ? 'hover:bg-muted/30' 
                        : 'bg-destructive/10 text-destructive'
                  }`}
                  style={{
                    animation: 'fadeSlideIn 0.3s ease-out forwards',
                    animationDelay: `${Math.min(i * 20, 500)}ms`,
                    opacity: 0,
                  }}
                >
                  {log.isHeader ? (
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  ) : log.success ? (
                    <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 mt-0.5 text-destructive shrink-0" />
                  )}
                  <span className="flex-1 break-all">
                    {log.path}
                    {log.timeMs && (
                      <span className="text-muted-foreground ml-2 tabular-nums">
                        ({log.timeMs}ms)
                      </span>
                    )}
                    {log.error && (
                      <span className="text-destructive ml-2">— {log.error}</span>
                    )}
                  </span>
                </div>
              ))}
              {isRefreshing && refreshLogs.length <= 1 && (
                <div className="flex items-center gap-2 py-2 text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Завантаження списку сторінок...</span>
                </div>
              )}
              <div ref={logsEndRef} />
            </div>
            {!isRefreshing && refreshStats && (
              <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  ✓ Оновлено {refreshStats.successful} з {refreshStats.total} сторінок
                  {refreshStats.failed > 0 && (
                    <span className="text-destructive"> ({refreshStats.failed} помилок)</span>
                  )}
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowLogs(false)}
                  className="text-xs"
                >
                  Сховати
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!cacheStats ? (
        <Card className="cosmic-card border-amber-500/30">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Database className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground mb-4">
                Функція кешування ще не задеплоєна
              </p>
              <p className="text-sm text-muted-foreground">
                Опублікуйте проєкт щоб активувати кешування
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Main Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="cosmic-card">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">{cacheStats.totalPages}</p>
                    <p className="text-xs text-muted-foreground">Сторінок</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="cosmic-card">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-3">
                  <HardDrive className="w-5 h-5 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold">{cacheStats.totalSizeMB}</p>
                    <p className="text-xs text-muted-foreground">МБ</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="cosmic-card">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-3">
                  <Zap className="w-5 h-5 text-amber-500" />
                  <div>
                    <p className="text-2xl font-bold">{cacheStats.avgGenerationTimeMs}</p>
                    <p className="text-xs text-muted-foreground">мс (серед.)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="cosmic-card">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-3">
                  <Settings2 className="w-5 h-5 text-purple-500" />
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground mb-1 block">Авто</Label>
                    <Select
                      value={cronStatus?.enabled ? cronStatus.frequency : 'off'}
                      onValueChange={handleSetCronFrequency}
                      disabled={isSettingUpCron}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Вимкнено" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="off">Вимкнено</SelectItem>
                        <SelectItem value="6hours">6 годин</SelectItem>
                        <SelectItem value="12hours">12 годин</SelectItem>
                        <SelectItem value="24hours">24 години</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pages List */}
          {cacheStats.pages && cacheStats.pages.length > 0 && (
            <Card className="cosmic-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Закешовані сторінки
                </CardTitle>
                <CardDescription>
                  Останні {Math.min(cacheStats.pages.length, 30)} з {cacheStats.totalPages} сторінок
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-[400px] overflow-y-auto space-y-2">
                  {cacheStats.pages.slice(0, 30).map((page, i) => (
                    <div 
                      key={i} 
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{page.title || page.path}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">{page.path}</p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground ml-4">
                        <div className="flex items-center gap-1">
                          <HardDrive className="w-3 h-3" />
                          {page.sizeKB} KB
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(page.updatedAt), 'd MMM HH:mm', { locale: uk })}
                        </div>
                        <Badge 
                          variant={new Date(page.expiresAt) > new Date() ? 'secondary' : 'destructive'} 
                          className="text-xs"
                        >
                          {new Date(page.expiresAt) > new Date() ? 'Активний' : 'Прострочено'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* CSS for animations */}
      <style>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
