import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek, getMonth, getYear } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { SEOHead } from "@/components/SEOHead";
import { HeroSection } from "@/components/home/HeroSection";
import { StructureSection } from "@/components/home/StructureSection";
import { LatestStoriesSection } from "@/components/home/LatestStoriesSection";
import { CountryNewsSection } from "@/components/home/CountryNewsSection";
import { ChaptersSection } from "@/components/home/ChaptersSection";
import { InfiniteNewsFeed } from "@/components/home/InfiniteNewsFeed";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Part } from "@/types/database";

const STORIES_COUNT = 6;
const CHAPTERS_COUNT = 6;

export default function Index() {
  const { t, language } = useLanguage();
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  // Latest published parts for hero and stories section
  const { data: latestParts = [] } = useQuery({
    queryKey: ['latest-parts-home', language],
    queryFn: async () => {
      const { data } = await supabase
        .from('parts')
        .select('id, title, title_en, title_pl, content, content_en, content_pl, date, status, tweets, tweets_en, tweets_pl, cover_image_url, cover_image_type, news_sources, number, is_flash_news, category, manual_images')
        .eq('status', 'published')
        .order('date', { ascending: false })
        .limit(STORIES_COUNT);
      
      return (data || []) as unknown as Part[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Week parts for narrative summary
  const { data: weekParts = [] } = useQuery({
    queryKey: ['week-parts', format(weekStart, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data } = await supabase
        .from('parts')
        .select('id, title, date, status')
        .eq('status', 'published')
        .gte('date', format(weekStart, 'yyyy-MM-dd'))
        .lte('date', format(weekEnd, 'yyyy-MM-dd'))
        .order('date', { ascending: true });
      return (data || []) as Part[];
    },
    staleTime: 1000 * 60 * 10,
  });

  // Latest chapters
  const { data: allChapters = [] } = useQuery({
    queryKey: ['latest-chapters-home', language],
    queryFn: async () => {
      const { data } = await supabase
        .from('chapters')
        .select(`
          id, title, title_en, title_pl,
          description, description_en, description_pl,
          number, week_of_month,
          cover_image_url, narrator_monologue, narrator_commentary,
          volume:volumes(title, title_en, title_pl)
        `)
        .not('narrator_monologue', 'is', null)
        .order('created_at', { ascending: false })
        .limit(CHAPTERS_COUNT);
      return data || [];
    },
    staleTime: 1000 * 60 * 10,
  });

  return (
    <div className="min-h-screen bg-background">
      <SEOHead />
      <Header />
      
      {/* Hero Section */}
      <HeroSection latestParts={latestParts} />
      
      {/* Structure Explainer */}
      <StructureSection />
      
      {/* Latest Stories - Grid layout */}
      <LatestStoriesSection parts={latestParts} />
      
      {/* News by Country - 6 per country */}
      <CountryNewsSection />
      
      {/* Chapters Section */}
      <ChaptersSection chapters={allChapters} />
      
      {/* Infinite News Feed */}
      <InfiniteNewsFeed />
      
      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground font-mono">
            {t('footer.style')}
          </p>
        </div>
      </footer>
    </div>
  );
}
