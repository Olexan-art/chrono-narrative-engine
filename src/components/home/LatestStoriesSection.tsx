import { memo } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { uk, enUS, pl } from "date-fns/locale";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Part } from "@/types/database";

interface LatestStoriesSectionProps {
  parts: Part[];
}

function getPartLabel(part: any, t: (key: string) => string): { type: 'day' | 'week' | 'month' | 'flash' | 'business'; label: string } {
  if (part.category === 'just_business') {
    return { type: 'business', label: 'JUST BUSINESS' };
  }
  
  if (part.is_flash_news) {
    return { type: 'flash', label: t('flash_news') };
  }
  
  const date = new Date(part.date);
  const dayOfWeek = date.getDay();
  const dayOfMonth = date.getDate();
  
  if (dayOfWeek === 0) {
    return { type: 'week', label: t('month') === 'MONTH' ? 'WEEK' : 'ТИЖДЕНЬ' };
  }
  
  if (dayOfMonth >= 28) {
    const nextDay = new Date(date);
    nextDay.setDate(dayOfMonth + 1);
    if (nextDay.getMonth() !== date.getMonth()) {
      return { type: 'month', label: t('month') };
    }
  }
  
  return { type: 'day', label: t('day') };
}

export const LatestStoriesSection = memo(function LatestStoriesSection({ parts }: LatestStoriesSectionProps) {
  const { t, language } = useLanguage();
  const dateLocale = language === 'en' ? enUS : language === 'pl' ? pl : uk;

  if (parts.length === 0) return null;

  return (
    <section className="py-8 md:py-12">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg md:text-xl font-bold chapter-title flex items-center gap-2">
            <span className="w-1 h-6 bg-primary rounded-full" />
            {t('latest.title')}
          </h2>
          <Badge variant="outline" className="font-mono text-xs">
            {parts.length} {t('common.stories')}
          </Badge>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {parts.map((part, index) => {
            const partLabel = getPartLabel(part, t);
            
            const localizedTitle = language === 'en' 
              ? ((part as any).title_en || part.title)
              : language === 'pl'
              ? ((part as any).title_pl || part.title)
              : part.title;
            
            const localizedContent = language === 'en'
              ? ((part as any).content_en || part.content)
              : language === 'pl'
              ? ((part as any).content_pl || part.content)
              : part.content;

            const partsOnSameDate = parts.filter((p, i) => 
              p.date === part.date && i <= index
            );
            const storyNumber = partsOnSameDate.length;
            
            // Get cover image
            const coverType = (part as any).cover_image_type || 'generated';
            const newsSources = ((part as any).news_sources as any[]) || [];
            const manualImages = Array.isArray((part as any).manual_images) ? (part as any).manual_images : [];
            const selectedNewsImage = newsSources.find((s: any) => s.is_selected && s.image_url);
            const firstNewsImage = newsSources.find((s: any) => s.image_url);
            const newsImage = selectedNewsImage || firstNewsImage;
            
            let imageUrl = part.cover_image_url;
            if ((part as any).category === 'just_business' && manualImages.length > 0) {
              imageUrl = manualImages[0];
            } else if (coverType === 'news' && newsImage) {
              imageUrl = newsImage.image_url;
            }
            
            return (
              <Link 
                key={part.id} 
                to={`/read/${part.date}/${storyNumber}`} 
                className="group block animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <article className={`cosmic-card h-full border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 active:scale-[0.98] overflow-hidden ${
                  partLabel.type === 'flash' 
                    ? 'border-amber-500/40 bg-amber-500/5 hover:border-amber-500/70' 
                    : partLabel.type === 'business'
                    ? 'border-cyan-500/40 bg-cyan-500/10 hover:border-cyan-500/70'
                    : 'border-border hover:border-primary/50'
                }`}>
                  {/* Cover Image */}
                  {imageUrl && (
                    <div className="relative h-40 overflow-hidden">
                      <img 
                        src={imageUrl} 
                        alt=""
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                      <div className="absolute top-3 left-3 flex gap-2">
                        <Badge 
                          variant={partLabel.type === 'day' ? 'secondary' : 'default'}
                          className={`text-[10px] font-mono ${
                            partLabel.type === 'flash' ? 'bg-amber-500/20 text-amber-500 border-amber-500/30' 
                            : partLabel.type === 'business' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                            : ''
                          }`}
                        >
                          {partLabel.label}
                        </Badge>
                      </div>
                    </div>
                  )}
                  
                  <div className="p-4">
                    {!imageUrl && (
                      <Badge 
                        variant={partLabel.type === 'day' ? 'secondary' : 'default'}
                        className={`text-[10px] font-mono mb-2 ${
                          partLabel.type === 'flash' ? 'bg-amber-500/20 text-amber-500 border-amber-500/30' 
                          : partLabel.type === 'business' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                          : ''
                        }`}
                      >
                        {partLabel.label}
                      </Badge>
                    )}
                    
                    <span className="text-[10px] md:text-xs font-mono text-muted-foreground block mb-1">
                      {format(new Date(part.date), 'd MMM yyyy', { locale: dateLocale })}
                    </span>
                    
                    <h3 className={`font-serif font-medium text-sm md:text-base transition-colors duration-200 line-clamp-2 mb-2 ${
                      partLabel.type === 'flash' ? 'group-hover:text-amber-500' 
                      : partLabel.type === 'business' ? 'group-hover:text-cyan-400'
                      : 'group-hover:text-primary'
                    }`}>
                      {localizedTitle}
                    </h3>
                    
                    <p className="text-xs text-muted-foreground line-clamp-2 font-serif">
                      {localizedContent?.slice(0, 100)}...
                    </p>
                    
                    <div className="flex items-center justify-end mt-3 pt-3 border-t border-border/50">
                      <span className={`text-xs font-mono flex items-center gap-1 ${
                        partLabel.type === 'flash' ? 'text-amber-500' 
                        : partLabel.type === 'business' ? 'text-cyan-400'
                        : 'text-primary'
                      }`}>
                        {t('hero.latest')}
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                      </span>
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
