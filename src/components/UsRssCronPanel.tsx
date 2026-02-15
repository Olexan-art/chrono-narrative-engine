import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, Play, Globe } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const FREQUENCY_OPTIONS = [
  { value: '15min', label: 'Кожні 15 хвилин', schedule: '*/15 * * * *' },
  { value: '30min', label: 'Кожні 30 хвилин', schedule: '*/30 * * * *' },
  { value: '1hour', label: 'Кожну годину', schedule: '0 * * * *' }
];

export function UsRssCronPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFrequency, setSelectedFrequency] = useState('30min');

  // Get current cron status
  const { data: cronStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['us-rss-cron-status'],
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-cron`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'get_us_rss_cron_status',
            password: localStorage.getItem('adminPassword')
          })
        }
      );
      
      if (!response.ok) throw new Error('Failed to get cron status');
      
      const result = await response.json();
      if (result.enabled) {
        setSelectedFrequency(result.frequency);
      }
      return result;
    },
    refetchInterval: 30000
  });

  // Setup cron mutation
  const setupCronMutation = useMutation({
    mutationFn: async (frequency: string) => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-cron`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'setup_us_rss_cron',
            password: localStorage.getItem('adminPassword'),
            data: { frequency }
          })
        }
      );
      
      if (!response.ok) throw new Error('Failed to setup cron');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Успіх', description: 'US RSS крон налаштовано' });
      queryClient.invalidateQueries({ queryKey: ['us-rss-cron-status'] });
    },
    onError: () => {
      toast({ title: 'Помилка', description: 'Не вдалось налаштувати крон', variant: 'destructive' });
    }
  });

  // Remove cron mutation
  const removeCronMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-cron`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'remove_us_rss_cron',
            password: localStorage.getItem('adminPassword')
          })
        }
      );
      
      if (!response.ok) throw new Error('Failed to remove cron');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Успіх', description: 'US RSS крон вимкнено' });
      queryClient.invalidateQueries({ queryKey: ['us-rss-cron-status'] });
    },
    onError: () => {
      toast({ title: 'Помилка', description: 'Не вдалось вимкнути крон', variant: 'destructive' });
    }
  });

  // Trigger now mutation
  const triggerNowMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-rss`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'fetch_us_rss' })
        }
      );
      
      if (!response.ok) throw new Error('Failed to trigger US RSS fetch');
      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: 'Успіх', 
        description: `Завантажено: ${data.totalFetched}, Переказано: ${data.totalRetold}` 
      });
    },
    onError: () => {
      toast({ title: 'Помилка', description: 'Не вдалось запустити завантаження', variant: 'destructive' });
    }
  });

  const handleFrequencyChange = (value: string) => {
    setSelectedFrequency(value);
    setupCronMutation.mutate(value);
  };

  const handleToggle = (enabled: boolean) => {
    if (enabled) {
      setupCronMutation.mutate(selectedFrequency);
    } else {
      removeCronMutation.mutate();
    }
  };

  const isEnabled = cronStatus?.enabled || false;

  return (
    <Card className="cosmic-card border-blue-500/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-blue-500" />
          🇺🇸 Оновлення US Новин
          {isEnabled && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/10 border border-green-500/30 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-medium text-green-600">Активно</span>
            </div>
          )}
        </CardTitle>
        <CardDescription>
          Автоматичне завантаження та переклад новин з US RSS каналів
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 border border-border/50 rounded-lg">
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-blue-500" />
            <div>
              <div className="font-medium text-sm">Автооновлення</div>
              <div className="text-xs text-muted-foreground">
                Регулярно завантажувати US новини
              </div>
            </div>
          </div>
          <Switch
            checked={isEnabled}
            onCheckedChange={handleToggle}
            disabled={setupCronMutation.isPending || removeCronMutation.isPending}
          />
        </div>

        <div className="flex items-end gap-4 flex-wrap">
          <div className="space-y-2 flex-1 min-w-[200px]">
            <Label>Частота оновлення</Label>
            <Select
              value={selectedFrequency}
              onValueChange={handleFrequencyChange}
              disabled={setupCronMutation.isPending || statusLoading}
            >
              <SelectTrigger>
                {statusLoading ? (
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
            onClick={() => triggerNowMutation.mutate()}
            disabled={triggerNowMutation.isPending}
            className="gap-2"
          >
            {triggerNowMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Запустити зараз
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
