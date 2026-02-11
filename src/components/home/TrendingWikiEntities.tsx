import { memo } from "react";
import { getOptimizedUrl } from "@/components/OptimizedImage";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Sparkles, TrendingUp, ExternalLink, Calendar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

interface WikiEntityWithNews {
  entity: {
    id: string;
    name: string;
    name_en: string | null;
    description: string | null;
    description_en: string | null;
    image_url: string | null;
    wiki_url: string;
    wiki_url_en: string | null;
  };
  mentionCount: number;
  news: Array<{
    id: string;
    title: string;
    title_en: string | null;
    slug: string;
    countryCode: string;
  }>;
}

async function fetchTrendingEntities(hoursAgo: number): Promise<WikiEntityWithNews[]> {
  const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

  const { data: recentMentions } = await supabase
    .from('news_wiki_entities')
    .select(`
      wiki_entity_id,
      news_item_id,
      created_at,
      wiki_entity:wiki_entities(
        id, name, name_en, description, description_en, 
        image_url, wiki_url, wiki_url_en
      ),
      news_item:news_rss_items(
        id, title, title_en, slug, country_id
      )
    `)
    .gte('created_at', cutoffTime)
    .order('created_at', { ascending: false });

  if (!recentMentions || recentMentions.length === 0) return [];

  const countryIds = [...new Set(recentMentions
    .filter(m => m.news_item)
    .map(m => (m.news_item as any).country_id))];
  
  const { data: countries } = await supabase
    .from('news_countries')
    .select('id, code')
    .in('id', countryIds);

  const countryMap = new Map((countries || []).map(c => [c.id, c.code.toLowerCase()]));

  const entityMap = new Map<string, WikiEntityWithNews>();

  for (const mention of recentMentions) {
    if (!mention.wiki_entity || !mention.news_item) continue;

    const entity = mention.wiki_entity as any;
    const newsItem = mention.news_item as any;

    if (!entityMap.has(entity.id)) {
      entityMap.set(entity.id, {
        entity,
        mentionCount: 0,
        news: []
      });
    }

    const existing = entityMap.get(entity.id)!;
    existing.mentionCount++;

    if (existing.news.length < 4 && !existing.news.some(n => n.id === newsItem.id) && newsItem.slug) {
      existing.news.push({
        id: newsItem.id,
        title: newsItem.title,
        title_en: newsItem.title_en,
        slug: newsItem.slug,
        countryCode: countryMap.get(newsItem.country_id) || 'us'
      });
    }
  }

  return Array.from(entityMap.values())
    .filter(e => e.entity.image_url)
    .sort((a, b) => b.mentionCount - a.mentionCount)
    .slice(0, 5);
}

export const TrendingWikiEntities = memo(function TrendingWikiEntities() {
  const { language } = useLanguage();

  const { data: trendingEntities24h = [], isLoading: isLoading24h } = useQuery({
    queryKey: ['trending-wiki-entities-24h', language],
    queryFn: () => fetchTrendingEntities(24),
    staleTime: 1000 * 60 * 5,
  });

  const { data: trendingEntitiesWeek = [], isLoading: isLoadingWeek } = useQuery({
    queryKey: ['trending-wiki-entities-week', language],
    queryFn: () => fetchTrendingEntities(24 * 7),
    staleTime: 1000 * 60 * 10,
  });

  const isLoading = isLoading24h || isLoadingWeek;

  if (isLoading) {
    return (
      <section className="py-8 border-b border-border bg-muted/30">
        <div className="container mx-auto px-4">
          <Skeleton className="h-8 w-64 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (trendingEntities24h.length === 0 && trendingEntitiesWeek.length === 0) return null;

  const renderEntityCard = (item: WikiEntityWithNews, idx: number) => {
    const name = language === 'en' && item.entity.name_en ? item.entity.name_en : item.entity.name;
    const description = language === 'en' && item.entity.description_en 
      ? item.entity.description_en 
      : item.entity.description;
    const wikiUrl = language === 'en' && item.entity.wiki_url_en 
      ? item.entity.wiki_url_en 
      : item.entity.wiki_url;

    return (
      <Card 
        key={item.entity.id} 
        className="overflow-hidden hover:shadow-md transition-shadow animate-fade-in"
        style={{ animationDelay: `${idx * 75}ms` }}
      >
        <CardContent className="p-0">
          <div className="flex items-start gap-3 p-3">
            {item.entity.image_url && (
              <img 
                src={getOptimizedUrl(item.entity.image_url, 128)} 
                alt={name}
                className="w-16 h-16 object-cover rounded-lg shrink-0"
                loading="lazy"
                width={64}
                height={64}
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-1">
                <h3 className="font-medium text-sm line-clamp-1">{name}</h3>
                <a 
                  href={wikiUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary shrink-0"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              {description && (
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                  {description}
                </p>
              )}
              <div className="flex items-center gap-1 mt-1">
                <Sparkles className="w-3 h-3 text-primary" />
                <span className="text-[10px] text-primary font-medium">
                  {item.mentionCount} {language === 'uk' ? 'згадок' : language === 'pl' ? 'wzmianek' : 'mentions'}
                </span>
              </div>
            </div>
          </div>

          {item.news.length > 0 && (
            <div className="border-t border-border px-3 py-2 space-y-1 bg-muted/20">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {language === 'uk' ? 'Новини:' : language === 'pl' ? 'Wiadomości:' : 'News:'}
              </span>
              {item.news.slice(0, 4).map(news => {
                const newsTitle = language === 'en' && news.title_en ? news.title_en : news.title;
                return (
                  <Link
                    key={news.id}
                    to={`/news/${news.countryCode}/${news.slug}`}
                    className="block text-xs text-foreground hover:text-primary line-clamp-1 transition-colors"
                  >
                    → {newsTitle}
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <section className="py-8 border-b border-border bg-gradient-to-b from-muted/30 to-transparent">
      <div className="container mx-auto px-4 space-y-8">
        {/* 24 Hours Trending */}
        {trendingEntities24h.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">
                {language === 'uk' ? 'Популярні персони та компанії' : language === 'pl' ? 'Popularne osoby i firmy' : 'Trending People & Companies'}
              </h2>
              <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded-full">
                {language === 'uk' ? 'за 24 год' : language === 'pl' ? '24 godz.' : '24h'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {trendingEntities24h.map((item, idx) => renderEntityCard(item, idx))}
            </div>
          </div>
        )}

        {/* Weekly Trending */}
        {trendingEntitiesWeek.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-semibold">
                {language === 'uk' ? 'Популярні за тиждень' : language === 'pl' ? 'Popularne w tym tygodniu' : 'Trending This Week'}
              </h2>
              <span className="text-xs text-muted-foreground px-2 py-0.5 bg-amber-500/10 text-amber-600 rounded-full">
                {language === 'uk' ? '7 днів' : language === 'pl' ? '7 dni' : '7 days'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {trendingEntitiesWeek.map((item, idx) => renderEntityCard(item, idx))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
});
