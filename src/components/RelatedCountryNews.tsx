import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, endOfDay } from "date-fns";
import { uk, enUS, pl } from "date-fns/locale";
import { Link } from "react-router-dom";
import { ArrowRight, Newspaper } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

interface RelatedCountryNewsProps {
  countryId: string;
  countryCode: string;
  countryName: string;
  countryFlag: string;
  currentArticleId: string;
  className?: string;
}

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
}

// Fisher-Yates shuffle
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export const RelatedCountryNews = memo(function RelatedCountryNews({
  countryId,
  countryCode,
  countryName,
  countryFlag,
  currentArticleId,
  className = ""
}: RelatedCountryNewsProps) {
  const { t, language } = useLanguage();
  const dateLocale = language === 'en' ? enUS : language === 'pl' ? pl : uk;

  const { data: relatedNews = [], isLoading } = useQuery({
    queryKey: ['related-country-news', countryId, currentArticleId, language],
    queryFn: async () => {
      const today = new Date();
      const todayStart = startOfDay(today).toISOString();
      const todayEnd = endOfDay(today).toISOString();

      // Fetch all in parallel
      const [latestResult, todayResult, allResult] = await Promise.all([
        // 1. Get 2 latest news (excluding current)
        supabase
          .from('news_rss_items')
          .select('id, title, title_en, description, description_en, image_url, published_at, slug, category')
          .eq('country_id', countryId)
          .neq('id', currentArticleId)
          .not('slug', 'is', null)
          .order('published_at', { ascending: false })
          .limit(2),
        
        // 2. Get today's news for random selection
        supabase
          .from('news_rss_items')
          .select('id, title, title_en, description, description_en, image_url, published_at, slug, category')
          .eq('country_id', countryId)
          .neq('id', currentArticleId)
          .not('slug', 'is', null)
          .gte('published_at', todayStart)
          .lte('published_at', todayEnd)
          .order('published_at', { ascending: false })
          .limit(20),
        
        // 3. Get more news for random selection from this country
        supabase
          .from('news_rss_items')
          .select('id, title, title_en, description, description_en, image_url, published_at, slug, category')
          .eq('country_id', countryId)
          .neq('id', currentArticleId)
          .not('slug', 'is', null)
          .order('published_at', { ascending: false })
          .limit(50)
      ]);

      const latestNews = (latestResult.data || []) as NewsItem[];
      const todayNews = (todayResult.data || []) as NewsItem[];
      const allNews = (allResult.data || []) as NewsItem[];

      // Collect used IDs to avoid duplicates
      const usedIds = new Set<string>([currentArticleId, ...latestNews.map(n => n.id)]);

      // 2 random from today (excluding latest)
      const todayFiltered = todayNews.filter(n => !usedIds.has(n.id));
      const randomToday = shuffleArray(todayFiltered).slice(0, 2);
      randomToday.forEach(n => usedIds.add(n.id));

      // 2 random from all (excluding already selected)
      const allFiltered = allNews.filter(n => !usedIds.has(n.id));
      const randomAll = shuffleArray(allFiltered).slice(0, 2);

      // Combine: 2 latest + 2 random today + 2 random all
      const combined = [...latestNews, ...randomToday, ...randomAll];
      
      return combined.slice(0, 6);
    },
    enabled: !!countryId && !!currentArticleId,
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (relatedNews.length === 0) return null;

  const sectionTitle = language === 'en' 
    ? `More from ${countryName}` 
    : language === 'pl' 
    ? `Więcej z ${countryName}`
    : `Більше з ${countryName}`;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-primary" />
          <span className="flex items-center gap-1.5">
            {countryFlag} {sectionTitle}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {relatedNews.map((news, idx) => {
          const localizedTitle = language === 'en' 
            ? (news.title_en || news.title)
            : news.title;

          return (
            <Link
              key={news.id}
              to={`/news/${countryCode.toLowerCase()}/${news.slug}`}
              className="group block"
            >
              <article 
                className="flex gap-3 p-2 rounded-lg border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 animate-fade-in"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                {news.image_url && (
                  <img 
                    src={news.image_url} 
                    alt="" 
                    className="w-16 h-16 object-cover rounded shrink-0"
                    loading="lazy"
                  />
                )}
                <div className="flex-1 min-w-0">
                  {news.category && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 mb-1">
                      {news.category}
                    </Badge>
                  )}
                  <h4 className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                    {localizedTitle}
                  </h4>
                  {news.published_at && (
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(news.published_at), 'd MMM, HH:mm', { locale: dateLocale })}
                    </span>
                  )}
                </div>
              </article>
            </Link>
          );
        })}

        {/* Link to all country news */}
        <Link 
          to={`/news/${countryCode.toLowerCase()}`}
          className="flex items-center justify-center gap-2 text-sm text-primary hover:underline pt-2"
        >
          {language === 'en' ? 'View all' : language === 'pl' ? 'Zobacz wszystkie' : 'Переглянути всі'}
          <ArrowRight className="w-3 h-3" />
        </Link>
      </CardContent>
    </Card>
  );
});
