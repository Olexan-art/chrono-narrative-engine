import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Sparkles, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";
import { uk, enUS, pl } from "date-fns/locale";

interface RelatedEntitiesNewsProps {
  newsId: string;
  countryCode: string;
  className?: string;
}

interface WikiEntity {
  id: string;
  name: string;
  name_en: string | null;
  image_url: string | null;
}

interface RelatedNewsItem {
  id: string;
  slug: string;
  title: string;
  title_en: string | null;
  image_url: string | null;
  published_at: string | null;
  country: {
    code: string;
    flag: string;
  };
  matchingEntity: WikiEntity;
}

export function RelatedEntitiesNews({ newsId, countryCode, className }: RelatedEntitiesNewsProps) {
  const { language } = useLanguage();
  const dateLocale = language === 'en' ? enUS : language === 'pl' ? pl : uk;

  // Fetch entities for this news, then find other news with same entities
  const { data: relatedNews, isLoading } = useQuery({
    queryKey: ['related-entities-news', newsId],
    queryFn: async () => {
      // First, get entities linked to this news
      const { data: entityLinks } = await supabase
        .from('news_wiki_entities')
        .select('wiki_entity_id, wiki_entity:wiki_entities(id, name, name_en, image_url)')
        .eq('news_item_id', newsId);

      if (!entityLinks || entityLinks.length === 0) return [];

      const entityIds = entityLinks.map(l => l.wiki_entity_id);
      
      // Find other news with same entities
      const { data: otherNewsLinks } = await supabase
        .from('news_wiki_entities')
        .select(`
          news_item_id,
          wiki_entity_id,
          news_item:news_rss_items(
            id, slug, title, title_en, image_url, published_at, is_archived,
            country:news_countries(code, flag)
          )
        `)
        .in('wiki_entity_id', entityIds)
        .neq('news_item_id', newsId)
        .order('created_at', { ascending: false })
        .limit(30);

      if (!otherNewsLinks) return [];

      // Group by news_item_id, keep most recent 2 unique news
      const newsMap = new Map<string, RelatedNewsItem>();
      
      for (const link of otherNewsLinks) {
        const item = link.news_item as any;
        if (!item || item.is_archived || !item.slug || newsMap.has(item.id)) continue;
        if (newsMap.size >= 5) break;
        
        // Find matching entity
        const entity = entityLinks.find(e => e.wiki_entity_id === link.wiki_entity_id)?.wiki_entity as WikiEntity;
        if (!entity) continue;

        newsMap.set(item.id, {
          id: item.id,
          slug: item.slug,
          title: item.title,
          title_en: item.title_en,
          image_url: item.image_url,
          published_at: item.published_at,
          country: item.country,
          matchingEntity: entity,
        });
      }

      return Array.from(newsMap.values());
    },
    enabled: !!newsId,
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading || !relatedNews || relatedNews.length === 0) {
    return null;
  }

  const getTitle = (item: RelatedNewsItem) => 
    language === 'en' && item.title_en ? item.title_en : item.title;

  const getEntityName = (entity: WikiEntity) =>
    language === 'en' && entity.name_en ? entity.name_en : entity.name;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          {language === 'uk' 
            ? 'Більше новин про згадані персони' 
            : language === 'pl' 
            ? 'Więcej wiadomości o wspomnianych osobach' 
            : 'More news about mentioned people'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {relatedNews.map((item) => (
          <Link
            key={item.id}
            to={`/news/${item.country.code.toLowerCase()}/${item.slug}`}
            className="flex gap-3 group hover:bg-muted/50 rounded-lg p-2 -m-2 transition-colors"
          >
            {item.image_url ? (
              <img 
                src={item.image_url} 
                alt=""
                className="w-20 h-14 object-cover rounded flex-shrink-0"
              />
            ) : (
              <div className="w-20 h-14 bg-muted rounded flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">{item.country.flag}</span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                {getTitle(item)}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-1">
                  {item.matchingEntity.image_url && (
                    <img 
                      src={item.matchingEntity.image_url} 
                      alt="" 
                      className="w-3 h-3 rounded-full object-cover"
                    />
                  )}
                  {getEntityName(item.matchingEntity)}
                </Badge>
                {item.published_at && (
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(item.published_at), 'd MMM', { locale: dateLocale })}
                  </span>
                )}
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 self-center" />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
