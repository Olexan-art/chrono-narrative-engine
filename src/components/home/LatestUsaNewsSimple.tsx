import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { uk, enUS, pl } from "date-fns/locale";
import { Link } from "react-router-dom";
import { ArrowRight, Clock, Newspaper } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { OptimizedImage } from "@/components/OptimizedImage";

interface LatestUsaNewsSimpleProps {
  excludeIds?: string[];
}

export const LatestUsaNewsSimple = memo(function LatestUsaNewsSimple({ excludeIds = [] }: LatestUsaNewsSimpleProps) {
  const { language } = useLanguage();
  const dateLocale = language === 'en' ? enUS : language === 'pl' ? pl : uk;

  const { data: usaNews = [], isLoading } = useQuery({
    queryKey: ['latest-usa-simple-news', language, excludeIds],
    queryFn: async () => {
      // First get USA country
      const { data: usaCountry } = await supabase
        .from('news_countries')
        .select('id, code')
        .eq('code', 'US')
        .single();

      if (!usaCountry) return [];

      // Fetch latest 40 news WITHOUT content_en (not retold)
      const { data: news } = await supabase
        .from('news_rss_items')
        .select(`
          id, 
          title, 
          title_en,
          description,
          description_en,
          image_url, 
          published_at, 
          slug,
          category,
          content_en
        `)
        .eq('country_id', usaCountry.id)
        .not('slug', 'is', null)
        .order('published_at', { ascending: false })
        .limit(40);

      // Filter out those with content_en (already in Full Retelling) and excluded IDs
      // No longer filtering by content_en to include more articles
      const filtered = (news || [])
        .filter(item => !excludeIds.includes(item.id))
        .slice(0, 20);

      return filtered.map(item => ({
        ...item,
        countryCode: 'us'
      }));
    },
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <section className="py-8 border-b border-border">
        <div className="container mx-auto px-4">
          <Skeleton className="h-8 w-48 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (usaNews.length === 0) return null;

  return (
    <section className="py-8 border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🇺🇸</span>
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Newspaper className="w-4 h-4 text-muted-foreground" />
                {language === 'uk' ? 'Останні новини США' : language === 'pl' ? 'Najnowsze wiadomości USA' : 'Latest USA News'}
              </h2>
              <span className="text-xs text-muted-foreground">
                {usaNews.length} {language === 'uk' ? 'новин' : language === 'pl' ? 'wiadomości' : 'articles'}
              </span>
            </div>
          </div>
          <Link 
            to="/news/us" 
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            {language === 'uk' ? 'Усі новини' : language === 'pl' ? 'Wszystkie' : 'View all'}
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {usaNews.map((item, idx) => {
            const localizedTitle = language === 'en' 
              ? (item.title_en || item.title)
              : item.title;

            return (
              <Link
                key={item.id}
                to={`/news/us/${item.slug}`}
                className="group flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-muted/30 transition-all animate-fade-in"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                {item.image_url && (
                  <OptimizedImage 
                    src={item.image_url} 
                    alt="" 
                    className="w-16 h-16 object-cover rounded shrink-0"
                    containerClassName="w-16 h-16 shrink-0 rounded"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                    {localizedTitle}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                    {item.category && (
                      <span className="px-1.5 py-0.5 bg-secondary rounded text-secondary-foreground">
                        {item.category}
                      </span>
                    )}
                    {item.published_at && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {format(new Date(item.published_at), 'HH:mm', { locale: dateLocale })}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
});
