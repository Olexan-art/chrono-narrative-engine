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
  const [processing, setProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<QueueProcessResult | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchStats = async () => {
    try {
      const data = await adminAction<{ success: boolean; stats: QueueStats }>('getRetellQueueStats', password);
      
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch retell queue stats:', error);
    } finally {
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
      fetchStats();
    }, 30000); // 30 секунд

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

  return (
    <div className="space-y-4">
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between border-b border-gray-700">
          <CardTitle className="text-gray-100">Retell Queue Stats</CardTitle>
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
              onClick={fetchStats}
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              <RefreshCw className="w-4 h-4" />
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
          {stats?.recent_queue_events && stats.recent_queue_events.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2 text-gray-200">Останні події черги</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {stats.recent_queue_events.slice(0, 5).map((event, index) => (
                  <div key={index} className="text-xs bg-gray-800 p-2 rounded border border-gray-700">
                    <div className="flex justify-between text-gray-300">
                      <span className="text-gray-400">
                        {new Date(event.created_at).toLocaleString('uk-UA')}
                      </span>
                      <span className="font-medium text-green-400">
                        {event.details?.total_processed || 0} оброблено
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}