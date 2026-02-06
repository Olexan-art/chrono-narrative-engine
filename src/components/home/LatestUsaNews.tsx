import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { uk, enUS, pl } from "date-fns/locale";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { OptimizedImage } from "@/components/OptimizedImage";
export const LatestUsaNews = memo(function LatestUsaNews() {
  const { t, language } = useLanguage();
  const dateLocale = language === 'en' ? enUS : language === 'pl' ? pl : uk;

  const { data: usaNews = [], isLoading } = useQuery({
    queryKey: ['latest-usa-retold-news', language],
    queryFn: async () => {
      // First get USA country
      const { data: usaCountry } = await supabase
        .from('news_countries')
        .select('id, code, name, name_en, flag')
        .eq('code', 'US')
        .single();

      if (!usaCountry) return [];

      // Fetch latest 3 retold news (with content_en)
      const { data: news } = await supabase
        .from('news_rss_items')
        .select(`
          id, 
          title, 
          title_en,
          content_en,
          description,
          description_en,
          image_url, 
          published_at, 
          slug,
          category
        `)
        .eq('country_id', usaCountry.id)
        .not('content_en', 'is', null)
        .not('slug', 'is', null)
        .order('published_at', { ascending: false })
        .limit(6);

      return (news || []).map(item => ({
        ...item,
        country: usaCountry
      }));
    },
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <section className="py-4 md:py-6 border-y border-border bg-gradient-to-r from-primary/5 via-transparent to-primary/5">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-3 overflow-x-auto pb-2 md:pb-0">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-24 w-80 shrink-0" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (usaNews.length === 0) return null;

  return (
    <section className="py-4 md:py-6 border-y border-border bg-gradient-to-r from-primary/5 via-transparent to-primary/5">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">🇺🇸</span>
          <span className="text-xs font-mono text-primary uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Full retelling
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {usaNews.map((item, idx) => {
            const localizedTitle = language === 'en' 
              ? (item.title_en || item.title)
              : item.title;
            
            // Get preview from content_en
            const contentPreview = item.content_en?.slice(0, 150) || item.description_en || item.description || '';

            return (
              <Link
                key={item.id}
                to={`/news/us/${item.slug}`}
                className="group block animate-fade-in"
                style={{ animationDelay: `${idx * 75}ms` }}
              >
                <article className="cosmic-card h-full border border-primary/20 bg-primary/5 hover:border-primary/50 hover:bg-primary/10 transition-all duration-300 overflow-hidden flex">
                  {item.image_url && (
                    <div className="relative w-24 md:w-32 shrink-0 overflow-hidden">
                      <img 
                        src={item.image_url} 
                        alt="" 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    </div>
                  )}
                  <div className="p-3 flex-1 min-w-0 flex flex-col">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="inline-flex items-center text-[10px] px-1 py-0 h-4 border border-primary/30 text-primary rounded-sm">
                        <Sparkles className="w-2 h-2 mr-0.5" />
                        Full retelling
                      </span>
                      {item.category && (
                        <span className="inline-flex items-center text-[10px] px-1 py-0 h-4 bg-secondary text-secondary-foreground rounded-sm">
                          {item.category}
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors mb-1">
                      {localizedTitle}
                    </h4>
                    <p className="text-xs text-muted-foreground line-clamp-2 flex-1">
                      {contentPreview}...
                    </p>
                    <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
                      {item.published_at && (
                        <span>
                          {format(new Date(item.published_at), 'd MMM, HH:mm', { locale: dateLocale })}
                        </span>
                      )}
                      <ArrowRight className="w-3 h-3 group-hover:translate-x-1 group-hover:text-primary transition-all" />
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
