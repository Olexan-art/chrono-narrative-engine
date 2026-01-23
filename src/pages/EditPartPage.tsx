import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Sparkles, Trash2, Eye, Image, Loader2, Calendar, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Header } from "@/components/Header";
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
  useState(() => {
    if (part) {
      setFormData(part);
    }
  });

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['part', id] });
      toast({ title: "Опубліковано" });
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
          news_sources: newsResult.articles.slice(0, 10).map(a => ({ url: a.url, title: a.title }))
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
            </CardContent>
          </Card>

          <Card className="cosmic-card">
            <CardHeader>
              <CardTitle>Зображення</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentData.cover_image_url && (
                <img 
                  src={currentData.cover_image_url} 
                  alt="" 
                  className="w-full max-h-64 object-cover border border-border"
                />
              )}
              <div className="space-y-2">
                <Label>Промт для AI зображення</Label>
                <Textarea
                  value={currentData.cover_image_prompt || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, cover_image_prompt: e.target.value }))}
                  rows={3}
                  placeholder="Опишіть бажане зображення англійською..."
                />
              </div>
              <Button
                variant="outline"
                onClick={handleGenerateImage}
                disabled={isGeneratingImage}
                className="w-full gap-2"
              >
                {isGeneratingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />}
                Згенерувати зображення
              </Button>
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
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {(currentData.news_sources as Array<{ url: string; title: string }>).map((source, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <ExternalLink className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                      <a 
                        href={source.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary transition-colors"
                      >
                        {source.title}
                      </a>
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
