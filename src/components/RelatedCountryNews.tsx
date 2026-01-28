import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
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
      const { data } = await supabase
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
          category
        `)
        .eq('country_id', countryId)
        .neq('id', currentArticleId)
        .not('slug', 'is', null)
        .order('published_at', { ascending: false })
        .limit(6);
      
      return data || [];
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
