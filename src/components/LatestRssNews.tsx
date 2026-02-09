import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { uk, enUS, pl } from "date-fns/locale";
import { Link } from "react-router-dom";
import { ArrowRight, Newspaper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

export function LatestRssNews() {
  const { t, language } = useLanguage();
  const dateLocale = language === 'en' ? enUS : language === 'pl' ? pl : uk;

  const { data: latestNews = [] } = useQuery({
    queryKey: ['latest-rss-news', language],
    queryFn: async () => {
      const { data: items } = await supabase
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
          country:news_countries(id, code, name, name_en, flag),
          feed:news_rss_feeds(name)
        `)
        .not('slug', 'is', null)
        .order('published_at', { ascending: false })
        .limit(3);
      
      return items || [];
    }
  });

  if (latestNews.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-mono text-muted-foreground flex items-center gap-2">
          <Newspaper className="w-4 h-4" />
          {t('rss_news.latest')}
        </h3>
        <Link 
          to="/news" 
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          {t('rss_news.view_all')}
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="space-y-2">
        {latestNews.map((news: any) => {
          const country = news.country;
          if (!country) return null;

          const localizedTitle = language === 'en' 
            ? (news.title_en || news.title)
            : news.title;

          return (
            <Link
              key={news.id}
              to={`/news/${country.code}/${news.slug}`}
              className="group block"
            >
              <article className="flex gap-3 p-2 rounded-lg border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200">
                {news.image_url ? (
                  <img 
                    src={news.image_url} 
                    alt="" 
                    className="w-16 h-16 object-cover rounded shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      const fallback = (e.target as HTMLImageElement).nextElementSibling;
                      if (fallback) (fallback as HTMLElement).style.display = 'flex';
                    }}
                  />
                ) : null}
                <div className={`w-16 h-16 shrink-0 rounded bg-gradient-to-br from-primary/10 to-muted/50 items-center justify-center border border-border/50 ${news.image_url ? 'hidden' : 'flex'}`}>
                  <Newspaper className="w-6 h-6 text-muted-foreground/60" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-sm">{country.flag}</span>
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                      {news.category || 'news'}
                    </Badge>
                  </div>
                  <h4 className="text-xs font-medium line-clamp-2 group-hover:text-primary transition-colors">
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
      </div>
    </div>
  );
}
