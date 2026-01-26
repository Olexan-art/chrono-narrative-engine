import { memo } from "react";
import { Link } from "react-router-dom";
import { BookOpen, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface Chapter {
  id: string;
  title: string;
  title_en?: string | null;
  title_pl?: string | null;
  description?: string | null;
  description_en?: string | null;
  description_pl?: string | null;
  number: number;
  week_of_month: number;
  cover_image_url?: string | null;
  narrator_monologue?: string | null;
  narrator_commentary?: string | null;
  volume?: {
    title: string;
    title_en?: string | null;
    title_pl?: string | null;
  };
}

interface ChaptersSectionProps {
  chapters: Chapter[];
}

export const ChaptersSection = memo(function ChaptersSection({ chapters }: ChaptersSectionProps) {
  const { t, language } = useLanguage();

  if (chapters.length === 0) return null;

  return (
    <section className="py-8 md:py-12">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            {t('chapters.title')}
          </h2>
          <Link to="/chapters">
            <Button variant="outline" size="sm" className="gap-2 text-xs">
              {t('rss_news.view_all')}
              <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
        
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {chapters.map((chapter, index) => {
            const localizedTitle = language === 'en' 
              ? (chapter.title_en || chapter.title)
              : language === 'pl'
              ? (chapter.title_pl || chapter.title)
              : chapter.title;
              
            const localizedDesc = language === 'en'
              ? (chapter.description_en || chapter.description)
              : language === 'pl'
              ? (chapter.description_pl || chapter.description)
              : chapter.description;
            
            const localizedVolume = language === 'en'
              ? (chapter.volume?.title_en || chapter.volume?.title || 'Volume')
              : language === 'pl'
              ? (chapter.volume?.title_pl || chapter.volume?.title || 'Tom')
              : (chapter.volume?.title || 'Том');
            
            return (
              <Link 
                key={chapter.id} 
                to={`/chapter/${chapter.number}`}
                className="group block animate-fade-in"
                style={{ animationDelay: `${index * 75}ms` }}
              >
                <article className="cosmic-card border border-border hover:border-primary/50 transition-all duration-300 overflow-hidden h-full hover:shadow-lg hover:-translate-y-1 active:scale-[0.98]">
                  {/* Cover Image */}
                  <div className="relative h-48 bg-muted">
                    {chapter.cover_image_url ? (
                      <img 
                        src={chapter.cover_image_url} 
                        alt={localizedTitle}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
                        <BookOpen className="w-12 h-12 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                    
                    <div className="absolute top-3 left-3">
                      <Badge className="font-mono text-xs">
                        {t('chapter')} {chapter.number}
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-mono text-muted-foreground">
                        {localizedVolume}
                      </span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-xs font-mono text-muted-foreground">
                        {t('week')} {chapter.week_of_month}
                      </span>
                    </div>
                    
                    <h3 className="font-serif font-medium text-lg group-hover:text-primary transition-colors line-clamp-2 mb-2">
                      {localizedTitle}
                    </h3>
                    
                    {localizedDesc && (
                      <p className="text-sm text-muted-foreground line-clamp-2 font-serif">
                        {localizedDesc}
                      </p>
                    )}
                    
                    {/* Indicators */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                      {chapter.narrator_monologue && (
                        <span className="text-xs text-primary font-mono">
                          ✦ {t('monologue')}
                        </span>
                      )}
                      {chapter.narrator_commentary && (
                        <span className="text-xs text-secondary-foreground font-mono">
                          ◆ {t('commentary')}
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
});
