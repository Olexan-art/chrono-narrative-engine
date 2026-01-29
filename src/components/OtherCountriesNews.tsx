import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { uk, enUS, pl } from "date-fns/locale";
import { Link } from "react-router-dom";
import { ArrowRight, Globe, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

interface OtherCountriesNewsProps {
  excludeCountryCode: string;
  className?: string;
}

export const OtherCountriesNews = memo(function OtherCountriesNews({
  excludeCountryCode,
  className = ""
}: OtherCountriesNewsProps) {
  const { t, language } = useLanguage();
  const dateLocale = language === 'en' ? enUS : language === 'pl' ? pl : uk;

  // Fetch other countries with their latest news
  const { data: countriesWithNews = [], isLoading } = useQuery({
    queryKey: ['other-countries-news', excludeCountryCode, language],
    queryFn: async () => {
      // First get all active countries except current
      const { data: countries } = await supabase
        .from('news_countries')
        .select('id, code, name, name_en, name_pl, flag')
        .eq('is_active', true)
        .neq('code', excludeCountryCode.toUpperCase())
        .order('sort_order');

      if (!countries || countries.length === 0) return [];

      // Fetch 3 latest news for each country
      const results = await Promise.all(
        countries.map(async (country) => {
          const { data: news } = await supabase
            .from('news_rss_items')
            .select(`
              id, 
              title, 
              title_en,
              content_en,
              image_url, 
              published_at, 
              slug,
              category
            `)
            .eq('country_id', country.id)
            .not('slug', 'is', null)
            .order('published_at', { ascending: false })
            .limit(3);

          return {
            country,
            news: news || []
          };
        })
      );

      // Filter out countries with no news
      return results.filter(r => r.news.length > 0);
    },
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <section className={`py-8 border-t border-border ${className}`}>
        <div className="flex items-center gap-2 mb-6">
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </section>
    );
  }

  if (countriesWithNews.length === 0) return null;

  const sectionTitle = language === 'en' 
    ? 'News from Other Countries' 
    : language === 'pl' 
    ? 'Wiadomości z innych krajów'
    : 'Новини інших країн';

  return (
    <section className={`py-8 border-t border-border ${className}`}>
      <div className="flex items-center gap-2 mb-6">
        <Globe className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold">{sectionTitle}</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {countriesWithNews.map(({ country, news }, countryIdx) => {
          const countryName = language === 'en' 
            ? (country.name_en || country.name)
            : language === 'pl'
            ? (country.name_pl || country.name)
            : country.name;

          return (
            <div 
              key={country.id} 
              className="space-y-3 animate-fade-in"
              style={{ animationDelay: `${countryIdx * 100}ms` }}
            >
              {/* Country Header */}
              <Link 
                to={`/news/${country.code.toLowerCase()}`}
                className="flex items-center justify-between group"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{country.flag}</span>
                  <h3 className="font-semibold group-hover:text-primary transition-colors">
                    {countryName}
                  </h3>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </Link>

              {/* News Items */}
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
                        className={`flex gap-3 p-2 rounded-lg border transition-all duration-200 ${
                          isRetold 
                            ? 'border-primary/30 bg-primary/5 hover:border-primary/50' 
                            : 'border-border/50 hover:border-primary/50 hover:bg-primary/5'
                        }`}
                        style={{ animationDelay: `${(countryIdx * 3 + idx) * 50}ms` }}
                      >
                        {item.image_url && (
                          <img 
                            src={item.image_url} 
                            alt="" 
                            className="w-14 h-14 object-cover rounded shrink-0"
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
                            {item.category && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                                {item.category}
                              </Badge>
                            )}
                          </div>
                          <h4 className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
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
    </section>
  );
});
