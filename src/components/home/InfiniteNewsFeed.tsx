import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { uk, enUS, pl } from "date-fns/locale";
import { Link } from "react-router-dom";
import { Loader2, Newspaper, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

const DEFAULT_PAGE_SIZE = 40;

interface NewsItem {
  id: string;
  title: string;
  title_en: string | null;
  description: string | null;
  description_en: string | null;
  image_url: string | null;
  published_at: string | null;
  slug: string | null;
  category: string | null;
  country: {
    id: string;
    code: string;
    name: string;
    name_en: string | null;
    flag: string;
  };
}

export const InfiniteNewsFeed = memo(function InfiniteNewsFeed() {
  const { t, language } = useLanguage();
  const dateLocale = language === 'en' ? enUS : language === 'pl' ? pl : uk;
  const loadMoreRef = useRef<HTMLDivElement>(null);
  
  // Fetch page size from settings
  const { data: pageSize = DEFAULT_PAGE_SIZE } = useQuery({
    queryKey: ['news-feed-page-size'],
    queryFn: async () => {
      const { data } = await supabase
        .from('settings')
        .select('news_feed_page_size')
        .single();
      return data?.news_feed_page_size || DEFAULT_PAGE_SIZE;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: ['infinite-news-feed', language, pageSize],
    queryFn: async ({ pageParam = 0 }) => {
      // Fetch more items to allow weighted distribution
      // Target distribution: 50% USA, 20% PL, 20% UA, 10% IN
      const fetchSize = pageSize * 5; // Fetch more to select from
      const from = pageParam * fetchSize;
      const to = from + fetchSize - 1;

      const { data: items, count } = await supabase
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
          country:news_countries(id, code, name, name_en, flag)
        `, { count: 'exact' })
        .not('slug', 'is', null)
        .order('published_at', { ascending: false })
        .range(from, to);

      // Group by country (USA, PL, UA only)
      const byCountry: Record<string, NewsItem[]> = { US: [], PL: [], UA: [], OTHER: [] };
      for (const item of (items || []) as NewsItem[]) {
        const code = item.country?.code?.toUpperCase() || 'OTHER';
        if (['US', 'PL', 'UA'].includes(code)) {
          byCountry[code].push(item);
        } else {
          byCountry.OTHER.push(item);
        }
      }

      // Calculate target counts: 50% USA, 25% PL, 25% UA
      const targetUs = Math.ceil(pageSize * 0.5);
      const targetPl = Math.ceil(pageSize * 0.25);
      const targetUa = Math.ceil(pageSize * 0.25);

      // Take proportional amounts from each country
      const selected: NewsItem[] = [
        ...byCountry.US.slice(0, targetUs),
        ...byCountry.PL.slice(0, targetPl),
        ...byCountry.UA.slice(0, targetUa),
      ];

      // Fill remaining slots if some countries don't have enough
      const remaining = pageSize - selected.length;
      if (remaining > 0) {
        const allRemaining = [
          ...byCountry.US.slice(targetUs),
          ...byCountry.PL.slice(targetPl),
          ...byCountry.UA.slice(targetUa),
        ].slice(0, remaining);
        selected.push(...allRemaining);
      }

      // Sort by published_at to maintain chronological order
      selected.sort((a, b) => {
        const dateA = new Date(a.published_at || 0).getTime();
        const dateB = new Date(b.published_at || 0).getTime();
        return dateB - dateA;
      });

      return {
        items: selected.slice(0, pageSize),
        totalCount: count || 0,
        nextPage: (items?.length || 0) === fetchSize ? pageParam + 1 : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Intersection Observer for infinite scroll
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const [target] = entries;
    if (target.isIntersecting && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: '200px',
      threshold: 0,
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [handleObserver]);

  const allNews = data?.pages.flatMap(page => page.items) || [];
  const totalCount = data?.pages[0]?.totalCount || 0;

  if (isLoading) {
    return (
      <section className="py-8 md:py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2 mb-6">
            <Newspaper className="w-5 h-5 text-primary" />
            <h2 className="text-lg md:text-xl font-bold">{t('rss_news.latest')}</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (isError || allNews.length === 0) return null;

  return (
    <section className="py-8 md:py-12 border-t border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-primary" />
            {t('rss_news.latest')}
          </h2>
          <Badge variant="outline" className="font-mono text-xs">
            {totalCount.toLocaleString()} {language === 'en' ? 'news' : 'новин'}
          </Badge>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {allNews.map((item, index) => {
            const country = item.country;
            if (!country) return null;

            const localizedTitle = language === 'en' 
              ? (item.title_en || item.title)
              : item.title;

            const localizedDesc = language === 'en'
              ? (item.description_en || item.description)
              : item.description;

            return (
              <Link
                key={item.id}
                to={`/news/${country.code.toLowerCase()}/${item.slug}`}
                className="group block animate-fade-in"
                style={{ animationDelay: `${(index % 20) * 25}ms` }}
              >
                <article className="cosmic-card h-full border border-border/50 hover:border-primary/50 transition-all duration-200 overflow-hidden hover:shadow-lg hover:-translate-y-1">
                  {item.image_url && (
                    <div className="relative h-32 overflow-hidden">
                      <img 
                        src={item.image_url} 
                        alt="" 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                      <div className="absolute top-2 left-2 flex items-center gap-1">
                        <span className="text-base">{country.flag}</span>
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-background/80 backdrop-blur-sm">
                          {item.category || 'news'}
                        </Badge>
                      </div>
                    </div>
                  )}
                  
                  <div className="p-3">
                    {!item.image_url && (
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-base">{country.flag}</span>
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                          {item.category || 'news'}
                        </Badge>
                      </div>
                    )}
                    
                    <h4 className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors mb-2">
                      {localizedTitle}
                    </h4>
                    
                    {localizedDesc && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {localizedDesc}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
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

        {/* Load More Trigger */}
        <div ref={loadMoreRef} className="flex justify-center py-8">
          {isFetchingNextPage ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm font-mono">{language === 'en' ? 'Loading more...' : 'Завантаження...'}</span>
            </div>
          ) : hasNextPage ? (
            <Button 
              variant="outline" 
              onClick={() => fetchNextPage()}
              className="gap-2"
            >
              <Newspaper className="w-4 h-4" />
              {language === 'en' ? 'Load More News' : 'Завантажити ще'}
            </Button>
          ) : allNews.length > 0 ? (
            <p className="text-sm text-muted-foreground font-mono">
              {language === 'en' ? '— End of news feed —' : '— Кінець стрічки новин —'}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
});
