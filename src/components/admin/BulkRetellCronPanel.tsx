import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { callEdgeFunction } from '@/lib/api';
import { Play, Pause, Settings, Activity, Clock, CheckCircle2, XCircle, Trash2, Globe, RefreshCw, TrendingUp, AlertCircle, Zap } from 'lucide-react';
import { LLM_MODELS } from '@/types/database';
import { LineChart, Line, BarChart, Bar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface CronConfig {
    id: string;
    job_name: string;
    enabled: boolean;
    frequency_minutes: number;
    countries: string[];
    processing_options: Record<string, any>;
    last_run_at: string | null;
    last_run_status: string | null;
    last_run_details: any;
}

// Helper component for displaying bulk retell statistics with charts
function BulkRetellStats({ countryCode, password }: { countryCode: string; password: string }) {
    const { data: statsData } = useQuery({
        queryKey: ['bulk-retell-stats', countryCode],
        queryFn: async () => {
            const response = await callEdgeFunction('admin', {
                action: 'getBulkRetellStats',
                password,
                data: { country_code: countryCode }
            }) as { success: boolean; stats?: any; error?: string };

            if (!response.success) throw new Error(response.error);
            return response.stats;
        },
        refetchInterval: 15000, // Refresh every 15 seconds for real-time updates
        enabled: !!password,
    });

    if (!statsData) return null;

    // Prepare chart data from hourly statistics
    const chartData = Array.from({ length: 24 }, (_, i) => {
        const hour = new Date();
        hour.setHours(hour.getHours() - (23 - i));
        const hourKey = hour.getHours().toString().padStart(2, '0') + ':00';
        const hourlyStats = statsData.hourly?.[i] || { processed: 0, success: 0, failed: 0 };
        
        return {
            time: hourKey,
            processed: hourlyStats.processed || 0,
            success: hourlyStats.success || 0,
            failed: hourlyStats.failed || 0,
            successRate: hourlyStats.processed > 0 ? Math.round((hourlyStats.success / hourlyStats.processed) * 100) : 0
        };
    });

    const successRate = statsData.all_time > 0 
        ? Math.round(((statsData.all_time - (statsData.failed || 0)) / statsData.all_time) * 100)
        : 0;

    const avgProcessingTime = statsData.avg_processing_time_ms || 0;
    const itemsPerMinute = statsData.recent_rate || 0;

    return (
        <div className="space-y-4 mt-3">
            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-sm">
                <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                    <div className="text-muted-foreground text-xs uppercase tracking-wide">All-time</div>
                    <div className="font-bold text-lg text-green-500">{statsData.all_time || 0}</div>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <div className="text-muted-foreground text-xs uppercase tracking-wide">Last 24h</div>
                    <div className="font-bold text-lg text-blue-500">{statsData.h24 || 0}</div>
                </div>
                <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                    <div className="text-muted-foreground text-xs uppercase tracking-wide">Last Hour</div>
                    <div className="font-bold text-lg text-purple-500">{statsData.h1 || 0}</div>
                </div>
                <div className={`p-3 rounded-lg border ${successRate >= 90 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-orange-500/10 border-orange-500/20'}`}>
                    <div className="text-muted-foreground text-xs uppercase tracking-wide">Success Rate</div>
                    <div className={`font-bold text-lg ${successRate >= 90 ? 'text-emerald-500' : 'text-orange-500'}`}>{successRate}%</div>
                </div>
                <div className="p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                    <div className="text-muted-foreground text-xs uppercase tracking-wide">Avg Time</div>
                    <div className="font-bold text-lg text-cyan-500">{Math.round(avgProcessingTime)}ms</div>
                </div>
                <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                    <div className="text-muted-foreground text-xs uppercase tracking-wide">Rate</div>
                    <div className="font-bold text-lg text-amber-500">{itemsPerMinute.toFixed(1)}/min</div>
                </div>
            </div>

            {/* Charts */}
            {chartData && chartData.length > 0 && (
                <>
                    {/* Processing Volume Chart */}
                    <Card className="bg-muted/30 border border-muted">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-green-500" />
                                Processing Volume (24h)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[180px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                        <XAxis 
                                            dataKey="time" 
                                            stroke="#666"
                                            fontSize={11}
                                            interval={Math.floor(chartData.length / 6)}
                                        />
                                        <YAxis stroke="#666" fontSize={11} />
                                        <Tooltip 
                                            contentStyle={{
                                                backgroundColor: 'rgba(0,0,0,0.9)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '6px',
                                                fontSize: '12px'
                                            }}
                                        />
                                        <Legend />
                                        <Bar dataKey="success" stackId="a" fill="#22c55e" name="Success" />
                                        <Bar dataKey="failed" stackId="a" fill="#ef4444" name="Failed" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Success Rate Trend */}
                    <Card className="bg-muted/30 border border-muted">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Activity className="w-4 h-4 text-purple-500" />
                                Success Rate Trend (24h)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[140px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                        <XAxis 
                                            dataKey="time" 
                                            stroke="#666"
                                            fontSize={11}
                                            interval={Math.floor(chartData.length / 6)}
                                        />
                                        <YAxis stroke="#666" fontSize={11} domain={[0, 100]} />
                                        <Tooltip 
                                            contentStyle={{
                                                backgroundColor: 'rgba(0,0,0,0.9)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '6px',
                                                fontSize: '12px'
                                            }}
                                            formatter={(value) => `${value}%`}
                                        />
                                        <Line 
                                            type="monotone" 
                                            dataKey="successRate" 
                                            stroke="#a855f7" 
                                            dot={false}
                                            strokeWidth={2}
                                            name="Success %"
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}

// Helper function to calculate time until next run
function getNextRunInfo(lastRunAt: string | null, frequencyMinutes: number): { text: string; isOverdue: boolean } {
    if (!lastRunAt) {
        return { text: 'Not run yet', isOverdue: false };
    }

    const lastRun = new Date(lastRunAt).getTime();
    const now = Date.now();
    const frequencyMs = frequencyMinutes * 60 * 1000;
    const nextRun = lastRun + frequencyMs;
    const timeUntil = nextRun - now;

    if (timeUntil <= 0) {
        const overdue = Math.abs(timeUntil);
        const overdueMinutes = Math.floor(overdue / (60 * 1000));
        if (overdueMinutes < 60) {
            return { text: `Overdue by ${overdueMinutes}m`, isOverdue: true };
        }
        const overdueHours = Math.floor(overdueMinutes / 60);
        return { text: `Overdue by ${overdueHours}h`, isOverdue: true };
    }

    const minutes = Math.floor(timeUntil / (60 * 1000));
    if (minutes < 60) {
        return { text: `in ${minutes}m`, isOverdue: false };
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
        return { text: `in ${hours}h`, isOverdue: false };
    }
    return { text: `in ${hours}h ${remainingMinutes}m`, isOverdue: false };
}


// Helper component for creating new bulk retell crons
function BulkRetellForm({ onSuccess, password }: { onSuccess: () => void; password: string }) {
    const [countryCode, setCountryCode] = useState('');
    const [timeRange, setTimeRange] = useState<'last_1h' | 'all'>('last_1h');
    const [llmModel, setLlmModel] = useState('');
    const [llmProvider, setLlmProvider] = useState('');
    const [frequencyMinutes, setFrequencyMinutes] = useState(60);
    const [isCreating, setIsCreating] = useState(false);

    const allCountries = [
        { code: 'us', label: 'United States' },
        { code: 'ua', label: 'Ukraine' },
        { code: 'gb', label: 'United Kingdom' },
    ];

    const handleCreate = async () => {
        if (!countryCode || !llmModel || !llmProvider) {
            toast.error('Please fill all fields');
            return;
        }

        setIsCreating(true);
        try {
            const result = await callEdgeFunction('admin', {
                action: 'createBulkRetellCron',
                password,
                data: {
                    country_code: countryCode,
                    time_range: timeRange,
                    llm_model: llmModel,
                    llm_provider: llmProvider,
                    frequency_minutes: frequencyMinutes
                }
            }) as { success: boolean; error?: string };

            if (result.success) {
                toast.success('Bulk retell cron created successfully');
                setCountryCode('');
                setLlmModel('');
                setLlmProvider('');
                onSuccess();
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to create cron');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div className="space-y-2">
                <Label>Country</Label>
                <Select value={countryCode} onValueChange={setCountryCode}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                        {allCountries.map((c) => (
                            <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Time Range</Label>
                <Select value={timeRange} onValueChange={(v: any) => setTimeRange(v)}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="last_1h">Last 1 Hour</SelectItem>
                        <SelectItem value="last_24h">Last 24 Hours</SelectItem>
                        <SelectItem value="all">Unprocessed (All)</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Model</Label>
                <Select
                    value={llmModel}
                    onValueChange={(val) => {
                        setLlmModel(val);
                        setLlmModel(val);
                        // Find provider by iterating keys
                        let foundProvider = 'google';
                        for (const [providerKey, providerConfig] of Object.entries(LLM_MODELS)) {
                            // providerConfig is unknown here, cast to any or check shape
                            const config = providerConfig as { text?: Array<{ value: string }> };
                            if (config.text?.some(m => m.value === val)) {
                                foundProvider = providerKey;
                                break;
                            }
                        }
                        setLlmProvider(foundProvider);
                    }}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Select Model" />
                    </SelectTrigger>
                    <SelectContent>
                        {[
                            ...(LLM_MODELS.gemini?.text || []),
                            ...(LLM_MODELS.geminiV22?.text || []),
                            ...(LLM_MODELS.openai?.text || []),
                            ...(LLM_MODELS.anthropic?.text || []),
                            ...(LLM_MODELS.zai?.text || []),
                            ...(LLM_MODELS.mistral?.text || []),
                            ...(LLM_MODELS.lovable?.text || []),
                        ].map((m: any) => (
                            <SelectItem key={m.value} value={m.value}>
                                {m.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Frequency</Label>
                <Select value={frequencyMinutes.toString()} onValueChange={(v) => setFrequencyMinutes(parseInt(v))}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="5">Every 5 mins</SelectItem>
                        <SelectItem value="15">Every 15 mins</SelectItem>
                        <SelectItem value="30">Every 30 mins</SelectItem>
                        <SelectItem value="60">Every 1 hour</SelectItem>
                        <SelectItem value="120">Every 2 hours</SelectItem>
                        <SelectItem value="360">Every 6 hours</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <Button onClick={handleCreate} disabled={isCreating}>
                {isCreating ? <Activity className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                Create Cron
            </Button>
        </div>
    );
}

export function BulkRetellCronPanel({ password }: { password: string }) {
    const queryClient = useQueryClient();

    // Fetch cron configs
    const { data: configsData, isLoading } = useQuery({
        queryKey: ['cron-configs'],
        queryFn: async () => {
            const response = await callEdgeFunction('admin', { action: 'getCronConfigs', password }) as { success: boolean; configs: CronConfig[] };
            if (!response.success) throw new Error('Failed to fetch configs');
            return response;
        },
        enabled: !!password,
    });

    // Fetch global stats
    const { data: globalStats } = useQuery({
        queryKey: ['global-news-stats'],
        queryFn: async () => {
            const response = await callEdgeFunction('admin', {
                action: 'getGlobalNewsStats',
                password
            }) as { success: boolean; stats: any; error?: string };

            if (!response.success) throw new Error(response.error);
            return response.stats;
        },
        refetchInterval: 30000,
        enabled: !!password,
    });

    const allCountries = [
        { code: 'us', label: 'United States' },
        { code: 'ua', label: 'Ukraine' },
        { code: 'gb', label: 'United Kingdom' },
    ];

    if (isLoading) return <div>Loading crons...</div>;

    const bulkCrons = configsData?.configs?.filter((c: CronConfig) => c.job_name.startsWith('bulk_retell_')) || [];

    return (
        <Card className="cosmic-card">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Settings className="w-5 h-5 text-purple-500" />
                            Bulk News Retelling Automation
                        </CardTitle>
                        <CardDescription>Scheduled jobs for automatic news retelling</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {globalStats && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 border rounded-lg bg-green-500/5 space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <Activity className="w-4 h-4 text-green-500" />
                                Global News Fetching
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <div className="text-xs text-muted-foreground">Last hour</div>
                                    <div className="text-lg font-bold">{globalStats.fetching?.h1 || 0}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">Today (24h)</div>
                                    <div className="text-lg font-bold">{globalStats.fetching?.h24 || 0}</div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border rounded-lg bg-purple-500/5 space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <RefreshCw className="w-4 h-4 text-purple-500" />
                                Global News Retelling
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <div className="text-xs text-muted-foreground">Last hour</div>
                                    <div className="text-lg font-bold">{globalStats.retelling?.h1 || 0}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">Today (24h)</div>
                                    <div className="text-lg font-bold">{globalStats.retelling?.h24 || 0}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* List of Active Bulk Retell Crons */}
                <div className="space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        Active Crons
                    </h4>
                    {bulkCrons.map((cron: CronConfig) => {
                        const countryCode = cron.processing_options?.country_code || '';
                        const country = allCountries.find(c => c.code === countryCode);

                        return (
                            <div key={cron.id} className="p-4 border rounded-lg space-y-3 bg-muted/20">
                                <div className="flex items-center justify-between flex-wrap gap-4">
<div className="flex items-center gap-3 flex-1">
                                            <div className={`flex items-center justify-center w-12 h-12 rounded-full text-lg font-bold relative ${
                                                cron.enabled 
                                                    ? 'bg-green-500/20 border border-green-500/40 text-green-400' 
                                                    : 'bg-muted/50 border border-muted-foreground/20 text-muted-foreground'
                                            }`}>
                                                {countryCode.toUpperCase()}
                                                {cron.enabled && (
                                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-medium flex items-center gap-2">
                                                    {country?.label || countryCode.toUpperCase()}
                                                    <Badge 
                                                        variant={cron.enabled ? 'default' : 'secondary'} 
                                                        className={`text-xs ${cron.enabled ? 'bg-green-500/30 text-green-400' : ''}`}
                                                    >
                                                        {cron.enabled ? '● Active' : '○ Paused'}
                                                    </Badge>
                                                </div>
                                                <div className="text-sm text-muted-foreground space-y-1 mt-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            Every {cron.frequency_minutes}m
                                                        </span>
                                                        {cron.enabled && (() => {
                                                            const nextRun = getNextRunInfo(cron.last_run_at, cron.frequency_minutes);
                                                            return (
                                                                <>
                                                                    <span className="text-border">●</span>
                                                                    <span className={`font-medium ${nextRun.isOverdue ? 'text-orange-500 animate-pulse' : 'text-cyan-400'}`}>
                                                                        {nextRun.isOverdue ? '⚠️' : '⏱️'} Next: {nextRun.text}
                                                                    </span>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                    <div className="text-xs">
                                                        📋 Scope: {cron.processing_options?.time_range === 'all' ? 'All unprocessed' : cron.processing_options?.time_range || 'default'}
                                                    </div>
                                                    <div className="text-xs">
                                                        🤖 Model: {cron.processing_options?.llm_model}
                                                    </div>
                                                </div>
                                                {cron.last_run_at && (
                                                    <div className="text-xs mt-2 flex flex-wrap items-center gap-2">
                                                        <span className="text-muted-foreground">Last: {new Date(cron.last_run_at).toLocaleTimeString()}</span>
                                                        {cron.last_run_status === 'success' ? (
                                                            <CheckCircle2 className="w-3 h-3 text-green-500" />
                                                        ) : cron.last_run_status === 'running' ? (
                                                            <Activity className="w-3 h-3 text-blue-500 animate-spin" />
                                                        ) : (
                                                            <XCircle className="w-3 h-3 text-red-500" />
                                                        )}
                                                        {cron.last_run_details?.processed !== undefined && (
                                                            <Badge variant="outline" className="text-xs">
                                                                {cron.last_run_details.processed} items
                                                            </Badge>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30 text-blue-400"
                                            onClick={async () => {
                                                try {
                                                    const result = await callEdgeFunction('bulk-retell-news', {
                                                        password,
                                                        country_code: cron.processing_options?.country_code,
                                                        time_range: cron.processing_options?.time_range,
                                                        llm_model: cron.processing_options?.llm_model,
                                                        llm_provider: cron.processing_options?.llm_provider,
                                                        job_name: cron.job_name
                                                    }) as any;

                                                    if (result.success) {
                                                        toast.success(`✓ Processed ${result.processed} items. Success: ${result.success_count}, Errors: ${result.error_count}`);
                                                        queryClient.invalidateQueries({ queryKey: ['cron-configs'] });
                                                        queryClient.invalidateQueries({ queryKey: ['bulk-retell-stats', cron.processing_options?.country_code] });
                                                    } else {
                                                        toast.error('Run failed: ' + (result.message || 'Unknown error'));
                                                    }
                                                } catch (e) {
                                                    toast.error('Failed to run: ' + (e instanceof Error ? e.message : String(e)));
                                                }
                                            }}
                                        >
                                            <Play className="w-4 h-4 mr-1" />
                                            Run Now
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={async () => {
                                                // Same logic as in NewsProcessingPage - toggle enabled
                                                // For now, let's just use invalidation as we removed the toggle mutation from here to keep it simple
                                                // Or we can re-implement it.
                                                // Since I extracted this, I should probably expose the toggle functionality or import it.
                                                // But `callEdgeFunction` can do it.
                                                try {
                                                    await callEdgeFunction('admin', {
                                                        action: 'updateCronConfig',
                                                        password,
                                                        data: {
                                                            jobName: cron.job_name,
                                                            config: { enabled: !cron.enabled }
                                                        }
                                                    });
                                                    queryClient.invalidateQueries({ queryKey: ['cron-configs'] });
                                                    toast.success(cron.enabled ? 'Cron paused' : 'Cron resumed');
                                                } catch (e) {
                                                    toast.error('Failed to toggle cron');
                                                }
                                            }}
                                        >
                                            {cron.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={async () => {
                                                if (!confirm(`Delete bulk retell cron for ${country?.label}?`)) return;

                                                try {
                                                    const result = await callEdgeFunction('admin', {
                                                        action: 'deleteBulkRetellCron',
                                                        password,
                                                        data: { jobName: cron.job_name }
                                                    }) as { success: boolean; error?: string };

                                                    if (result.success) {
                                                        toast.success('Cron deleted');
                                                        queryClient.invalidateQueries({ queryKey: ['cron-configs'] });
                                                    } else {
                                                        throw new Error(result.error);
                                                    }
                                                } catch (error) {
                                                    toast.error(error instanceof Error ? error.message : 'Failed to delete');
                                                }
                                            }}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Statistics */}
                                <BulkRetellStats countryCode={countryCode} password={password} />
                            </div>
                        );
                    })}

                    {bulkCrons.length === 0 && (
                        <div className="text-center text-muted-foreground py-8 border border-dashed rounded-lg">
                            No active bulk retelling jobs. Create one below!
                        </div>
                    )}
                </div>

                {/* Add New Cron Form */}
                <div className="border-t pt-6">
                    <h4 className="font-medium mb-4 flex items-center gap-2">
                        <PlusIcon className="w-4 h-4" />
                        Create New Bulk Retell Cron
                    </h4>
                    <BulkRetellForm onSuccess={() => queryClient.invalidateQueries({ queryKey: ['cron-configs'] })} password={password} />
                </div>
            </CardContent>
        </Card>
    );
}

function PlusIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M5 12h14" />
            <path d="M12 5v14" />
        </svg>
    )
}
