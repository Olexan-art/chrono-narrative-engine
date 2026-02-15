import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface CronStats {
  '6h': PeriodStats;
  '24h': PeriodStats;
  '3d': PeriodStats;
  '7d': PeriodStats;
  '14d': PeriodStats;
}

interface PeriodStats {
  fetchUs: {
    fetched: number;
    retold: number;
    executions: number;
  };
  processPending: {
    processed: number;
    retold: number;
    executions: number;
  };
  total: {
    newsCount: number;
    noRetellCount: number;
    retellPercentage: number;
  };
}

export function CronStatsTable() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['cron-stats'],
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-rss`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({ action: 'get_cron_stats' })
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch cron stats');
      }
      
      const result = await response.json();
      return result.stats as CronStats;
    },
    refetchInterval: 60000 // Refresh every minute
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8">
          <p className="text-destructive">Помилка завантаження статистики</p>
        </CardContent>
      </Card>
    );
  }

  const periods = [
    { key: '6h', label: '6 годин' },
    { key: '24h', label: '24 години' },
    { key: '3d', label: '3 дні' },
    { key: '7d', label: '7 днів' },
    { key: '14d', label: '14 днів' }
  ];

  const getRetellBadge = (percentage: number) => {
    if (percentage >= 90) {
      return <Badge className="bg-green-500">{percentage}%</Badge>;
    } else if (percentage >= 70) {
      return <Badge className="bg-yellow-500">{percentage}%</Badge>;
    } else {
      return <Badge className="bg-red-500">{percentage}%</Badge>;
    }
  };

  return (
    <Card className="cosmic-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Статистика обробки новин
        </CardTitle>
        <CardDescription>
          Детальна статистика завантаження та перекладу новин за різні періоди
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Метрика</TableHead>
                {periods.map(period => (
                  <TableHead key={period.key} className="text-center">
                    {period.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* US RSS Fetching */}
              <TableRow className="bg-blue-500/5">
                <TableCell className="font-medium" colSpan={6}>
                  🇺🇸 US RSS Оновлення
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-8">Завантажено новин</TableCell>
                {periods.map(period => (
                  <TableCell key={period.key} className="text-center font-mono">
                    {data?.[period.key as keyof CronStats]?.fetchUs.fetched || 0}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="pl-8">Переказано</TableCell>
                {periods.map(period => (
                  <TableCell key={period.key} className="text-center font-mono">
                    {data?.[period.key as keyof CronStats]?.fetchUs.retold || 0}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="pl-8">Запусків крону</TableCell>
                {periods.map(period => (
                  <TableCell key={period.key} className="text-center font-mono">
                    {data?.[period.key as keyof CronStats]?.fetchUs.executions || 0}
                  </TableCell>
                ))}
              </TableRow>

              {/* Process Pending */}
              <TableRow className="bg-orange-500/5">
                <TableCell className="font-medium" colSpan={6}>
                  🔄 Обробка пропущених
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-8">Оброблено новин</TableCell>
                {periods.map(period => (
                  <TableCell key={period.key} className="text-center font-mono">
                    {data?.[period.key as keyof CronStats]?.processPending.processed || 0}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="pl-8">Переказано</TableCell>
                {periods.map(period => (
                  <TableCell key={period.key} className="text-center font-mono">
                    {data?.[period.key as keyof CronStats]?.processPending.retold || 0}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="pl-8">Запусків крону</TableCell>
                {periods.map(period => (
                  <TableCell key={period.key} className="text-center font-mono">
                    {data?.[period.key as keyof CronStats]?.processPending.executions || 0}
                  </TableCell>
                ))}
              </TableRow>

              {/* Totals */}
              <TableRow className="bg-primary/5">
                <TableCell className="font-medium" colSpan={6}>
                  📊 Загальна статистика
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-8">Всього новин</TableCell>
                {periods.map(period => (
                  <TableCell key={period.key} className="text-center font-mono">
                    {data?.[period.key as keyof CronStats]?.total.newsCount || 0}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="pl-8">Без перекладу</TableCell>
                {periods.map(period => (
                  <TableCell key={period.key} className="text-center font-mono text-destructive">
                    {data?.[period.key as keyof CronStats]?.total.noRetellCount || 0}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="pl-8 font-semibold">% Переказано</TableCell>
                {periods.map(period => (
                  <TableCell key={period.key} className="text-center">
                    {getRetellBadge(data?.[period.key as keyof CronStats]?.total.retellPercentage || 0)}
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
