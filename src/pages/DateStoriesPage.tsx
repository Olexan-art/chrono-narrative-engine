import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { uk, enUS, pl } from "date-fns/locale";
import { BookOpen, Calendar, ArrowLeft, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Part } from "@/types/database";

export default function DateStoriesPage() {
  const { date } = useParams<{ date: string }>();
  const { language } = useLanguage();
  const dateLocale = language === 'en' ? enUS : language === 'pl' ? pl : uk;

  const { data: parts = [], isLoading } = useQuery({
    queryKey: ['date-parts', date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts')
        .select('*, chapter:chapters(title, title_en, title_pl, volume:volumes(title, title_en, title_pl))')
        .eq('date', date)
        .eq('status', 'published')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return (data || []) as (Part & { chapter: any })[];
    },
    enabled: !!date
  });

  const getLocalizedTitle = (part: Part) => {
    if (language === 'en' && part.title_en) return part.title_en;
    if (language === 'pl' && part.title_pl) return part.title_pl;
    return part.title;
  };

  const getLocalizedContent = (part: Part) => {
    if (language === 'en' && part.content_en) return part.content_en;
    if (language === 'pl' && part.content_pl) return part.content_pl;
    return part.content;
  };

  const getLocalizedChapterTitle = (chapter: any) => {
    if (!chapter) return '';
    if (language === 'en' && chapter.title_en) return chapter.title_en;
    if (language === 'pl' && chapter.title_pl) return chapter.title_pl;
    return chapter.title;
  };

  const labels = {
    stories: language === 'en' ? 'Stories' : language === 'pl' ? 'Opowiadania' : 'Оповідання',
    noStories: language === 'en' ? 'No stories for this date' : language === 'pl' ? 'Brak opowiadań na tę datę' : 'Оповідань на цю дату немає',
    backToCalendar: language === 'en' ? 'Back to Calendar' : language === 'pl' ? 'Powrót do kalendarza' : 'До календаря',
    read: language === 'en' ? 'Read' : language === 'pl' ? 'Czytaj' : 'Читати',
    chapter: language === 'en' ? 'Chapter' : language === 'pl' ? 'Rozdział' : 'Глава',
  };

  const parsedDate = date ? parseISO(date) : new Date();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-6 md:py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6 md:mb-8">
            <Link to="/calendar">
              <Button variant="ghost" size="sm" className="gap-2 transition-all duration-200 hover:translate-x-[-4px]">
                <ArrowLeft className="w-4 h-4" />
                {labels.backToCalendar}
              </Button>
            </Link>
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                <Calendar className="w-5 h-5 md:w-6 md:h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold chapter-title">
                  {format(parsedDate, 'd MMMM yyyy', { locale: dateLocale })}
                </h1>
                <p className="text-sm text-muted-foreground font-mono">
                  {parts.length} {labels.stories.toLowerCase()}
                </p>
              </div>
            </div>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Empty state */}
          {!isLoading && parts.length === 0 && (
            <Card className="cosmic-card">
              <CardContent className="py-12 text-center">
                <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">{labels.noStories}</p>
                <Link to="/calendar" className="mt-4 inline-block">
                  <Button variant="outline" className="gap-2">
                    <Calendar className="w-4 h-4" />
                    {labels.backToCalendar}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Stories list */}
          <div className="space-y-4 md:space-y-6">
            {parts.map((part, index) => (
              <Link 
                key={part.id} 
                to={`/read/${part.date}/${index + 1}`}
                className="block group"
              >
                <Card 
                  className="cosmic-card overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1 active:scale-[0.99] animate-fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex flex-col md:flex-row">
                    {/* Cover image */}
                    {(() => {
                      const coverType = (part as any).cover_image_type || 'generated';
                      const newsSources = ((part as any).news_sources as any[]) || [];
                      const selectedNewsImage = newsSources.find((s: any) => s.is_selected && s.image_url);
                      const firstNewsImage = newsSources.find((s: any) => s.image_url);
                      const newsImage = selectedNewsImage || firstNewsImage;
                      const imageUrl = coverType === 'news' && newsImage ? newsImage.image_url : part.cover_image_url;
                      
                      return imageUrl ? (
                        <div className="md:w-48 lg:w-64 shrink-0">
                          <div className="aspect-video md:aspect-[4/5] overflow-hidden">
                            <img 
                              src={imageUrl} 
                              alt={getLocalizedTitle(part)}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          </div>
                        </div>
                      ) : null;
                    })()}
                    
                    {/* Content */}
                    <CardContent className="flex-1 p-4 md:p-6 flex flex-col">
                      {/* Chapter badge */}
                      {part.chapter && (
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-mono text-primary px-2 py-0.5 bg-primary/10 rounded">
                            {labels.chapter} {part.number}
                          </span>
                          <span className="text-xs text-muted-foreground truncate">
                            {getLocalizedChapterTitle(part.chapter)}
                          </span>
                        </div>
                      )}
                      
                      {/* Title */}
                      <h2 className="text-lg md:text-xl font-serif font-bold mb-2 group-hover:text-primary transition-colors line-clamp-2">
                        {getLocalizedTitle(part)}
                      </h2>
                      
                      {/* Preview */}
                      <p className="text-sm md:text-base text-muted-foreground font-serif line-clamp-3 md:line-clamp-4 flex-1">
                        {getLocalizedContent(part).slice(0, 300)}...
                      </p>
                      
                      {/* Footer */}
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>{format(new Date(part.created_at || ''), 'HH:mm', { locale: dateLocale })}</span>
                        </div>
                        
                        <Button 
                          size="sm" 
                          className="gap-2 transition-all duration-200 group-hover:gap-3"
                        >
                          <BookOpen className="w-4 h-4" />
                          {labels.read}
                        </Button>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
