import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format, addMonths, subMonths, getYear, getMonth } from "date-fns";
import { uk } from "date-fns/locale";
import { BookOpen, Edit, RefreshCw, ChevronLeft, ChevronRight, Image, MessageSquare, Twitter, Loader2, ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Chapter, Volume } from "@/types/database";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { adminAction } from "@/lib/api";

interface ChaptersPanelProps {
  password: string;
}

interface ChapterWithVolume extends Chapter {
  volume?: Volume;
}

export function ChaptersPanel({ password }: ChaptersPanelProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleDeleteChapter = async (chapterId: string) => {
    setDeletingId(chapterId);
    try {
      await adminAction('deleteChapter', password, { id: chapterId });
      queryClient.invalidateQueries({ queryKey: ['admin-chapters'] });
      queryClient.invalidateQueries({ queryKey: ['chapters'] });
      toast({ title: "Главу видалено" });
    } catch (error) {
      toast({
        title: "Помилка",
        description: error instanceof Error ? error.message : "Не вдалося видалити",
        variant: "destructive"
      });
    } finally {
      setDeletingId(null);
    }
  };

  const year = getYear(currentMonth);
  const month = getMonth(currentMonth) + 1;

  const { data: chapters = [], isLoading } = useQuery({
    queryKey: ['admin-chapters', year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chapters')
        .select(`
          *,
          volume:volumes!inner(*)
        `)
        .eq('volumes.year', year)
        .eq('volumes.month', month)
        .order('week_of_month', { ascending: true });
      
      if (error) throw error;
      return data as ChapterWithVolume[];
    }
  });

  const handleRegenerate = async (chapter: ChapterWithVolume) => {
    setRegeneratingId(chapter.id);
    
    try {
      // Get parts for this chapter's week
      const weekStart = new Date(year, month - 1, (chapter.week_of_month - 1) * 7 + 1);
      const weekEnd = new Date(year, month - 1, chapter.week_of_month * 7);
      
      const { data: parts } = await supabase
        .from('parts')
        .select('*')
        .gte('date', format(weekStart, 'yyyy-MM-dd'))
        .lte('date', format(weekEnd, 'yyyy-MM-dd'))
        .eq('status', 'published');

      if (!parts || parts.length === 0) {
        throw new Error('Немає опублікованих частин для цього тижня');
      }

      toast({ title: "Перегенерація розпочата...", description: "Це може зайняти кілька хвилин" });

      // Call generate-week for part 3 to regenerate monologue, commentary, tweets
      const response = await supabase.functions.invoke('generate-week', {
        body: {
          weekParts: parts,
          previousContent: chapter.description || '',
          weekStart: format(weekStart, 'yyyy-MM-dd'),
          weekEnd: format(weekEnd, 'yyyy-MM-dd'),
          part: 3,
          totalParts: 3
        }
      });

      if (response.error) throw response.error;

      const story = response.data?.story;
      if (!story) throw new Error('Не отримано результат генерації');

      // Update chapter with new data
      const updateData: Partial<Chapter> = {
        title: story.title || chapter.title,
        narrator_monologue: story.strangerMonologue,
        narrator_commentary: story.narratorCommentary,
        description: story.summary || chapter.description,
        tweets: story.tweets || [],
        cover_image_prompt: story.imagePrompt,
        cover_image_prompt_2: story.imagePrompt2,
        cover_image_prompt_3: story.imagePrompt3,
      };

      const { error: updateError } = await supabase
        .from('chapters')
        .update(updateData as any)
        .eq('id', chapter.id);

      if (updateError) throw updateError;

      // Generate images
      for (let i = 1; i <= 3; i++) {
        const prompt = i === 1 ? story.imagePrompt : i === 2 ? story.imagePrompt2 : story.imagePrompt3;
        if (prompt) {
          await supabase.functions.invoke('generate-image', {
            body: { prompt, chapterId: chapter.id, imageIndex: i }
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['admin-chapters'] });
      toast({ title: "Главу перегенеровано!" });
    } catch (error) {
      toast({
        title: "Помилка",
        description: error instanceof Error ? error.message : "Не вдалося перегенерувати",
        variant: "destructive"
      });
    } finally {
      setRegeneratingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-lg font-serif">
          {format(currentMonth, 'LLLL yyyy', { locale: uk })}
        </h2>
        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : chapters.length === 0 ? (
        <Card className="cosmic-card">
          <CardContent className="py-12 text-center">
            <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Глав за цей місяць ще немає</p>
            <p className="text-sm text-muted-foreground mt-2">
              Згенеруйте глави у вкладці "Тиждень"
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {chapters.map((chapter) => (
            <Card key={chapter.id} className="cosmic-card overflow-hidden">
              <div className="flex">
                {/* Cover Image */}
                {chapter.cover_image_url && (
                  <div className="w-32 h-32 shrink-0">
                    <img
                      src={chapter.cover_image_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                <CardContent className="flex-1 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="font-mono">
                          Тиждень {chapter.week_of_month}
                        </Badge>
                        {chapter.volume && (
                          <Badge variant="secondary" className="font-mono text-xs">
                            Том {chapter.volume.number}
                          </Badge>
                        )}
                      </div>
                      
                      <h3 className="font-serif font-medium text-lg mb-2 line-clamp-1">
                        {chapter.title}
                      </h3>
                      
                      <p className="text-sm text-muted-foreground line-clamp-2 font-serif">
                        {chapter.description || chapter.narrator_monologue?.slice(0, 150)}
                      </p>
                      
                      {/* Content indicators */}
                      <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                        {chapter.narrator_monologue && (
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            Монолог
                          </span>
                        )}
                        {chapter.narrator_commentary && (
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            Коментар
                          </span>
                        )}
                        {chapter.tweets && (chapter.tweets as any[]).length > 0 && (
                          <span className="flex items-center gap-1">
                            <Twitter className="w-3 h-3" />
                            {(chapter.tweets as any[]).length} твітів
                          </span>
                        )}
                        {chapter.cover_image_url && (
                          <span className="flex items-center gap-1">
                            <Image className="w-3 h-3" />
                            {[chapter.cover_image_url, chapter.cover_image_url_2, chapter.cover_image_url_3].filter(Boolean).length} фото
                          </span>
                        )}
                        {chapter.chat_dialogue && (chapter.chat_dialogue as any[]).length > 0 && (
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            Чат
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-4">
                    <Link to={`/admin/chapter/${chapter.id}`}>
                      <Button size="sm" variant="outline" className="gap-1">
                        <Edit className="w-3 h-3" />
                        Редагувати
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => handleRegenerate(chapter)}
                      disabled={regeneratingId === chapter.id}
                    >
                      {regeneratingId === chapter.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                      Перегенерувати
                    </Button>
                    <Link to={`/chapter/${chapter.number}`}>
                      <Button size="sm" variant="ghost" className="gap-1">
                        <ExternalLink className="w-3 h-3" />
                        Переглянути
                      </Button>
                    </Link>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1 text-destructive hover:text-destructive"
                          disabled={deletingId === chapter.id}
                        >
                          {deletingId === chapter.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                          Видалити
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Видалити главу?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Ви впевнені, що хочете видалити главу "{chapter.title}"? Цю дію неможливо скасувати.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Скасувати</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteChapter(chapter.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Видалити
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
