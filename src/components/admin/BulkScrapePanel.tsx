import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, RefreshCw, Loader2, CheckCircle2, XCircle, Settings, Play, Pause, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { callEdgeFunction } from "@/lib/api";

interface Props {
  password: string;
}

interface ScrapeProgress {
  isRunning: boolean;
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  currentUrl?: string;
}

export function BulkScrapePanel({ password }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [progress, setProgress] = useState<ScrapeProgress>({
    isRunning: false,
    total: 0,
    processed: 0,
    succeeded: 0,
    failed: 0
  });
  
  const [settings, setSettings] = useState({
    batchSize: 10,
    delayMs: 500,
    autoScrapeOnImport: true
  });
  
  const [filters, setFilters] = useState({
    countryId: 'all',
    dateFrom: '',
    dateTo: '',
    limit: 500
  });
  
  const [shouldStop, setShouldStop] = useState(false);

  // Fetch countries for filter
  const { data: countries } = useQuery({
    queryKey: ['countries-for-scrape'],
    queryFn: async () => {
      const { data } = await supabase
        .from('news_countries')
        .select('id, name, code, flag')
        .eq('is_active', true)
        .order('sort_order');
      return data || [];
    }
  });

  // Count news without original_content with filters
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['bulk-scrape-stats', filters],
    queryFn: async () => {
      // Base query for total
      let totalQuery = supabase
        .from('news_rss_items')
        .select('*', { count: 'exact', head: true })
        .eq('is_archived', false);
      
      // Base query for with content
      let withContentQuery = supabase
        .from('news_rss_items')
        .select('*', { count: 'exact', head: true })
        .eq('is_archived', false)
        .not('original_content', 'is', null)
        .gt('original_content', '');
      
      // Base query for without content
      let withoutContentQuery = supabase
        .from('news_rss_items')
        .select('*', { count: 'exact', head: true })
        .eq('is_archived', false)
        .or('original_content.is.null,original_content.eq.');
      
      // Apply filters
      if (filters.countryId && filters.countryId !== 'all') {
        totalQuery = totalQuery.eq('country_id', filters.countryId);
        withContentQuery = withContentQuery.eq('country_id', filters.countryId);
        withoutContentQuery = withoutContentQuery.eq('country_id', filters.countryId);
      }
      
      if (filters.dateFrom) {
        const dateFrom = new Date(filters.dateFrom).toISOString();
        totalQuery = totalQuery.gte('published_at', dateFrom);
        withContentQuery = withContentQuery.gte('published_at', dateFrom);
        withoutContentQuery = withoutContentQuery.gte('published_at', dateFrom);
      }
      
      if (filters.dateTo) {
        const dateTo = new Date(filters.dateTo + 'T23:59:59').toISOString();
        totalQuery = totalQuery.lte('published_at', dateTo);
        withContentQuery = withContentQuery.lte('published_at', dateTo);
        withoutContentQuery = withoutContentQuery.lte('published_at', dateTo);
      }
      
      const [{ count: totalCount }, { count: withContent }, { count: withoutContent }] = await Promise.all([
        totalQuery,
        withContentQuery,
        withoutContentQuery
      ]);
      
      return {
        total: totalCount || 0,
        withContent: withContent || 0,
        withoutContent: withoutContent || 0
      };
    }
  });

  // Bulk scrape mutation
  const bulkScrapeMutation = useMutation({
    mutationFn: async () => {
      setShouldStop(false);
      
      // Build query with filters
      let query = supabase
        .from('news_rss_items')
        .select('id, url, title')
        .eq('is_archived', false)
        .or('original_content.is.null,original_content.eq.')
        .order('published_at', { ascending: false })
        .limit(filters.limit);
      
      if (filters.countryId && filters.countryId !== 'all') {
        query = query.eq('country_id', filters.countryId);
      }
      
      if (filters.dateFrom) {
        query = query.gte('published_at', new Date(filters.dateFrom).toISOString());
      }
      
      if (filters.dateTo) {
        query = query.lte('published_at', new Date(filters.dateTo + 'T23:59:59').toISOString());
      }
      
      const { data: newsItems, error } = await query;
      
      if (error) throw error;
      if (!newsItems || newsItems.length === 0) {
        return { succeeded: 0, failed: 0 };
      }
      
      setProgress({
        isRunning: true,
        total: newsItems.length,
        processed: 0,
        succeeded: 0,
        failed: 0
      });
      
      let succeeded = 0;
      let failed = 0;
      
      // Process in batches
      for (let i = 0; i < newsItems.length; i += settings.batchSize) {
        if (shouldStop) break;
        
        const batch = newsItems.slice(i, i + settings.batchSize);
        
        // Process batch in parallel
        const results = await Promise.allSettled(
          batch.map(async (item) => {
            try {
              setProgress(prev => ({ ...prev, currentUrl: item.url }));
              
              const result = await callEdgeFunction<{ success: boolean; data?: { content: string } }>(
                'scrape-news',
                { url: item.url }
              );
              
              if (result.success && result.data?.content && result.data.content.length > 100) {
                // Update the news item with scraped content
                await supabase
                  .from('news_rss_items')
                  .update({ original_content: result.data.content.slice(0, 10000) })
                  .eq('id', item.id);
                
                return { success: true };
              }
              return { success: false };
            } catch {
              return { success: false };
            }
          })
        );
        
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value.success) {
            succeeded++;
          } else {
            failed++;
          }
        }
        
        setProgress(prev => ({
          ...prev,
          processed: Math.min(i + settings.batchSize, newsItems.length),
          succeeded,
          failed
        }));
        
        // Delay between batches
        if (i + settings.batchSize < newsItems.length && !shouldStop) {
          await new Promise(r => setTimeout(r, settings.delayMs));
        }
      }
      
      return { succeeded, failed };
    },
    onSuccess: (result) => {
      setProgress(prev => ({ ...prev, isRunning: false, currentUrl: undefined }));
      refetchStats();
      queryClient.invalidateQueries({ queryKey: ['news-rss-items-stats'] });
      toast({
        title: 'Парсинг завершено',
        description: `Успішно: ${result.succeeded}, помилок: ${result.failed}`
      });
    },
    onError: (error) => {
      setProgress(prev => ({ ...prev, isRunning: false }));
      toast({
        title: 'Помилка',
        description: error instanceof Error ? error.message : 'Не вдалося виконати парсинг',
        variant: 'destructive'
      });
    }
  });

  const stopScraping = () => {
    setShouldStop(true);
    toast({ title: 'Зупинка парсингу...' });
  };

  const progressPercent = progress.total > 0 
    ? Math.round((progress.processed / progress.total) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cosmic-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats?.total || 0}</p>
                <p className="text-xs text-muted-foreground">Всього новин</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="cosmic-card border-primary/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <div>
                <p className="text-2xl font-bold text-primary">{stats?.withContent || 0}</p>
                <p className="text-xs text-muted-foreground">З original_content</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="cosmic-card border-destructive/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <XCircle className="w-5 h-5 text-destructive" />
              <div>
                <p className="text-2xl font-bold text-destructive">{stats?.withoutContent || 0}</p>
                <p className="text-xs text-muted-foreground">Без original_content</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Filters */}
      <Card className="cosmic-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-primary" />
            Фільтри парсингу
          </CardTitle>
          <CardDescription>Обмежте новини для парсингу</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Country filter */}
            <div className="space-y-2">
              <Label>Країна</Label>
              <Select 
                value={filters.countryId} 
                onValueChange={(v) => setFilters(prev => ({ ...prev, countryId: v }))}
                disabled={progress.isRunning}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Всі країни" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">🌍 Всі країни</SelectItem>
                  {countries?.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.flag} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Date from */}
            <div className="space-y-2">
              <Label>Дата від</Label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                disabled={progress.isRunning}
              />
            </div>
            
            {/* Date to */}
            <div className="space-y-2">
              <Label>Дата до</Label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                disabled={progress.isRunning}
              />
            </div>
            
            {/* Limit */}
            <div className="space-y-2">
              <Label>Ліміт новин</Label>
              <Input
                type="number"
                min={1}
                max={2000}
                value={filters.limit}
                onChange={(e) => setFilters(prev => ({ ...prev, limit: Math.min(2000, Math.max(1, parseInt(e.target.value) || 100)) }))}
                disabled={progress.isRunning}
              />
            </div>
          </div>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              setFilters({ countryId: 'all', dateFrom: '', dateTo: '', limit: 500 });
              refetchStats();
            }}
            disabled={progress.isRunning}
          >
            Скинути фільтри
          </Button>
        </CardContent>
      </Card>
      
      {/* Settings */}
      <Card className="cosmic-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Налаштування парсингу
          </CardTitle>
          <CardDescription>Параметри масового парсингу original_content</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Розмір батчу: {settings.batchSize}</Label>
              <span className="text-xs text-muted-foreground">паралельних запитів</span>
            </div>
            <Slider
              value={[settings.batchSize]}
              onValueChange={([v]) => setSettings(prev => ({ ...prev, batchSize: v }))}
              min={1}
              max={20}
              step={1}
              disabled={progress.isRunning}
            />
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Затримка між батчами: {settings.delayMs}ms</Label>
              <span className="text-xs text-muted-foreground">для уникнення блокувань</span>
            </div>
            <Slider
              value={[settings.delayMs]}
              onValueChange={([v]) => setSettings(prev => ({ ...prev, delayMs: v }))}
              min={100}
              max={2000}
              step={100}
              disabled={progress.isRunning}
            />
          </div>
          
          <div className="flex items-center justify-between p-4 border border-border/50 rounded-lg">
            <div>
              <Label>Авто-парсинг при імпорті</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Автоматично парсити original_content при додаванні RSS новин
              </p>
            </div>
            <Switch
              checked={settings.autoScrapeOnImport}
              onCheckedChange={(v) => setSettings(prev => ({ ...prev, autoScrapeOnImport: v }))}
            />
          </div>
        </CardContent>
      </Card>
      
      {/* Progress */}
      {progress.isRunning && (
        <Card className="cosmic-card border-primary/30">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">Прогрес парсингу</span>
              <span className="text-sm text-muted-foreground">
                {progress.processed} / {progress.total}
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-primary">✓ {progress.succeeded} успішно</span>
              <span className="text-destructive">✗ {progress.failed} помилок</span>
            </div>
            {progress.currentUrl && (
              <p className="text-xs text-muted-foreground truncate">
                {progress.currentUrl}
              </p>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Actions */}
      <div className="flex gap-4">
        {!progress.isRunning ? (
          <Button
            onClick={() => bulkScrapeMutation.mutate()}
            disabled={!stats?.withoutContent || stats.withoutContent === 0}
            className="flex-1"
          >
            <Play className="w-4 h-4 mr-2" />
            Запустити парсинг ({Math.min(stats?.withoutContent || 0, filters.limit)} новин)
          </Button>
        ) : (
          <Button
            onClick={stopScraping}
            variant="destructive"
            className="flex-1"
          >
            <Pause className="w-4 h-4 mr-2" />
            Зупинити
          </Button>
        )}
        
        <Button
          variant="outline"
          onClick={() => refetchStats()}
          disabled={progress.isRunning}
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
