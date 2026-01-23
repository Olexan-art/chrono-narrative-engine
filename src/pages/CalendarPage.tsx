import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, getWeek, getMonth, getYear } from "date-fns";
import { uk } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Sparkles, Loader2, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import type { Part } from "@/types/database";
import { useToast } from "@/hooks/use-toast";
import { fetchNews, generateStory, generateImage, adminAction } from "@/lib/api";
import { useAdminStore } from "@/stores/adminStore";

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const { isAuthenticated, password } = useAdminStore();
  const queryClient = useQueryClient();

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const { data: parts = [] } = useQuery({
    queryKey: ['parts', format(currentDate, 'yyyy-MM')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts')
        .select('*')
        .gte('date', format(monthStart, 'yyyy-MM-dd'))
        .lte('date', format(monthEnd, 'yyyy-MM-dd'));
      
      if (error) throw error;
      return (data || []) as Part[];
    }
  });

  const getPartForDate = (date: Date) => {
    return parts.find(p => isSameDay(new Date(p.date), date));
  };

  const handleGenerateForDate = async (date: Date) => {
    if (!isAuthenticated) {
      toast({
        title: "Потрібна авторизація",
        description: "Увійдіть в адмінку для генерації",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      
      // Fetch news
      const newsResult = await fetchNews(dateStr);
      if (!newsResult.success || newsResult.articles.length === 0) {
        throw new Error('Не вдалося отримати новини');
      }

      // Generate story
      const storyResult = await generateStory({
        news: newsResult.articles.slice(0, 10),
        date: dateStr
      });

      if (!storyResult.success) {
        throw new Error('Не вдалося згенерувати історію');
      }

      // Find or create volume and chapter
      const year = getYear(date);
      const month = getMonth(date) + 1;
      const weekOfMonth = Math.ceil(date.getDate() / 7);

      // Get or create volume
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

      // Get or create chapter
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

      // Create part with new fields
      const partResult = await adminAction<{ part: Part }>(
        'createPart',
        password,
        {
          chapter_id: chapter.id,
          number: date.getDate(),
          title: storyResult.story.title,
          content: storyResult.story.content,
          date: dateStr,
          status: 'draft',
          cover_image_prompt: storyResult.story.imagePrompt,
          cover_image_prompt_2: storyResult.story.imagePrompt2 || null,
          chat_dialogue: storyResult.story.chatDialogue || [],
          tweets: storyResult.story.tweets || [],
          news_sources: newsResult.articles.slice(0, 10).map(a => ({ url: a.url, title: a.title }))
        }
      );

      // Generate images (both)
      if (storyResult.story.imagePrompt) {
        await generateImage(storyResult.story.imagePrompt, partResult.part.id, 1);
      }
      if (storyResult.story.imagePrompt2) {
        await generateImage(storyResult.story.imagePrompt2, partResult.part.id, 2);
      }

      toast({
        title: "Успішно!",
        description: `Частину для ${format(date, 'd MMMM', { locale: uk })} створено`
      });

      queryClient.invalidateQueries({ queryKey: ['parts'] });
    } catch (error) {
      toast({
        title: "Помилка",
        description: error instanceof Error ? error.message : 'Не вдалося згенерувати',
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <Button variant="outline" size="icon" onClick={prevMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <h2 className="text-2xl font-bold chapter-title text-glow">
              {format(currentDate, 'LLLL yyyy', { locale: uk })}
            </h2>
            
            <Button variant="outline" size="icon" onClick={nextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-2 mb-4">
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map(day => (
              <div key={day} className="text-center text-sm font-mono text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {/* Empty cells for days before month starts */}
            {Array.from({ length: (monthStart.getDay() + 6) % 7 }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}
            
            {daysInMonth.map(day => {
              const part = getPartForDate(day);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={`
                    aspect-square p-2 border transition-all relative group
                    ${isToday(day) ? 'border-primary' : 'border-border'}
                    ${isSelected ? 'bg-primary/20 border-primary border-glow' : 'bg-card hover:bg-muted'}
                    ${part ? 'ring-2 ring-primary/30' : ''}
                  `}
                >
                  <span className={`
                    text-sm font-mono
                    ${isToday(day) ? 'text-primary font-bold' : 'text-foreground'}
                  `}>
                    {format(day, 'd')}
                  </span>
                  
                  {part && (
                    <div className={`
                      absolute bottom-1 left-1 right-1 h-1
                      ${part.status === 'published' ? 'bg-primary' : 'bg-secondary'}
                    `} />
                  )}
                </button>
              );
            })}
          </div>

          {selectedDate && (
            <div className="mt-8 cosmic-card p-6 border">
              <h3 className="font-bold text-lg mb-4">
                {format(selectedDate, 'd MMMM yyyy', { locale: uk })}
              </h3>
              
              {(() => {
                const part = getPartForDate(selectedDate);
                if (part) {
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <span className={`
                          px-2 py-1 text-xs font-mono border
                          ${part.status === 'published' ? 'border-primary text-primary' : 'border-muted-foreground text-muted-foreground'}
                        `}>
                          {part.status === 'published' ? 'ОПУБЛІКОВАНО' : part.status === 'scheduled' ? 'ЗАПЛАНОВАНО' : 'ЧЕРНЕТКА'}
                        </span>
                      </div>
                      <h4 className="font-serif text-xl">{part.title}</h4>
                      <p className="text-muted-foreground font-serif line-clamp-3">
                        {part.content.slice(0, 200)}...
                      </p>
                      <div className="flex gap-2">
                        <Link to={`/read/${part.date}`}>
                          <Button size="sm" className="gap-2">
                            <BookOpen className="w-4 h-4" />
                            Читати
                          </Button>
                        </Link>
                        {isAuthenticated && (
                          <Link to={`/admin/part/${part.id}`}>
                            <Button variant="outline" size="sm">
                              Редагувати
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                }
                
                return (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4 font-serif">
                      Частину для цього дня ще не створено
                    </p>
                    {isAuthenticated && (
                      <Button
                        onClick={() => handleGenerateForDate(selectedDate)}
                        disabled={isGenerating}
                        className="gap-2"
                      >
                        {isGenerating ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                        Згенерувати з новин
                      </Button>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
