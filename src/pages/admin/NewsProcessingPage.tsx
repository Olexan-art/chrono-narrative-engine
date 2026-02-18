import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { callEdgeFunction } from '@/lib/api';
import { Play, Pause, Settings, Activity, Clock, CheckCircle2, XCircle, RefreshCw, BarChart3, Zap, Timer, AlertCircle } from 'lucide-react';
import { LLM_MODELS } from '@/types/database';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { BulkRetellCronPanelEnhanced } from '@/components/admin/BulkRetellCronPanelEnhanced';

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

function NewsProcessingChart({ data }: { data: any[] }) {
    if (!data || data.length === 0) return null;

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    News Volume (24h)
                </CardTitle>
                <CardDescription>Hourly volume for fetching and successful retelling</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[250px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient id="colorFetching" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                            <XAxis
                                dataKey="time"
                                stroke="#888888"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                interval={3}
                            />
                            <YAxis
                                stroke="#888888"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(0,0,0,0.8)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                    fontSize: '11px'
                                }}
                            />
                            <Legend wrapperStyle={{ fontSize: '11px' }} />
                            <Area
                                type="monotone"
                                dataKey="fetching"
                                name="Fetched"
                                stroke="#22c55e"
                                fillOpacity={1}
                                fill="url(#colorFetching)"
                                strokeWidth={2}
                            />
                            <Area
                                type="monotone"
                                dataKey="success"
                                name="Retold"
                                stroke="#a855f7"
                                fillOpacity={1}
                                fill="url(#colorSuccess)"
                                strokeWidth={2}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}

function ProcessingHealthChart({ data }: { data: any[] }) {
    if (!data || data.length === 0) return null;

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Activity className="w-5 h-5 text-orange-500" />
                    Processing Health (24h)
                </CardTitle>
                <CardDescription>Success vs Error ratio during retelling</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[250px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient id="colorRS" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorRE" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                            <XAxis
                                dataKey="time"
                                stroke="#888888"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                interval={3}
                            />
                            <YAxis
                                stroke="#888888"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(0,0,0,0.8)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                    fontSize: '11px'
                                }}
                            />
                            <Legend wrapperStyle={{ fontSize: '11px' }} />
                            <Area
                                type="monotone"
                                dataKey="success"
                                name="Success"
                                stroke="#22c55e"
                                fillOpacity={1}
                                fill="url(#colorRS)"
                                strokeWidth={2}
                                stackId="1"
                            />
                            <Area
                                type="monotone"
                                dataKey="errors"
                                name="Errors"
                                stroke="#ef4444"
                                fillOpacity={1}
                                fill="url(#colorRE)"
                                strokeWidth={2}
                                stackId="1"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}

