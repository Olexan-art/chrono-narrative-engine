import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, Pause, RefreshCw, Trash2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { adminAction } from '@/lib/api';

interface QueueStats {
  pending_queue: {
    m15: number;
    h1: number;
    h6: number; 
    h24: number;
  };
  current_queue_size: number;
  completed_h24: {
    zai: number;
    deepseek: number;
    total: number;
  };
  recent_queue_events: Array<{
    created_at: string;
    details: any;
    event_type?: string;
    job_name?: string;
    status?: string;
  }>;
  cron_runs_30m: {
    run_count: number;
    processed: number;
    zai_runs: number;
    deepseek_runs: number;
    last_run_at: string | null;
  };
  cron_runs_list: Array<{
    created_at: string;
    job_name: string;
    provider: string;
    llm_model: string;
    taken: number;
    success: number;
    errors: number;
    country_code: string;
    status: string;
  }>;
  hourly_chart: Array<{
    time: string;
    zai: number;
    deepseek: number;
    total: number;
  }>;
}

interface QueueProcessResult {
  zai: { processed: number; success: number; failed: number; error?: string };
  deepseek: { processed: number; success: number; failed: number; error?: string };
  total_time_ms: number;
  timeout_reached?: boolean;
}

export default function RetellQueueStats({ password }: { password: string }) {
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<QueueProcessResult | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const fetchInFlightRef = React.useRef(false);

  const fetchStats = async (silent = false) => {
    // Prevent parallel fetches
    if (fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;
    if (!silent) setIsRefreshing(true);
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 15000);
    try {
      const response = await fetch(
        `${(import.meta.env.VITE_SUPABASE_URL || '').trim()}/functions/v1/admin`,
        {
          method: 'POST',
          signal: abort.signal,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim()}`,
          },
          body: JSON.stringify({ action: 'getRetellQueueStats', password }),
        }
      );
      const data = await response.json().catch(() => ({ success: false }));
      if (data.success) {
        setStats(data.stats);
        setFetchError(false);
      } else {
        setFetchError(true);
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error('Failed to fetch retell queue stats:', error);
      }
      setFetchError(true);
    } finally {
      clearTimeout(timer);
      fetchInFlightRef.current = false;
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const processQueue = async (provider: 'zai' | 'deepseek' | 'both' = 'both') => {
    setProcessing(true);
    setLastResult(null);
    
    try {
      const data = await adminAction<{ success: boolean; results: QueueProcessResult }>('processRetellQueue', password, {
        provider, 
        batch_size: 20, 
        timeout_minutes: 10
      });
      
      if (data.success) {
        setLastResult(data.results);
        fetchStats(); // Refresh stats
      }
    } catch (error) {
      console.error('Failed to process queue:', error);
    } finally {
      setProcessing(false);
    }
  };

  const clearQueue = async () => {
    try {
      const data = await adminAction<{ success: boolean }>('clearRetellQueue', password);
      
      if (data.success) {
        fetchStats(); // Refresh stats
      }
    } catch (error) {
      console.error('Failed to clear queue:', error);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchStats(true); // silent background refresh — keeps old data visible
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  if (loading) {
    return (
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center text-gray-100">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Retell Queue Stats
          </CardTitle>
        </CardHeader>
        <CardContent className="bg-gray-900">
          <div className="text-center py-8 text-gray-400">Завантаження...</div>
        </CardContent>
      </Card>
    );
  }

  if (!stats && fetchError) {
    return (
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-100">Retell Queue Stats</CardTitle>
        </CardHeader>
        <CardContent className="bg-gray-900">
          <div className="text-center py-8 space-y-3">
            <div className="text-red-400 text-sm">Не вдалося завантажити дані</div>
            <button onClick={fetchStats} className="text-xs text-blue-400 underline hover:text-blue-300">
              Спробувати знову
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between border-b border-gray-700">
          <div className="flex items-center gap-2">
            <CardTitle className="text-gray-100">Retell Queue Stats</CardTitle>
            {isRefreshing && (
              <Loader2 className="w-3 h-3 animate-spin text-gray-500" />
            )}
            {fetchError && !isRefreshing && (
              <span className="text-xs text-red-400 font-normal">⚠ помилка оновлення</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              {autoRefresh ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => fetchStats()}
              disabled={isRefreshing}
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6 bg-gray-900 text-gray-100">
          {/* Current Queue Size */}
          <div className="text-center p-4 bg-gray-800 rounded-lg border border-gray-700">
            <div className="text-3xl font-bold text-green-400">{stats?.current_queue_size || 0}</div>
            <div className="text-sm text-gray-400">новин в черзі зараз</div>
          </div>

          {/* Queue Overview */}
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-400">{stats?.pending_queue.m15 || 0}</div>
              <div className="text-sm text-gray-400">Останні 15хв</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{stats?.pending_queue.h1 || 0}</div>
              <div className="text-sm text-gray-400">Остання година</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">{stats?.pending_queue.h6 || 0}</div>
              <div className="text-sm text-gray-400">Останні 6 годин</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-400">{stats?.pending_queue.h24 || 0}</div>
              <div className="text-sm text-gray-400">Останні 24 години</div>
            </div>
          </div>

          {/* Completed Overview */}
          <div className="text-center p-2 bg-gray-800 rounded border border-gray-700">
            <div className="text-2xl font-bold text-green-400">{stats?.completed_h24.total || 0}</div>
            <div className="text-sm text-gray-400">оброблено за добу</div>
          </div>

          {/* Provider Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
              <h3 className="font-semibold text-blue-300 mb-2">Z.AI Provider</h3>
              <div className="text-xl font-bold text-blue-200">{stats?.completed_h24.zai || 0}</div>
              <div className="text-sm text-blue-400">переказів за 24г</div>
            </div>
            <div className="p-4 bg-purple-900/30 border border-purple-700 rounded-lg">
              <h3 className="font-semibold text-purple-300 mb-2">DeepSeek Provider</h3>
              <div className="text-xl font-bold text-purple-200">{stats?.completed_h24.deepseek || 0}</div>
              <div className="text-sm text-purple-400">переказів за 24г</div>
            </div>
          </div>

          {/* Last 2h cron runs table */}
          <div>
            <h3 className="font-semibold mb-2 text-gray-200">
              Крони — останні 4 год
              {stats?.cron_runs_30m && (
                <span className="ml-2 text-xs font-normal text-gray-400">
                  (30хв: {stats.cron_runs_30m.run_count} запусків, {stats.cron_runs_30m.processed} оброблено)
                </span>
              )}
            </h3>
            {!stats?.cron_runs_list || stats.cron_runs_list.length === 0 ? (
              <div className="text-sm text-gray-500 bg-gray-800 p-3 rounded border border-gray-700">
                Немає завершених кронів за останні 2 години
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-700">
                      <th className="text-left pb-1 pr-2">Час</th>
                      <th className="text-left pb-1 pr-2">LLM</th>
                      <th className="text-left pb-1 pr-2">Країна</th>
                      <th className="text-right pb-1 pr-2">Взято</th>
                      <th className="text-right pb-1 pr-2">Вдалих</th>
                      <th className="text-right pb-1">Помилок</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {stats.cron_runs_list.map((run, i) => {
                      const isZai = run.provider === 'zai' || run.job_name.includes('zai');
                      const isDs = run.provider === 'deepseek' || run.job_name.includes('deepseek');
                      return (
                        <tr key={i} className="hover:bg-gray-800/50">
                          <td className="py-1 pr-2 tabular-nums text-gray-400">
                            {new Date(run.created_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="py-1 pr-2">
                            <span className={`font-mono px-1 rounded text-[10px] ${
                              isZai ? 'text-blue-400' : isDs ? 'text-purple-400' : 'text-gray-400'
                            }`}>
                              {isZai ? 'Z.AI' : isDs ? 'DeepSeek' : run.provider || '?'}
                            </span>
                            {run.llm_model && (
                              <span className="ml-1 text-gray-600 font-mono">{run.llm_model}</span>
                            )}
                          </td>
                          <td className="py-1 pr-2 text-gray-500 uppercase">{run.country_code || '—'}</td>
                          <td className="py-1 pr-2 text-right text-gray-300 tabular-nums">{run.taken}</td>
                          <td className="py-1 pr-2 text-right tabular-nums">
                            <span className={run.success > 0 ? 'text-green-400' : 'text-gray-500'}>
                              {run.success}
                            </span>
                          </td>
                          <td className="py-1 text-right tabular-nums">
                            <span className={run.errors > 0 ? 'text-red-400' : 'text-gray-600'}>
                              {run.errors || '—'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Processing Controls */}
          <div className="flex gap-2 justify-center">
            <Button 
              onClick={() => processQueue('both')}
              disabled={processing}
              className="bg-green-700 hover:bg-green-600 text-white border-green-600"
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Запустити обробку (20 новин)
            </Button>
            <Button 
              variant="outline"
              onClick={() => processQueue('zai')}
              disabled={processing}
              className="border-blue-600 text-blue-300 hover:bg-blue-900/30"
            >
              Z.AI (10 новин)
            </Button>
            <Button 
              variant="outline"
              onClick={() => processQueue('deepseek')}
              disabled={processing}
              className="border-purple-600 text-purple-300 hover:bg-purple-900/30"
            >
              DeepSeek (10 новин)
            </Button>
            <Button 
              variant="destructive"
              onClick={clearQueue}
              size="sm"
              className="bg-red-800 hover:bg-red-700"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>

          {/* Last Process Result */}
          {lastResult && (
            <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
              <h3 className="font-semibold mb-2 text-gray-200">Останній результат обробки</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Badge variant="outline" className="mr-2 border-blue-600 text-blue-300">Z.AI</Badge>
                  <span className="text-gray-300">
                    Оброблено: {lastResult.zai.processed}, 
                    Успішно: {lastResult.zai.success}, 
                    Помилок: {lastResult.zai.failed}
                  </span>
                  {lastResult.zai.error && (
                    <div className="text-red-400 text-xs mt-1">Помилка: {lastResult.zai.error}</div>
                  )}
                </div>
                <div>
                  <Badge variant="outline" className="mr-2 border-purple-600 text-purple-300">DeepSeek</Badge>
                  <span className="text-gray-300">
                    Оброблено: {lastResult.deepseek.processed}, 
                    Успішно: {lastResult.deepseek.success}, 
                    Помилок: {lastResult.deepseek.failed}
                  </span>
                  {lastResult.deepseek.error && (
                    <div className="text-red-400 text-xs mt-1">Помилка: {lastResult.deepseek.error}</div>
                  )}
                </div>
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Час виконання: {Math.round(lastResult.total_time_ms / 1000)}с
                {lastResult.timeout_reached && (
                  <span className="text-red-400 ml-2">⚠️ Таймаут</span>
                )}
              </div>
            </div>
          )}

          {/* Hourly Chart */}
          {stats?.hourly_chart && stats.hourly_chart.length > 0 && (
            <div>
              <h3 className="font-semibold mb-4 text-gray-200">Погодинна активність (24 години)</h3>
              <div className="h-64 bg-gray-800 rounded border border-gray-700 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.hourly_chart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="time" stroke="#9CA3AF" fontSize={10} />
                    <YAxis stroke="#9CA3AF" fontSize={10} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1F2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#F3F4F6'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="zai" 
                      stroke="#60A5FA" 
                      strokeWidth={2}
                      name="Z.AI"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="deepseek" 
                      stroke="#A78BFA" 
                      strokeWidth={2}
                      name="DeepSeek"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="total" 
                      stroke="#34D399" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      name="Всього"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Recent Events */}
          <div>
            <h3 className="font-semibold mb-2 text-gray-200">Останні події черги (4 год)</h3>
            {!stats?.recent_queue_events || stats.recent_queue_events.length === 0 ? (
              <div className="text-sm text-gray-500 bg-gray-800 p-3 rounded border border-gray-700">
                Немає подій за останні 2 години
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {stats.recent_queue_events.slice(0, 40).map((event, index) => {
                  // Normalize details — sometimes nested, sometimes flat
                  const d = event.details || {};
                  const processed = d.success_count ?? d.processed ?? d.total_processed ?? 0;
                  const rawProvider = d.provider || d.details?.provider || '';
                  const provider = rawProvider
                    || ((event.job_name || '').toLowerCase().includes('zai') ? 'zai'
                    : (event.job_name || '').toLowerCase().includes('deepseek') ? 'deepseek' : '');
                  const isStart = event.event_type === 'run_started';
                  const isFailed = event.event_type === 'run_failed';
                  const isDone = !isStart && !isFailed;
                  const sampleItems: Array<{ slug: string; country: string; title: string }> = d.sample_items || [];
                  const llmModel: string = d.llm_model || '';
                  const countryCode: string = d.country_code || d.details?.country_code || '';
                  const errorMsg: string = d.error || d.details?.error || '';
                  const hasData = provider || llmModel || countryCode || processed > 0;
                  return (
                    <div key={index} className={`text-xs p-2 rounded border ${
                      isFailed ? 'bg-red-950/50 border-red-800'
                      : isStart ? 'bg-yellow-950/20 border-yellow-900/40'
                      : 'bg-gray-800 border-gray-700'
                    }`}>
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-gray-400 tabular-nums shrink-0">
                          {new Date(event.created_at).toLocaleTimeString('uk-UA')}
                        </span>
                        <span className={`px-1 rounded text-[10px] font-mono shrink-0 ${
                          isFailed ? 'text-red-400' : isStart ? 'text-yellow-400' : 'text-green-500'
                        }`}>
                          {isFailed ? 'FAIL' : isStart ? 'START' : 'DONE'}
                        </span>
                        {provider ? (
                          <span className={`font-mono px-1 rounded text-[10px] shrink-0 ${
                            provider === 'zai' ? 'text-blue-400' : 'text-purple-400'
                          }`}>
                            {provider === 'zai' ? 'Z.AI' : 'DeepSeek'}
                          </span>
                        ) : !hasData && (
                          <span className="text-[10px] text-gray-600 italic">{event.job_name || event.event_type}</span>
                        )}
                        {llmModel && (
                          <span className="text-[10px] text-gray-500 font-mono shrink-0" title="LLM model">
                            {llmModel}
                          </span>
                        )}
                        {countryCode && (
                          <span className="text-[10px] text-gray-500 uppercase shrink-0">{countryCode}</span>
                        )}
                        {isDone && (
                          <span className={`font-medium ml-auto ${
                            processed > 0 ? 'text-green-400' : 'text-gray-500'
                          }`}>
                            {processed} оброблено
                          </span>
                        )}
                        {isStart && (
                          <span className="text-yellow-600 ml-auto text-[10px]">очікування...</span>
                        )}
                        {isFailed && (
                          <span className="font-medium text-red-400 ml-auto truncate max-w-[200px]" title={errorMsg}>
                            {errorMsg ? errorMsg.slice(0, 60) : 'помилка'}
                          </span>
                        )}
                        {isDone && (d.error_count ?? 0) > 0 && (
                          <span className="text-red-400">{d.error_count} помилок</span>
                        )}
                      </div>
                      {isDone && sampleItems.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {sampleItems.map((item, i) => (
                            <a
                              key={i}
                              href={`/news/${item.country}/${item.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-[10px] text-gray-400 hover:text-blue-400 truncate"
                            >
                              {item.title || item.slug}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}