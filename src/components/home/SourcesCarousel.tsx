import { memo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Rss } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

interface RSSFeed {
  id: string;
  name: string;
  url: string;
  category: string;
  is_active: boolean;
}

export const SourcesCarousel = memo(function SourcesCarousel() {
  const { language } = useLanguage();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: feeds = [] } = useQuery<RSSFeed[]>({
    queryKey: ['rss-feeds-carousel'],
    queryFn: async () => {
      const { data } = await supabase
        .from('news_rss_feeds')
        .select('id, name, url, category, is_active')
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
    staleTime: 1000 * 60 * 30, // 30 min
  });

  // Auto-scroll animation
  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer || feeds.length === 0) return;

    let animationId: number;
    let scrollPosition = 0;
    const scrollSpeed = 0.5; // pixels per frame

    const animate = () => {
      scrollPosition += scrollSpeed;
      
      if (scrollContainer.scrollWidth > 0) {
        // Reset when reaching half-way (because we duplicate the items)
        if (scrollPosition >= scrollContainer.scrollWidth / 2) {
          scrollPosition = 0;
        }
        scrollContainer.scrollLeft = scrollPosition;
      }
      
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    // Pause on hover
    const handleMouseEnter = () => cancelAnimationFrame(animationId);
    const handleMouseLeave = () => {
      animationId = requestAnimationFrame(animate);
    };

    scrollContainer.addEventListener('mouseenter', handleMouseEnter);
    scrollContainer.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      cancelAnimationFrame(animationId);
      scrollContainer.removeEventListener('mouseenter', handleMouseEnter);
      scrollContainer.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [feeds.length]);

  if (feeds.length === 0) return null;

  // Get domain from URL for logo display
  const getDomain = (url: string) => {
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      return domain;
    } catch {
      return url;
    }
  };

  // Duplicate feeds for seamless loop
  const duplicatedFeeds = [...feeds, ...feeds];

  return (
    <section className="py-3 border-t border-cyan-500/20 overflow-hidden bg-background">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-1.5 h-1.5 bg-cyan-400 animate-digital-blink" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
            {language === 'uk' ? 'Джерела' : language === 'pl' ? 'Źródła' : 'Sources'}
          </span>
          <span className="text-[9px] font-mono text-muted-foreground">
            {feeds.length}
          </span>
          <div className="flex-1 h-px bg-cyan-500/20" />
          <Rss className="w-3 h-3 text-cyan-500/50" />
        </div>

        {/* Scrolling carousel */}
        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-hidden"
          style={{ scrollBehavior: 'auto' }}
        >
          {duplicatedFeeds.map((feed, idx) => (
            <div
              key={`${feed.id}-${idx}`}
              className="flex-shrink-0 group"
            >
              <div className="flex items-center gap-1.5 px-2 py-1 border border-cyan-500/20 bg-cyan-500/5 hover:border-cyan-500/40 hover:bg-cyan-500/10 transition-all">
                {/* Favicon/Logo */}
                <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${getDomain(feed.url)}&sz=32`}
                    alt=""
                    className="w-4 h-4 object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
                
                {/* Feed name */}
                <span className="text-[9px] font-mono text-foreground whitespace-nowrap">
                  {feed.name}
                </span>

                {/* Category badge */}
                {feed.category && (
                  <span className="text-[8px] font-mono text-cyan-500/60 uppercase">
                    {feed.category}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});
