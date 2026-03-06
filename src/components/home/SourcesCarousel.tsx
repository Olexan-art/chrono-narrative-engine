import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLogoUrl } from "@/lib/getLogoUrl";

interface RssFeed {
  id: string;
  name: string;
  url: string;
  category: string | null;
}

export const SourcesCarousel = memo(function SourcesCarousel() {
  const { language } = useLanguage();

  const { data: feeds = [] } = useQuery({
    queryKey: ['rss-feeds-carousel'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('news_rss_feeds')
        .select('id, name, url, category')
        .eq('enabled', true)
        .order('name');
      
      if (error) throw error;
      
      return (data || []) as RssFeed[];
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  if (feeds.length === 0) return null;

  // Duplicate feeds for seamless infinite scroll
  const duplicatedFeeds = [...feeds, ...feeds, ...feeds];

  return (
    <section className="py-3 border-y border-cyan-500/20 overflow-hidden bg-black/40">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-1.5 h-1.5 bg-cyan-400 animate-digital-blink" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
            {language === 'uk' ? 'Джерела' : language === 'pl' ? 'Źródła' : 'Sources'}
          </span>
          <div className="flex-1 h-px bg-cyan-500/20" />
          <span className="text-[9px] font-mono text-muted-foreground">
            {feeds.length}
          </span>
        </div>

        {/* Infinite scrolling carousel */}
        <div className="relative">
          <div className="overflow-hidden">
            <div className="flex gap-3 animate-carousel-scroll">
              {duplicatedFeeds.map((feed, idx) => {
                const logoUrl = getLogoUrl(feed.url);
                const domain = new URL(feed.url).hostname.replace('www.', '');

                return (
                  <div
                    key={`${feed.id}-${idx}`}
                    className="flex-shrink-0 flex flex-col items-center gap-1 group cursor-pointer hover:scale-105 transition-transform duration-200"
                  >
                    {/* Logo */}
                    <div className="w-10 h-10 flex items-center justify-center border border-cyan-500/30 bg-cyan-500/5 hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all">
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt={feed.name}
                          className="w-6 h-6 object-contain opacity-80 group-hover:opacity-100 transition-opacity"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-[10px] font-mono text-cyan-400 text-center leading-tight px-1">
                          {feed.name.substring(0, 3).toUpperCase()}
                        </span>
                      )}
                    </div>
                    {/* Domain */}
                    <span className="text-[8px] font-mono text-muted-foreground max-w-[40px] truncate">
                      {domain.split('.')[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes carousel-scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-33.333%);
          }
        }

        .animate-carousel-scroll {
          animation: carousel-scroll 60s linear infinite;
        }

        .animate-carousel-scroll:hover {
          animation-play-state: paused;
        }
      `}</style>
    </section>
  );
});
