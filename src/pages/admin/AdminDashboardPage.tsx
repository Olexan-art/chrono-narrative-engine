import { useQuery } from "@tanstack/react-query";
import { Activity, AlertCircle, RefreshCw, Timer, Zap, TrendingUp, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { callEdgeFunction } from "@/lib/api";
import RetellQueueStats from "@/components/admin/RetellQueueStats";
import { useAdminStore } from "@/stores/adminStore";
import { supabase } from "@/integrations/supabase/client";

// Швидка версія дашборду тільки з критичною статистикою
function QuickDashboard({ password }: { password: string }) {
    const { data: queueStats, refetch } = useQuery({
        queryKey: ['quick-dashboard-stats'],
        queryFn: async () => {
            const response = await callEdgeFunction('admin', {
                action: 'getRetellQueueStats',
                password
            }) as { success: boolean; stats: any };

            if (!response.success) throw new Error('Failed to fetch queue stats');
            return response.stats;
        },
        refetchInterval: 30000,
        enabled: !!password,
    });

    const { data: recentStats } = useQuery({
        queryKey: ['quick-retell-stats'],
        queryFn: async () => {
            const response = await callEdgeFunction('admin', {
                action: 'getRetellStats',
                password,
                data: { hours: 24 } // Let's look at 24h for a better overview
            }) as { success: boolean; rows?: any[] };

            if (!response.success) throw new Error('Failed to fetch retell stats');
            return response.rows || [];
        },
        refetchInterval: 60000,
        enabled: !!password,
    });

    const { data: scoringStats } = useQuery({
        queryKey: ['source-scoring-stats'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('news_rss_items')
                .select('id, url, title, slug, source_scoring, updated_at, country:news_countries(code)')
                .not('source_scoring', 'is', null)
                .order('updated_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            return data || [];
        },
        refetchInterval: 60000,
    });

    // Calculate scoring statistics
    const scoringDistribution = scoringStats?.reduce((acc: any, item: any) => {
        const overall = item.source_scoring?.json?.scores?.overall || 0;
        if (overall >= 90) acc.excellent++;
        else if (overall >= 80) acc.high++;
        else if (overall >= 70) acc.normal++;
        else acc.low++;
        acc.total++;
        acc.avgScore += overall;
        return acc;
    }, { excellent: 0, high: 0, normal: 0, low: 0, total: 0, avgScore: 0 }) || { excellent: 0, high: 0, normal: 0, low: 0, total: 0, avgScore: 0 };

    if (scoringDistribution.total > 0) {
        scoringDistribution.avgScore = Math.round(scoringDistribution.avgScore / scoringDistribution.total);
    }

    if (!queueStats) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {[1, 2, 3].map(i => (
                    <Card key={i} className="animate-pulse">
                        <CardContent className="pt-6">
                            <div className="h-20 bg-muted rounded"></div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    const totalInQueue = queueStats.current_queue_size || 0;
    const completed24h = queueStats.completed_h24 || { zai: 0, deepseek: 0, total: 0 };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Черга */}
                <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Всего в черзі</p>
                                <p className="text-4xl font-bold text-primary">{totalInQueue}</p>
                            </div>
                            <Activity className="w-10 h-10 text-primary/30" />
                        </div>
                        <div className="mt-3 flex gap-4 text-[11px] text-muted-foreground">
                            <span>15хв: <strong>{queueStats.pending_queue?.m15 || 0}</strong></span>
                            <span>1г: <strong>{queueStats.pending_queue?.h1 || 0}</strong></span>
                        </div>
                    </CardContent>
                </Card>

                {/* Z.AI статистика (24г) */}
                <Card className="bg-green-500/5 border-green-500/20">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Z.AI (24г)</p>
                                <p className="text-4xl font-bold text-green-500">{completed24h.zai}</p>
                            </div>
                            <Zap className="w-10 h-10 text-green-500/30" />
                        </div>
                        <div className="mt-3">
                            <Badge variant="outline" className="text-[10px] border-green-500/30">GLM-4.7-Flash</Badge>
                        </div>
                    </CardContent>
                </Card>

                {/* DeepSeek статистика (24г) */}
                <Card className="bg-blue-500/5 border-blue-500/20">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">DeepSeek (24г)</p>
                                <p className="text-4xl font-bold text-blue-500">{completed24h.deepseek}</p>
                            </div>
                            <TrendingUp className="w-10 h-10 text-blue-500/30" />
                        </div>
                        <div className="mt-3">
                            <Badge variant="outline" className="text-[10px] border-blue-500/30">deepseek-chat</Badge>
                        </div>
                    </CardContent>
                </Card>

                {/* Source Scoring статистика */}
                <Card className="bg-purple-500/5 border-purple-500/20">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Source Scoring</p>
                                <p className="text-4xl font-bold text-purple-500">{scoringDistribution.total}</p>
                            </div>
                            <Target className="w-10 h-10 text-purple-500/30" />
                        </div>
                        <div className="mt-3 flex gap-2">
                            <Badge variant="outline" className="text-[10px] border-purple-500/30">Avg: {scoringDistribution.avgScore}</Badge>
                            <Badge variant="outline" className="text-[10px] border-green-500/30">{scoringDistribution.excellent} ★★★</Badge>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Z.AI Logs */}
                <Card className="bg-green-500/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Zap className="w-4 h-4 text-green-500" />
                            Логи Z.AI (Останні результати)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {recentStats?.filter(r => r.provider === 'zai').length > 0 ? (
                                recentStats.filter(r => r.provider === 'zai').map((log, i) => (
                                    <div key={i} className="flex justify-between items-center text-xs border-b border-green-500/10 pb-1">
                                        <span className="text-muted-foreground">{new Date(log.last_run).toLocaleTimeString()}</span>
                                        <span className="font-mono">{log.job_name}</span>
                                        <Badge variant="outline" className="text-green-500 border-green-500/20">+{log.news_retold}</Badge>
                                    </div>
                                ))
                            ) : (
                                <p className="text-xs text-muted-foreground py-4 text-center">Немає активних логів за 24г</p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* DeepSeek Logs */}
                <Card className="bg-blue-500/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-blue-500" />
                            Логи DeepSeek (Останні результати)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {recentStats?.filter(r => r.provider === 'deepseek').length > 0 ? (
                                recentStats.filter(r => r.provider === 'deepseek').map((log, i) => (
                                    <div key={i} className="flex justify-between items-center text-xs border-b border-blue-500/10 pb-1">
                                        <span className="text-muted-foreground">{new Date(log.last_run).toLocaleTimeString()}</span>
                                        <span className="font-mono">{log.job_name}</span>
                                        <Badge variant="outline" className="text-blue-500 border-blue-500/20">+{log.news_retold}</Badge>
                                    </div>
                                ))
                            ) : (
                                <p className="text-xs text-muted-foreground py-4 text-center">Немає активних логів за 24г</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Source Scoring Block */}
            <Card className="bg-purple-500/5 border-purple-500/20">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Target className="w-5 h-5 text-purple-500" />
                        Source Scoring - Якість джерел
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Distribution Chart */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-muted-foreground">Розподіл оцінок</h4>
                        <div className="grid grid-cols-4 gap-3">
                            <div className="text-center space-y-1">
                                <div className="relative h-24 flex items-end justify-center">
                                    <div 
                                        className="w-full bg-green-500/20 border-2 border-green-500 rounded-t transition-all"
                                        style={{ height: `${scoringDistribution.total > 0 ? (scoringDistribution.excellent / scoringDistribution.total) * 100 : 0}%` }}
                                    />
                                </div>
                                <p className="text-2xl font-bold text-green-500">{scoringDistribution.excellent}</p>
                                <p className="text-[10px] text-muted-foreground uppercase">90+ Excellent</p>
                            </div>
                            <div className="text-center space-y-1">
                                <div className="relative h-24 flex items-end justify-center">
                                    <div 
                                        className="w-full bg-blue-500/20 border-2 border-blue-500 rounded-t transition-all"
                                        style={{ height: `${scoringDistribution.total > 0 ? (scoringDistribution.high / scoringDistribution.total) * 100 : 0}%` }}
                                    />
                                </div>
                                <p className="text-2xl font-bold text-blue-500">{scoringDistribution.high}</p>
                                <p className="text-[10px] text-muted-foreground uppercase">80-89 High</p>
                            </div>
                            <div className="text-center space-y-1">
                                <div className="relative h-24 flex items-end justify-center">
                                    <div 
                                        className="w-full bg-cyan-500/20 border-2 border-cyan-500 rounded-t transition-all"
                                        style={{ height: `${scoringDistribution.total > 0 ? (scoringDistribution.normal / scoringDistribution.total) * 100 : 0}%` }}
                                    />
                                </div>
                                <p className="text-2xl font-bold text-cyan-500">{scoringDistribution.normal}</p>
                                <p className="text-[10px] text-muted-foreground uppercase">70-79 Normal</p>
                            </div>
                            <div className="text-center space-y-1">
                                <div className="relative h-24 flex items-end justify-center">
                                    <div 
                                        className="w-full bg-orange-500/20 border-2 border-orange-500 rounded-t transition-all"
                                        style={{ height: `${scoringDistribution.total > 0 ? (scoringDistribution.low / scoringDistribution.total) * 100 : 0}%` }}
                                    />
                                </div>
                                <p className="text-2xl font-bold text-orange-500">{scoringDistribution.low}</p>
                                <p className="text-[10px] text-muted-foreground uppercase">&lt;70 Low</p>
                            </div>
                        </div>
                    </div>

                    {/* LLM Providers Schedule */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-muted-foreground">Розклад LLM провайдерів</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-green-500 text-sm">Z.AI</span>
                                        <Badge variant="outline" className="text-[10px] border-green-500/30">glm-4-flash</Badge>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-1">Кожні 30 хвилин (00, 30)</p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-violet-500/5 border border-violet-500/20">
                                <div className="w-2 h-2 rounded-full bg-violet-500"></div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-violet-500 text-sm">Gemini</span>
                                        <Badge variant="outline" className="text-[10px] border-violet-500/30">1.5-flash</Badge>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-1">Кожну годину о :15</p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-blue-500 text-sm">DeepSeek</span>
                                        <Badge variant="outline" className="text-[10px] border-blue-500/30">deepseek-chat</Badge>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-1">Кожну годину о :30</p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
                                <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-cyan-500 text-sm">OpenAI</span>
                                        <Badge variant="outline" className="text-[10px] border-cyan-500/30">gpt-4o-mini</Badge>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-1">Кожні 3 години о :00</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recent Scores */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-muted-foreground">Останні 10 оцінок</h4>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {scoringStats && scoringStats.length > 0 ? (
                                scoringStats.slice(0, 10).map((item: any, i) => {
                                    const scoring = item.source_scoring?.json;
                                    const overall = scoring?.scores?.overall || 0;
                                    const status = scoring?.verification_status || 'Unknown';
                                    const countryCode = item.country?.code?.toLowerCase() || 'us';
                                    const newsUrl = `/news/${countryCode}/${item.slug}`;
                                    
                                    return (
                                        <div key={i} className="flex justify-between items-center text-xs border-b border-purple-500/10 pb-2 hover:bg-purple-500/5 px-2 py-1 rounded transition-colors">
                                            <div className="flex-1 min-w-0">
                                                <a 
                                                    href={newsUrl} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="text-purple-500 hover:underline truncate block font-medium"
                                                >
                                                    {item.title}
                                                </a>
                                            </div>
                                            <div className="flex items-center gap-2 ml-4 shrink-0">
                                                <Badge 
                                                    variant="outline" 
                                                    className={`text-[10px] font-bold ${
                                                        overall >= 90 ? 'border-green-500 text-green-500 bg-green-500/10' :
                                                        overall >= 80 ? 'border-blue-500 text-blue-500 bg-blue-500/10' :
                                                        overall >= 70 ? 'border-cyan-500 text-cyan-500 bg-cyan-500/10' :
                                                        'border-orange-500 text-orange-500 bg-orange-500/10'
                                                    }`}
                                                >
                                                    {overall}
                                                </Badge>
                                                <Badge variant="outline" className="text-[10px] border-purple-500/30">
                                                    {status}
                                                </Badge>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-xs text-muted-foreground py-8 text-center">Немає оцінок джерел. Cron запуститься о :30</p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Швидкі дії */}
            <div className="flex flex-wrap gap-2">
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                        refetch();
                    }}
                >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Оновити
                </Button>
                <Button 
                    variant="outline" 
                    size="sm" 
                    asChild
                >
                    <Link to="/admin/news-processing">
                        <Timer className="w-4 h-4 mr-2" />
                        Детальна статистика
                    </Link>
                </Button>
            </div>
        </div>
    );
}

export default function AdminDashboardPage() {
    const { password } = useAdminStore();
    
    return (
        <div className="container mx-auto px-4 py-8 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold chapter-title text-glow">Адмін Дашборд</h1>
                    <p className="text-muted-foreground mt-1">Швидкий огляд системи та ключові показники</p>
                </div>
            </div>

            {/* Швидкий дашборд */}
            <QuickDashboard password={password} />

            {/* Retell Queue Stats - найважливіший блок */}
            <RetellQueueStats password={password} />

            {/* Швидкий доступ */}
            <Card>
                <CardHeader>
                    <CardTitle>Швидкий доступ</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Button variant="outline" asChild>
                            <Link to="/admin/news-processing">
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Обробка новин
                            </Link>
                        </Button>
                        <Button variant="outline" asChild>
                            <Link to="/admin">
                                <Activity className="w-4 h-4 mr-2" />
                                Повна адмінка
                            </Link>
                        </Button>
                        <Button variant="outline" asChild>
                            <Link to="/admin/llm-management">
                                <Zap className="w-4 h-4 mr-2" />
                                LLM Management
                            </Link>
                        </Button>
                        <Button variant="outline" asChild>
                            <Link to="/news">
                                <TrendingUp className="w-4 h-4 mr-2" />
                                Новини (Frontend)
                            </Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}