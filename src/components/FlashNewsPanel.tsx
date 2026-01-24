import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { uk } from "date-fns/locale";
import { Link } from "react-router-dom";
import { Plus, Loader2, Trash2, ChevronLeft, ChevronRight, Zap, Edit, Link as LinkIcon, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { adminAction } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import type { Part, Chapter } from "@/types/database";

interface FlashNewsPanelProps {
  password: string;
}

export function FlashNewsPanel({ password }: FlashNewsPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [scrapedImageUrl, setScrapedImageUrl] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    title_en: '',
    title_pl: '',
    content: '',
    content_en: '',
    content_pl: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    chapter_id: ''
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  // Get flash news for the current month
  const { data: flashNews = [], isLoading } = useQuery({
    queryKey: ['flash-news', format(currentMonth, 'yyyy-MM')],
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
        .eq('is_flash_news', true)
        .gte('date', format(monthStart, 'yyyy-MM-dd'))
        .lte('date', format(monthEnd, 'yyyy-MM-dd'))
        .order('date', { ascending: false });
      
      if (error) throw error;
      return data as (Part & { chapter?: Chapter })[];
    }
  });

  // Get available chapters for the month
  const { data: chapters = [] } = useQuery({
    queryKey: ['month-chapters', format(currentMonth, 'yyyy-MM')],
    queryFn: async () => {
      const { data: volumes } = await supabase
        .from('volumes')
        .select('id')
        .eq('year', currentMonth.getFullYear())
        .eq('month', currentMonth.getMonth() + 1);
      
      if (!volumes?.length) return [];

      const { data } = await supabase
        .from('chapters')
        .select('*')
        .in('volume_id', volumes.map(v => v.id))
        .order('week_of_month', { ascending: true });
      
      return data || [];
    }
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!formData.chapter_id) {
        throw new Error('Виберіть главу');
      }
      if (!formData.title) {
        throw new Error('Введіть заголовок');
      }
      if (!formData.content) {
        throw new Error('Введіть контент');
      }

      // Count existing parts for this date to get the next number
      const { count } = await supabase
        .from('parts')
        .select('id', { count: 'exact' })
        .eq('date', formData.date);
      
      const partNumber = (count || 0) + 1;

      const result = await adminAction<{ part: Part }>('createPart', password, {
        title: formData.title,
        title_en: formData.title_en || null,
        title_pl: formData.title_pl || null,
        content: formData.content,
        content_en: formData.content_en || null,
        content_pl: formData.content_pl || null,
        date: formData.date,
        chapter_id: formData.chapter_id,
        number: partNumber,
        status: 'published',
        is_flash_news: true,
        // Add scraped image as news source
        news_sources: scrapedImageUrl ? [{
          title: formData.title,
          url: scrapeUrl || '',
          image_url: scrapedImageUrl,
          is_selected: true
        }] : [],
        cover_image_type: scrapedImageUrl ? 'news' : 'generated'
      });
      return result.part;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flash-news'] });
      queryClient.invalidateQueries({ queryKey: ['admin-parts'] });
      queryClient.invalidateQueries({ queryKey: ['latest-parts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      toast({ title: "Flash News створено!" });
      setIsCreating(false);
      setScrapeUrl('');
      setScrapedImageUrl('');
      setFormData({
        title: '',
        title_en: '',
        title_pl: '',
        content: '',
        content_en: '',
        content_pl: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        chapter_id: ''
      });
    },
    onError: (error) => {
      toast({
        title: "Помилка",
        description: error instanceof Error ? error.message : "Не вдалося створити",
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (partId: string) => {
      await adminAction('deletePart', password, { id: partId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flash-news'] });
      queryClient.invalidateQueries({ queryKey: ['admin-parts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['latest-parts'] });
      toast({ title: "Flash News видалено" });
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
    if (window.confirm(`Видалити Flash News "${partTitle}"?`)) {
      setDeletingId(partId);
      deleteMutation.mutate(partId);
    }
  };

  // Scrape URL handler
  const handleScrapeUrl = async () => {
    if (!scrapeUrl.trim()) {
      toast({
        title: "Помилка",
        description: "Введіть URL новини",
        variant: "destructive"
      });
      return;
    }

    setIsScraping(true);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-news', {
        body: { url: scrapeUrl.trim() }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to scrape');

      const scraped = data.data;
      
      // Update form with scraped data
      setFormData(prev => ({
        ...prev,
        title: scraped.title || prev.title,
        content: scraped.content || scraped.description || prev.content
      }));
      
      // Store image URL separately
      if (scraped.imageUrl) {
        setScrapedImageUrl(scraped.imageUrl);
      }

      toast({
        title: "Успішно",
        description: "Дані новини витягнуто. Натисніть 'Перекласти' для автоперекладу."
      });

    } catch (error) {
      console.error('Scrape error:', error);
      toast({
        title: "Помилка",
        description: error instanceof Error ? error.message : "Не вдалося витягнути дані",
        variant: "destructive"
      });
    } finally {
      setIsScraping(false);
    }
  };

  // Translate handler
  const handleTranslate = async () => {
    if (!formData.title && !formData.content) {
      toast({
        title: "Помилка",
        description: "Спочатку заповніть заголовок або контент",
        variant: "destructive"
      });
      return;
    }

    setIsTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke('translate-flash-news', {
        body: { 
          title: formData.title,
          content: formData.content
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to translate');

      const translations = data.translations;
      
      setFormData(prev => ({
        ...prev,
        title_en: translations.title_en || prev.title_en,
        title_pl: translations.title_pl || prev.title_pl,
        content_en: translations.content_en || prev.content_en,
        content_pl: translations.content_pl || prev.content_pl
      }));

      toast({
        title: "Успішно",
        description: "Переклад виконано!"
      });

    } catch (error) {
      console.error('Translate error:', error);
      toast({
        title: "Помилка",
        description: error instanceof Error ? error.message : "Не вдалося перекласти",
        variant: "destructive"
      });
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap className="w-5 h-5 text-amber-500" />
          <h3 className="text-lg font-bold">Flash News / Hot Meat</h3>
        </div>
        <Button 
          onClick={() => setIsCreating(!isCreating)}
          variant={isCreating ? "outline" : "default"}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          {isCreating ? "Скасувати" : "Створити Flash News"}
        </Button>
      </div>

      {/* Create Form */}
      {isCreating && (
        <Card className="cosmic-card border-amber-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-500">
              <Zap className="w-5 h-5" />
              Нова Flash News
            </CardTitle>
            <CardDescription>Ручне створення швидкої новини з власним контентом</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* URL Scraper Section */}
            <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg space-y-3">
              <Label className="flex items-center gap-2 text-amber-500">
                <LinkIcon className="w-4 h-4" />
                Витягнути з URL (опційно)
              </Label>
              <div className="flex gap-2">
                <Input
                  value={scrapeUrl}
                  onChange={(e) => setScrapeUrl(e.target.value)}
                  placeholder="https://example.com/news-article"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleScrapeUrl}
                  disabled={isScraping || !scrapeUrl.trim()}
                  className="gap-2"
                >
                  {isScraping ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LinkIcon className="w-4 h-4" />
                  )}
                  Витягнути
                </Button>
              </div>
              {scrapedImageUrl && (
                <div className="flex items-center gap-3 p-2 bg-background/50 rounded">
                  <img 
                    src={scrapedImageUrl} 
                    alt="Preview" 
                    className="w-16 h-16 object-cover rounded border border-border"
                  />
                  <div className="text-xs text-muted-foreground flex-1">
                    Зображення знайдено
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Дата</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Глава</Label>
                <Select
                  value={formData.chapter_id}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, chapter_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Оберіть главу" />
                  </SelectTrigger>
                  <SelectContent>
                    {chapters.map((ch: any) => (
                      <SelectItem key={ch.id} value={ch.id}>
                        Тиждень {ch.week_of_month}: {ch.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Titles */}
            <div className="space-y-2">
              <Label>Заголовок (UA)</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Введіть заголовок українською..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Заголовок (EN)</Label>
                <Input
                  value={formData.title_en}
                  onChange={(e) => setFormData(prev => ({ ...prev, title_en: e.target.value }))}
                  placeholder="English title..."
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Заголовок (PL)</Label>
                <Input
                  value={formData.title_pl}
                  onChange={(e) => setFormData(prev => ({ ...prev, title_pl: e.target.value }))}
                  placeholder="Tytuł po polsku..."
                />
              </div>
            </div>

            {/* Content */}
            <div className="space-y-2">
              <Label>Контент (UA)</Label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Введіть контент українською..."
                rows={6}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Контент (EN)</Label>
                <Textarea
                  value={formData.content_en}
                  onChange={(e) => setFormData(prev => ({ ...prev, content_en: e.target.value }))}
                  placeholder="English content..."
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Контент (PL)</Label>
                <Textarea
                  value={formData.content_pl}
                  onChange={(e) => setFormData(prev => ({ ...prev, content_pl: e.target.value }))}
                  placeholder="Treść po polsku..."
                  rows={4}
                />
              </div>
            </div>

            {/* Translate Button */}
            <Button 
              type="button"
              variant="outline"
              onClick={handleTranslate}
              disabled={isTranslating || (!formData.title && !formData.content)}
              className="w-full gap-2 border-primary/30 hover:border-primary/60"
            >
              {isTranslating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Languages className="w-4 h-4" />
              )}
              Автоперекласти на EN / PL
            </Button>

            <Button 
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="w-full gap-2 bg-amber-600 hover:bg-amber-700"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              Створити Flash News
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="font-mono text-sm">
          {format(currentMonth, 'LLLL yyyy', { locale: uk })}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Flash News List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : flashNews.length === 0 ? (
        <Card className="cosmic-card border-dashed">
          <CardContent className="py-12 text-center">
            <Zap className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              Немає Flash News за цей місяць
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Натисніть "Створити Flash News" щоб додати
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {flashNews.map((part) => (
            <Card key={part.id} className="cosmic-card border-amber-500/20 hover:border-amber-500/40 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">
                        <Zap className="w-3 h-3 mr-1" />
                        FLASH NEWS
                      </Badge>
                      <span className={`
                        px-2 py-0.5 text-xs font-mono border
                        ${part.status === 'published' ? 'border-primary text-primary' : 'border-muted-foreground text-muted-foreground'}
                      `}>
                        {part.status === 'published' ? 'ОПУБЛІКОВАНО' : 'ЧЕРНЕТКА'}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">{part.date}</span>
                    </div>
                    <h4 className="font-serif font-medium truncate">{part.title}</h4>
                    <p className="text-sm text-muted-foreground line-clamp-2 font-serif mt-1">
                      {part.content?.slice(0, 150)}...
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      {part.title_en && <Badge variant="outline" className="text-[10px]">EN ✓</Badge>}
                      {part.title_pl && <Badge variant="outline" className="text-[10px]">PL ✓</Badge>}
                    </div>
                  </div>
                  {part.cover_image_url && (
                    <img 
                      src={part.cover_image_url} 
                      alt="" 
                      className="w-20 h-20 object-cover border border-amber-500/30"
                    />
                  )}
                </div>
                <div className="flex gap-2 mt-4">
                  <Link to={`/admin/part/${part.id}`}>
                    <Button size="sm" variant="outline" className="gap-1">
                      <Edit className="w-3 h-3" />
                      Редагувати
                    </Button>
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
      )}
    </div>
  );
}
