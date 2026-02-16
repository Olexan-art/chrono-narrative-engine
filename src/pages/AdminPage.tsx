import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Lock, BarChart3, Settings, BookOpen, FileText, Image, RefreshCw, LogOut, Loader2, Sparkles, Calendar, TrendingUp, Key, Eye, EyeOff, Bot, Trash2, Users, MessageSquare, Zap, Globe, Clock, Archive, Map, Search, Activity, ChartArea, Database, AlertTriangle, Building2, Flame, GitMerge, Rss } from "lucide-react";
import { AdminLogin } from "@/components/AdminLogin";
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
import { ChaptersPanel } from "@/components/ChaptersPanel";
import { SEOHead } from "@/components/SEOHead";
import CharactersPanel from "@/components/CharactersPanel";
import DialogueManagementPanel from "@/components/DialogueManagementPanel";
import { DashboardPanel } from "@/components/DashboardPanel";
import { FlashNewsPanel } from "@/components/FlashNewsPanel";
import { JustBusinessPanel } from "@/components/JustBusinessPanel";
import { NewsDigestPanel } from "@/components/NewsDigestPanel";
import { NewsArchivePanel } from "@/components/NewsArchivePanel";
import { SitemapManagementPanel } from "@/components/SitemapManagementPanel";
import { SEOAuditPanel } from "@/components/SEOAuditPanel";
import { SEOSettingsPanel } from "@/components/SEOSettingsPanel";
import { BotVisitsPanel } from "@/components/BotVisitsPanel";
import { BotCacheAnalyticsPanel } from "@/components/BotCacheAnalyticsPanel";
import { BotErrorsPanel } from "@/components/BotErrorsPanel";
import { StatisticsPanel } from "@/components/StatisticsPanel";
import { WikiEntitiesPanel } from "@/components/admin/WikiEntitiesPanel";
import { NewsSearchPanel } from "@/components/admin/NewsSearchPanel";
import { NewsCalendarPanel } from "@/components/admin/NewsCalendarPanel";
import { ImagesManagementPanel } from "@/components/admin/ImagesManagementPanel";
import { BulkScrapePanel } from "@/components/admin/BulkScrapePanel";
import { ViralityPanel } from "@/components/admin/ViralityPanel";
import { NewsMergePanel } from "@/components/admin/NewsMergePanel";
import { RSSFeedPanel } from "@/components/admin/RSSFeedPanel";
import LLMManagementPage from "@/pages/admin/LLMManagementPage";
import NewsProcessingPage from "@/pages/admin/NewsProcessingPage";
import { useToast } from "@/hooks/use-toast";
import { adminAction } from "@/lib/api";
import { useAdminStore } from "@/stores/adminStore";
import { supabase } from "@/integrations/supabase/client";
import type { Settings as SettingsType, AdminStats, Part, Volume, Chapter, LLMProvider } from "@/types/database";
import { NARRATIVE_OPTIONS, LLM_MODELS } from "@/types/database";

