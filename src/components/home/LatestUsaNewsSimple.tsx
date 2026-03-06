import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { uk, enUS, pl } from "date-fns/locale";
import { Link } from "react-router-dom";
import { ArrowRight, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { OptimizedImage } from "@/components/OptimizedImage";
import { NewsVoteCompact } from "@/components/NewsVoteBlock";
import { NewsLogoMosaic } from "@/components/NewsLogoMosaic";

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
          url,
          published_at, 
          slug,
          category,
          content_en,
          likes,
          dislikes,
          news_rss_feeds(name)
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
      <section className="py-4 border-b border-cyan-500/20">
        <div className="container mx-auto px-4">
          <Skeleton className="h-4 w-24 mb-2" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {Array.from({ length: 20 }, (_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (usaNews.length === 0) return null;

  return (
    <section className="py-4 border-b border-cyan-500/20">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-cyan-400 animate-digital-blink" />
            <h2 className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
              {language === 'uk' ? 'Новини США' : language === 'pl' ? 'USA' : 'USA News'}
            </h2>
            <span className="text-[9px] font-mono text-muted-foreground">
              {usaNews.length}
            </span>
          </div>
          <Link 
            to="/news/us" 
            className="text-[9px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5"
          >
            {language === 'uk' ? 'Усі' : language === 'pl' ? 'Wszystkie' : 'All'}
            <ArrowRight className="w-2.5 h-2.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {usaNews.map((item, idx) => {
            const localizedTitle = language === 'en' 
              ? (item.title_en || item.title)
              : item.title;

            return (
              <Link
                key={item.id}
                to={`/news/us/${item.slug}`}
                className="group flex items-start gap-2 p-2 border border-cyan-500/20 hover:border-cyan-500/40 bg-cyan-500/5 hover:bg-cyan-500/10 transition-all"
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                {item.image_url ? (
                  <OptimizedImage 
                    src={item.image_url} 
                    alt="" 
                    className="w-12 h-12 object-cover shrink-0"
                    containerClassName="w-12 h-12 shrink-0"
                    onError={() => {}}
                    fallbackSrc=""
                  />
                ) : null}
                {(!item.image_url) && (
                  <NewsLogoMosaic 
                    feedName={(item as any).news_rss_feeds?.name}
                    sourceUrl={(item as any).url}
                    className="w-12 h-12 shrink-0"
                    logoSize="sm"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-[11px] font-mono leading-tight line-clamp-2 group-hover:text-cyan-400 transition-colors">
                    {localizedTitle}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-1 text-[9px] text-muted-foreground font-mono">
                    {item.published_at && (
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-2 h-2" />
                        {format(new Date(item.published_at), 'HH:mm', { locale: dateLocale })}
                      </span>
                    )}
                    {item.category && (
                      <span className="text-cyan-500/60">
                        {item.category}
                      </span>
                    )}
                  </div>
                  {/* Voting buttons */}
                  <div className="mt-1" onClick={(e) => e.preventDefault()}>
                    <NewsVoteCompact 
                      newsId={item.id} 
                      likes={item.likes || 0} 
                      dislikes={item.dislikes || 0} 
                    />
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
