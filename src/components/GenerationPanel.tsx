import { useState } from "react";
import { format, getMonth, getYear, eachDayOfInterval, parseISO } from "date-fns";
import { uk } from "date-fns/locale";
import { Sparkles, Loader2, CheckCircle, Clock, AlertCircle, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { fetchNews, generateStory, generateImage, adminAction } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import type { Part } from "@/types/database";

interface LogEntry {
  time: string;
  message: string;
  status: 'pending' | 'success' | 'error' | 'info';
}

interface GenerationPanelProps {
  password: string;
}

export function GenerationPanel({ password }: GenerationPanelProps) {
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [storiesPerDay, setStoriesPerDay] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const addLog = (message: string, status: LogEntry['status'] = 'pending') => {
    const time = format(new Date(), 'HH:mm:ss');
    setLogs(prev => [...prev, { time, message, status }]);
  };

  const updateLastLog = (status: LogEntry['status']) => {
    setLogs(prev => {
      const updated = [...prev];
      if (updated.length > 0) {
        updated[updated.length - 1].status = status;
      }
      return updated;
    });
  };

  const generateForDate = async (dateStr: string, storyNumber: number): Promise<boolean> => {
    try {
      const date = new Date(dateStr);
      
      // Step 1: Fetch news
      addLog(`[${format(date, 'd MMM', { locale: uk })} #${storyNumber}] Завантаження новин...`);
      const newsResult = await fetchNews(dateStr);
      if (!newsResult.success || newsResult.articles.length === 0) {
        updateLastLog('error');
        addLog(`[${format(date, 'd MMM', { locale: uk })} #${storyNumber}] Не вдалося отримати новини`);
        updateLastLog('error');
        return false;
      }
      updateLastLog('success');

      // Step 2: Generate story
      addLog(`[${format(date, 'd MMM', { locale: uk })} #${storyNumber}] Генерація тексту...`);
      const storyResult = await generateStory({
        news: newsResult.articles.slice(0, 10),
        date: dateStr
      });
      if (!storyResult.success) {
        updateLastLog('error');
        return false;
      }
      updateLastLog('success');

      // Step 3: Find or create volume
      const year = getYear(date);
      const month = getMonth(date) + 1;
      
      // Calculate week of month based on which week in the month's calendar view
      const firstOfMonth = new Date(year, month - 1, 1);
      const firstMonday = new Date(firstOfMonth);
      while (firstMonday.getDay() !== 1) {
        firstMonday.setDate(firstMonday.getDate() - 1);
      }
      const daysSinceFirstMonday = Math.floor((date.getTime() - firstMonday.getTime()) / (1000 * 60 * 60 * 24));
      const weekOfMonth = Math.floor(daysSinceFirstMonday / 7) + 1;

      let { data: volume } = await supabase
        .from('volumes')
        .select('*')
        .eq('year', year)
        .eq('month', month)
        .maybeSingle();

      if (!volume) {
        const volumeResult = await adminAction<{ volume: any }>(
          'createVolume',
          password,
          {
            number: year * 12 + month,
            title: `Том ${format(date, 'LLLL yyyy', { locale: uk })}`,
            year,
            month
          }
        );
        volume = volumeResult.volume;
      }

      // Step 4: Find or create chapter
      let { data: chapter } = await supabase
        .from('chapters')
        .select('*')
        .eq('volume_id', volume.id)
        .eq('week_of_month', weekOfMonth)
        .maybeSingle();

      if (!chapter) {
        const chapterResult = await adminAction<{ chapter: any }>(
          'createChapter',
          password,
          {
            volume_id: volume.id,
            number: weekOfMonth,
            title: `Глава ${weekOfMonth}: Тиждень ${format(date, 'd MMMM', { locale: uk })}`,
            week_of_month: weekOfMonth
          }
        );
        chapter = chapterResult.chapter;
      }

      // Step 5: Count existing parts for this date
      const { count } = await supabase
        .from('parts')
        .select('*', { count: 'exact', head: true })
        .eq('date', dateStr);
      
      const partNumber = (count || 0) + 1;

      // Step 6: Create part with multilingual content
      addLog(`[${format(date, 'd MMM', { locale: uk })} #${storyNumber}] Збереження...`);
      const partResult = await adminAction<{ part: Part }>(
        'createPart',
        password,
        {
          chapter_id: chapter.id,
          number: date.getDate(),
          title: storyResult.story.title,
          title_en: storyResult.story.title_en || null,
          title_pl: storyResult.story.title_pl || null,
          content: storyResult.story.content,
          content_en: storyResult.story.content_en || null,
          content_pl: storyResult.story.content_pl || null,
          date: dateStr,
          status: 'published',
          cover_image_prompt: storyResult.story.imagePrompt,
          cover_image_prompt_2: storyResult.story.imagePrompt2 || null,
          chat_dialogue: storyResult.story.chatDialogue || [],
          tweets: storyResult.story.tweets || [],
          news_sources: newsResult.articles.slice(0, 10).map(a => ({ url: a.url, title: a.title, image_url: a.image_url || null }))
        }
      );
      updateLastLog('success');

      // Step 7: Generate images
      if (storyResult.story.imagePrompt) {
        addLog(`[${format(date, 'd MMM', { locale: uk })} #${storyNumber}] Генерація зображень...`);
        await generateImage(storyResult.story.imagePrompt, partResult.part.id, 1);
        if (storyResult.story.imagePrompt2) {
          await generateImage(storyResult.story.imagePrompt2, partResult.part.id, 2);
        }
        updateLastLog('success');
      }

      addLog(`[${format(date, 'd MMM', { locale: uk })} #${storyNumber}] ✓ "${storyResult.story.title}"`);
      updateLastLog('success');
      return true;
    } catch (error) {
      addLog(`Помилка: ${error instanceof Error ? error.message : 'Невідома помилка'}`);
      updateLastLog('error');
      return false;
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setLogs([]);
    
    try {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      const days = eachDayOfInterval({ start, end });
      
      const totalGenerations = days.length * storiesPerDay;
      addLog(`=== ПАКЕТНА ГЕНЕРАЦІЯ: ${days.length} днів × ${storiesPerDay} оповідань = ${totalGenerations} всього ===`, 'info');
      
      let successCount = 0;
      let failCount = 0;

      for (const day of days) {
        const dateStr = format(day, 'yyyy-MM-dd');
        addLog(`--- ${format(day, 'd MMMM yyyy', { locale: uk })} ---`, 'info');
        
        for (let i = 1; i <= storiesPerDay; i++) {
          const success = await generateForDate(dateStr, i);
          if (success) {
            successCount++;
          } else {
            failCount++;
          }
        }
      }

      addLog(`=== ЗАВЕРШЕНО: ${successCount} успішно, ${failCount} помилок ===`, 'info');
      
      toast({
        title: "Генерацію завершено!",
        description: `Створено ${successCount} оповідань${failCount > 0 ? `, ${failCount} помилок` : ''}`
      });

      queryClient.invalidateQueries({ queryKey: ['parts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-parts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['latest-parts'] });
      
    } catch (error) {
      updateLastLog('error');
      addLog(`Помилка: ${error instanceof Error ? error.message : 'Невідома помилка'}`);
      updateLastLog('error');
      toast({
        title: "Помилка генерації",
        description: error instanceof Error ? error.message : 'Не вдалося згенерувати',
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const daysCount = (() => {
    try {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      return eachDayOfInterval({ start, end }).length;
    } catch {
      return 1;
    }
  })();

  return (
    <Card className="cosmic-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          Генерація оповідань
        </CardTitle>
        <CardDescription>
          Згенерувати оповідання для діапазону дат
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Від
            </Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={isGenerating}
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              До
            </Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={isGenerating}
            />
          </div>
          <div className="space-y-2">
            <Label>На день</Label>
            <Input
              type="number"
              min={1}
              max={5}
              value={storiesPerDay}
              onChange={(e) => setStoriesPerDay(Math.min(5, Math.max(1, parseInt(e.target.value) || 1)))}
              disabled={isGenerating}
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full gap-2"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {isGenerating ? 'Генерація...' : `Згенерувати (${daysCount * storiesPerDay})`}
            </Button>
          </div>
        </div>

        {logs.length > 0 && (
          <div className="mt-4">
            <Label className="text-xs text-muted-foreground">ЛОГ ГЕНЕРАЦІЇ</Label>
            <ScrollArea className="h-64 mt-2 border border-border rounded-md bg-muted/30">
              <div className="p-4 space-y-2 font-mono text-sm">
                {logs.map((log, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-muted-foreground shrink-0">
                      [{log.time}]
                    </span>
                    {log.status === 'pending' && (
                      <Clock className="w-4 h-4 text-muted-foreground animate-pulse shrink-0 mt-0.5" />
                    )}
                    {log.status === 'success' && (
                      <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    )}
                    {log.status === 'error' && (
                      <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    )}
                    {log.status === 'info' && (
                      <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    )}
                    <span className={log.status === 'error' ? 'text-destructive' : log.status === 'info' ? 'text-primary font-medium' : ''}>
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
