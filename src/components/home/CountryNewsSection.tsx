import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { uk, enUS, pl } from "date-fns/locale";
import { Link } from "react-router-dom";
import { Globe, ArrowRight, Newspaper, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

const NEWS_PER_COUNTRY = 6;

interface NewsItem {
  id: string;
  title: string;
  title_en: string | null;
  description: string | null;
  description_en: string | null;
  content_en: string | null;
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

interface CountryWithNews {
  country: {
    id: string;
    code: string;
    name: string;
    name_en: string | null;
    flag: string;
  };
  news: NewsItem[];
}

export const CountryNewsSection = memo(function CountryNewsSection() {
  const { t, language } = useLanguage();
  const dateLocale = language === 'en' ? enUS : language === 'pl' ? pl : uk;

  const { data: countriesWithNews = [], isLoading } = useQuery({
    queryKey: ['country-news-section', language],
    queryFn: async () => {
      // First get active countries
      const { data: countries } = await supabase
        .from('news_countries')
        .select('id, code, name, name_en, flag')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (!countries?.length) return [];

      // For each country, fetch 6 latest news
      const results: CountryWithNews[] = [];
      
      for (const country of countries) {
        const { data: newsItems } = await supabase
          .from('news_rss_items')
          .select(`
            id, 
            title, 
            title_en,
            description,
            description_en,
            content_en,
            image_url, 
            published_at, 
            slug,
            category
          `)
          .eq('country_id', country.id)
          .not('slug', 'is', null)
          .order('published_at', { ascending: false })
          .limit(NEWS_PER_COUNTRY);

        if (newsItems?.length) {
          results.push({
            country,
            news: newsItems.map(item => ({
              ...item,
              country
            }))
          });
        }
      }

      return results;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  if (isLoading) {
    return (
      <section className="py-8 md:py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2 mb-6">
            <Globe className="w-5 h-5 text-primary" />
            <h2 className="text-lg md:text-xl font-bold">{t('newsdigest.title')}</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-6 w-32" />
                {[1, 2, 3].map(j => (
                  <Skeleton key={j} className="h-20 w-full" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (countriesWithNews.length === 0) return null;

  return (
    <section className="py-8 md:py-12 bg-muted/30 border-y border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            {t('newsdigest.title')}
          </h2>
          <Link to="/news">
            <Button variant="outline" size="sm" className="gap-2 text-xs">
              {t('rss_news.view_all')}
              <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {countriesWithNews.map(({ country, news }) => {
            const countryName = language === 'en' 
              ? (country.name_en || country.name)
              : country.name;

            return (
              <div key={country.id} className="space-y-3">
                {/* Country Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{country.flag}</span>
                    <span className="font-medium text-sm">{countryName}</span>
                  </div>
                  <Link 
                    to={`/news/${country.code.toLowerCase()}`}
                    className="text-xs text-primary hover:underline"
                  >
                    {t('rss_news.view_all')} →
                  </Link>
                </div>

                {/* News Cards */}
                <div className="space-y-2">
                  {news.map((item, idx) => {
                    const localizedTitle = language === 'en' 
                      ? (item.title_en || item.title)
                      : item.title;
                    const isRetold = item.content_en && item.content_en.length > 100;

                    return (
                      <Link
                        key={item.id}
                        to={`/news/${country.code.toLowerCase()}/${item.slug}`}
                        className="group block"
                      >
                        <article 
                          className={`flex gap-3 p-2 rounded-lg border bg-card transition-all duration-200 ${
                            isRetold 
                              ? 'border-primary/30 hover:border-primary/50 bg-primary/5' 
                              : 'border-border/50 hover:border-primary/50 hover:bg-primary/5'
                          }`}
                          style={{ animationDelay: `${idx * 50}ms` }}
                        >
                          {item.image_url && (
                            <img 
                              src={item.image_url} 
                              alt="" 
                              className="w-16 h-16 object-cover rounded shrink-0"
                              loading="lazy"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              {isRetold && (
                                <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 gap-0.5">
                                  <Sparkles className="w-2.5 h-2.5" />
                                  Full retelling
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                                {item.category || 'news'}
                              </Badge>
                            </div>
                            <h4 className="text-xs font-medium line-clamp-2 group-hover:text-primary transition-colors">
                              {localizedTitle}
                            </h4>
                            {item.published_at && (
                              <span className="text-[10px] text-muted-foreground">
                                {format(new Date(item.published_at), 'd MMM, HH:mm', { locale: dateLocale })}
                              </span>
                            )}
                          </div>
                        </article>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
});
