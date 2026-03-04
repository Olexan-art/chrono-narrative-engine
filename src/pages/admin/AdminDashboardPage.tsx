import { useQuery } from "@tanstack/react-query";
import { Activity, AlertCircle, RefreshCw, Timer, Zap, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { callEdgeFunction } from "@/lib/api";
import RetellQueueStats from "@/components/admin/RetellQueueStats";
import { useAdminStore } from "@/stores/adminStore";

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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Activity className="w-5 h-5" />
                        Retell Queue (Автоматична обробка)
                    </CardTitle>
                    <CardDescription>
                        Система автоматично обробляє 20 новин кожні 10 хвилин
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <RetellQueueStats password={password} />
                </CardContent>
            </Card>

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