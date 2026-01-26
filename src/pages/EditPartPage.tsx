import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Sparkles, Trash2, Eye, Image, Loader2, Calendar, ExternalLink, Languages, Zap } from "lucide-react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/Header";
import { SEOHead } from "@/components/SEOHead";
import { useToast } from "@/hooks/use-toast";
import { adminAction, generateImage, fetchNews, generateStory } from "@/lib/api";
import { useAdminStore } from "@/stores/adminStore";
import { supabase } from "@/integrations/supabase/client";
import type { Part } from "@/types/database";
import { NARRATIVE_OPTIONS } from "@/types/database";

export default function EditPartPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, password } = useAdminStore();
  const queryClient = useQueryClient();
  
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isTranslating, setIsTranslating] = useState<'en' | 'pl' | null>(null);

  const { data: part, isLoading } = useQuery({
    queryKey: ['part', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as Part;
    },
    enabled: !!id && isAuthenticated
  });

  const [formData, setFormData] = useState<Partial<Part>>({});

  // Initialize form data when part loads
  useEffect(() => {
    if (part) {
      setFormData(part);
    }
  }, [part]);

  const handleTranslate = async (targetLanguage: 'en' | 'pl') => {
    setIsTranslating(targetLanguage);
    try {
      const { error } = await supabase.functions.invoke('translate', {
        body: { partId: id, targetLanguage }
      });
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['part', id] });
      toast({ 
        title: `Перекладено на ${targetLanguage === 'en' ? 'англійську' : 'польську'}!` 
      });
    } catch (error) {
      toast({
        title: "Помилка перекладу",
        description: error instanceof Error ? error.message : "Не вдалося перекласти",
        variant: "destructive"
      });
    } finally {
      setIsTranslating(null);
    }
  };

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Part>) => {
      await adminAction('updatePart', password, { ...data, id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['part', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-parts'] });
      toast({ title: "Збережено" });
    },
    onError: (error) => {
      toast({
        title: "Помилка",
        description: error instanceof Error ? error.message : "Не вдалося зберегти",
        variant: "destructive"
      });
    }
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      await adminAction('publishPart', password, { id });
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['part', id] });
      toast({ title: "Опубліковано" });
      
      // Ping search engines for faster indexing
      try {
        await supabase.functions.invoke('ping-sitemap');
        console.log('Sitemap ping sent to search engines');
      } catch (err) {
        console.error('Failed to ping sitemap:', err);
      }
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await adminAction('deletePart', password, { id });
    },
    onSuccess: () => {
      navigate('/admin');
      toast({ title: "Видалено" });
    }
  });

  const handleGenerateImage = async () => {
    const prompt = formData.cover_image_prompt || part?.cover_image_prompt;
    if (!prompt) {
      toast({
        title: "Помилка",
        description: "Спочатку введіть промт для зображення",
        variant: "destructive"
      });
      return;
    }

    setIsGeneratingImage(true);
    try {
      const result = await generateImage(prompt, id);
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['part', id] });
        toast({ title: "Зображення згенеровано" });
      }
    } catch (error) {
      toast({
        title: "Помилка",
        description: error instanceof Error ? error.message : "Не вдалося згенерувати",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleRegenerate = async () => {
    if (!part) return;
    
    setIsRegenerating(true);
    try {
      const newsResult = await fetchNews(part.date);
      if (!newsResult.success) throw new Error('Не вдалося отримати новини');

      const storyResult = await generateStory({
        news: newsResult.articles.slice(0, 10),
        date: part.date,
        narrativeSource: formData.narrative_source || part.narrative_source || undefined,
        narrativeStructure: formData.narrative_structure || part.narrative_structure || undefined,
      });

      if (storyResult.success) {
        setFormData(prev => ({
          ...prev,
          title: storyResult.story.title,
          content: storyResult.story.content,
          cover_image_prompt: storyResult.story.imagePrompt,
          news_sources: newsResult.articles.slice(0, 10).map(a => ({ url: a.url, title: a.title, image_url: a.image_url || null }))
        }));
        toast({ title: "Перегенеровано" });
      }
    } catch (error) {
      toast({
        title: "Помилка",
        description: error instanceof Error ? error.message : "Не вдалося перегенерувати",
        variant: "destructive"
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  if (!isAuthenticated) {
    navigate('/admin');
    return null;
  }

  if (isLoading || !part) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentData = { ...part, ...formData };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Редагування частини" noIndex={true} />
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/admin">
            <Button variant="outline" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Редагування частини</h1>
            <p className="text-sm text-muted-foreground font-mono">
              {format(new Date(part.date), 'd MMMM yyyy', { locale: uk })}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="gap-2"
            >
              {isRegenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Перегенерувати
            </Button>
            <Button
              onClick={() => updateMutation.mutate(formData)}
              disabled={updateMutation.isPending}
              className="gap-2"
            >
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Зберегти
            </Button>
          </div>
        </div>

        <div className="grid gap-6">
          <Card className="cosmic-card">
            <CardHeader>
              <CardTitle>Основна інформація</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Заголовок</Label>
                <Input
                  value={currentData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Текст оповідання</Label>
                <Textarea
                  value={currentData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  rows={15}
                  className="font-serif"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Статус</Label>
                  <Select
                    value={currentData.status}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, status: v as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Чернетка</SelectItem>
                      <SelectItem value="scheduled">Заплановано</SelectItem>
                      <SelectItem value="published">Опубліковано</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    Flash News
                  </Label>
                  <div className="flex items-center gap-3 h-10 px-3 border border-input rounded-md bg-background">
                    <Switch
                      checked={currentData.is_flash_news || false}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_flash_news: checked }))}
                    />
                    <span className="text-sm text-muted-foreground">
                      {currentData.is_flash_news ? 'Так, це Flash News' : 'Звичайне оповідання'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Translations */}
          <Card className="cosmic-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Languages className="w-5 h-5" />
                    Переклади
                  </CardTitle>
                  <CardDescription>Автоматичний переклад на англійську та польську</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px] p-4 border border-border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">🇬🇧 English</span>
                    {part.title_en ? (
                      <Badge variant="outline" className="text-primary border-primary">Є переклад</Badge>
                    ) : (
                      <Badge variant="secondary">Немає</Badge>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTranslate('en')}
                    disabled={isTranslating === 'en'}
                    className="w-full gap-2"
                  >
                    {isTranslating === 'en' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Languages className="w-4 h-4" />
                    )}
                    {part.title_en ? 'Оновити переклад' : 'Перекласти'}
                  </Button>
                </div>
                
                <div className="flex-1 min-w-[200px] p-4 border border-border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">🇵🇱 Polski</span>
                    {part.title_pl ? (
                      <Badge variant="outline" className="text-primary border-primary">Є переклад</Badge>
                    ) : (
                      <Badge variant="secondary">Немає</Badge>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTranslate('pl')}
                    disabled={isTranslating === 'pl'}
                    className="w-full gap-2"
                  >
                    {isTranslating === 'pl' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Languages className="w-4 h-4" />
                    )}
                    {part.title_pl ? 'Оновити переклад' : 'Перекласти'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cosmic-card">
            <CardHeader>
              <CardTitle>Головне зображення</CardTitle>
              <CardDescription>Оберіть яке зображення показувати як головну обкладинку</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Cover image type selection */}
              <div className="space-y-2">
                <Label>Тип головного зображення</Label>
                <Select
                  value={currentData.cover_image_type || 'generated'}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, cover_image_type: v as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="generated">🎨 AI згенероване</SelectItem>
                    <SelectItem value="news">📰 З новин</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Preview current selection */}
              {(() => {
                const coverType = currentData.cover_image_type || 'generated';
                const newsSources = currentData.news_sources as any[] || [];
                const selectedNewsImage = newsSources.find((s: any) => s.is_selected && s.image_url);
                const firstNewsImage = newsSources.find((s: any) => s.image_url);
                const newsImage = selectedNewsImage || firstNewsImage;
                
                return (
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Generated Image */}
                    <div className={`p-3 border rounded-lg transition-all ${coverType === 'generated' ? 'border-primary ring-2 ring-primary/20' : 'border-border'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">🎨 AI зображення</span>
                        {coverType === 'generated' && <Badge>Активне</Badge>}
                      </div>
                      {currentData.cover_image_url ? (
                        <img 
                          src={currentData.cover_image_url} 
                          alt="AI generated" 
                          className="w-full aspect-video object-cover border border-border rounded"
                        />
                      ) : (
                        <div className="w-full aspect-video bg-muted/20 border border-border rounded flex items-center justify-center text-muted-foreground text-sm">
                          Не згенеровано
                        </div>
                      )}
                    </div>
                    
                    {/* News Image */}
                    <div className={`p-3 border rounded-lg transition-all ${coverType === 'news' ? 'border-primary ring-2 ring-primary/20' : 'border-border'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">📰 З новин</span>
                        {coverType === 'news' && <Badge>Активне</Badge>}
                      </div>
                      {newsImage ? (
                        <img 
                          src={newsImage.image_url} 
                          alt={newsImage.title}
                          className="w-full aspect-video object-cover border border-border rounded"
                        />
                      ) : (
                        <div className="w-full aspect-video bg-muted/20 border border-border rounded flex items-center justify-center text-muted-foreground text-sm">
                          Немає зображень
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
              
              {/* AI Image Generation section */}
              <div className="pt-4 border-t border-border">
                <Label className="mb-2 block">Промт для AI зображення</Label>
                <Textarea
                  value={currentData.cover_image_prompt || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, cover_image_prompt: e.target.value }))}
                  rows={3}
                  placeholder="Опишіть бажане зображення англійською..."
                  className="mb-3"
                />
                <Button
                  variant="outline"
                  onClick={handleGenerateImage}
                  disabled={isGeneratingImage}
                  className="w-full gap-2"
                >
                  {isGeneratingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />}
                  Згенерувати зображення
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="cosmic-card">
            <CardHeader>
              <CardTitle>Нарративні налаштування</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {Object.entries(NARRATIVE_OPTIONS).slice(0, 2).map(([key, options]) => (
                <div key={key} className="space-y-2">
                  <Label className="capitalize">{key === 'source' ? 'Джерело' : 'Структура'}</Label>
                  <Select
                    value={currentData[`narrative_${key}` as keyof Part] as string || ''}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, [`narrative_${key}`]: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="За замовчуванням" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(options).map(([value, { label }]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </CardContent>
          </Card>

          {currentData.news_sources && Array.isArray(currentData.news_sources) && (currentData.news_sources as any[]).length > 0 && (
            <Card className="cosmic-card">
              <CardHeader>
                <CardTitle>Джерела новин</CardTitle>
                <CardDescription>Оберіть зображення для показу в оповіданні</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* News Images Selection */}
                {(() => {
                  const newsWithImages = (currentData.news_sources as any[]).filter((s: any) => s.image_url);
                  const selectedImage = (currentData.news_sources as any[]).find((s: any) => s.is_selected && s.image_url);
                  const displayImage = selectedImage || newsWithImages[0];
                  
                  if (newsWithImages.length === 0) {
                    return (
                      <p className="text-sm text-muted-foreground">
                        Немає зображень у джерелах новин
                      </p>
                    );
                  }
                  
                  return (
                    <div className="space-y-4">
                      {/* Current selected image */}
                      {displayImage && (
                        <div className="space-y-2">
                          <Label>Обране зображення</Label>
                          <img 
                            src={displayImage.image_url} 
                            alt={displayImage.title}
                            className="w-full max-h-48 object-cover border border-border rounded"
                          />
                          <p className="text-xs text-muted-foreground">
                            Джерело: {displayImage.title}
                          </p>
                        </div>
                      )}
                      
                      {/* Image selection grid */}
                      {newsWithImages.length > 1 && (
                        <div className="space-y-2">
                          <Label>Доступні зображення ({newsWithImages.length})</Label>
                          <div className="grid grid-cols-3 gap-2">
                            {newsWithImages.map((source: any, i: number) => {
                              const isSelected = source.is_selected || (!selectedImage && i === 0);
                              return (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => {
                                    const updatedSources = (currentData.news_sources as any[]).map((s: any) => ({
                                      ...s,
                                      is_selected: s.url === source.url && s.image_url ? true : false
                                    }));
                                    setFormData(prev => ({ ...prev, news_sources: updatedSources }));
                                  }}
                                  className={`relative aspect-video overflow-hidden rounded border-2 transition-all ${
                                    isSelected 
                                      ? 'border-primary ring-2 ring-primary/20' 
                                      : 'border-border hover:border-primary/50'
                                  }`}
                                >
                                  <img 
                                    src={source.image_url} 
                                    alt={source.title}
                                    className="w-full h-full object-cover"
                                  />
                                  {isSelected && (
                                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                      <Badge className="bg-primary text-primary-foreground">✓</Badge>
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
                
                <ul className="space-y-2">
                  {(currentData.news_sources as Array<{ url: string; title: string; image_url?: string; is_selected?: boolean }>).map((source, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <ExternalLink className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                      <a 
                        href={source.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary transition-colors flex-1"
                      >
                        {source.title}
                      </a>
                      {source.image_url && (
                        <Badge 
                          variant={source.is_selected ? "default" : "outline"} 
                          className="text-xs shrink-0"
                        >
                          📷{source.is_selected && ' ✓'}
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between">
            <Link to={`/read/${part.date}`}>
              <Button variant="outline" className="gap-2">
                <Eye className="w-4 h-4" />
                Переглянути
              </Button>
            </Link>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirm('Видалити цю частину?')) {
                  deleteMutation.mutate();
                }
              }}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Видалити
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
