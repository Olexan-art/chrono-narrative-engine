import { useState, useEffect, useRef } from "react";
import { format, startOfWeek, endOfWeek, getMonth, getYear, addWeeks, subWeeks, eachDayOfInterval } from "date-fns";
import { uk } from "date-fns/locale";
import { Link } from "react-router-dom";
import { Sparkles, Loader2, CheckCircle, Clock, AlertCircle, ChevronLeft, ChevronRight, BookOpen, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { adminAction, generateImage } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import type { Part, Chapter } from "@/types/database";

interface LogEntry {
  time: string;
  message: string;
  status: 'pending' | 'success' | 'error' | 'info';
}

interface WeekGenerationPanelProps {
  password: string;
}

interface WeekData {
  start: Date;
  end: Date;
  partsCount: number;
  hasChapter: boolean;
  chapter?: Chapter;
  parts: Part[];
}

export function WeekGenerationPanel({ password }: WeekGenerationPanelProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedWeek, setSelectedWeek] = useState<WeekData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Fetch weeks data for current month
  const { data: weeksData = [], isLoading } = useQuery({
    queryKey: ['weeks-data', format(currentMonth, 'yyyy-MM')],
    queryFn: async () => {
      const year = getYear(currentMonth);
      const month = getMonth(currentMonth) + 1;
      
      // Get all parts for this month
      const startDate = format(startOfWeek(new Date(year, month - 1, 1), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const endDate = format(endOfWeek(new Date(year, month - 1, 28), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      
      const { data: parts } = await supabase
        .from('parts')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .eq('status', 'published');

      // Get volume and chapters for this month
      const { data: volume } = await supabase
        .from('volumes')
        .select('*, chapters(*)')
        .eq('year', year)
        .eq('month', month)
        .maybeSingle();

      // Build weeks array
      const weeks: WeekData[] = [];
      let weekStart = startOfWeek(new Date(year, month - 1, 1), { weekStartsOn: 1 });
      
      for (let i = 0; i < 5; i++) {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        // Use sequential week number (i + 1) consistently
        const weekOfMonth = i + 1;
        
        const weekParts = (parts || []).filter((p: Part) => {
          const partDate = new Date(p.date);
          return partDate >= weekStart && partDate <= weekEnd;
        });

        const chapter = volume?.chapters?.find((c: any) => c.week_of_month === weekOfMonth);

        weeks.push({
          start: weekStart,
          end: weekEnd,
          partsCount: weekParts.length,
          hasChapter: !!chapter?.narrator_monologue,
          chapter,
          parts: weekParts as Part[]
        });

        weekStart = addWeeks(weekStart, 1);
      }

      return weeks;
    }
  });

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

  const handleGenerateWeek = async () => {
    if (!selectedWeek || selectedWeek.partsCount === 0) {
      toast({
        title: "Помилка",
        description: "Спочатку згенеруйте оповідання на кожен день тижня",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    setLogs([]);
    
    try {
      const weekStart = selectedWeek.start;
      const year = getYear(weekStart);
      const month = getMonth(weekStart) + 1;
      // Find which week index this is in the current view
      const weekIndex = weeksData.findIndex(w => 
        w.start.getTime() === selectedWeek.start.getTime()
      );
      const weekOfMonth = weekIndex !== -1 ? weekIndex + 1 : 1;

      addLog('=== ГЕНЕРАЦІЯ ГЛАВИ ТИЖНЯ ===', 'info');
      addLog(`Тиждень: ${format(selectedWeek.start, 'd MMMM', { locale: uk })} - ${format(selectedWeek.end, 'd MMMM yyyy', { locale: uk })}`);
      updateLastLog('success');

      // Step 1: Collect all news from parts
      addLog('Збір всіх новин тижня...');
      const allNews: Array<{ title: string; url: string }> = [];
      const allContent: string[] = [];
      
      for (const part of selectedWeek.parts) {
        if (part.news_sources && Array.isArray(part.news_sources)) {
          allNews.push(...(part.news_sources as Array<{ title: string; url: string }>));
        }
        allContent.push(`[${part.date}] ${part.title}\n${part.content}`);
      }
      
      updateLastLog('success');
      addLog(`Зібрано ${allNews.length} новин з ${selectedWeek.parts.length} частин`);
      updateLastLog('success');

      // Step 2: Find or create volume
      addLog('Перевірка тому...');
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
            title: `Том ${format(weekStart, 'LLLL yyyy', { locale: uk })}`,
            year,
            month
          }
        );
        volume = volumeResult.volume;
      }
      updateLastLog('success');

      // Step 3: Find or create chapter
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
            title: `Глава ${weekOfMonth}: Тиждень ${format(weekStart, 'd MMMM', { locale: uk })}`,
            week_of_month: weekOfMonth
          }
        );
        chapter = chapterResult.chapter;
      }
      updateLastLog('success');

      // Step 4: Generate week synthesis (3 parts)
      addLog('=== ГЕНЕРАЦІЯ ТЕКСТУ (частина 1/3) ===', 'info');
      addLog('Генерація першої частини синтезу (~1000 слів)...');
      
      const part1Response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-week`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          weekParts: selectedWeek.parts.map(p => ({ 
            date: p.date, 
            title: p.title, 
            content: p.content,
            news_sources: p.news_sources 
          })),
          weekStart: format(selectedWeek.start, 'yyyy-MM-dd'),
          weekEnd: format(selectedWeek.end, 'yyyy-MM-dd'),
          part: 1,
          totalParts: 3
        }),
      });
      
      if (!part1Response.ok) {
        const errorData = await part1Response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Помилка генерації частини 1');
      }
      
      const part1Data = await part1Response.json();
      updateLastLog('success');
      addLog(`✓ Частина 1 згенерована: ${part1Data.story?.wordCount || '~1000'} слів`);
      updateLastLog('success');

      // Part 2
      addLog('=== ГЕНЕРАЦІЯ ТЕКСТУ (частина 2/3) ===', 'info');
      addLog('Генерація другої частини синтезу (~1000 слів)...');
      
      const part2Response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-week`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          weekParts: selectedWeek.parts.map(p => ({ 
            date: p.date, 
            title: p.title, 
            content: p.content,
            news_sources: p.news_sources 
          })),
          previousContent: part1Data.story?.content,
          weekStart: format(selectedWeek.start, 'yyyy-MM-dd'),
          weekEnd: format(selectedWeek.end, 'yyyy-MM-dd'),
          part: 2,
          totalParts: 3
        }),
      });
      
      if (!part2Response.ok) {
        const errorData = await part2Response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Помилка генерації частини 2');
      }
      
      const part2Data = await part2Response.json();
      updateLastLog('success');
      addLog(`✓ Частина 2 згенерована: ${part2Data.story?.wordCount || '~1000'} слів`);
      updateLastLog('success');

      // Part 3 - finale with monologue and commentary
      addLog('=== ГЕНЕРАЦІЯ ТЕКСТУ (частина 3/3) ===', 'info');
      addLog('Генерація фіналу + Монолог Незнайомця + Коментар Наратора...');
      
      const part3Response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-week`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          weekParts: selectedWeek.parts.map(p => ({ 
            date: p.date, 
            title: p.title, 
            content: p.content,
            news_sources: p.news_sources 
          })),
          previousContent: part1Data.story?.content + '\n\n' + part2Data.story?.content,
          weekStart: format(selectedWeek.start, 'yyyy-MM-dd'),
          weekEnd: format(selectedWeek.end, 'yyyy-MM-dd'),
          part: 3,
          totalParts: 3,
          includeMonologue: true,
          includeCommentary: true
        }),
      });
      
      if (!part3Response.ok) {
        const errorData = await part3Response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Помилка генерації частини 3');
      }
      
      const part3Data = await part3Response.json();
      updateLastLog('success');
      addLog(`✓ Частина 3 згенерована з Монологом та Коментарем`);
      updateLastLog('success');

      // Combine all parts
      const fullContent = [
        part1Data.story?.content || '',
        part2Data.story?.content || '',
        part3Data.story?.content || ''
      ].join('\n\n---\n\n');

      // Step 5: Update chapter with generated content
      addLog('Збереження глави в базу...');
      await adminAction('updateChapter', password, {
        id: chapter.id,
        title: part3Data.story?.title || chapter.title,
        description: part3Data.story?.summary || `Синтез тижня ${format(selectedWeek.start, 'd', { locale: uk })}-${format(selectedWeek.end, 'd MMMM', { locale: uk })}`,
        narrator_monologue: part3Data.story?.strangerMonologue || '',
        narrator_commentary: part3Data.story?.narratorCommentary || '',
        cover_image_prompt: part3Data.story?.imagePrompt || '',
        cover_image_prompt_2: part3Data.story?.imagePrompt2 || '',
        cover_image_prompt_3: part3Data.story?.imagePrompt3 || '',
        tweets: part3Data.story?.tweets || []
      });
      updateLastLog('success');

      // Step 6: Generate cover images (3 images)
      const imagePrompts = [
        { prompt: part3Data.story?.imagePrompt, index: 1, field: 'cover_image_url' },
        { prompt: part3Data.story?.imagePrompt2, index: 2, field: 'cover_image_url_2' },
        { prompt: part3Data.story?.imagePrompt3, index: 3, field: 'cover_image_url_3' }
      ].filter(p => p.prompt);

      for (const imgData of imagePrompts) {
        addLog(`Генерація обкладинки #${imgData.index}...`);
        try {
          const imageResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              prompt: imgData.prompt,
              chapterId: chapter.id,
              imageIndex: imgData.index
            }),
          });
          
          if (imageResponse.ok) {
            updateLastLog('success');
          } else {
            updateLastLog('error');
            addLog(`Попередження: обкладинку #${imgData.index} не вдалося згенерувати`);
            updateLastLog('error');
          }
        } catch (imgError) {
          updateLastLog('error');
          addLog(`Попередження: помилка генерації обкладинки #${imgData.index}`);
          updateLastLog('error');
        }
      }

      addLog('=== ГЕНЕРАЦІЮ ЗАВЕРШЕНО ===', 'info');
      addLog(`✓ Глава "${part3Data.story?.title || 'Тиждень'}" готова!`);
      updateLastLog('success');

      const totalWords = (part1Data.story?.wordCount || 1000) + 
                         (part2Data.story?.wordCount || 1000) + 
                         (part3Data.story?.wordCount || 1000);
      addLog(`Всього: ~${totalWords} слів`);
      updateLastLog('success');

      toast({
        title: "Успішно!",
        description: `Главу тижня згенеровано (~${totalWords} слів)`
      });

      queryClient.invalidateQueries({ queryKey: ['weeks-data'] });
      queryClient.invalidateQueries({ queryKey: ['chapters'] });
      
    } catch (error) {
      updateLastLog('error');
      addLog(`ПОМИЛКА: ${error instanceof Error ? error.message : 'Невідома помилка'}`);
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
          <BookOpen className="w-5 h-5 text-primary" />
          Генерація Глави (Тиждень)
        </CardTitle>
        <CardDescription>
          Синтез семи днів з Монологом Незнайомця та Коментарем Наратора
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Month navigation */}
        <div className="flex items-center justify-between">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setCurrentMonth(prev => subWeeks(prev, 4))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h3 className="font-mono text-lg">
            {format(currentMonth, 'LLLL yyyy', { locale: uk })}
          </h3>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setCurrentMonth(prev => addWeeks(prev, 4))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Weeks list */}
        <div className="space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            weeksData.map((week, index) => (
              <div
                key={index}
                onClick={() => setSelectedWeek(week)}
                className={`
                  p-4 border rounded-lg cursor-pointer transition-all
                  ${selectedWeek?.start.getTime() === week.start.getTime() 
                    ? 'border-primary bg-primary/10' 
                    : 'border-border hover:border-primary/50'}
                `}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-muted-foreground">
                      Тиждень {index + 1}
                    </span>
                    <span className="font-serif">
                      {format(week.start, 'd MMM', { locale: uk })} — {format(week.end, 'd MMM', { locale: uk })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={week.partsCount > 0 ? "default" : "secondary"}>
                      {week.partsCount} оповід.
                    </Badge>
                    {week.hasChapter && week.chapter && (
                      <Link 
                        to={`/chapter/${week.chapter.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex"
                      >
                        <Badge variant="outline" className="border-primary text-primary hover:bg-primary/10 transition-colors gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Глава
                          <ExternalLink className="w-3 h-3" />
                        </Badge>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Generate button */}
        {selectedWeek && (
          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-mono text-muted-foreground">Вибрано:</p>
                <p className="font-serif">
                  {format(selectedWeek.start, 'd MMMM', { locale: uk })} — {format(selectedWeek.end, 'd MMMM', { locale: uk })}
                </p>
              </div>
              <Button
                onClick={handleGenerateWeek}
                disabled={isGenerating || selectedWeek.partsCount === 0}
                className="gap-2"
                size="lg"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {isGenerating ? 'Генерація...' : 'Згенерувати Главу'}
              </Button>
            </div>
            
            {selectedWeek.partsCount === 0 && (
              <p className="text-sm text-destructive">
                ⚠️ Спочатку згенеруйте оповідання на дні цього тижня
              </p>
            )}
          </div>
        )}

        {/* Detailed logs */}
        {logs.length > 0 && (
          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground font-mono mb-2">ДЕТАЛЬНИЙ ЛОГ</p>
            <ScrollArea className="h-80 border border-border rounded-md bg-muted/30">
              <div className="p-4 space-y-1 font-mono text-xs">
                {logs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-muted-foreground shrink-0 w-20">
                      [{log.time}]
                    </span>
                    {log.status === 'pending' && (
                      <Clock className="w-3 h-3 text-muted-foreground animate-pulse shrink-0 mt-0.5" />
                    )}
                    {log.status === 'success' && (
                      <CheckCircle className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                    )}
                    {log.status === 'error' && (
                      <AlertCircle className="w-3 h-3 text-destructive shrink-0 mt-0.5" />
                    )}
                    {log.status === 'info' && (
                      <span className="w-3 h-3 shrink-0" />
                    )}
                    <span className={`
                      ${log.status === 'error' ? 'text-destructive' : ''}
                      ${log.status === 'info' ? 'text-primary font-bold' : ''}
                    `}>
                      {log.message}
                    </span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
