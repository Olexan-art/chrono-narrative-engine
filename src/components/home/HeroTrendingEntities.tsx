import { memo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, ExternalLink, User, Building2, BrainCircuit } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

interface TrendingEntity {
  id: string;
  name: string;
  name_en: string | null;
  image_url: string | null;
  entity_type: string;
  slug: string | null;
  wiki_url: string;
  wiki_url_en: string | null;
  mentionCount: number;
}

async function fetchTrendingEntities24h(): Promise<TrendingEntity[]> {
  const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: recentMentions } = await supabase
    .from('news_wiki_entities')
    .select(`
      wiki_entity_id,
      wiki_entity:wiki_entities(
        id, name, name_en, image_url, entity_type, slug, wiki_url, wiki_url_en
      )
    `)
    .gte('created_at', cutoffTime);

  if (!recentMentions || recentMentions.length === 0) return [];

  // Count mentions per entity
  const entityMap = new Map<string, { entity: any; count: number }>();
  
  for (const mention of recentMentions) {
    if (!mention.wiki_entity) continue;
    const entity = mention.wiki_entity as any;
    
    const existing = entityMap.get(entity.id);
    if (existing) {
      existing.count++;
    } else {
      entityMap.set(entity.id, { entity, count: 1 });
    }
  }

  return Array.from(entityMap.values())
    .filter(e => e.entity.image_url) // Only entities with images
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map(({ entity, count }) => ({
      ...entity,
      mentionCount: count,
    }));
}

export const HeroTrendingEntities = memo(function HeroTrendingEntities() {
  const { language } = useLanguage();

  const { data: trendingEntities = [], isLoading } = useQuery({
    queryKey: ['hero-trending-entities-24h', language],
    queryFn: fetchTrendingEntities24h,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch latest narrative for the #1 trending entity
  const topEntityId = trendingEntities[0]?.id;
  const { data: topNarrative } = useQuery({
    queryKey: ['hero-narrative', topEntityId, language],
    queryFn: async () => {
      const { data } = await supabase
        .from('narrative_analyses')
        .select('analysis, year_month, news_count, is_regenerated')
        .eq('entity_id', topEntityId!)
        .eq('language', language === 'uk' ? 'uk' : 'en')
        .order('year_month', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!topEntityId,
    staleTime: 1000 * 60 * 10,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card/50">
            <Skeleton className="w-12 h-12 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (trendingEntities.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {trendingEntities.map((entity, idx) => {
        const name = language === 'en' && entity.name_en ? entity.name_en : entity.name;
        const wikiUrl = language === 'en' && entity.wiki_url_en ? entity.wiki_url_en : entity.wiki_url;
        
        return (
          <Link
            key={entity.id}
            to={`/wiki/${entity.slug || entity.id}`}
            className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card/50 hover:bg-primary/5 hover:border-primary/30 transition-all duration-300 group animate-fade-in"
            style={{ animationDelay: `${idx * 100}ms` }}
          >
            {/* Entity Image */}
            <div className="relative shrink-0">
              {entity.image_url ? (
                <img
                  src={entity.image_url}
                  alt={name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-primary/20 group-hover:border-primary/50 transition-colors"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center border-2 border-border">
                  {entity.entity_type === 'person' ? (
                    <User className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <Building2 className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              )}
              {/* Rank badge */}
              <div className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shadow-md">
                {idx + 1}
              </div>
            </div>

            {/* Entity Info */}
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm line-clamp-1 group-hover:text-primary transition-colors">
                {name}
              </h4>
              <div className="flex items-center gap-2 mt-0.5">
                <TrendingUp className="w-3 h-3 text-primary" />
                <span className="text-[11px] text-primary font-medium">
                  {entity.mentionCount} {language === 'uk' ? 'згадок' : language === 'pl' ? 'wzmianek' : 'mentions'}
                </span>
              </div>
            </div>

            {/* Wiki link */}
            <a
              href={wikiUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </Link>
        );
      })}
    </div>
  );
});
