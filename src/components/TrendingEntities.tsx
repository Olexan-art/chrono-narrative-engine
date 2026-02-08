import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { subHours } from "date-fns";
import { TrendingUp, User, Building2, Globe, Flame } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

interface TrendingEntity {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  image_url: string | null;
  entity_type: string;
  slug: string | null;
  mention_count: number;
}

export function TrendingEntities() {
  const { language } = useLanguage();

  const { data: trendingEntities, isLoading } = useQuery({
    queryKey: ['trending-entities-72h'],
    queryFn: async () => {
      const cutoff = subHours(new Date(), 72).toISOString();

      // Get news_wiki_entities links from last 72 hours - limit to 500 for performance
      const { data: recentLinks, error: linksError } = await supabase
        .from('news_wiki_entities')
        .select('wiki_entity_id')
        .gte('created_at', cutoff)
        .limit(500);

      if (linksError) throw linksError;

      // Count mentions per entity
      const entityCounts = new Map<string, number>();
      for (const link of recentLinks || []) {
        const count = entityCounts.get(link.wiki_entity_id) || 0;
        entityCounts.set(link.wiki_entity_id, count + 1);
      }

      // Get top 4 entity IDs
      const topEntityIds = Array.from(entityCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([id]) => id);

      if (topEntityIds.length === 0) return [];

      // Fetch entity details
      const { data: entities, error: entitiesError } = await supabase
        .from('wiki_entities')
        .select('id, name, name_en, description, description_en, image_url, entity_type, slug')
        .in('id', topEntityIds);

      if (entitiesError) throw entitiesError;

      // Map with counts and sort
      const result = (entities || []).map(entity => ({
        ...entity,
        mention_count: entityCounts.get(entity.id) || 0,
      }));

      result.sort((a, b) => b.mention_count - a.mention_count);

      return result as TrendingEntity[];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes cache
  });

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'person': return <User className="w-4 h-4" />;
      case 'company': return <Building2 className="w-4 h-4" />;
      default: return <Globe className="w-4 h-4" />;
    }
  };

  const t = {
    title: language === 'uk' ? 'Топ за 72 години' : language === 'pl' ? 'Top za 72 godziny' : 'Trending (72h)',
    mentions: language === 'uk' ? 'згадок' : language === 'pl' ? 'wzmianek' : 'mentions',
  };

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Flame className="w-5 h-5 text-orange-500" />
            {t.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!trendingEntities || trendingEntities.length === 0) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-br from-orange-500/5 via-primary/5 to-transparent border-primary/20 overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Flame className="w-5 h-5 text-orange-500 animate-pulse" />
          {t.title}
          <Badge variant="outline" className="ml-2 text-orange-500 border-orange-500/30">
            HOT
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {trendingEntities.map((entity, index) => {
            const name = language === 'en' && entity.name_en ? entity.name_en : entity.name;
            const description = language === 'en' && entity.description_en 
              ? entity.description_en 
              : entity.description;

            return (
              <Link
                key={entity.id}
                to={`/wiki/${entity.slug || entity.id}`}
                className="group relative"
              >
                <Card className="overflow-hidden h-full hover:shadow-xl transition-all hover:scale-[1.02] border-2 border-transparent hover:border-primary/30">
                  {/* Ranking badge */}
                  <div className="absolute top-2 left-2 z-10">
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-lg
                      ${index === 0 ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white' :
                        index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-800' :
                        index === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white' :
                        'bg-muted text-muted-foreground'}
                    `}>
                      {index + 1}
                    </div>
                  </div>

                  <div className="aspect-square relative overflow-hidden">
                    {entity.image_url ? (
                      <img
                        src={entity.image_url}
                        alt={name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                        {getEntityIcon(entity.entity_type)}
                      </div>
                    )}
                    
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    
                    {/* Mention count */}
                    <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-primary/90 text-primary-foreground px-2 py-1 rounded-full text-xs font-bold shadow-lg">
                      <TrendingUp className="w-3 h-3" />
                      {entity.mention_count}
                    </div>
                  </div>

                  <CardContent className="p-3">
                    <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">
                      {name}
                    </h3>
                    {description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {description}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
