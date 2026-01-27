import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, RefreshCw, Loader2, Play, Zap, MessageSquare, Twitter, FileText, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { callEdgeFunction, adminAction } from "@/lib/api";
import { CountryRetellRatioPanel } from "@/components/CountryRetellRatioPanel";
import { AutoGenChart } from "@/components/AutoGenChart";

interface CronJob {
  id: number;
  name: string;
  schedule: string;
  active: boolean;
  description: string;
}

interface AutoGenSettings {
  news_auto_retell_enabled: boolean;
  news_auto_dialogue_enabled: boolean;
  news_auto_tweets_enabled: boolean;
  news_retell_ratio: number;
  news_dialogue_count: number;
  news_tweet_count: number;
}

interface PeriodStats {
  retold: number;
  dialogues: number;
  tweets: number;
}

interface DailyStats {
  date: string;
  label: string;
  retold: number;
  dialogues: number;
  tweets: number;
}

interface AutoGenStats {
  h24: PeriodStats;
  d3: PeriodStats;
  d7: PeriodStats;
  d30: PeriodStats;
  daily: DailyStats[];
}

interface Props {
  password: string;
}

const FREQUENCY_OPTIONS = [
  { value: '30min', label: 'Кожні 30 хвилин', schedule: '*/30 * * * *' },
  { value: '1hour', label: 'Кожну годину', schedule: '0 * * * *' },
  { value: '6hours', label: 'Кожні 6 годин', schedule: '0 */6 * * *' },
];

// Global ratio is now per-country, but keep for backwards compat

const DIALOGUE_COUNT_OPTIONS = [
  { value: 5, label: '5 повідомлень' },
  { value: 6, label: '6 повідомлень' },
  { value: 7, label: '7 повідомлень' },
  { value: 8, label: '8 повідомлень' },
  { value: 9, label: '9 повідомлень' },
  { value: 10, label: '10 повідомлень' },
];

const TWEET_COUNT_OPTIONS = [
  { value: 3, label: '3 твіти' },
  { value: 4, label: '4 твіти' },
  { value: 5, label: '5 твітів' },
  { value: 6, label: '6 твітів' },
];

function formatSchedule(schedule: string): string {
  if (schedule === '*/30 * * * *') return 'Кожні 30 хв';
  if (schedule === '0 * * * *') return 'Кожну годину';
  if (schedule === '0 */6 * * *') return 'Кожні 6 год';
  if (schedule.startsWith('*/')) {
    const mins = schedule.split(' ')[0].replace('*/', '');
    return `Кожні ${mins} хв`;
  }
  return schedule;
}

