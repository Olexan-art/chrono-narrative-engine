import { useState } from "react";
import { format, getMonth, getYear } from "date-fns";
import { uk } from "date-fns/locale";
import { Sparkles, Loader2, CheckCircle, Clock, AlertCircle } from "lucide-react";
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
  status: 'pending' | 'success' | 'error';
}

interface GenerationPanelProps {
  password: string;
}

export function GenerationPanel({ password }: GenerationPanelProps) {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
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

  const handleGenerate = async () => {
    setIsGenerating(true);
    setLogs([]);
    
    try {
      const date = new Date(selectedDate);
      const dateStr = format(date, 'yyyy-MM-dd');
      
      // Step 1: Fetch news
      addLog('Завантаження новин...');
      const newsResult = await fetchNews(dateStr);
      if (!newsResult.success || newsResult.articles.length === 0) {
        updateLastLog('error');
        throw new Error('Не вдалося отримати новини');
      }
      updateLastLog('success');
      addLog(`Знайдено ${newsResult.articles.length} новин`);
      updateLastLog('success');

      // Step 2: Generate story
      addLog('Генерація тексту оповідання (~1000 слів)...');
      const storyResult = await generateStory({
        news: newsResult.articles.slice(0, 10),
        date: dateStr
      });
      if (!storyResult.success) {
        updateLastLog('error');
        throw new Error('Не вдалося згенерувати історію');
      }
      updateLastLog('success');
      addLog(`Заголовок: "${storyResult.story.title}"`);
      updateLastLog('success');

      // Step 3: Find or create volume
      addLog('Перевірка тому...');
      const year = getYear(date);
      const month = getMonth(date) + 1;
      const weekOfMonth = Math.ceil(date.getDate() / 7);

      let { data: volume } = await supabase
        .from('volumes')
        .select('*')
        .eq('year', year)
        .eq('month', month)
        .maybeSingle();

      if (!volume) {
        addLog('Створення нового тому...');
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
        updateLastLog('success');
      } else {
        updateLastLog('success');
      }

      // Step 4: Find or create chapter
      addLog('Перевірка глави...');
      let { data: chapter } = await supabase
        .from('chapters')
        .select('*')
        .eq('volume_id', volume.id)
        .eq('week_of_month', weekOfMonth)
        .maybeSingle();

      if (!chapter) {
        addLog('Створення нової глави...');
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
        updateLastLog('success');
      } else {
        updateLastLog('success');
      }

      // Step 5: Count existing parts for this date
      addLog('Перевірка існуючих частин...');
      const { count } = await supabase
        .from('parts')
        .select('*', { count: 'exact', head: true })
        .eq('date', dateStr);
      
      const partNumber = (count || 0) + 1;
      updateLastLog('success');
      addLog(`Це буде частина #${partNumber} на цю дату`);
      updateLastLog('success');

      // Step 6: Create part
      addLog('Збереження оповідання в базу...');
      const partResult = await adminAction<{ part: Part }>(
        'createPart',
        password,
        {
          chapter_id: chapter.id,
          number: date.getDate(),
          title: storyResult.story.title,
          content: storyResult.story.content,
          date: dateStr,
          status: 'published',
          cover_image_prompt: storyResult.story.imagePrompt,
          cover_image_prompt_2: storyResult.story.imagePrompt2 || null,
          chat_dialogue: storyResult.story.chatDialogue || [],
          tweets: storyResult.story.tweets || [],
          news_sources: newsResult.articles.slice(0, 10).map(a => ({ url: a.url, title: a.title }))
        }
      );
      updateLastLog('success');

      // Step 7: Generate images
      if (storyResult.story.imagePrompt) {
        addLog('Генерація зображення #1...');
        await generateImage(storyResult.story.imagePrompt, partResult.part.id, 1);
        updateLastLog('success');
      }
      
      if (storyResult.story.imagePrompt2) {
        addLog('Генерація зображення #2...');
        await generateImage(storyResult.story.imagePrompt2, partResult.part.id, 2);
        updateLastLog('success');
      }

      addLog('✓ Генерацію завершено успішно!');
      updateLastLog('success');

      toast({
        title: "Успішно!",
        description: `Частину для ${format(date, 'd MMMM', { locale: uk })} створено`
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

  return (
    <Card className="cosmic-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          Генерація оповідання
        </CardTitle>
        <CardDescription>
          Згенерувати нову частину на основі реальних новин
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          <div className="flex-1 space-y-2">
            <Label>Дата</Label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              disabled={isGenerating}
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="gap-2"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {isGenerating ? 'Генерація...' : 'Згенерувати'}
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
                    <span className={log.status === 'error' ? 'text-destructive' : ''}>
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
