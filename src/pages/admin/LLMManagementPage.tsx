import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { callEdgeFunction } from '@/lib/api';
import { useAdminStore } from '@/stores/adminStore';
import { adminAction } from '@/lib/api';
import { Activity, CheckCircle2, XCircle, TrendingUp, Clock, Zap } from 'lucide-react';

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

export default function LLMManagementPage() {
    const { password: adminPassword } = useAdminStore();
    const queryClient = useQueryClient();
    const [timeRange, setTimeRange] = useState('24h');

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
                };
            }>('getLLMAvailability', adminPassword);
            return result?.availability;
        },
        enabled: !!adminPassword,
    });

    // Fetch LLM statistics
    const { data: statsData, isLoading } = useQuery({
        queryKey: ['llm-stats', timeRange],
        queryFn: async () => {
            const url = `/llm-stats?timeRange=${timeRange}`;
            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/llm-stats?timeRange=${timeRange}`, {
                headers: {
                    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                },
            });
            const result = await response.json();
            return result;
        },
        refetchInterval: 30000, // Refresh every 30 seconds
    });

    const providers = [
        { name: 'zai', label: 'Z.AI', available: true, color: 'bg-blue-500' },
        { name: 'openai', label: 'OpenAI', available: availability?.hasOpenai, color: 'bg-green-500' },
        { name: 'gemini', label: 'Gemini', available: availability?.hasGemini, color: 'bg-purple-500' },
        { name: 'geminiV22', label: 'Gemini V2.2', available: availability?.hasGeminiV22, color: 'bg-purple-600' },
        { name: 'mistral', label: 'Mistral', available: availability?.hasMistral, color: 'bg-orange-500' },
        { name: 'anthropic', label: 'Anthropic', available: availability?.hasAnthropic, color: 'bg-red-500' },
        { name: 'lovable', label: 'Lovable AI', available: true, color: 'bg-pink-500' },
    ];

    const getProviderStats = (providerName: string): LLMStat | null => {
        return statsData?.stats?.find(s => s.provider === providerName) || null;
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
                                    statsData.stats.reduce((acc, s) => acc + s.successRate, 0) / statsData.stats.length
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
                                    statsData.stats.reduce((acc, s) => acc + s.avgDuration, 0) / statsData.stats.length
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
                    const isActive = provider.available && stats && stats.totalCalls > 0;

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
                                                        .sort((a, b) => b[1] - a[1])
                                                        .slice(0, 3)
                                                        .map(([op, count]) => (
                                                            <Badge key={op} variant="secondary" className="text-xs">
                                                                {op}: {count}
                                                            </Badge>
                                                        ))}
                                                </div>
                                            </div>
                                        )}

                                        {stats.errors.length > 0 && (
                                            <div className="text-xs text-red-500 space-y-1">
                                                <div className="font-semibold">Recent Errors:</div>
                                                {stats.errors.slice(0, 2).map((err, i) => (
                                                    <div key={i} className="truncate">{err}</div>
                                                ))}
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
        </div>
    );
}
