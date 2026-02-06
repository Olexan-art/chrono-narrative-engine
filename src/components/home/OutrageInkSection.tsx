import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Palette, ThumbsUp, ThumbsDown, ArrowRight, Sparkles, Scale } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface OutrageInkItem {
  id: string;
  image_url: string;
  title: string | null;
  likes: number;
  dislikes: number;
  created_at: string;
  news_item: {
    id: string;
    slug: string;
    country: {
      code: string;
    };
  } | null;
  entities: Array<{
    wiki_entity: {
      id: string;
      name: string;
      name_en: string | null;
    };
  }>;
}

type VoteStatus = 'majority_likes' | 'majority_dislikes' | 'balanced';

const getVoteStatus = (likes: number, dislikes: number): VoteStatus => {
  const total = likes + dislikes;
  if (total === 0) return 'balanced';
  const likeRatio = likes / total;
  if (likeRatio >= 0.6) return 'majority_likes';
  if (likeRatio <= 0.4) return 'majority_dislikes';
  return 'balanced';
};

export const OutrageInkSection = memo(function OutrageInkSection() {
  const { language } = useLanguage();

  const t = {
    title: language === 'en' ? 'Outrage Ink' : language === 'pl' ? 'Outrage Ink' : 'Outrage Ink',
    subtitle: language === 'en' ? 'Satirical Art Gallery' : language === 'pl' ? 'Galeria Satyryczna' : 'Галерея сатири',
    viewAll: language === 'en' ? 'View Gallery' : language === 'pl' ? 'Zobacz galerię' : 'Переглянути галерею',
  };

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['outrage-ink-home'],
    queryFn: async () => {
      // Get top liked from last week
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data: topLiked } = await supabase
        .from('outrage_ink')
        .select(`
          id, image_url, title, likes, dislikes, created_at,
          news_item:news_rss_items(id, slug, country:news_countries(code)),
          entities:outrage_ink_entities(wiki_entity:wiki_entities(id, name, name_en))
        `)
        .gte('created_at', weekAgo)
        .order('likes', { ascending: false })
        .limit(1);

      // Get 4 most recent
      const { data: recent } = await supabase
        .from('outrage_ink')
        .select(`
          id, image_url, title, likes, dislikes, created_at,
          news_item:news_rss_items(id, slug, country:news_countries(code)),
          entities:outrage_ink_entities(wiki_entity:wiki_entities(id, name, name_en))
        `)
        .order('created_at', { ascending: false })
        .limit(4);

      // Combine: top liked first, then recent (excluding duplicates)
      const topId = topLiked?.[0]?.id;
      const filtered = (recent || []).filter((r: any) => r.id !== topId);
      
      return [
        ...(topLiked || []),
        ...filtered.slice(0, 4)
      ].slice(0, 5) as OutrageInkItem[];
    },
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <section className="py-8 border-b border-border">
        <div className="container mx-auto px-4">
          <Skeleton className="h-8 w-48 mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="py-8 border-b border-border bg-gradient-to-r from-rose-500/5 via-transparent to-orange-500/5">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-rose-500" />
            <h2 className="text-lg font-semibold">{t.title}</h2>
            <span className="text-xs text-muted-foreground">{t.subtitle}</span>
          </div>
          <Link 
            to="/ink-abyss" 
            className="text-sm text-rose-500 hover:text-rose-600 flex items-center gap-1"
          >
            {t.viewAll}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {items.map((item, idx) => {
            const newsLink = item.news_item?.slug && item.news_item?.country?.code
              ? `/news/${item.news_item.country.code.toLowerCase()}/${item.news_item.slug}`
              : null;

            return (
              <Card 
                key={item.id} 
                className="overflow-hidden group hover:shadow-lg transition-all"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <Link to={newsLink || '/ink-abyss'} className="block">
                  <div className="relative aspect-square">
                    <img 
                      src={item.image_url} 
                      alt={item.title || 'Satirical artwork'}
                      title={item.title || undefined}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    
                    {/* Vote status badge - using qualitative labels instead of numbers */}
                    {(item.likes > 0 || item.dislikes > 0) && (() => {
                      const status = getVoteStatus(item.likes, item.dislikes);
                      const statusConfig = {
                        majority_likes: {
                          icon: ThumbsUp,
                          colorClass: 'text-emerald-500',
                          animated: true,
                        },
                        majority_dislikes: {
                          icon: ThumbsDown,
                          colorClass: 'text-rose-500',
                          animated: false,
                        },
                        balanced: {
                          icon: Scale,
                          colorClass: 'text-amber-500',
                          animated: false,
                        },
                      };
                      const config = statusConfig[status];
                      const StatusIcon = config.icon;
                      return (
                        <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
                          <StatusIcon className={cn("w-3 h-3", config.colorClass, config.animated && "animate-pulse")} />
                          {config.animated && <Sparkles className="w-2.5 h-2.5 text-emerald-500 animate-bounce" />}
                        </div>
                      );
                    })()}

                    {/* First item badge (top liked) */}
                    {idx === 0 && (
                      <Badge className="absolute top-2 left-2 bg-rose-500 text-white">
                        🔥 Top
                      </Badge>
                    )}
                  </div>

                  {/* Entity tags */}
                  {item.entities && item.entities.length > 0 && (
                    <div className="p-2 flex flex-wrap gap-1">
                      {item.entities.slice(0, 2).map((e: any) => {
                        const name = language === 'en' && e.wiki_entity?.name_en 
                          ? e.wiki_entity.name_en 
                          : e.wiki_entity?.name;
                        return name ? (
                          <Badge key={e.wiki_entity?.id} variant="secondary" className="text-[10px]">
                            {name}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  )}
                </Link>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
});