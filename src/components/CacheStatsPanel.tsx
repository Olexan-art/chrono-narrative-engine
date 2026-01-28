import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Loader2, Database, Clock, HardDrive, Zap, Calendar, FileText, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { uk } from "date-fns/locale";

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

export function CacheStatsPanel({ password }: Props) {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSettingUpCron, setIsSettingUpCron] = useState(false);

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
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          if (response.status === 404) {
            // Function not deployed yet
            return null;
          }
          throw new Error(`HTTP ${response.status}`);
        }

        return response.json();
      } catch (error) {
        console.error('Failed to fetch cache stats:', error);
        return null;
      }
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Check if cache cron is enabled by looking at cron jobs
  const { data: cronStatus } = useQuery({
    queryKey: ['cache-cron-status'],
    queryFn: async () => {
      try {
        const { data } = await supabase.rpc('exec_sql', {
          sql: "SELECT jobname FROM cron.job WHERE jobname = 'refresh-cache-6hours' LIMIT 1"
        });
        const jobs = data as Array<{ jobname: string }> | null;
        return { enabled: jobs && jobs.length > 0 };
      } catch {
        return { enabled: false };
      }
    }
  });

  const handleRefreshCache = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/cache-pages?action=refresh-all&password=${password}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      toast.success(`Кеш оновлено: ${result.successful}/${result.total} сторінок`);
      queryClient.invalidateQueries({ queryKey: ['cache-stats'] });
    } catch (error) {
      console.error('Failed to refresh cache:', error);
      toast.error('Не вдалося оновити кеш');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleToggleCron = async (enabled: boolean) => {
    setIsSettingUpCron(true);
    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/manage-cron`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: enabled ? 'setup_cache_cron' : 'remove_cache_cron',
            password,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      toast.success(enabled ? 'Автооновлення кешу увімкнено' : 'Автооновлення вимкнено');
      queryClient.invalidateQueries({ queryKey: ['cache-cron-status'] });
    } catch (error) {
      console.error('Failed to toggle cache cron:', error);
      toast.error('Не вдалося змінити налаштування');
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Кеш HTML сторінок</h3>
        </div>
        <Button 
          onClick={handleRefreshCache} 
          variant="default" 
          size="sm" 
          disabled={isRefreshing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Оновлюється...' : 'Оновити кеш'}
        </Button>
      </div>

      {!cacheStats ? (
        <Card className="cosmic-card border-amber-500/30">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Database className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground mb-4">
                Функція кешування ще не задеплоєна або недоступна
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
                  <div className="flex items-center gap-2">
                    <Switch 
                      id="cache-cron"
                      checked={cronStatus?.enabled || false}
                      onCheckedChange={handleToggleCron}
                      disabled={isSettingUpCron}
                    />
                    <Label htmlFor="cache-cron" className="text-xs text-muted-foreground">
                      Авто (6г)
                    </Label>
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
                  Останні оновлення кешу
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-[400px] overflow-y-auto space-y-2">
                  {cacheStats.pages.slice(0, 20).map((page, i) => (
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
                        <Badge variant={new Date(page.expiresAt) > new Date() ? 'secondary' : 'destructive'} className="text-xs">
                          {new Date(page.expiresAt) > new Date() ? 'Активний' : 'Закінчився'}
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
    </div>
  );
}
