import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { callEdgeFunction } from '@/lib/api';
import { Play, Pause, Settings, Activity, Clock, CheckCircle2, XCircle, Trash2, Globe } from 'lucide-react';
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
    });

    if (!statsData) return null;

    return (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-sm mt-2">
            <div>
                <div className="text-muted-foreground text-xs">All-time</div>
                <div className="font-bold">{statsData.all_time || 0}</div>
            </div>
            <div>
                <div className="text-muted-foreground text-xs">1h</div>
                <div className="font-bold">{statsData.h1 || 0}</div>
            </div>
            <div>
                <div className="text-muted-foreground text-xs">6h</div>
                <div className="font-bold">{statsData.h6 || 0}</div>
            </div>
            <div>
                <div className="text-muted-foreground text-xs">24h</div>
                <div className="font-bold">{statsData.h24 || 0}</div>
            </div>
            <div>
                <div className="text-muted-foreground text-xs">3d</div>
                <div className="font-bold">{statsData.d3 || 0}</div>
            </div>
            <div>
                <div className="text-muted-foreground text-xs">7d</div>
                <div className="font-bold">{statsData.d7 || 0}</div>
            </div>
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
        }
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
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-xl font-bold">
                                            {countryCode.toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="font-medium flex items-center gap-2">
                                                {country?.label || countryCode.toUpperCase()}
                                                <Badge variant={cron.enabled ? 'default' : 'secondary'} className="text-xs">
                                                    {cron.enabled ? 'Active' : 'Paused'}
                                                </Badge>
                                            </div>
                                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                                                <Clock className="w-3 h-3" />
                                                Every {cron.frequency_minutes} mins
                                                {cron.enabled && (() => {
                                                    const nextRun = getNextRunInfo(cron.last_run_at, cron.frequency_minutes);
                                                    return (
                                                        <>
                                                            <span className="text-border">|</span>
                                                            <span className={nextRun.isOverdue ? 'text-orange-500 font-medium' : 'text-muted-foreground'}>
                                                                Next: {nextRun.text}
                                                            </span>
                                                        </>
                                                    );
                                                })()}
                                                <span className="text-border">|</span>
                                                Looking at: {cron.processing_options?.time_range}
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                Model: {cron.processing_options?.llm_model}
                                            </div>
                                            {cron.last_run_at && (
                                                <div className="text-xs mt-1 flex items-center gap-2">
                                                    <span className="text-muted-foreground">Last run: {new Date(cron.last_run_at).toLocaleString()}</span>
                                                    {cron.last_run_status === 'success' ? (
                                                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                                                    ) : (
                                                        <XCircle className="w-3 h-3 text-red-500" />
                                                    )}
                                                    {cron.last_run_details?.processed !== undefined && (
                                                        <span className="text-muted-foreground">
                                                            ({cron.last_run_details.processed} items)
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={async () => {
                                                const description = `Running bulk retell for ${cron.job_name}...`;
                                                toast.info(description);
                                                try {
                                                    const result = await callEdgeFunction('bulk-retell-news', {
                                                        country_code: cron.processing_options?.country_code,
                                                        time_range: cron.processing_options?.time_range,
                                                        llm_model: cron.processing_options?.llm_model,
                                                        llm_provider: cron.processing_options?.llm_provider,
                                                        job_name: cron.job_name
                                                    }) as any;

                                                    if (result.success) {
                                                        toast.success(`Processed ${result.processed} items. Success: ${result.success_count}, Errors: ${result.error_count}`);
                                                        queryClient.invalidateQueries({ queryKey: ['cron-configs'] });
                                                    } else {
                                                        toast.error('Run failed: ' + (result.message || 'Unknown error'));
                                                    }
                                                } catch (e) {
                                                    toast.error('Failed to run: ' + (e instanceof Error ? e.message : String(e)));
                                                }
                                            }}
                                        >
                                            <Play className="w-4 h-4 mr-2" />
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
                                                        action: 'updateCron',
                                                        password,
                                                        data: {
                                                            jobName: cron.job_name,
                                                            enabled: !cron.enabled
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