export function CronJobsPanel({ password }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFrequency, setSelectedFrequency] = useState<string>('1hour');
  const [autoGenSettings, setAutoGenSettings] = useState<AutoGenSettings>({
    news_auto_retell_enabled: true,
    news_auto_dialogue_enabled: true,
    news_auto_tweets_enabled: true,
    news_retell_ratio: 1,
    news_dialogue_count: 7,
    news_tweet_count: 4,
  });

  // Fetch current RSS schedule
  const { data: rssSchedule, isLoading: scheduleLoading } = useQuery({
    queryKey: ['rss-schedule'],
    queryFn: async () => {
      try {
        const result = await callEdgeFunction<{ success: boolean; schedule: string }>(
          'manage-cron',
          { action: 'get_rss_schedule', password }
        );
        if (result.success) {
          setSelectedFrequency(result.schedule);
          return result.schedule;
        }
        return '1hour';
      } catch {
        return '1hour';
      }
    }
  });

  // Fetch settings including auto-generation options
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['admin-settings-cron'],
    queryFn: async () => {
      const result = await adminAction<{ success: boolean; settings: AutoGenSettings & { id: string } }>(
        'getSettings',
        password
      );
      return result.settings;
    }
  });

  // Update local state when settings are fetched
  useEffect(() => {
    if (settings) {
      setAutoGenSettings({
        news_auto_retell_enabled: settings.news_auto_retell_enabled ?? true,
        news_auto_dialogue_enabled: settings.news_auto_dialogue_enabled ?? true,
        news_auto_tweets_enabled: settings.news_auto_tweets_enabled ?? true,
        news_retell_ratio: settings.news_retell_ratio ?? 1,
        news_dialogue_count: settings.news_dialogue_count ?? 7,
        news_tweet_count: settings.news_tweet_count ?? 4,
      });
    }
  }, [settings]);

  // Fetch auto-generation statistics for multiple periods
  const { data: stats } = useQuery<AutoGenStats>({
    queryKey: ['auto-gen-stats'],
    queryFn: async () => {
      const result = await adminAction<{ 
        success: boolean; 
        stats: AutoGenStats;
      }>('getAutoGenStats', password, { periods: true, daily: true });
      
      return result.stats ?? {
        h24: { retold: 0, dialogues: 0, tweets: 0 },
        d3: { retold: 0, dialogues: 0, tweets: 0 },
        d7: { retold: 0, dialogues: 0, tweets: 0 },
        d30: { retold: 0, dialogues: 0, tweets: 0 },
        daily: [],
      };
    },
    refetchInterval: 60000, // Refetch every minute
  });

  // Fetch all cron jobs
  const { data: cronJobs, isLoading: jobsLoading, refetch: refetchJobs } = useQuery({
    queryKey: ['cron-jobs'],
    queryFn: async () => {
      try {
        const result = await callEdgeFunction<{ success: boolean; jobs: CronJob[] }>(
          'manage-cron',
          { action: 'list_all_jobs', password }
        );
        return result.jobs || [];
      } catch {
        // Return known jobs as fallback
        return [
          {
            id: 1,
            name: 'fetch-rss-feeds-hourly',
            schedule: FREQUENCY_OPTIONS.find(f => f.value === selectedFrequency)?.schedule || '0 * * * *',
            active: true,
            description: 'Автоматична перевірка та завантаження RSS новин з переказом'
          }
        ];
      }
    }
  });

  // Update RSS schedule
  const updateScheduleMutation = useMutation({
    mutationFn: async (frequency: string) => {
      return callEdgeFunction<{ success: boolean; frequency: string; schedule: string }>(
        'manage-cron',
        { action: 'update_rss_schedule', password, data: { frequency } }
      );
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['rss-schedule'] });
      queryClient.invalidateQueries({ queryKey: ['cron-jobs'] });
      toast({ 
        title: 'Розклад оновлено',
        description: `RSS буде перевірятися ${FREQUENCY_OPTIONS.find(f => f.value === result.frequency)?.label?.toLowerCase()}`
      });
    },
    onError: (error) => {
      toast({
        title: 'Помилка',
        description: error instanceof Error ? error.message : 'Не вдалося оновити розклад',
        variant: 'destructive'
      });
    }
  });

  // Update auto-generation settings
  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: Partial<AutoGenSettings>) => {
      return adminAction<{ success: boolean }>(
        'updateSettings',
        password,
        { ...settings, ...newSettings, id: settings?.id }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings-cron'] });
      toast({ title: 'Налаштування збережено' });
    },
    onError: (error) => {
      toast({
        title: 'Помилка',
        description: error instanceof Error ? error.message : 'Не вдалося зберегти',
        variant: 'destructive'
      });
    }
  });

  // Trigger manual RSS fetch
  const triggerRssMutation = useMutation({
    mutationFn: async () => {
      return callEdgeFunction<{ 
        success: boolean; 
        feedsProcessed: number; 
        autoRetelled: number;
        autoDialogues?: number;
        autoTweets?: number;
        totalInserted?: number;
      }>(
        'fetch-rss',
        { action: 'fetch_all' }
      );
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['news-rss-items-count'] });
      queryClient.invalidateQueries({ queryKey: ['news-rss-items-stats'] });
      queryClient.invalidateQueries({ queryKey: ['latest-usa-retold-news'] });
      
      const parts = [`${result.feedsProcessed} каналів`];
      if (result.totalInserted) parts.push(`${result.totalInserted} новин`);
      if (result.autoRetelled) parts.push(`${result.autoRetelled} переказів`);
      if (result.autoDialogues) parts.push(`${result.autoDialogues} діалогів`);
      if (result.autoTweets) parts.push(`${result.autoTweets} твітів`);
      
      toast({ 
        title: 'RSS оновлено',
        description: `Оброблено: ${parts.join(', ')}`
      });
    },
    onError: (error) => {
      toast({
        title: 'Помилка',
        description: error instanceof Error ? error.message : 'Не вдалося запустити',
        variant: 'destructive'
      });
    }
  });

  const handleFrequencyChange = (value: string) => {
    setSelectedFrequency(value);
    updateScheduleMutation.mutate(value);
  };

  const handleSettingToggle = (key: keyof AutoGenSettings, value: boolean) => {
    const newSettings = { ...autoGenSettings, [key]: value };
    setAutoGenSettings(newSettings);
    updateSettingsMutation.mutate({ [key]: value });
  };

  const handleRatioChange = (value: string) => {
    const ratio = parseInt(value, 10);
    setAutoGenSettings(prev => ({ ...prev, news_retell_ratio: ratio }));
    updateSettingsMutation.mutate({ news_retell_ratio: ratio });
  };

  const handleDialogueCountChange = (value: string) => {
    const count = parseInt(value, 10);
    setAutoGenSettings(prev => ({ ...prev, news_dialogue_count: count }));
    updateSettingsMutation.mutate({ news_dialogue_count: count });
  };

  const handleTweetCountChange = (value: string) => {
    const count = parseInt(value, 10);
    setAutoGenSettings(prev => ({ ...prev, news_tweet_count: count }));
    updateSettingsMutation.mutate({ news_tweet_count: count });
  };

  return (
    <div className="space-y-6">
      {/* Auto-generation Settings */}
      <Card className="cosmic-card border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Авто-генерація контенту
          </CardTitle>
          <CardDescription>
            Налаштування автоматичної обробки новин при додаванні з RSS
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Toggle switches */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-center justify-between p-4 border border-border/50 rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-blue-500" />
                <div>
                  <div className="font-medium text-sm">Переказ</div>
                  <div className="text-xs text-muted-foreground">Переказувати новини</div>
                </div>
              </div>
              <Switch
                checked={autoGenSettings.news_auto_retell_enabled}
                onCheckedChange={(checked) => handleSettingToggle('news_auto_retell_enabled', checked)}
                disabled={settingsLoading || updateSettingsMutation.isPending}
              />
            </div>

            <div className="flex items-center justify-between p-4 border border-border/50 rounded-lg">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-green-500" />
                <div>
                  <div className="font-medium text-sm">Діалоги</div>
                  <div className="text-xs text-muted-foreground">Генерувати діалоги</div>
                </div>
              </div>
              <Switch
                checked={autoGenSettings.news_auto_dialogue_enabled}
                onCheckedChange={(checked) => handleSettingToggle('news_auto_dialogue_enabled', checked)}
                disabled={settingsLoading || updateSettingsMutation.isPending}
              />
            </div>

            <div className="flex items-center justify-between p-4 border border-border/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Twitter className="w-5 h-5 text-sky-500" />
                <div>
                  <div className="font-medium text-sm">Твіти</div>
                  <div className="text-xs text-muted-foreground">Генерувати твіти</div>
                </div>
              </div>
              <Switch
                checked={autoGenSettings.news_auto_tweets_enabled}
                onCheckedChange={(checked) => handleSettingToggle('news_auto_tweets_enabled', checked)}
                disabled={settingsLoading || updateSettingsMutation.isPending}
              />
            </div>
          </div>

          {/* Dialogue and Tweet count selectors */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Кількість діалогів</Label>
              <Select
                value={autoGenSettings.news_dialogue_count.toString()}
                onValueChange={handleDialogueCountChange}
                disabled={settingsLoading || updateSettingsMutation.isPending || !autoGenSettings.news_auto_dialogue_enabled}
              >
                <SelectTrigger className="w-full">
                  {settingsLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <SelectValue />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {DIALOGUE_COUNT_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Скільки повідомлень у діалозі (5-10)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Кількість твітів</Label>
              <Select
                value={autoGenSettings.news_tweet_count.toString()}
                onValueChange={handleTweetCountChange}
                disabled={settingsLoading || updateSettingsMutation.isPending || !autoGenSettings.news_auto_tweets_enabled}
              >
                <SelectTrigger className="w-full">
                  {settingsLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <SelectValue />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {TWEET_COUNT_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Скільки твітів генерувати (3-6)
              </p>
            </div>
          </div>

          {/* Multi-period Stats */}
          {stats && (
            <div className="space-y-4">
              {/* Stats Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Тип</th>
                      <th className="text-center py-2 px-3 text-muted-foreground font-medium">24г</th>
                      <th className="text-center py-2 px-3 text-muted-foreground font-medium">3 дні</th>
                      <th className="text-center py-2 px-3 text-muted-foreground font-medium">7 днів</th>
                      <th className="text-center py-2 px-3 text-muted-foreground font-medium">30 днів</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border/30">
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-500" />
                          <span>Переказів</span>
                        </div>
                      </td>
                      <td className="text-center py-2 px-3 font-bold text-blue-500">{stats.h24.retold}</td>
                      <td className="text-center py-2 px-3 font-medium">{stats.d3.retold}</td>
                      <td className="text-center py-2 px-3 font-medium">{stats.d7.retold}</td>
                      <td className="text-center py-2 px-3 font-medium">{stats.d30.retold}</td>
                    </tr>
                    <tr className="border-b border-border/30">
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-green-500" />
                          <span>Діалогів</span>
                        </div>
                      </td>
                      <td className="text-center py-2 px-3 font-bold text-green-500">{stats.h24.dialogues}</td>
                      <td className="text-center py-2 px-3 font-medium">{stats.d3.dialogues}</td>
                      <td className="text-center py-2 px-3 font-medium">{stats.d7.dialogues}</td>
                      <td className="text-center py-2 px-3 font-medium">{stats.d30.dialogues}</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <Twitter className="w-4 h-4 text-sky-500" />
                          <span>Твітів</span>
                        </div>
                      </td>
                      <td className="text-center py-2 px-3 font-bold text-sky-500">{stats.h24.tweets}</td>
                      <td className="text-center py-2 px-3 font-medium">{stats.d3.tweets}</td>
                      <td className="text-center py-2 px-3 font-medium">{stats.d7.tweets}</td>
                      <td className="text-center py-2 px-3 font-medium">{stats.d30.tweets}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              {/* Daily Chart */}
              {stats.daily && stats.daily.length > 0 && (
                <AutoGenChart data={stats.daily} />
              )}
            </div>
          )}

          <div className="p-3 bg-muted/30 rounded-lg text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Zap className="w-4 h-4 text-primary" />
              <span>
                {autoGenSettings.news_retell_ratio === 1 
                  ? 'Всі нові новини будуть автоматично оброблені' 
                  : `Кожна ${autoGenSettings.news_retell_ratio}-та нова новина буде автоматично оброблена`}
                {autoGenSettings.news_auto_retell_enabled && ' (переказ'}
                {autoGenSettings.news_auto_dialogue_enabled && (autoGenSettings.news_auto_retell_enabled ? ', діалоги' : ' (діалоги')}
                {autoGenSettings.news_auto_tweets_enabled && (autoGenSettings.news_auto_retell_enabled || autoGenSettings.news_auto_dialogue_enabled ? ', твіти)' : ' (твіти)')}
                {!autoGenSettings.news_auto_retell_enabled && !autoGenSettings.news_auto_dialogue_enabled && !autoGenSettings.news_auto_tweets_enabled && ' (нічого не обрано)'}
                {(autoGenSettings.news_auto_retell_enabled || autoGenSettings.news_auto_dialogue_enabled || autoGenSettings.news_auto_tweets_enabled) && !autoGenSettings.news_auto_tweets_enabled ? ')' : ''}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* RSS Schedule Settings */}
      <Card className="cosmic-card border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Автоматична перевірка RSS
          </CardTitle>
          <CardDescription>
            Налаштування частоти автоматичного завантаження новин
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="space-y-2 flex-1 min-w-[200px]">
              <Label>Частота перевірки</Label>
              <Select
                value={selectedFrequency}
                onValueChange={handleFrequencyChange}
                disabled={updateScheduleMutation.isPending || scheduleLoading}
              >
                <SelectTrigger>
                  {scheduleLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <SelectValue />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <span>{option.label}</span>
                        <span className="text-xs text-muted-foreground font-mono">
                          ({option.schedule})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Button
              onClick={() => triggerRssMutation.mutate()}
              disabled={triggerRssMutation.isPending}
              className="gap-2"
            >
              {triggerRssMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Запустити зараз
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Per-country Retell Ratio Settings */}
      <CountryRetellRatioPanel />

      {/* Cron Jobs List */}
      <Card className="cosmic-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Заплановані завдання (Cron Jobs)
              </CardTitle>
              <CardDescription>
                Список активних автоматичних завдань
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchJobs()}
              disabled={jobsLoading}
              className="gap-2"
            >
              {jobsLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Оновити
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {jobsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : cronJobs && cronJobs.length > 0 ? (
            <div className="space-y-3">
              {cronJobs.map((job) => (
                <div
                  key={job.id || job.name}
                  className="flex items-center justify-between p-4 border border-border/50 rounded-lg hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full ${job.active ? 'bg-green-500' : 'bg-muted'}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{job.name}</span>
                        <Badge variant={job.active ? 'default' : 'secondary'} className="text-xs">
                          {job.active ? 'Активний' : 'Призупинено'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{job.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm font-mono text-primary">
                        {formatSchedule(job.schedule)}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {job.schedule}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Немає запланованих завдань</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
