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
import { Play, Pause, Settings, Activity, Clock, CheckCircle2, XCircle } from 'lucide-react';

interface CronConfig {
    id: string;
    job_name: string;
    enabled: boolean;
    frequency_minutes: number;
    countries: string[];
    processing_options: Record<string, boolean>;
    last_run_at: string | null;
    last_run_status: string | null;
    last_run_details: any;
}

export default function NewsProcessingPage() {
    const queryClient = useQueryClient();

    // Fetch cron configurations
    const { data: configsData, isLoading } = useQuery({
        queryKey: ['cron-configs'],
        queryFn: async () => {
            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cron-control`, {
                headers: {
                    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                },
            });
            const result: { success: boolean; configs: CronConfig[] } = await response.json();
            return result;
        },
        refetchInterval: 10000, // Refresh every 10 seconds
    });

    const fetchingConfig = configsData?.configs?.find(c => c.job_name === 'news_fetching');
    const retellingConfig = configsData?.configs?.find(c => c.job_name === 'news_retelling');

    // Pause/Resume mutation
    const toggleMutation = useMutation({
        mutationFn: async ({ jobName, action }: { jobName: string; action: 'pause' | 'resume' }) => {
            const result = await callEdgeFunction('cron-control', { jobName, action });
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
            const result = await callEdgeFunction('cron-control', { jobName, config });
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
                </CardContent>
            </Card>

            {/* News Retelling Section */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Settings className="w-5 h-5" />
                                News Retelling
                            </CardTitle>
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

                    {retellingConfig?.last_run_details && (
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
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
