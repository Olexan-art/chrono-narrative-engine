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
import { Play, Pause, Settings, Activity, Clock, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { LLM_MODELS } from '@/types/database';

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

            {/* Bulk News Retelling Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Settings className="w-5 h-5" />
                                Bulk News Retelling
                            </CardTitle>
                            <CardDescription>Country-specific automated retelling crons</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* List of Active Bulk Retell Crons */}
                    <div className="space-y-4">
                        <h4 className="font-medium">Active Crons</h4>
                        {configsData?.configs
                            ?.filter((c: CronConfig) => c.job_name.startsWith('bulk_retell_'))
                            .map((cron: CronConfig) => {
                                const countryCode = cron.processing_options?.country_code || '';
                                const country = allCountries.find(c => c.code === countryCode);

                                return (
                                    <div key={cron.id} className="p-4 border rounded-lg space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="text-2xl">{country?.label || countryCode}</span>
                                                <div>
                                                    <div className="font-medium">{country?.label || countryCode.toUpperCase()}</div>
                                                    <div className="text-sm text-muted-foreground">
                                                        Every {cron.frequency_minutes}min • {cron.processing_options?.llm_model} • {cron.processing_options?.time_range === 'last_1h' ? 'Last 1h' : 'All news'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant={cron.enabled ? 'default' : 'secondary'}>
                                                    {cron.enabled ? 'Enabled' : 'Paused'}
                                                </Badge>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => {
                                                        toggleMutation.mutate({
                                                            jobName: cron.job_name,
                                                            action: cron.enabled ? 'pause' : 'resume'
                                                        });
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
                                                    Delete
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Statistics */}
                                        <BulkRetellStats countryCode={countryCode} password={password} />
                                    </div>
                                );
                            })}

                        {(!configsData?.configs || configsData.configs.filter((c: CronConfig) => c.job_name.startsWith('bulk_retell_')).length === 0) && (
                            <div className="text-center text-muted-foreground py-8">
                                No bulk retell crons configured yet
                            </div>
                        )}
                    </div>

                    {/* Add New Cron Form */}
                    <div className="border-t pt-6">
                        <h4 className="font-medium mb-4">Create New Bulk Retell Cron</h4>
                        <BulkRetellForm onSuccess={() => queryClient.invalidateQueries({ queryKey: ['cron-configs'] })} password={password} />
                    </div>
                </CardContent>
            </Card>
        </div >
    );
}
