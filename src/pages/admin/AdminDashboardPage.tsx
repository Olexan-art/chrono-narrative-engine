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
        refetchInterval: 30000, // Рідше рефреш для швидкості
        enabled: !!password,
    });

    const { data: recentStats } = useQuery({
        queryKey: ['quick-retell-stats'],
        queryFn: async () => {
            const response = await callEdgeFunction('admin', {
                action: 'getRetellStats',
                password,
                data: { hours: 1 }
            }) as { success: boolean; rows?: any[] };

            if (!response.success) throw new Error('Failed to fetch retell stats');
            return response.rows || [];
        },
        refetchInterval: 60000, // 1 хвилина рефреш
        enabled: !!password,
    });

    if (!queueStats) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <Card className="animate-pulse">
                    <CardContent className="pt-6">
                        <div className="h-20 bg-muted rounded"></div>
                    </CardContent>
                </Card>
                <Card className="animate-pulse">
                    <CardContent className="pt-6">
                        <div className="h-20 bg-muted rounded"></div>
                    </CardContent>
                </Card>
                <Card className="animate-pulse">
                    <CardContent className="pt-6">
                        <div className="h-20 bg-muted rounded"></div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const totalProcessed = recentStats?.reduce((sum, row) => sum + row.news_retold, 0) || 0;
    const zaiCount = recentStats?.filter(row => row.provider === 'zai').reduce((sum, row) => sum + row.news_retold, 0) || 0;
    const deepseekCount = recentStats?.filter(row => row.provider === 'deepseek').reduce((sum, row) => sum + row.news_retold, 0) || 0;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Черга */}
                <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground uppercase">В черзі</p>
                                <p className="text-3xl font-bold text-primary">{queueStats.current?.total || 0}</p>
                            </div>
                            <Activity className="w-8 h-8 text-primary/40" />
                        </div>
                        <div className="mt-2">
                            <p className="text-[11px] text-muted-foreground">Останні 15 хв: {queueStats.m15?.total || 0}</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Z.AI статистика */}
                <Card className="bg-green-500/5 border-green-500/20">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground uppercase">Z.AI (1г)</p>
                                <p className="text-3xl font-bold text-green-500">{zaiCount}</p>
                            </div>
                            <Zap className="w-8 h-8 text-green-500/40" />
                        </div>
                        <div className="mt-2">
                            <Badge variant="outline" className="text-[10px]">GLM-4.7-Flash</Badge>
                        </div>
                    </CardContent>
                </Card>

                {/* DeepSeek статистика */}
                <Card className="bg-blue-500/5 border-blue-500/20">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground uppercase">DeepSeek (1г)</p>
                                <p className="text-3xl font-bold text-blue-500">{deepseekCount}</p>
                            </div>
                            <TrendingUp className="w-8 h-8 text-blue-500/40" />
                        </div>
                        <div className="mt-2">
                            <Badge variant="outline" className="text-[10px]">deepseek-chat</Badge>
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