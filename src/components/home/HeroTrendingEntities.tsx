import { memo } from "react";
import { getOptimizedUrl } from "@/components/OptimizedImage";
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
    .gte('created_at', cutoffTime)
    .limit(300);

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

const getSentimentStyleHero = (sentiment: string, lang: string) => {
  switch (sentiment) {
    case 'positive': return { bg: 'bg-emerald-500/15', border: 'border-emerald-500/40', text: 'text-emerald-400', icon: '🟢', label: lang === 'uk' ? 'Позитивний' : 'Positive' };
    case 'negative': return { bg: 'bg-red-500/15', border: 'border-red-500/40', text: 'text-red-400', icon: '🔴', label: lang === 'uk' ? 'Негативний' : 'Negative' };
    case 'mixed': return { bg: 'bg-amber-500/15', border: 'border-amber-500/40', text: 'text-amber-400', icon: '🟡', label: lang === 'uk' ? 'Змішаний' : 'Mixed' };
    default: return { bg: 'bg-blue-500/15', border: 'border-blue-500/40', text: 'text-blue-400', icon: '⚪', label: lang === 'uk' ? 'Нейтральний' : 'Neutral' };
  }
};

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
      <div className="grid grid-cols-3 gap-2 max-w-md">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-lg overflow-hidden border border-border/50 bg-card/50">
            <Skeleton className="w-full aspect-square" />
          </div>
        ))}
      </div>
    );
  }

  if (trendingEntities.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-3 gap-2 max-w-md">
      {trendingEntities.map((entity, idx) => {
        const name = language === 'en' && entity.name_en ? entity.name_en : entity.name;
        const wikiUrl = language === 'en' && entity.wiki_url_en ? entity.wiki_url_en : entity.wiki_url;
        const sentiment = topNarrative?.analysis && idx === 0 ? ((topNarrative.analysis as any).sentiment || 'neutral').toLowerCase() : null;
        const sStyle = sentiment ? getSentimentStyleHero(sentiment, language) : null;

        return (
          <div key={entity.id} className="relative group animate-fade-in" style={{ animationDelay: `${idx * 100}ms` }}>
            <Link
              to={`/wiki/${entity.slug || entity.id}`}
              className={`block rounded-lg overflow-hidden border bg-card/50 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:shadow-[0_8px_30px_hsl(var(--primary)/0.2)] ${
                idx === 0 && topNarrative
                  ? 'border-primary/40 shadow-[0_0_20px_hsl(var(--primary)/0.15)]'
                  : 'border-border/50 hover:border-primary/40'
              }`}
            >
              {/* Rank badge - floating top left */}
              <div className="absolute top-1.5 left-1.5 z-10 w-5 h-5 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground text-[10px] font-bold flex items-center justify-center shadow-lg backdrop-blur-sm border border-white/20">
                {idx + 1}
              </div>

              {/* Image container with gradient overlay */}
              <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-primary/10 via-accent/5 to-primary/10">
                {entity.image_url ? (
                  <>
                    <img
                      src={getOptimizedUrl(entity.image_url, 200)}
                      alt={name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity"></div>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted/50 to-muted">
                    {entity.entity_type === 'person' ? (
                      <User className="w-8 h-8 text-muted-foreground/50" />
                    ) : (
                      <Building2 className="w-8 h-8 text-muted-foreground/50" />
                    )}
                  </div>
                )}
                
                {/* Sentiment badge - top right for #1 */}
                {idx === 0 && sStyle && (
                  <div className={`absolute top-1.5 right-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${sStyle.bg} ${sStyle.border} border backdrop-blur-md animate-in fade-in duration-500`}>
                    <span className="text-[10px]">{sStyle.icon}</span>
                    <span className={`text-[9px] font-bold uppercase ${sStyle.text}`}>{sStyle.label}</span>
                  </div>
                )}

                {/* Entity name and stats - bottom overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-2 space-y-0.5">
                  <h4 className="font-semibold text-xs text-white line-clamp-1 drop-shadow-lg">
                    {name}
                  </h4>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-2.5 h-2.5 text-primary drop-shadow-lg" />
                    <span className="text-[10px] text-white/90 font-medium drop-shadow-lg">
                      {entity.mentionCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* Wiki link button - bottom right corner */}
              <a
                href={wikiUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-1.5 right-1.5 z-10 p-1 rounded-full bg-card/80 backdrop-blur-md border border-border/50 text-muted-foreground hover:text-primary hover:bg-primary/10 hover:border-primary/30 transition-all duration-300 opacity-0 group-hover:opacity-100"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </Link>

            {/* Narrative card for #1 entity */}
            {idx === 0 && topNarrative?.analysis && (() => {
              const a = topNarrative.analysis as any;
              return (
                <div className="mt-1.5 p-2 rounded-lg border border-primary/20 bg-gradient-to-br from-primary/5 via-card/80 to-accent/5 backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-700">
                  <div className="flex items-center gap-1 mb-0.5">
                    <BrainCircuit className="w-2.5 h-2.5 text-primary animate-pulse" />
                    <span className="text-[9px] font-mono text-primary uppercase tracking-wider">
                      {language === 'uk' ? 'Наратив' : 'Narrative'} {topNarrative.year_month}
                    </span>
                  </div>
                  {a.narrative_summary && (
                    <p className="text-[9px] text-muted-foreground italic line-clamp-2 leading-relaxed">
                      {a.narrative_summary}
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
});
