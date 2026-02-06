import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Flame, ThumbsUp, ThumbsDown, Clock, Zap, 
  Settings, Play, RefreshCw, Loader2, Image, Newspaper,
  BarChart3, Target, Sparkles
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { adminAction, callEdgeFunction } from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";
import { uk } from "date-fns/locale";

interface ViralityPanelProps {
  password: string;
}

interface ViralSettings {
  viral_simulation_enabled: boolean;
  viral_news_per_day: number;
  viral_delay_hours: number;
  viral_growth_hours: number;
  viral_decay_hours: number;
  viral_min_interactions: number;
  viral_max_interactions: number;
  viral_dislike_ratio: number;
  viral_last_run_at: string | null;
}

export function ViralityPanel({ password }: ViralityPanelProps) {
  const queryClient = useQueryClient();
  const [manualNewsId, setManualNewsId] = useState("");

  // Fetch viral settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['viral-settings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('settings')
        .select('viral_simulation_enabled, viral_news_per_day, viral_delay_hours, viral_growth_hours, viral_decay_hours, viral_min_interactions, viral_max_interactions, viral_dislike_ratio, viral_last_run_at')
        .single();
      return data as ViralSettings;
    }
  });

  // Fetch stats - top voted news
  const { data: topNews, isLoading: newsLoading } = useQuery({
    queryKey: ['viral-top-news'],
    queryFn: async () => {
      const { data } = await supabase
        .from('news_rss_items')
        .select('id, title, title_en, slug, likes, dislikes, viral_simulation_started_at, viral_simulation_completed, country:news_countries(code, flag)')
        .or('likes.gt.0,dislikes.gt.0')
        .order('likes', { ascending: false })
        .limit(20);
      return data || [];
    }
  });

  // Fetch top voted outrage ink
  const { data: topInk, isLoading: inkLoading } = useQuery({
    queryKey: ['viral-top-ink'],
    queryFn: async () => {
      const { data } = await supabase
        .from('outrage_ink')
        .select('id, title, image_url, likes, dislikes, created_at, news_item:news_rss_items(title, slug, country:news_countries(code))')
        .or('likes.gt.0,dislikes.gt.0')
        .order('likes', { ascending: false })
        .limit(20);
      return data || [];
    }
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<ViralSettings>) => {
      const { data: current } = await supabase.from('settings').select('id').single();
      if (!current) throw new Error('Settings not found');
      
      const { error } = await supabase
        .from('settings')
        .update(updates)
        .eq('id', current.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['viral-settings'] });
      toast.success('Налаштування збережено');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Помилка збереження');
    }
  });

  // Run viral simulation mutation
  const runSimulationMutation = useMutation({
    mutationFn: async (newsId?: string) => {
      const result = await callEdgeFunction<{ success: boolean; processed: number; error?: string }>(
        'viral-simulation',
        { newsId, manual: !!newsId }
      );
      
      if (!result.success) throw new Error(result.error || 'Simulation failed');
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['viral-top-news'] });
      queryClient.invalidateQueries({ queryKey: ['viral-top-ink'] });
      queryClient.invalidateQueries({ queryKey: ['viral-settings'] });
      toast.success(`Опрацьовано ${data.processed} елементів`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Помилка симуляції');
    }
  });

  // Calculate totals
  const totalNewsLikes = topNews?.reduce((sum, n) => sum + (n.likes || 0), 0) || 0;
  const totalNewsDislikes = topNews?.reduce((sum, n) => sum + (n.dislikes || 0), 0) || 0;
  const totalInkLikes = topInk?.reduce((sum, i) => sum + (i.likes || 0), 0) || 0;
  const totalInkDislikes = topInk?.reduce((sum, i) => sum + (i.dislikes || 0), 0) || 0;

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="cosmic-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ThumbsUp className="w-5 h-5 text-emerald-500" />
              <div>
                <p className="text-2xl font-bold text-emerald-500">{totalNewsLikes + totalInkLikes}</p>
                <p className="text-xs text-muted-foreground">Всього лайків</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="cosmic-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ThumbsDown className="w-5 h-5 text-rose-500" />
              <div>
                <p className="text-2xl font-bold text-rose-500">{totalNewsDislikes + totalInkDislikes}</p>
                <p className="text-xs text-muted-foreground">Всього дизлайків</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="cosmic-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Newspaper className="w-5 h-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{topNews?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Новин з голосами</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="cosmic-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Image className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">{topInk?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Карикатур з голосами</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="stats" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="stats" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Статистика
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="w-4 h-4" />
            Налаштування
          </TabsTrigger>
          <TabsTrigger value="manual" className="gap-2">
            <Target className="w-4 h-4" />
            Ручний запуск
          </TabsTrigger>
        </TabsList>

        {/* Stats Tab */}
        <TabsContent value="stats" className="space-y-6">
          {/* News Votes Table */}
          <Card className="cosmic-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Newspaper className="w-5 h-5 text-primary" />
                Топ новини за голосами
              </CardTitle>
            </CardHeader>
            <CardContent>
              {newsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Новина</TableHead>
                      <TableHead className="text-center w-20">👍</TableHead>
                      <TableHead className="text-center w-20">👎</TableHead>
                      <TableHead className="w-32">Статус</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topNews?.map((news: any) => (
                      <TableRow key={news.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{news.country?.flag}</span>
                            <span className="line-clamp-1 text-sm">{news.title_en || news.title}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-emerald-500 font-medium">{news.likes || 0}</TableCell>
                        <TableCell className="text-center text-rose-500 font-medium">{news.dislikes || 0}</TableCell>
                        <TableCell>
                          {news.viral_simulation_completed ? (
                            <Badge variant="outline" className="text-emerald-500 border-emerald-500/50">
                              <Sparkles className="w-3 h-3 mr-1" />
                              Завершено
                            </Badge>
                          ) : news.viral_simulation_started_at ? (
                            <Badge variant="outline" className="text-amber-500 border-amber-500/50">
                              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                              В процесі
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              Очікує
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!topNews || topNews.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          Немає новин з голосами
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Outrage Ink Votes Table */}
          <Card className="cosmic-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="w-5 h-5 text-amber-500" />
                Топ карикатури за голосами
              </CardTitle>
            </CardHeader>
            <CardContent>
              {inkLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Карикатура</TableHead>
                      <TableHead className="text-center w-20">👍</TableHead>
                      <TableHead className="text-center w-20">👎</TableHead>
                      <TableHead className="w-32">Дата</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topInk?.map((ink: any) => (
                      <TableRow key={ink.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <img src={ink.image_url} alt="" className="w-10 h-10 rounded object-cover" />
                            <span className="line-clamp-1 text-sm">{ink.title || ink.news_item?.title || 'Без назви'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-emerald-500 font-medium">{ink.likes || 0}</TableCell>
                        <TableCell className="text-center text-rose-500 font-medium">{ink.dislikes || 0}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {ink.created_at ? format(new Date(ink.created_at), 'd MMM', { locale: uk }) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!topInk || topInk.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          Немає карикатур з голосами
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <Card className="cosmic-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                Вірусна симуляція (NHPP + STEPPS)
              </CardTitle>
              <CardDescription>
                Неоднорідний пуассонівський процес для імітації органічної активності
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Увімкнути автоматичну симуляцію</Label>
                  <p className="text-xs text-muted-foreground">Запускається кожні 6 годин</p>
                </div>
                <Switch
                  checked={settings?.viral_simulation_enabled || false}
                  onCheckedChange={(checked) => updateSettingsMutation.mutate({ viral_simulation_enabled: checked })}
                />
              </div>

              {/* News per day */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Новин на добу для симуляції</Label>
                  <span className="text-sm font-mono text-primary">{settings?.viral_news_per_day || 10}</span>
                </div>
                <Slider
                  value={[settings?.viral_news_per_day || 10]}
                  onValueChange={([v]) => updateSettingsMutation.mutate({ viral_news_per_day: v })}
                  min={1}
                  max={50}
                  step={1}
                />
                <p className="text-xs text-muted-foreground">Скільки новин обрати для симуляції за добу (STEPPS)</p>
              </div>

              {/* Delay hours */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Затримка старту (години)</Label>
                  <span className="text-sm font-mono text-primary">{settings?.viral_delay_hours || 1.5}</span>
                </div>
                <Slider
                  value={[settings?.viral_delay_hours || 1.5]}
                  onValueChange={([v]) => updateSettingsMutation.mutate({ viral_delay_hours: v })}
                  min={0.5}
                  max={6}
                  step={0.5}
                />
                <p className="text-xs text-muted-foreground">Час до початку активності після публікації</p>
              </div>

              {/* Growth hours */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Час зростання (години)</Label>
                  <span className="text-sm font-mono text-primary">{settings?.viral_growth_hours || 24}</span>
                </div>
                <Slider
                  value={[settings?.viral_growth_hours || 24]}
                  onValueChange={([v]) => updateSettingsMutation.mutate({ viral_growth_hours: v })}
                  min={6}
                  max={72}
                  step={6}
                />
                <p className="text-xs text-muted-foreground">Період максимальної активності</p>
              </div>

              {/* Decay hours */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Час згасання (години)</Label>
                  <span className="text-sm font-mono text-primary">{settings?.viral_decay_hours || 48}</span>
                </div>
                <Slider
                  value={[settings?.viral_decay_hours || 48]}
                  onValueChange={([v]) => updateSettingsMutation.mutate({ viral_decay_hours: v })}
                  min={12}
                  max={168}
                  step={12}
                />
                <p className="text-xs text-muted-foreground">Період поступового зменшення активності</p>
              </div>

              {/* Interaction range */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Мін. взаємодій</Label>
                  <Input
                    type="number"
                    value={settings?.viral_min_interactions || 50}
                    onChange={(e) => updateSettingsMutation.mutate({ viral_min_interactions: parseInt(e.target.value) || 50 })}
                    min={10}
                    max={500}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Макс. взаємодій</Label>
                  <Input
                    type="number"
                    value={settings?.viral_max_interactions || 300}
                    onChange={(e) => updateSettingsMutation.mutate({ viral_max_interactions: parseInt(e.target.value) || 300 })}
                    min={50}
                    max={1000}
                  />
                </div>
              </div>

              {/* Dislike ratio */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Відсоток дизлайків</Label>
                  <span className="text-sm font-mono text-primary">{Math.round((settings?.viral_dislike_ratio || 0.15) * 100)}%</span>
                </div>
                <Slider
                  value={[(settings?.viral_dislike_ratio || 0.15) * 100]}
                  onValueChange={([v]) => updateSettingsMutation.mutate({ viral_dislike_ratio: v / 100 })}
                  min={5}
                  max={40}
                  step={5}
                />
                <p className="text-xs text-muted-foreground">Частка дизлайків від загальної кількості (10-30% реалістично)</p>
              </div>

              {/* Last run info */}
              {settings?.viral_last_run_at && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg">
                  <Clock className="w-4 h-4" />
                  <span>Останній запуск: {format(new Date(settings.viral_last_run_at), 'd MMM HH:mm', { locale: uk })}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Manual Tab */}
        <TabsContent value="manual" className="space-y-6">
          <Card className="cosmic-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Ручний запуск симуляції
              </CardTitle>
              <CardDescription>
                Запустити симуляцію для конкретної новини або всіх відібраних за STEPPS
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Run for all */}
              <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                <div>
                  <p className="font-medium">Запустити для всіх (STEPPS)</p>
                  <p className="text-sm text-muted-foreground">
                    Обере {settings?.viral_news_per_day || 10} найкращих новин за моделлю STEPPS
                  </p>
                </div>
                <Button
                  onClick={() => runSimulationMutation.mutate()}
                  disabled={runSimulationMutation.isPending}
                >
                  {runSimulationMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  Запустити
                </Button>
              </div>

              {/* Run for specific news */}
              <div className="space-y-3 p-4 border border-border rounded-lg">
                <p className="font-medium">Запустити для конкретної новини</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="ID новини (UUID)"
                    value={manualNewsId}
                    onChange={(e) => setManualNewsId(e.target.value)}
                    className="font-mono"
                  />
                  <Button
                    onClick={() => runSimulationMutation.mutate(manualNewsId)}
                    disabled={runSimulationMutation.isPending || !manualNewsId}
                    variant="outline"
                  >
                    {runSimulationMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Flame className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Вставте UUID новини зі сторінки статті або з бази даних
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
