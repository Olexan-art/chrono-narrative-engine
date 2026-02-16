import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { adminAction } from '@/lib/api';
import { useAdminStore } from '@/stores/adminStore';
import { Activity, CheckCircle2, XCircle, TrendingUp, Clock, Key, Server, CalendarClock, Save, RotateCcw, Eye, EyeOff, Play } from 'lucide-react';
import { LLM_MODELS, LLMProvider } from '@/types/database';

interface LLMStat {
    provider: string;
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    avgDuration: number;
    successRate: number;
    avgTokens: number;
    totalTokens: number;
    operations: Record<string, number>;
    models: Record<string, number>;
    errors: string[];
}

interface CronConfig {
    job_name: string;
    schedule: string;
    enabled: boolean;
    processing_options?: {
        llm_provider?: string;
        llm_model?: string;
        [key: string]: any;
    };
}

export default function LLMManagementPage() {
    const { password: adminPassword } = useAdminStore();
    const queryClient = useQueryClient();
    const [timeRange, setTimeRange] = useState('24h');
    const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
    const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
    const [testingProvider, setTestingProvider] = useState<string | null>(null);

    // Fetch LLM availability
    const { data: availability } = useQuery({
        queryKey: ['llm-availability'],
        queryFn: async () => {
            if (!adminPassword) return null;
            const result = await adminAction<{
                success: boolean;
                availability: {
                    hasOpenai: boolean;
                    hasGemini: boolean;
                    hasGeminiV22: boolean;
                    hasAnthropic: boolean;
                    hasZai: boolean;
                    hasMistral: boolean;
                    hasLovable?: boolean;
                };
            }>('getLLMAvailability', adminPassword);
            return result?.availability;
        },
        enabled: !!adminPassword,
    });

    // Fetch LLM statistics
    const { data: statsData } = useQuery({
        queryKey: ['llm-stats', timeRange],
        queryFn: async () => {
            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/llm-stats?timeRange=${timeRange}`, {
                headers: {
                    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                },
            });
            const result = await response.json();
            return result;
        },
        refetchInterval: 30000,
    });

    // Fetch Cron Configs
    const { data: cronConfigs } = useQuery({
        queryKey: ['cron-configs'],
        queryFn: async () => {
            if (!adminPassword) return [];
            const result = await adminAction<{ success: boolean; configs: CronConfig[] }>('getCronConfigs', adminPassword);
            return result?.configs || [];
        },
        enabled: !!adminPassword,
    });

    // Mutation to update API keys
    const updateKeysMutation = useMutation({
        mutationFn: async (keys: Record<string, string>) => {
            if (!adminPassword) throw new Error('Admin password required');
            return await adminAction('updateApiKeys', adminPassword, keys);
        },
        onSuccess: () => {
            toast.success('API Keys updated successfully');
            queryClient.invalidateQueries({ queryKey: ['llm-availability'] });
            setApiKeys({}); // Clear inputs after save
        },
        onError: (error) => {
            toast.error(`Failed to update keys: ${error}`);
        }
    });

    // Mutation to test provider
    const testProviderMutation = useMutation({
        mutationFn: async ({ provider, apiKey }: { provider: string, apiKey: string }) => {
            if (!adminPassword) throw new Error('Admin password required');
            if (!apiKey) throw new Error('Please enter an API key to test');

            return await adminAction<{ success: boolean; message: string }>('testProvider', adminPassword, { provider, apiKey });
        },
        onSuccess: (data) => {
            if (data?.success) {
                toast.success(data.message);
            } else {
                toast.error(data?.message || 'Test failed');
            }
        },
        onError: (error) => {
            toast.error(`Test failed: ${error}`);
        }
    });

    // Mutation to update Cron Config
    const updateCronConfigMutation = useMutation({
        mutationFn: async ({ jobName, config }: { jobName: string, config: any }) => {
            if (!adminPassword) throw new Error('Admin password required');
            return await adminAction('updateCronConfig', adminPassword, { jobName, config });
        },
        onSuccess: () => {
            toast.success('Cron configuration updated');
            queryClient.invalidateQueries({ queryKey: ['cron-configs'] });
        },
        onError: (error) => {
            toast.error(`Failed to update cron config: ${error}`);
        }
    });

    const providers = [
        { name: 'zai', label: 'Z.AI (GLM)', keyField: 'zai_api_key', available: availability?.hasZai, color: 'bg-blue-500' },
        { name: 'openai', label: 'OpenAI', keyField: 'openai_api_key', available: availability?.hasOpenai, color: 'bg-green-500' },
        { name: 'gemini', label: 'Gemini', keyField: 'gemini_api_key', available: availability?.hasGemini, color: 'bg-purple-500' },
        { name: 'geminiV22', label: 'Gemini V2.2', keyField: 'gemini_v22_api_key', available: availability?.hasGeminiV22, color: 'bg-purple-600' },
        { name: 'mistral', label: 'Mistral', keyField: 'mistral_api_key', available: availability?.hasMistral, color: 'bg-orange-500' },
        { name: 'anthropic', label: 'Anthropic', keyField: 'anthropic_api_key', available: availability?.hasAnthropic, color: 'bg-red-500' },
        { name: 'lovable', label: 'Lovable AI', keyField: null, available: true, color: 'bg-pink-500' },
    ];

    const getProviderStats = (providerName: string): LLMStat | null => {
        return statsData?.stats?.find((s: any) => s.provider === providerName) || null;
    };

    const handleKeyChange = (field: string, value: string) => {
        setApiKeys(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveKeys = () => {
        // Filter only changed keys
        const keysToUpdate: Record<string, string> = {};
        Object.entries(apiKeys).forEach(([key, value]) => {
            if (value && value.trim() !== '') {
                keysToUpdate[key] = value.trim();
            }
        });

        if (Object.keys(keysToUpdate).length === 0) {
            toast.info('No changes to save');
            return;
        }

        updateKeysMutation.mutate(keysToUpdate);
    };

    const handleTestKey = async (provider: string, keyField: string | null) => {
        if (!keyField) return;
        setTestingProvider(provider);
        const apiKey = apiKeys[keyField];
        if (!apiKey) {
            toast.error('Please enter a key to validate');
            setTestingProvider(null);
            return;
        }

        try {
            await testProviderMutation.mutateAsync({ provider, apiKey });
        } finally {
            setTestingProvider(null);
        }
    };

    const handleCronModelChange = (jobName: string, model: string) => {
        // Find provider for model
        let provider = 'zai';
        if (model.startsWith('gpt')) provider = 'openai';
        else if (model.startsWith('gemini')) provider = 'gemini';
        else if (model.startsWith('claude')) provider = 'anthropic';
        else if (model.startsWith('mistral')) provider = 'mistral';

        // Find existing config or create new structure
        const currentConfig = cronConfigs?.find(c => c.job_name === jobName);
        const processingOptions = currentConfig?.processing_options || {};

        updateCronConfigMutation.mutate({
            jobName,
            config: {
                processing_options: {
                    ...processingOptions,
                    llm_provider: provider,
                    llm_model: model
                }
            }
        });
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">LLM Management</h1>
                    <p className="text-muted-foreground">Monitor and configure AI providers</p>
                </div>
                <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="1h">Last Hour</SelectItem>
                        <SelectItem value="24h">Last 24 Hours</SelectItem>
                        <SelectItem value="3d">Last 3 Days</SelectItem>
                        <SelectItem value="7d">Last 7 Days</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <Tabs defaultValue="stats" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="stats" className="flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Statistics
                    </TabsTrigger>
                    <TabsTrigger value="config" className="flex items-center gap-2">
                        <Key className="h-4 w-4" />
                        Providers & Keys
                    </TabsTrigger>
                    <TabsTrigger value="models" className="flex items-center gap-2">
                        <Server className="h-4 w-4" />
                        Models
                    </TabsTrigger>
                    <TabsTrigger value="cron" className="flex items-center gap-2">
                        <CalendarClock className="h-4 w-4" />
                        Cron Jobs
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="stats" className="space-y-6">
                    {/* Overview Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
                                <Activity className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{statsData?.totalCalls || 0}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Active Providers</CardTitle>
                                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {providers.filter(p => p.available).length}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Avg Success Rate</CardTitle>
                                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {statsData?.stats?.length
                                        ? Math.round(
                                            statsData.stats.reduce((acc: number, s: any) => acc + s.successRate, 0) / statsData.stats.length
                                        )
                                        : 0}
                                    %
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
                                <Clock className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {statsData?.stats?.length
                                        ? Math.round(
                                            statsData.stats.reduce((acc: number, s: any) => acc + s.avgDuration, 0) / statsData.stats.length
                                        )
                                        : 0}
                                    ms
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Provider Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {providers.map((provider) => {
                            const stats = getProviderStats(provider.name);

                            return (
                                <Card key={provider.name} className="relative overflow-hidden">
                                    <div className={`absolute top-0 left-0 w-1 h-full ${provider.color}`} />
                                    <CardHeader>
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="flex items-center gap-2">
                                                {provider.label}
                                                {provider.available ? (
                                                    <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                                                        <CheckCircle2 className="w-3 h-3 mr-1" />
                                                        Active
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-500/20">
                                                        <XCircle className="w-3 h-3 mr-1" />
                                                        Not Configured
                                                    </Badge>
                                                )}
                                            </CardTitle>
                                        </div>
                                        <CardDescription>
                                            {stats ? `${stats.totalCalls} calls in ${timeRange}` : 'No activity'}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        {stats ? (
                                            <>
                                                <div className="grid grid-cols-2 gap-2 text-sm">
                                                    <div>
                                                        <div className="text-muted-foreground">Success Rate</div>
                                                        <div className="font-semibold text-lg">{stats.successRate}%</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-muted-foreground">Avg Duration</div>
                                                        <div className="font-semibold text-lg">{stats.avgDuration}ms</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-muted-foreground">Total Tokens</div>
                                                        <div className="font-semibold text-lg">{stats.totalTokens.toLocaleString()}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-muted-foreground">Failed</div>
                                                        <div className="font-semibold text-lg text-red-500">{stats.failedCalls}</div>
                                                    </div>
                                                </div>

                                                {Object.keys(stats.operations).length > 0 && (
                                                    <div>
                                                        <div className="text-sm text-muted-foreground mb-1">Top Operations</div>
                                                        <div className="flex flex-wrap gap-1">
                                                            {Object.entries(stats.operations)
                                                                .sort((a, b) => (b[1] as number) - (a[1] as number))
                                                                .slice(0, 3)
                                                                .map(([op, count]) => (
                                                                    <Badge key={op} variant="secondary" className="text-xs">
                                                                        {op}: {count as number}
                                                                    </Badge>
                                                                ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="text-sm text-muted-foreground py-4 text-center">
                                                No usage data for this period
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </TabsContent>

                <TabsContent value="config" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Provider Configuration</CardTitle>
                            <CardDescription>
                                Manage API keys for various LLM providers. Keys are stored securely.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {providers.filter(p => p.keyField).map(provider => (
                                <div key={provider.name} className="border p-4 rounded-md space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-3 h-3 rounded-full ${provider.color}`} />
                                            <h3 className="font-medium text-lg">{provider.label}</h3>
                                        </div>
                                        {provider.available && (
                                            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                                Configured
                                            </Badge>
                                        )}
                                    </div>

                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Input
                                                type={showKeys[provider.name] ? "text" : "password"}
                                                placeholder={provider.available ? "****************" : `Enter ${provider.label} API Key`}
                                                value={apiKeys[provider.keyField!] || ''}
                                                onChange={(e) => handleKeyChange(provider.keyField!, e.target.value)}
                                            />
                                            <button
                                                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                                                onClick={() => setShowKeys(prev => ({ ...prev, [provider.name]: !prev[provider.name] }))}
                                            >
                                                {showKeys[provider.name] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                        <Button
                                            variant="outline"
                                            onClick={() => handleTestKey(provider.name, provider.keyField)}
                                            disabled={testingProvider === provider.name || !apiKeys[provider.keyField!]}
                                        >
                                            {testingProvider === provider.name ? (
                                                <RotateCcw className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Play className="h-4 w-4 mr-2" />
                                            )}
                                            Test
                                        </Button>
                                    </div>
                                </div>
                            ))}

                            <div className="flex justify-end pt-4">
                                <Button onClick={handleSaveKeys} className="w-full sm:w-auto">
                                    <Save className="mr-2 h-4 w-4" />
                                    Save API Keys
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="models" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Text Models</CardTitle>
                                <CardDescription>Available models for text generation & analysis</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {Object.entries(LLM_MODELS).flatMap(([provider, types]) =>
                                        types.text.map(model => ({ ...model, provider }))
                                    ).map((model, i) => (
                                        <div key={i} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded border">
                                            <div className="flex items-center gap-3">
                                                <Badge variant="secondary">{model.provider}</Badge>
                                                <span className="font-medium">{model.label}</span>
                                            </div>
                                            <code className="text-xs bg-muted px-2 py-1 rounded">{model.value}</code>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Image Models</CardTitle>
                                <CardDescription>Available models for image generation</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {Object.entries(LLM_MODELS).flatMap(([provider, types]) =>
                                        types.image.map(model => ({ ...model, provider }))
                                    ).map((model, i) => (
                                        <div key={i} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded border">
                                            <div className="flex items-center gap-3">
                                                <Badge variant="secondary">{model.provider}</Badge>
                                                <span className="font-medium">{model.label}</span>
                                            </div>
                                            <code className="text-xs bg-muted px-2 py-1 rounded">{model.value}</code>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="cron" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Cron Job LLM Configuration</CardTitle>
                            <CardDescription>
                                Configure which LLM model is used for specific automated tasks. These settings override global defaults.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-muted text-muted-foreground">
                                        <tr>
                                            <th className="p-4 font-medium">Job Name</th>
                                            <th className="p-4 font-medium">Schedule</th>
                                            <th className="p-4 font-medium">Status</th>
                                            <th className="p-4 font-medium">Assigned Model</th>
                                            <th className="p-4 font-medium">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y text-sm">
                                        {cronConfigs?.map((job) => (
                                            <tr key={job.job_name} className="hover:bg-muted/50">
                                                <td className="p-4 font-medium">{job.job_name}</td>
                                                <td className="p-4">{job.schedule}</td>
                                                <td className="p-4">
                                                    <Badge variant={job.enabled ? "default" : "secondary"} className={job.enabled ? "bg-green-500" : ""}>
                                                        {job.enabled ? "Active" : "Paused"}
                                                    </Badge>
                                                </td>
                                                <td className="p-4">
                                                    <Select
                                                        value={job.processing_options?.llm_model}
                                                        onValueChange={(val) => handleCronModelChange(job.job_name, val)}
                                                    >
                                                        <SelectTrigger className="w-[280px]">
                                                            <SelectValue placeholder="Use Global Default" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="default">
                                                                <span className="text-muted-foreground italic">Use Global Default</span>
                                                            </SelectItem>
                                                            {Object.values(LLM_MODELS).flatMap(p => p.text).map((m: any) => (
                                                                <SelectItem key={m.value} value={m.value}>
                                                                    {m.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </td>
                                                <td className="p-4">
                                                    {job.processing_options?.llm_model && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleCronModelChange(job.job_name, '')}
                                                        >
                                                            Reset
                                                        </Button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {(!cronConfigs || cronConfigs.length === 0) && (
                                            <tr>
                                                <td colSpan={5} className="p-4 text-center text-muted-foreground">
                                                    No cron jobs found (requires admin password)
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