// Advanced statistics component for the entire processing pipeline
function ProcessingDashboard({ password }: { password: string }) {
    const { data: dashboardStats, refetch } = useQuery({
        queryKey: ['processing-dashboard-stats'],
        queryFn: async () => {
            const response = await callEdgeFunction('admin', {
                action: 'getProcessingDashboardStats',
                password
            }) as { success: boolean; queueStats: any[]; throughput: { h1: number }; recentFailures: any[] };

            if (!response.success) throw new Error('Failed to fetch dashboard stats');
            return response;
        },
        refetchInterval: 15000,
        enabled: !!password,
    });

    if (!dashboardStats) return null;

    const totalPending = dashboardStats.queueStats.reduce((acc, curr) => acc + curr.pending, 0);
    const estFinishMinutes = totalPending > 0 && dashboardStats.throughput.h1 > 0
        ? Math.round((totalPending / (dashboardStats.throughput.h1)) * 60)
        : null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground uppercase">Queue Depth</p>
                            <p className="text-3xl font-bold text-primary">{totalPending}</p>
                        </div>
                        <Activity className="w-8 h-8 text-primary/40" />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-1">
                        {dashboardStats.queueStats.map(s => (
                            <Badge key={s.code} variant="outline" className="text-[10px] px-1 h-5">
                                {s.code}: {s.pending}
                            </Badge>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-green-500/5 border-green-500/20">
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground uppercase">Throughput (1h)</p>
                            <p className="text-3xl font-bold text-green-500">{dashboardStats.throughput.h1}</p>
                        </div>
                        <Zap className="w-8 h-8 text-green-500/40" />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2 italic">
                        Items processed per hour
                    </p>
                </CardContent>
            </Card>

            <Card className="bg-orange-500/5 border-orange-500/20">
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground uppercase">Est. Completion</p>
                            <p className="text-3xl font-bold text-orange-500">
                                {estFinishMinutes ? `${Math.floor(estFinishMinutes / 60)}h ${estFinishMinutes % 60}m` : 'N/A'}
                            </p>
                        </div>
                        <Timer className="w-8 h-8 text-orange-500/40" />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2 italic">
                        Based on last hour speed
                    </p>
                </CardContent>
            </Card>

            <Card className="bg-red-500/5 border-red-500/20">
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground uppercase">Recent Errors</p>
                            <p className="text-3xl font-bold text-red-500">{dashboardStats.recentFailures.length}</p>
                        </div>
                        <AlertCircle className="w-8 h-8 text-red-500/40" />
                    </div>
                    <div className="mt-4 text-[10px] space-y-1 overflow-hidden">
                        {dashboardStats.recentFailures.slice(0, 2).map((f, i) => (
                            <div key={i} className="truncate text-red-400">
                                {f.error_message}
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// Helper component for displaying bulk retell statistics
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
        refetchInterval: 30000, // Refresh every 30 seconds
        enabled: !!password,
    });

    if (!statsData) return null;

    return (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-sm">
            <div>
                <div className="text-muted-foreground">All-time</div>
                <div className="font-bold">{statsData.all_time || 0}</div>
            </div>
            <div>
                <div className="text-muted-foreground">1h</div>
                <div className="font-bold">{statsData.h1 || 0}</div>
            </div>
            <div>
                <div className="text-muted-foreground">6h</div>
                <div className="font-bold">{statsData.h6 || 0}</div>
            </div>
            <div>
                <div className="text-muted-foreground">24h</div>
                <div className="font-bold">{statsData.h24 || 0}</div>
            </div>
            <div>
                <div className="text-muted-foreground">3d</div>
                <div className="font-bold">{statsData.d3 || 0}</div>
            </div>
            <div>
                <div className="text-muted-foreground">7d</div>
                <div className="font-bold">{statsData.d7 || 0}</div>
            </div>
        </div>
    );
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
        { code: 'pl', label: 'Poland' },
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
                toast.success('Bulk retell cron created');
                // Reset form
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <Label>Country</Label>
                <Select value={countryCode} onValueChange={setCountryCode}>
                    <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                        {allCountries.map((country) => (
                            <SelectItem key={country.code} value={country.code}>
                                {country.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div>
                <Label>Time Range</Label>
                <Select value={timeRange} onValueChange={(v) => setTimeRange(v as 'last_1h' | 'all')}>
                    <SelectTrigger className="mt-2">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="last_1h">Last 1 hour</SelectItem>
                        <SelectItem value="all">All news</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div>
                <Label>AI Model</Label>
                <Select
                    value={llmModel}
                    onValueChange={(model) => {
                        setLlmModel(model);
                        // Auto-detect provider
                        let provider = 'zai';
                        if (model.startsWith('gpt')) provider = 'openai';
                        else if (model.startsWith('gemini')) provider = 'gemini';
                        else if (model.startsWith('claude')) provider = 'anthropic';
                        else if (model.startsWith('mistral')) provider = 'mistral';
                        else if (model.startsWith('GLM')) provider = 'zai';
                        setLlmProvider(provider);
                    }}
                >
                    <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                        {[
                            ...(LLM_MODELS.openai?.text || []),
                            ...(LLM_MODELS.gemini?.text || []),
                            ...(LLM_MODELS.anthropic?.text || []),
                            ...(LLM_MODELS.zai?.text || []),
                            ...(LLM_MODELS.mistral?.text || []),
                        ].map((m: any) => (
                            <SelectItem key={m.value} value={m.value}>
                                {m.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div>
                <Label>Schedule</Label>
                <Select value={String(frequencyMinutes)} onValueChange={(v) => setFrequencyMinutes(Number(v))}>
                    <SelectTrigger className="mt-2">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="5">Every 5 minutes</SelectItem>
                        <SelectItem value="15">Every 15 minutes</SelectItem>
                        <SelectItem value="30">Every 30 minutes</SelectItem>
                        <SelectItem value="60">Every 1 hour</SelectItem>
                        <SelectItem value="180">Every 3 hours</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="md:col-span-2">
                <Button onClick={handleCreate} disabled={isCreating} className="w-full">
                    {isCreating ? 'Creating...' : 'Create Bulk Retell Cron'}
                </Button>
            </div>
        </div>
    );
}

// Diagnostic component to inspect raw logs
function DiagnosticInfo({ password }: { password: string }) {
    const { data: diagData, refetch, isFetching } = useQuery({
        queryKey: ['admin-diagnostics'],
        queryFn: async () => {
            const response = await callEdgeFunction('admin', {
                action: 'getDiagnosticLogs',
                password
            }) as { success: boolean; logs: any[]; cronConfigs: any[]; error?: string };

            if (!response.success) throw new Error(response.error);
            return response;
        },
        enabled: false, // Only manual trigger
    });

    return (
        <Card className="mt-8 border-dashed border-primary/30">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground">Admin Diagnostics</CardTitle>
                        <CardDescription>Raw logs and configurations for troubleshooting</CardDescription>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
                        {isFetching ? 'Fetching...' : 'Show Raw Data'}
                    </Button>
                </div>
            </CardHeader>
            {diagData && (
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase">Last 10 LLM Usage Logs (retell-news)</h4>
                        <div className="max-h-60 overflow-auto border rounded p-2 bg-black/50 font-mono text-[10px]">
                            {diagData.logs.length === 0 ? (
                                <p className="text-muted-foreground italic">No logs found</p>
                            ) : (
                                diagData.logs.map((log: any) => (
                                    <div key={log.id} className="mb-2 border-b border-white/5 pb-1">
                                        <div className="flex justify-between text-primary">
                                            <span>{new Date(log.created_at).toLocaleString()}</span>
                                            <span>{log.model}</span>
                                        </div>
                                        <div className="text-muted-foreground">
                                            Success: {String(log.success)} | Duration: {log.duration_ms}ms
                                        </div>
                                        <div className="text-amber-500 whitespace-pre-wrap">
                                            Metadata: {JSON.stringify(log.metadata)}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase">Internal Cron Configs</h4>
                        <div className="max-h-40 overflow-auto border rounded p-2 bg-black/50 font-mono text-[10px]">
                            {diagData.cronConfigs.map((cfg: any) => (
                                <div key={cfg.id} className="mb-1">
                                    {cfg.job_name}: {cfg.last_run_status} ({cfg.last_run_at ? new Date(cfg.last_run_at).toLocaleString() : 'never'})
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            )}
        </Card>
    );
}

export default function NewsProcessingPage({ password }: { password: string }) {
    const queryClient = useQueryClient();

    // Fetch cron configurations
    // Fetch cron configurations
    const { data: configsData, isLoading } = useQuery({
        queryKey: ['cron-configs'],
        queryFn: async () => {
            const response = await callEdgeFunction('admin', {
                action: 'getCronConfigs',
                password
            }) as { success: boolean; error?: string; configs: CronConfig[] };

            if (!response.success) throw new Error(response.error);
            return response;
        },
        refetchInterval: 10000, // Refresh every 10 seconds
        enabled: !!password,
    });

    const fetchingConfig = configsData?.configs?.find((c: CronConfig) => c.job_name === 'news_fetching');
    const retellingConfig = configsData?.configs?.find((c: CronConfig) => c.job_name === 'news_retelling');

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

    // Pause/Resume mutation
    const toggleMutation = useMutation({
        mutationFn: async ({ jobName, action }: { jobName: string; action: 'pause' | 'resume' }) => {
            const enabled = action === 'resume';
            const result = await callEdgeFunction('admin', {
                action: 'updateCronConfig',
                password,
                data: {
                    jobName,
                    config: { enabled }
                }
            }) as { success: boolean; error?: string };

            if (!result.success) throw new Error(result.error);
            return result;
        },
        onSuccess: (_, variables) => {
            toast.success(`Job ${variables.action === 'pause' ? 'paused' : 'resumed'}`);
            queryClient.invalidateQueries({ queryKey: ['cron-configs'] });
        },
        onError: (error: Error) => {
            toast.error(error.message);
        },
    });

    // Update config mutation
    const updateConfigMutation = useMutation({
        mutationFn: async ({ jobName, config }: { jobName: string; config: any }) => {
            const result = await callEdgeFunction('admin', {
                action: 'updateCronConfig',
                password,
                data: {
                    jobName,
                    config
                }
            }) as { success: boolean; error?: string };

            if (!result.success) throw new Error(result.error);
            return result;
        },
        onSuccess: () => {
            toast.success('Configuration updated');
            queryClient.invalidateQueries({ queryKey: ['cron-configs'] });
        },
        onError: (error: Error) => {
            toast.error(error.message);
        },
    });

    const allCountries = [
        { code: 'us', label: 'United States' },
        { code: 'ua', label: 'Ukraine' },
        { code: 'pl', label: 'Poland' },
    ];

    const processingOptions = [
        { key: 'tags', label: 'Tags' },
        { key: 'retelling', label: 'Retelling' },
        { key: 'entities', label: 'Entities' },
        { key: 'key_points', label: 'Key Points' },
    ];

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold">News Processing</h1>
                <p className="text-muted-foreground">Manage automated news fetching and retelling</p>
            </div>

            {globalStats?.history && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    <NewsProcessingChart data={globalStats.history} />
                    <ProcessingHealthChart data={globalStats.history} />
                </div>
            )}

            {/* Dashboard Stats */}
            <ProcessingDashboard password={password} />

            {/* News Fetching Section */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Activity className="w-5 h-5" />
                                News Fetching
                            </CardTitle>
                            <CardDescription>Automatically fetch news from RSS feeds</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            {fetchingConfig?.enabled ? (
                                <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    Running
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-500/20">
                                    <Pause className="w-3 h-3 mr-1" />
                                    Paused
                                </Badge>
                            )}
                            <Button
                                size="sm"
                                variant={fetchingConfig?.enabled ? 'destructive' : 'default'}
                                onClick={() =>
                                    toggleMutation.mutate({
                                        jobName: 'news_fetching',
                                        action: fetchingConfig?.enabled ? 'pause' : 'resume',
                                    })
                                }
                                disabled={toggleMutation.isPending}
                            >
                                {fetchingConfig?.enabled ? (
                                    <>
                                        <Pause className="w-4 h-4 mr-1" />
                                        Pause
                                    </>
                                ) : (
                                    <>
                                        <Play className="w-4 h-4 mr-1" />
                                        Resume
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <Label>Frequency</Label>
                            <Select
                                value={fetchingConfig?.frequency_minutes?.toString() || '60'}
                                onValueChange={(value) =>
                                    updateConfigMutation.mutate({
                                        jobName: 'news_fetching',
                                        config: { frequency_minutes: parseInt(value) },
                                    })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="15">Every 15 minutes</SelectItem>
                                    <SelectItem value="30">Every 30 minutes</SelectItem>
                                    <SelectItem value="60">Every hour</SelectItem>
                                    <SelectItem value="180">Every 3 hours</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Last Run</Label>
                            <div className="text-sm text-muted-foreground mt-2">
                                {fetchingConfig?.last_run_at
                                    ? new Date(fetchingConfig.last_run_at).toLocaleString()
                                    : 'Never'}
                            </div>
                        </div>

                        <div>
                            <Label>Status</Label>
                            <div className="mt-2">
                                {fetchingConfig?.last_run_status === 'success' ? (
                                    <Badge variant="outline" className="bg-green-500/10 text-green-500">
                                        Success
                                    </Badge>
                                ) : fetchingConfig?.last_run_status === 'failed' ? (
                                    <Badge variant="outline" className="bg-red-500/10 text-red-500">
                                        Failed
                                    </Badge>
                                ) : (
                                    <Badge variant="outline">Unknown</Badge>
                                )}
                            </div>
                        </div>
                    </div>

                    <div>
                        <Label>Countries</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {allCountries.map((country) => (
                                <div key={country.code} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`fetch-${country.code}`}
                                        checked={fetchingConfig?.countries?.includes(country.code)}
                                        onCheckedChange={(checked) => {
                                            const newCountries = checked
                                                ? [...(fetchingConfig?.countries || []), country.code]
                                                : (fetchingConfig?.countries || []).filter((c) => c !== country.code);
                                            updateConfigMutation.mutate({
                                                jobName: 'news_fetching',
                                                config: { countries: newCountries },
                                            });
                                        }}
                                    />
                                    <Label htmlFor={`fetch-${country.code}`} className="cursor-pointer">
                                        {country.label}
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </div>

                    {fetchingConfig?.last_run_details && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                            <div>
                                <div className="text-sm text-muted-foreground">Fetched</div>
                                <div className="text-2xl font-bold">
                                    {fetchingConfig.last_run_details.fetched || 0}
                                </div>
                            </div>
                            <div>
                                <div className="text-sm text-muted-foreground">Added</div>
                                <div className="text-2xl font-bold text-green-500">
                                    {fetchingConfig.last_run_details.added || 0}
                                </div>
                            </div>
                            <div>
                                <div className="text-sm text-muted-foreground">Duplicates</div>
                                <div className="text-2xl font-bold text-yellow-500">
                                    {fetchingConfig.last_run_details.duplicates || 0}
                                </div>
                            </div>
                            <div>
                                <div className="text-sm text-muted-foreground">Errors</div>
                                <div className="text-2xl font-bold text-red-500">
                                    {fetchingConfig.last_run_details.errors || 0}
                                </div>
                            </div>
                        </div>
                    )}

                    {globalStats && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border rounded-lg bg-green-500/5 mt-4">
                            <div>
                                <div className="text-sm text-muted-foreground">Global (1h)</div>
                                <div className="text-xl font-bold">{globalStats.fetching?.h1 || 0}</div>
                            </div>
                            <div>
                                <div className="text-sm text-muted-foreground">Global (24h)</div>
                                <div className="text-xl font-bold">{globalStats.fetching?.h24 || 0}</div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* News Retelling Section */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-medium flex items-center gap-2">
                                <RefreshCw className="w-4 h-4 text-primary" />
                                Retell news (v2)
                            </h3>
                            <CardDescription>Process and enrich news articles with AI</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            {retellingConfig?.enabled ? (
                                <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    Running
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-500/20">
                                    <Pause className="w-3 h-3 mr-1" />
                                    Paused
                                </Badge>
                            )}
                            <Button
                                size="sm"
                                variant={retellingConfig?.enabled ? 'destructive' : 'default'}
                                onClick={() =>
                                    toggleMutation.mutate({
                                        jobName: 'news_retelling',
                                        action: retellingConfig?.enabled ? 'pause' : 'resume',
                                    })
                                }
                                disabled={toggleMutation.isPending}
                            >
                                {retellingConfig?.enabled ? (
                                    <>
                                        <Pause className="w-4 h-4 mr-1" />
                                        Pause
                                    </>
                                ) : (
                                    <>
                                        <Play className="w-4 h-4 mr-1" />
                                        Resume
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <Label>Frequency</Label>
                            <Select
                                value={retellingConfig?.frequency_minutes?.toString() || '180'}
                                onValueChange={(value) =>
                                    updateConfigMutation.mutate({
                                        jobName: 'news_retelling',
                                        config: { frequency_minutes: parseInt(value) },
                                    })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="5">Every 5 minutes</SelectItem>
                                    <SelectItem value="15">Every 15 minutes</SelectItem>
                                    <SelectItem value="60">Every hour</SelectItem>
                                    <SelectItem value="180">Every 3 hours</SelectItem>
                                    <SelectItem value="360">Every 6 hours</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Last Run</Label>
                            <div className="text-sm text-muted-foreground mt-2">
                                {retellingConfig?.last_run_at
                                    ? new Date(retellingConfig.last_run_at).toLocaleString()
                                    : 'Never'}
                            </div>
                        </div>

                        <div>
                            <Label>Status</Label>
                            <div className="mt-2">
                                {retellingConfig?.last_run_status === 'success' ? (
                                    <Badge variant="outline" className="bg-green-500/10 text-green-500">
                                        Success
                                    </Badge>
                                ) : retellingConfig?.last_run_status === 'failed' ? (
                                    <Badge variant="outline" className="bg-red-500/10 text-red-500">
                                        Failed
                                    </Badge>
                                ) : (
                                    <Badge variant="outline">Unknown</Badge>
                                )}
                            </div>
                        </div>

                        <div>
                            <Label>Model</Label>
                            <Select
                                value={retellingConfig?.processing_options?.llm_model || 'default'}
                                onValueChange={(value) => {
                                    const model = value === 'default' ? undefined : value;
                                    let provider = undefined;

                                    if (model) {
                                        if (model.startsWith('gpt')) provider = 'openai';
                                        else if (model.startsWith('gemini')) provider = 'gemini';
                                        else if (model.startsWith('claude')) provider = 'anthropic';
                                        else if (model.startsWith('mistral')) provider = 'mistral';
                                        else if (model.startsWith('GLM')) provider = 'zai';
                                        else provider = 'zai'; // Fallback
                                    }

                                    updateConfigMutation.mutate({
                                        jobName: 'news_retelling',
                                        config: {
                                            processing_options: {
                                                ...retellingConfig?.processing_options,
                                                llm_model: model,
                                                llm_provider: provider
                                            }
                                        }
                                    });
                                }}
                            >
                                <SelectTrigger className="mt-2">
                                    <SelectValue placeholder="Use Global Default" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="default">
                                        <span className="text-muted-foreground italic">Use Global Default</span>
                                    </SelectItem>
                                    {/* Explicitly list and flatten models to ensure visibility */}
                                    {[
                                        ...(LLM_MODELS.openai?.text || []),
                                        ...(LLM_MODELS.gemini?.text || []),
                                        ...(LLM_MODELS.geminiV22?.text || []),
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
                    </div>

                    <div>
                        <Label>Processing Options</Label>
                        <div className="flex flex-wrap gap-4 mt-2">
                            {processingOptions.map((option) => (
                                <div key={option.key} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`option-${option.key}`}
                                        checked={retellingConfig?.processing_options?.[option.key] || false}
                                        onCheckedChange={(checked) => {
                                            updateConfigMutation.mutate({
                                                jobName: 'news_retelling',
                                                config: {
                                                    processing_options: {
                                                        ...retellingConfig?.processing_options,
                                                        [option.key]: checked,
                                                    },
                                                },
                                            });
                                        }}
                                    />
                                    <Label htmlFor={`option-${option.key}`} className="cursor-pointer">
                                        {option.label}
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <Label>Countries</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {allCountries.map((country) => (
                                <div key={country.code} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`retell-${country.code}`}
                                        checked={retellingConfig?.countries?.includes(country.code)}
                                        onCheckedChange={(checked) => {
                                            const newCountries = checked
                                                ? [...(retellingConfig?.countries || []), country.code]
                                                : (retellingConfig?.countries || []).filter((c) => c !== country.code);
                                            updateConfigMutation.mutate({
                                                jobName: 'news_retelling',
                                                config: { countries: newCountries },
                                            });
                                        }}
                                    />
                                    <Label htmlFor={`retell-${country.code}`} className="cursor-pointer">
                                        {country.label}
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </div>

                    {
                        retellingConfig?.last_run_details && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                                <div>
                                    <div className="text-sm text-muted-foreground">Processed</div>
                                    <div className="text-2xl font-bold">
                                        {retellingConfig.last_run_details.processed || 0}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm text-muted-foreground">Success</div>
                                    <div className="text-2xl font-bold text-green-500">
                                        {retellingConfig.last_run_details.success || 0}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm text-muted-foreground">Skipped</div>
                                    <div className="text-2xl font-bold text-yellow-500">
                                        {retellingConfig.last_run_details.skipped || 0}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm text-muted-foreground">Errors</div>
                                    <div className="text-2xl font-bold text-red-500">
                                        {retellingConfig.last_run_details.errors || 0}
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    {globalStats && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border rounded-lg bg-purple-500/5 mt-4">
                            <div>
                                <div className="text-sm text-muted-foreground">Global (1h)</div>
                                <div className="text-xl font-bold">{globalStats.retelling?.h1 || 0}</div>
                            </div>
                            <div>
                                <div className="text-sm text-muted-foreground">Global (24h)</div>
                                <div className="text-xl font-bold">{globalStats.retelling?.h24 || 0}</div>
                            </div>
                        </div>
                    )}
                </CardContent >
            </Card >

            {/* Bulk News Retelling - Use Enhanced Component */}
            <BulkRetellCronPanelEnhanced password={password || ''} />

            {/* Diagnostics Section */}
            <DiagnosticInfo password={password} />
        </div>
    );
}
