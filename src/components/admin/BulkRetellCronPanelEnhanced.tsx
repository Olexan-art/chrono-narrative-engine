import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { callEdgeFunction } from '@/lib/api';
import { Play, Pause, Settings, Activity, Clock, CheckCircle2, XCircle, Trash2, Globe, RefreshCw, TrendingUp, AlertCircle, Zap, Edit } from 'lucide-react';
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

type TimeRange = 'last_1h' | 'last_24h' | 'all';

// Helper component for displaying bulk retell statistics with enhanced charts
function BulkRetellStatsEnhanced({ countryCode, password }: { countryCode: string; password: string }) {
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
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                    <div className="text-muted-foreground text-xs uppercase tracking-wide font-medium">All-time</div>
                    <div className="font-bold text-lg text-green-500 mt-1">{statsData.all_time || 0}</div>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <div className="text-muted-foreground text-xs uppercase tracking-wide font-medium">Last 24h</div>
                    <div className="font-bold text-lg text-blue-500 mt-1">{statsData.h24 || 0}</div>
                </div>
                <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                    <div className="text-muted-foreground text-xs uppercase tracking-wide font-medium">Last Hour</div>
                    <div className="font-bold text-lg text-purple-500 mt-1">{statsData.h1 || 0}</div>
                </div>
                <div className={`p-3 rounded-lg border ${successRate >= 90 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-orange-500/10 border-orange-500/20'}`}>
                    <div className="text-muted-foreground text-xs uppercase tracking-wide font-medium">Success</div>
                    <div className={`font-bold text-lg mt-1 ${successRate >= 90 ? 'text-emerald-500' : 'text-orange-500'}`}>{successRate}%</div>
                </div>
                <div className="p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                    <div className="text-muted-foreground text-xs uppercase tracking-wide font-medium">Avg Time</div>
                    <div className="font-bold text-lg text-cyan-500 mt-1">{Math.round(avgProcessingTime)}ms</div>
                </div>
                <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                    <div className="text-muted-foreground text-xs uppercase tracking-wide font-medium">Rate</div>
                    <div className="font-bold text-lg text-amber-500 mt-1">{itemsPerMinute.toFixed(1)}/min</div>
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
                                        <Bar dataKey="success" stackId="a" fill="#22c55e" name="✓ Success" />
                                        <Bar dataKey="failed" stackId="a" fill="#ef4444" name="✗ Failed" />
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
                                Success Rate Trend
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

// Helper function to calculate next run time in HH:MM format
function getNextRunTime(lastRunAt: string | null, frequencyMinutes: number): string {
    if (!lastRunAt) {
        return '—';
    }

    const lastRun = new Date(lastRunAt).getTime();
    const frequencyMs = frequencyMinutes * 60 * 1000;
    const nextRun = new Date(lastRun + frequencyMs);
    
    const hours = String(nextRun.getHours()).padStart(2, '0');
    const minutes = String(nextRun.getMinutes()).padStart(2, '0');
    
    return `${hours}:${minutes}`;
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
function BulkRetellFormEnhanced({ onSuccess, password }: { onSuccess: () => void; password: string }) {
    const [countryCode, setCountryCode] = useState('');
    const [timeRange, setTimeRange] = useState<TimeRange>('all');
    const [llmModel, setLlmModel] = useState('');
    const [llmProvider, setLlmProvider] = useState('');
    const [frequencyMinutes, setFrequencyMinutes] = useState(60);
    const [isCreating, setIsCreating] = useState(false);

    const allCountries = [
        { code: 'us', label: '🇺🇸 United States' },
        { code: 'ua', label: '🇺🇦 Ukraine' },
        { code: 'gb', label: '🇬🇧 United Kingdom' },
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
                toast.success('✓ Bulk retell cron created successfully');
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
                <Label>Processing Scope</Label>
                <Select value={timeRange} onValueChange={(v: any) => setTimeRange(v)}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="last_1h">Last 1 Hour</SelectItem>
                        <SelectItem value="last_24h">Last 24 Hours</SelectItem>
                        <SelectItem value="all">All Unprocessed</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>AI Model</Label>
                <Select
                    value={llmModel}
                    onValueChange={(val) => {
                        setLlmModel(val);
                        // Find provider by iterating keys
                        let foundProvider = 'google';
                        for (const [providerKey, providerConfig] of Object.entries(LLM_MODELS)) {
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
                        <SelectValue placeholder="Pick model" />
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
                <Label>Check Every</Label>
                <Select value={frequencyMinutes.toString()} onValueChange={(v) => setFrequencyMinutes(parseInt(v))}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="5">5 minutes ⚡</SelectItem>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                        <SelectItem value="120">2 hours</SelectItem>
                        <SelectItem value="360">6 hours</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <Button onClick={handleCreate} disabled={isCreating} className="bg-green-600 hover:bg-green-700">
                {isCreating ? <Activity className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                Create Cron
            </Button>
        </div>
    );
}

export function BulkRetellCronPanelEnhanced({ password }: { password: string }) {
    const queryClient = useQueryClient();
    const [editingCron, setEditingCron] = useState<CronConfig | null>(null);
    const [editFrequency, setEditFrequency] = useState(60);

    // Fetch cron configs
    const { data: configsData, isLoading } = useQuery({
        queryKey: ['cron-configs'],
        queryFn: async () => {
            const response = await callEdgeFunction('admin', { action: 'getCronConfigs', password }) as { success: boolean; configs: CronConfig[] };
            if (!response.success) throw new Error('Failed to fetch configs');
            return response;
        },
        refetchInterval: 20000,
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
        refetchInterval: 15000,
        enabled: !!password,
    });

    const allCountries = [
        { code: 'us', label: '🇺🇸 USA' },
        { code: 'ua', label: '🇺🇦 Ukraine' },
        { code: 'gb', label: '🇬🇧 UK' },
    ];

    if (isLoading) {
        return (
            <Card>
                <CardContent className="py-8">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                        <Activity className="w-4 h-4 animate-spin" />
                        Loading cron jobs...
                    </div>
                </CardContent>
            </Card>
        );
    }

    const bulkCrons = configsData?.configs?.filter((c: CronConfig) => c.job_name.startsWith('bulk_retell_')) || [];

    return (
        <div className="space-y-6">
            {/* Global Stats */}
            {globalStats && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Activity className="w-4 h-4 text-green-500" />
                                Global News Fetching
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-xs text-muted-foreground font-medium uppercase">Last Hour</div>
                                    <div className="text-2xl font-bold text-green-500 mt-1">{globalStats.fetching?.h1 || 0}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground font-medium uppercase">Today (24h)</div>
                                    <div className="text-2xl font-bold text-green-600 mt-1">{globalStats.fetching?.h24 || 0}</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-purple-500/10 to-violet-500/10 border-purple-500/30">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <RefreshCw className="w-4 h-4 text-purple-500" />
                                Global News Retelling
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-xs text-muted-foreground font-medium uppercase">Last Hour</div>
                                    <div className="text-2xl font-bold text-purple-500 mt-1">{globalStats.retelling?.h1 || 0}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground font-medium uppercase">Today (24h)</div>
                                    <div className="text-2xl font-bold text-purple-600 mt-1">{globalStats.retelling?.h24 || 0}</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Active Crons */}
            <Card>
                <CardHeader>
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="w-5 h-5 text-blue-500" />
                            Active Cron Jobs
                        </CardTitle>
                        <CardDescription>
                            {bulkCrons.length} job{bulkCrons.length !== 1 ? 's' : ''} running • Auto-check for new content
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {bulkCrons.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
                            <AlertCircle className="w-8 h-8 mx-auto mb-3 opacity-50" />
                            <p>No cron jobs active. Create one below to start automatic processing!</p>
                        </div>
                    ) : (
                        bulkCrons.map((cron: CronConfig) => {
                            const countryCode = cron.processing_options?.country_code || '';
                            const country = allCountries.find(c => c.code === countryCode);

                            return (
                                <div key={cron.id} className={`p-4 border rounded-lg space-y-4 ${cron.enabled ? 'bg-green-500/5 border-green-500/30' : 'bg-muted/20 border-muted/50'}`}>
                                    {/* Header */}
                                    <div className="flex items-start justify-between gap-4 flex-wrap">
                                        <div className="flex items-start gap-3 flex-1">
                                            <div className={`flex items-center justify-center w-14 h-14 rounded-full text-lg font-bold relative flex-shrink-0 ${
                                                cron.enabled 
                                                    ? 'bg-green-500/30 border-2 border-green-500/60 text-green-300' 
                                                    : 'bg-muted/50 border border-muted-foreground/20 text-muted-foreground'
                                            }`}>
                                                {countryCode.toUpperCase()}
                                                {cron.enabled && (
                                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full animate-pulse border-2 border-background" />
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-semibold text-base flex items-center gap-2">
                                                    {country?.label || countryCode.toUpperCase()}
                                                    <Badge 
                                                        variant={cron.enabled ? 'default' : 'secondary'} 
                                                        className={`text-xs font-medium ${cron.enabled ? 'bg-green-600 text-white' : ''}`}
                                                    >
                                                        {cron.enabled ? '🟢 Active' : '⚪ Paused'}
                                                    </Badge>
                                                </div>
                                                <div className="text-sm text-muted-foreground space-y-1 mt-2">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="inline-flex items-center gap-1 bg-muted/50 px-2 py-1 rounded text-xs">
                                                            <Clock className="w-3 h-3" />
                                                            Every {cron.frequency_minutes}m
                                                        </span>
                                                        {cron.last_run_at && (
                                                            <span className="inline-flex items-center gap-1 bg-purple-500/20 text-purple-300 px-2 py-1 rounded text-xs font-medium">
                                                                🕐 {getNextRunTime(cron.last_run_at, cron.frequency_minutes)}
                                                            </span>
                                                        )}
                                                        {cron.enabled && (() => {
                                                            const nextRun = getNextRunInfo(cron.last_run_at, cron.frequency_minutes);
                                                            return (
                                                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                                                                    nextRun.isOverdue 
                                                                        ? 'bg-orange-500/20 text-orange-400 animate-pulse' 
                                                                        : 'bg-blue-500/20 text-blue-400'
                                                                }`}>
                                                                    {nextRun.isOverdue ? '⚠️' : '⏱️'} {nextRun.text}
                                                                </span>
                                                            );
                                                        })()}
                                                    </div>
                                                    <div className="text-xs">
                                                        <span className="inline-block bg-muted/50 px-2 py-1 rounded mr-2">📋 {cron.processing_options?.time_range === 'all' ? 'All unprocessed' : cron.processing_options?.time_range || 'default'}</span>
                                                        <span className="inline-block bg-muted/50 px-2 py-1 rounded">🤖 {cron.processing_options?.llm_model}</span>
                                                    </div>
                                                </div>
                                                {cron.last_run_at && (
                                                    <div className="text-xs mt-2 flex flex-wrap items-center gap-2">
                                                        <span className="text-muted-foreground">Last run: {new Date(cron.last_run_at).toLocaleTimeString()}</span>
                                                        {cron.last_run_status === 'success' ? (
                                                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                                                        ) : cron.last_run_status === 'running' ? (
                                                            <Activity className="w-4 h-4 text-blue-500 animate-spin" />
                                                        ) : (
                                                            <XCircle className="w-4 h-4 text-red-500" />
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

                                        {/* Action Buttons */}
                                        <div className="flex items-center gap-2 flex-wrap justify-end">
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
                                                Run
                                            </Button>
                                            
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/30 text-orange-400"
                                                onClick={async () => {
                                                    const confirm_force = confirm(`⚡ Force quick check for ${country?.label}? Process recent items only.`);
                                                    if (!confirm_force) return;

                                                    try {
                                                        const result = await callEdgeFunction('bulk-retell-news', {
                                                            password,
                                                            country_code: cron.processing_options?.country_code,
                                                            time_range: 'last_1h',
                                                            llm_model: cron.processing_options?.llm_model,
                                                            llm_provider: cron.processing_options?.llm_provider,
                                                            job_name: cron.job_name,
                                                            force_quick: true
                                                        }) as any;

                                                        if (result.success) {
                                                            toast.success(`⚡ Quick check processed ${result.processed} items`);
                                                            queryClient.invalidateQueries({ queryKey: ['bulk-retell-stats', cron.processing_options?.country_code] });
                                                        } else {
                                                            toast.error('Quick check failed');
                                                        }
                                                    } catch (e) {
                                                        toast.error('Failed to run quick check');
                                                    }
                                                }}
                                            >
                                                <Zap className="w-4 h-4 mr-1" />
                                                Quick
                                            </Button>

                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="bg-cyan-500/10 hover:bg-cyan-500/20 border-cyan-500/30 text-cyan-400"
                                                onClick={() => {
                                                    setEditingCron(cron);
                                                    setEditFrequency(cron.frequency_minutes);
                                                }}
                                                title="Edit cron schedule"
                                                aria-label={`Edit cron ${cron.job_name}`}
                                            >
                                                <Edit className="w-4 h-4 mr-2" />
                                                <span className="text-sm font-medium">Edit</span>
                                            </Button>

                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={async () => {
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
                                                        toast.error('Failed to toggle');
                                                    }
                                                }}
                                            >
                                                {cron.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                            </Button>

                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={async () => {
                                                    if (!confirm(`Delete cron for ${country?.label}?`)) return;

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

                                    {/* Statistics and Charts */}
                                    <BulkRetellStatsEnhanced countryCode={countryCode} password={password} />
                                </div>
                            );
                        })
                    )}
                </CardContent>
            </Card>

            {/* Create New Cron Form */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Play className="w-5 h-5 text-green-500" />
                        Create New Cron Job
                    </CardTitle>
                    <CardDescription>Set up automatic news processing that runs continuously</CardDescription>
                </CardHeader>
                <CardContent>
                    <BulkRetellFormEnhanced onSuccess={() => queryClient.invalidateQueries({ queryKey: ['cron-configs'] })} password={password} />
                </CardContent>
            </Card>

            {/* Edit Cron Modal */}
            <Dialog open={!!editingCron} onOpenChange={(open) => !open && setEditingCron(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Edit className="w-5 h-5 text-cyan-500" />
                            Edit Cron Job
                        </DialogTitle>
                        <DialogDescription>
                            Update the schedule for {editingCron?.processing_options?.country_code?.toUpperCase()} cron
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label>Check Every</Label>
                            <Select value={editFrequency.toString()} onValueChange={(v) => setEditFrequency(parseInt(v))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="5">5 minutes ⚡</SelectItem>
                                    <SelectItem value="15">15 minutes</SelectItem>
                                    <SelectItem value="30">30 minutes</SelectItem>
                                    <SelectItem value="60">1 hour</SelectItem>
                                    <SelectItem value="120">2 hours</SelectItem>
                                    <SelectItem value="360">6 hours</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setEditingCron(null)}>Cancel</Button>
                            <Button
                                onClick={async () => {
                                    if (!editingCron) return;
                                    try {
                                        await callEdgeFunction('admin', {
                                            action: 'updateCronConfig',
                                            password,
                                            data: {
                                                jobName: editingCron.job_name,
                                                config: { frequency_minutes: editFrequency }
                                            }
                                        });
                                        queryClient.invalidateQueries({ queryKey: ['cron-configs'] });
                                        toast.success('Cron schedule updated');
                                        setEditingCron(null);
                                    } catch (e) {
                                        toast.error('Failed to update cron');
                                    }
                                }}
                            >
                                Save Changes
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
