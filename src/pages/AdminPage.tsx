import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Lock, BarChart3, Settings, BookOpen, FileText, Image, RefreshCw, LogOut, Loader2, Sparkles, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Header } from "@/components/Header";
import { GenerationPanel } from "@/components/GenerationPanel";
import { WeekGenerationPanel } from "@/components/WeekGenerationPanel";
import { useToast } from "@/hooks/use-toast";
import { adminAction } from "@/lib/api";
import { useAdminStore } from "@/stores/adminStore";
import { supabase } from "@/integrations/supabase/client";
import type { Settings as SettingsType, AdminStats, Part, Volume, Chapter } from "@/types/database";
import { NARRATIVE_OPTIONS } from "@/types/database";

function AdminLogin({ onLogin }: { onLogin: (password: string) => void }) {
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await adminAction('verify', password);
      onLogin(password);
      toast({ title: "Авторизація успішна" });
    } catch (error) {
      toast({
        title: "Помилка",
        description: "Невірний пароль",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="w-full max-w-md cosmic-card">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 border border-primary/30 flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="chapter-title">АДМІН ПАНЕЛЬ</CardTitle>
          <CardDescription className="font-mono">
            ТОЧКА СИНХРОНІЗАЦІЇ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введіть пароль"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Увійти"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function StatsCard({ stats }: { stats: AdminStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {[
        { label: 'Томів', value: stats.volumes, icon: BookOpen },
        { label: 'Глав', value: stats.chapters, icon: FileText },
        { label: 'Частин', value: stats.parts, icon: FileText },
        { label: 'Опубліковано', value: stats.publishedParts, icon: FileText },
        { label: 'Генерацій', value: stats.generations, icon: Image },
      ].map(({ label, value, icon: Icon }) => (
        <Card key={label} className="cosmic-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Icon className="w-5 h-5 text-primary" />
              <div>
                <p className="text-2xl font-bold text-glow">{value}</p>
                <p className="text-xs text-muted-foreground font-mono">{label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SettingsPanel({ password }: { password: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const result = await adminAction<{ settings: SettingsType }>('getSettings', password);
      return result.settings;
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<SettingsType>) => {
      await adminAction('updateSettings', password, { ...data, id: settings?.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast({ title: "Налаштування збережено" });
    },
    onError: (error) => {
      toast({
        title: "Помилка",
        description: error instanceof Error ? error.message : "Не вдалося зберегти",
        variant: "destructive"
      });
    }
  });

  if (isLoading || !settings) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card className="cosmic-card">
        <CardHeader>
          <CardTitle>Автогенерація</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Увімкнути автогенерацію</Label>
            <Switch
              checked={settings.auto_generation_enabled}
              onCheckedChange={(checked) => updateMutation.mutate({ auto_generation_enabled: checked })}
            />
          </div>
          <div className="space-y-2">
            <Label>Інтервал генерації (години)</Label>
            <Select
              value={String(settings.generation_interval_hours)}
              onValueChange={(v) => updateMutation.mutate({ generation_interval_hours: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 6, 8, 12, 24].map(h => (
                  <SelectItem key={h} value={String(h)}>{h} год</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="cosmic-card">
        <CardHeader>
          <CardTitle>Нарративні налаштування</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(NARRATIVE_OPTIONS).map(([key, options]) => (
            <div key={key} className="space-y-2">
              <Label className="capitalize">{
                key === 'source' ? 'Джерело' :
                key === 'structure' ? 'Структура' :
                key === 'purpose' ? 'Мета' :
                key === 'plot' ? 'Сюжет' : 'Спеціальний'
              }</Label>
              <Select
                value={settings[`narrative_${key}` as keyof SettingsType] as string}
                onValueChange={(v) => updateMutation.mutate({ [`narrative_${key}`]: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(options).map(([value, { label, description }]) => (
                    <SelectItem key={value} value={value}>
                      {label} — {description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="cosmic-card">
        <CardHeader>
          <CardTitle>Баланс стилів авторів</CardTitle>
          <CardDescription>Розподіл впливу стилів письменників</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {[
            { key: 'bradbury_weight', label: 'Рей Бредбері', desc: 'Метафоричність, ностальгія' },
            { key: 'clarke_weight', label: 'Артур Кларк', desc: 'Технічність, космос' },
            { key: 'gaiman_weight', label: 'Ніл Гейман', desc: 'Міфологія, сюрреалізм' },
          ].map(({ key, label, desc }) => (
            <div key={key} className="space-y-2">
              <div className="flex justify-between">
                <Label>{label}</Label>
                <span className="text-sm text-muted-foreground font-mono">
                  {settings[key as keyof SettingsType]}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{desc}</p>
              <Slider
                value={[settings[key as keyof SettingsType] as number]}
                onValueChange={([v]) => updateMutation.mutate({ [key]: v })}
                max={100}
                step={1}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function PartsPanel({ password }: { password: string }) {
  const { data: parts = [] } = useQuery({
    queryKey: ['admin-parts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts')
        .select(`
          *,
          chapter:chapters(
            *,
            volume:volumes(*)
          )
        `)
        .order('date', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    }
  });

  return (
    <div className="space-y-4">
      {parts.map((part: any) => (
        <Card key={part.id} className="cosmic-card">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`
                    px-2 py-0.5 text-xs font-mono border
                    ${part.status === 'published' ? 'border-primary text-primary' : 'border-muted-foreground text-muted-foreground'}
                  `}>
                    {part.status === 'published' ? 'ОПУБЛІКОВАНО' : part.status === 'scheduled' ? 'ЗАПЛАНОВАНО' : 'ЧЕРНЕТКА'}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">{part.date}</span>
                </div>
                <h4 className="font-serif font-medium truncate">{part.title}</h4>
                <p className="text-sm text-muted-foreground line-clamp-1 font-serif">
                  {part.content?.slice(0, 100)}...
                </p>
              </div>
              {part.cover_image_url && (
                <img 
                  src={part.cover_image_url} 
                  alt="" 
                  className="w-20 h-20 object-cover border border-border"
                />
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <Link to={`/admin/part/${part.id}`}>
                <Button size="sm" variant="outline">Редагувати</Button>
              </Link>
              <Link to={`/read/${part.date}`}>
                <Button size="sm" variant="ghost">Переглянути</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function AdminPage() {
  const { isAuthenticated, password, setPassword, setAuthenticated, logout } = useAdminStore();
  const queryClient = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const result = await adminAction<{ stats: AdminStats }>('getStats', password);
      return result.stats;
    },
    enabled: isAuthenticated
  });

  const handleLogin = (pwd: string) => {
    setPassword(pwd);
    setAuthenticated(true);
  };

  if (!isAuthenticated) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold chapter-title text-glow">ПАНЕЛЬ КЕРУВАННЯ</h1>
          <Button variant="outline" size="sm" onClick={logout} className="gap-2">
            <LogOut className="w-4 h-4" />
            Вийти
          </Button>
        </div>

        {stats && <StatsCard stats={stats} />}

        <Tabs defaultValue="generate" className="mt-8">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="generate" className="gap-2">
              <Sparkles className="w-4 h-4" />
              День
            </TabsTrigger>
            <TabsTrigger value="week" className="gap-2">
              <Calendar className="w-4 h-4" />
              Тиждень
            </TabsTrigger>
            <TabsTrigger value="parts" className="gap-2">
              <FileText className="w-4 h-4" />
              Частини
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="w-4 h-4" />
              Налаштування
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="mt-6">
            <GenerationPanel password={password} />
          </TabsContent>

          <TabsContent value="week" className="mt-6">
            <WeekGenerationPanel password={password} />
          </TabsContent>

          <TabsContent value="parts" className="mt-6">
            <PartsPanel password={password} />
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <SettingsPanel password={password} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