// AdminLogin component moved to separate file


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
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});

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

  const toggleApiKeyVisibility = (key: string) => {
    setShowApiKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (isLoading || !settings) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  const textProvider = (settings.llm_text_provider || settings.llm_provider || 'zai') as LLMProvider;
  const imageProvider = (settings.llm_image_provider || settings.llm_provider || 'zai') as LLMProvider;
  // Safe access to LLM_MODELS - fall back to empty arrays if provider not found
  const availableTextModels = (LLM_MODELS as Record<string, { text?: { value: string; label: string }[]; image?: { value: string; label: string }[] }>)[textProvider]?.text || LLM_MODELS.zai?.text || [];
  const availableImageModels = (LLM_MODELS as Record<string, { text?: { value: string; label: string }[]; image?: { value: string; label: string }[] }>)[imageProvider]?.image || LLM_MODELS.zai?.image || [];

  return (
    <div className="space-y-6">
      {/* LLM Configuration */}
      <Card className="cosmic-card border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            AI/LLM Налаштування
          </CardTitle>
          <CardDescription>Підключення до штучного інтелекту для генерації контенту</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Removed single provider - now using separate providers for text and image */}

          {/* API Keys - show when any provider needs them */}
          {(textProvider !== 'zai' || imageProvider !== 'zai') && (
            <div className="space-y-4 p-4 border border-dashed border-primary/30 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Key className="w-4 h-4" />
                API Ключі
              </div>

              {(textProvider === 'openai' || imageProvider === 'openai') && (
                <div className="space-y-2">
                  <Label>OpenAI API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      type={showApiKeys.openai ? 'text' : 'password'}
                      value={settings.openai_api_key || ''}
                      onChange={(e) => updateMutation.mutate({ openai_api_key: e.target.value })}
                      placeholder="sk-..."
                      className="font-mono"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => toggleApiKeyVisibility('openai')}
                    >
                      {showApiKeys.openai ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Отримати ключ: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" className="text-primary hover:underline">platform.openai.com</a>
                  </p>
                </div>
              )}

              {(textProvider === 'gemini' || imageProvider === 'gemini') && (
                <div className="space-y-2">
                  <Label>Google AI API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      type={showApiKeys.gemini ? 'text' : 'password'}
                      value={settings.gemini_api_key || ''}
                      onChange={(e) => updateMutation.mutate({ gemini_api_key: e.target.value })}
                      placeholder="AIza..."
                      className="font-mono"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => toggleApiKeyVisibility('gemini')}
                    >
                      {showApiKeys.gemini ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Отримати ключ: <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="text-primary hover:underline">aistudio.google.com</a>
                  </p>
                </div>
              )}

              {textProvider === 'anthropic' && (
                <div className="space-y-2">
                  <Label>Anthropic API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      type={showApiKeys.anthropic ? 'text' : 'password'}
                      value={settings.anthropic_api_key || ''}
                      onChange={(e) => updateMutation.mutate({ anthropic_api_key: e.target.value })}
                      placeholder="sk-ant-..."
                      className="font-mono"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => toggleApiKeyVisibility('anthropic')}
                    >
                      {showApiKeys.anthropic ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Отримати ключ: <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener" className="text-primary hover:underline">console.anthropic.com</a>
                  </p>
                </div>
              )}

              {textProvider === 'zai' && (
                <div className="space-y-2">
                  <Label>Z.AI API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      type={showApiKeys.zai ? 'text' : 'password'}
                      value={settings.zai_api_key || ''}
                      onChange={(e) => updateMutation.mutate({ zai_api_key: e.target.value })}
                      placeholder="..."
                      className="font-mono"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => toggleApiKeyVisibility('zai')}
                    >
                      {showApiKeys.zai ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Отримати ключ: <a href="https://z.ai/model-api" target="_blank" rel="noopener" className="text-primary hover:underline">z.ai/model-api</a>
                  </p>
                </div>
              )}

              {(textProvider === 'geminiV22' || imageProvider === 'geminiV22') && (
                <div className="space-y-2">
                  <Label>Google AI API Key (V22)</Label>
                  <div className="flex gap-2">
                    <Input
                      type={showApiKeys.geminiV22 ? 'text' : 'password'}
                      value={settings.gemini_v22_api_key || ''}
                      onChange={(e) => updateMutation.mutate({ gemini_v22_api_key: e.target.value })}
                      placeholder="AIza..."
                      className="font-mono"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => toggleApiKeyVisibility('geminiV22')}
                    >
                      {showApiKeys.geminiV22 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Версія 22 API ключа для Gemini
                  </p>
                </div>
              )}

              {textProvider === 'mistral' && (
                <div className="space-y-2">
                  <Label>Mistral API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      type={showApiKeys.mistral ? 'text' : 'password'}
                      value={(settings as any).mistral_api_key || ''}
                      onChange={(e) => updateMutation.mutate({ mistral_api_key: e.target.value } as any)}
                      placeholder="..."
                      className="font-mono"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => toggleApiKeyVisibility('mistral')}
                    >
                      {showApiKeys.mistral ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Отримати ключ: <a href="https://console.mistral.ai/api-keys" target="_blank" rel="noopener" className="text-primary hover:underline">console.mistral.ai</a>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Text Provider + Model Selection */}
          <div className="space-y-3 p-4 border border-border/50 rounded-lg">
            <Label className="text-base font-medium">Модель для тексту</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Провайдер</Label>
                <Select
                  value={textProvider}
                  onValueChange={(v) => {
                    const provider = v as LLMProvider;
                    const defaultModel = LLM_MODELS[provider]?.text[0]?.value || '';
                    updateMutation.mutate({
                      llm_text_provider: provider,
                      llm_text_model: defaultModel
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zai">
                      <div className="flex items-center gap-2">
                        <span>🇨🇳</span>
                        Z.AI (GLM)
                      </div>
                    </SelectItem>
                    <SelectItem value="gemini">
                      <div className="flex items-center gap-2">
                        <span>💎</span>
                        Google Gemini
                      </div>
                    </SelectItem>
                    <SelectItem value="openai">
                      <div className="flex items-center gap-2">
                        <span>🤖</span>
                        OpenAI
                      </div>
                    </SelectItem>
                    <SelectItem value="anthropic">
                      <div className="flex items-center gap-2">
                        <span>🧠</span>
                        Anthropic
                      </div>
                    </SelectItem>
                    <SelectItem value="lovable">
                      <div className="flex items-center gap-2">
                        <span className="text-primary">✨</span>
                        Lovable AI
                      </div>
                    </SelectItem>
                    <SelectItem value="geminiV22">
                      <div className="flex items-center gap-2">
                        <span>💎</span>
                        Gemini V22
                      </div>
                    </SelectItem>
                    <SelectItem value="mistral">
                      <div className="flex items-center gap-2">
                        <span>🇫🇷</span>
                        Mistral AI
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Модель</Label>
                <Select
                  value={settings.llm_text_model || availableTextModels[0]?.value}
                  onValueChange={(v) => updateMutation.mutate({ llm_text_model: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTextModels.map(model => (
                      <SelectItem key={model.value} value={model.value}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {textProvider === 'zai' && (
              <p className="text-xs text-muted-foreground">
                Використовує Z.AI (GLM) для генерації тексту
              </p>
            )}
          </div>

          {/* Image Provider + Model Selection */}
          <div className="space-y-3 p-4 border border-border/50 rounded-lg">
            <Label className="text-base font-medium">Модель для зображень</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Провайдер</Label>
                <Select
                  value={imageProvider}
                  onValueChange={(v) => {
                    const provider = v as LLMProvider;
                    const defaultModel = LLM_MODELS[provider]?.image[0]?.value || '';
                    updateMutation.mutate({
                      llm_image_provider: provider,
                      llm_image_model: defaultModel
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lovable">
                      <div className="flex items-center gap-2">
                        <span className="text-primary">✨</span>
                        Lovable AI
                      </div>
                    </SelectItem>
                    <SelectItem value="openai">
                      <div className="flex items-center gap-2">
                        <span>🤖</span>
                        OpenAI
                      </div>
                    </SelectItem>
                    <SelectItem value="gemini">
                      <div className="flex items-center gap-2">
                        <span>💎</span>
                        Google Gemini
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Модель</Label>
                {availableImageModels.length > 0 ? (
                  <Select
                    value={settings.llm_image_model || availableImageModels[0]?.value}
                    onValueChange={(v) => updateMutation.mutate({ llm_image_model: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableImageModels.map(model => (
                        <SelectItem key={model.value} value={model.value}>
                          {model.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="p-2 bg-muted/50 rounded text-sm text-muted-foreground">
                    Немає моделей
                  </div>
                )}
              </div>
            </div>
            {imageProvider === 'zai' && (
              <p className="text-xs text-muted-foreground">
                Z.AI не підтримує генерацію зображень, використовуйте інший провайдер
              </p>
            )}
            {imageProvider === 'anthropic' && (
              <div className="p-2 bg-destructive/10 rounded text-sm text-destructive">
                ⚠️ Anthropic не підтримує генерацію зображень
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const deleteMutation = useMutation({
    mutationFn: async (partId: string) => {
      await adminAction('deletePart', password, { id: partId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-parts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['latest-parts'] });
      toast({ title: "Оповідання видалено" });
      setDeletingId(null);
    },
    onError: (error) => {
      toast({
        title: "Помилка",
        description: error instanceof Error ? error.message : "Не вдалося видалити",
        variant: "destructive"
      });
      setDeletingId(null);
    }
  });

  const handleDelete = (partId: string, partTitle: string) => {
    if (window.confirm(`Видалити оповідання "${partTitle}"?`)) {
      setDeletingId(partId);
      deleteMutation.mutate(partId);
    }
  };

  return (
    <div className="space-y-4">
      {parts.map((part: any) => (
        <Card key={part.id} className={`cosmic-card ${part.is_flash_news ? 'border-amber-500/20' : ''}`}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {part.is_flash_news && (
                    <span className="px-2 py-0.5 text-xs font-mono border border-amber-500/30 text-amber-500 bg-amber-500/10 flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      FLASH
                    </span>
                  )}
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
                  className={`w-20 h-20 object-cover border ${part.is_flash_news ? 'border-amber-500/30' : 'border-border'}`}
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
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleDelete(part.id, part.title)}
                disabled={deletingId === part.id}
                className="ml-auto"
              >
                {deletingId === part.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </Button>
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

  useEffect(() => {
    // Force invalidate all queries when mounting admin page to ensure fresh data
    // This addresses the user request to "remove caching" from admin
    queryClient.invalidateQueries();
  }, [queryClient]);

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
      <SEOHead title="Панель керування" noIndex={true} />
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

        <Tabs defaultValue="dashboard" className="mt-8">
          <TabsList className="flex flex-wrap gap-1 h-auto py-2">
            {/* Аналітика */}
            <TabsTrigger value="dashboard" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Дашборд
            </TabsTrigger>
            <TabsTrigger value="statistics" className="gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Статистика
            </TabsTrigger>
            <TabsTrigger value="bots" className="gap-2">
              <Bot className="w-4 h-4 text-emerald-500" />
              Боти
            </TabsTrigger>
            <TabsTrigger value="cache-analytics" className="gap-2">
              <Database className="w-4 h-4 text-cyan-500" />
              Кеш
            </TabsTrigger>

            {/* Генерація контенту */}
            <TabsTrigger value="generate" className="gap-2">
              <Sparkles className="w-4 h-4" />
              День
            </TabsTrigger>
            <TabsTrigger value="week" className="gap-2">
              <Calendar className="w-4 h-4" />
              Тиждень
            </TabsTrigger>
            <TabsTrigger value="flash" className="gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              Flash
            </TabsTrigger>
            <TabsTrigger value="justbusiness" className="gap-2">
              <Building2 className="w-4 h-4 text-blue-500" />
              Business
            </TabsTrigger>

            {/* Контент */}
            <TabsTrigger value="chapters" className="gap-2">
              <BookOpen className="w-4 h-4" />
              Глави
            </TabsTrigger>
            <TabsTrigger value="parts" className="gap-2">
              <FileText className="w-4 h-4" />
              Частини
            </TabsTrigger>
            <TabsTrigger value="characters" className="gap-2">
              <Users className="w-4 h-4" />
              Персонажі
            </TabsTrigger>
            <TabsTrigger value="dialogues" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              Діалоги
            </TabsTrigger>

            {/* Новини */}
            <TabsTrigger value="newsdigest" className="gap-2">
              <Globe className="w-4 h-4 text-cyan-500" />
              Кротовиина
            </TabsTrigger>
            <TabsTrigger value="news-search" className="gap-2">
              <Search className="w-4 h-4 text-amber-500" />
              Пошук
            </TabsTrigger>
            <TabsTrigger value="news-calendar" className="gap-2">
              <Calendar className="w-4 h-4 text-teal-500" />
              Календар
            </TabsTrigger>
            <TabsTrigger value="virality" className="gap-2">
              <Flame className="w-4 h-4 text-orange-500" />
              Віральність
            </TabsTrigger>
            <TabsTrigger value="merge-news" className="gap-2">
              <GitMerge className="w-4 h-4 text-teal-500" />
              Дедуплікація
            </TabsTrigger>
            <TabsTrigger value="archive" className="gap-2">
              <Archive className="w-4 h-4 text-orange-500" />
              Архів
            </TabsTrigger>
            <TabsTrigger value="rss-feed" className="gap-2">
              <Rss className="w-4 h-4 text-orange-500" />
              RSS
            </TabsTrigger>

            {/* База даних */}
            <TabsTrigger value="wiki-entities" className="gap-2">
              <Building2 className="w-4 h-4 text-violet-500" />
              Wiki
            </TabsTrigger>
            <TabsTrigger value="images" className="gap-2">
              <Image className="w-4 h-4 text-rose-500" />
              Картинки
            </TabsTrigger>
            <TabsTrigger value="bulk-scrape" className="gap-2">
              <FileText className="w-4 h-4 text-cyan-500" />
              Парсинг
            </TabsTrigger>

            {/* SEO & Технічне */}
            <TabsTrigger value="sitemaps" className="gap-2">
              <Map className="w-4 h-4 text-blue-500" />
              Сайтмапи
            </TabsTrigger>
            <TabsTrigger value="seo" className="gap-2">
              <Search className="w-4 h-4 text-purple-500" />
              SEO
            </TabsTrigger>
            <TabsTrigger value="cron" className="gap-2">
              <Clock className="w-4 h-4 text-green-500" />
              Cron
            </TabsTrigger>
            <TabsTrigger value="bot-errors" className="gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              Помилки
            </TabsTrigger>

            {/* Налаштування */}
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="w-4 h-4" />
              Налаштування
            </TabsTrigger>
            <TabsTrigger value="llm" className="gap-2">
              <Bot className="w-4 h-4 text-purple-500" />
              LLM
            </TabsTrigger>
            <TabsTrigger value="news-processing" className="gap-2">
              <RefreshCw className="w-4 h-4 text-orange-500" />
              News Jobs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <DashboardPanel password={password} />
          </TabsContent>

          <TabsContent value="llm" className="mt-6">
            <LLMManagementPage />
          </TabsContent>

          <TabsContent value="news-processing" className="mt-6">
            <NewsProcessingPage />
          </TabsContent>

          <TabsContent value="statistics" className="mt-6">
            <StatisticsPanel password={password} />
          </TabsContent>

          <TabsContent value="generate" className="mt-6">
            <GenerationPanel password={password} />
          </TabsContent>

          <TabsContent value="week" className="mt-6">
            <WeekGenerationPanel password={password} />
          </TabsContent>

          <TabsContent value="flash" className="mt-6">
            <FlashNewsPanel password={password} />
          </TabsContent>

          <TabsContent value="justbusiness" className="mt-6">
            <JustBusinessPanel password={password} />
          </TabsContent>

          <TabsContent value="chapters" className="mt-6">
            <ChaptersPanel password={password} />
          </TabsContent>

          <TabsContent value="parts" className="mt-6">
            <PartsPanel password={password} />
          </TabsContent>

          <TabsContent value="characters" className="mt-6">
            <CharactersPanel password={password} />
          </TabsContent>

          <TabsContent value="dialogues" className="mt-6">
            <DialogueManagementPanel password={password} />
          </TabsContent>

          <TabsContent value="newsdigest" className="mt-6">
            <NewsDigestPanel password={password} />
          </TabsContent>

          <TabsContent value="cron" className="mt-6">
            {/* <CronJobsPanel password={password} /> Removed in favor of NewsProcessingPage */}
            <div className="p-4 text-center">
              <p>Керування новинами перенесено на сторінку <Link to="/admin/news-processing" className="text-primary hover:underline">News Processing</Link></p>
            </div>
          </TabsContent>

          <TabsContent value="archive" className="mt-6">
            <NewsArchivePanel password={password} />
          </TabsContent>

          <TabsContent value="sitemaps" className="mt-6">
            <SitemapManagementPanel />
          </TabsContent>

          <TabsContent value="seo" className="mt-6">
            <div className="space-y-6">
              <SEOSettingsPanel password={password} />
              <SEOAuditPanel password={password} />
            </div>
          </TabsContent>

          <TabsContent value="bots" className="mt-6">
            <BotVisitsPanel password={password} />
          </TabsContent>

          <TabsContent value="cache-analytics" className="mt-6">
            <BotCacheAnalyticsPanel password={password} />
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <SettingsPanel password={password} />
          </TabsContent>

          <TabsContent value="bot-errors" className="mt-6">
            <BotErrorsPanel password={password} />
          </TabsContent>

          <TabsContent value="wiki-entities" className="mt-6">
            <WikiEntitiesPanel />
          </TabsContent>

          <TabsContent value="news-search" className="mt-6">
            <NewsSearchPanel />
          </TabsContent>

          <TabsContent value="news-calendar" className="mt-6">
            <NewsCalendarPanel />
          </TabsContent>

          <TabsContent value="images" className="mt-6">
            <ImagesManagementPanel />
          </TabsContent>

          <TabsContent value="bulk-scrape" className="mt-6">
            <BulkScrapePanel />
          </TabsContent>

          <TabsContent value="virality" className="mt-6">
            <ViralityPanel />
          </TabsContent>

          <TabsContent value="merge-news" className="mt-6">
            <NewsMergePanel />
          </TabsContent>

          <TabsContent value="rss-feed" className="mt-6">
            <RSSFeedPanel password={password} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
