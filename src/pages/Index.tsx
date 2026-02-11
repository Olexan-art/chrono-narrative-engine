import { lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { SEOHead } from "@/components/SEOHead";
import { HeroSection } from "@/components/home/HeroSection";
import { LatestUsaNews } from "@/components/home/LatestUsaNews";
import { LatestUsaNewsSimple } from "@/components/home/LatestUsaNewsSimple";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Part } from "@/types/database";

// Lazy load below-the-fold sections to reduce main-thread work
const OutrageInkSection = lazy(() => import("@/components/home/OutrageInkSection").then(m => ({ default: m.OutrageInkSection })));
const TrendingWikiEntities = lazy(() => import("@/components/home/TrendingWikiEntities").then(m => ({ default: m.TrendingWikiEntities })));
const LatestStoriesSection = lazy(() => import("@/components/home/LatestStoriesSection").then(m => ({ default: m.LatestStoriesSection })));
const StructureSection = lazy(() => import("@/components/home/StructureSection").then(m => ({ default: m.StructureSection })));
const CountryNewsSection = lazy(() => import("@/components/home/CountryNewsSection").then(m => ({ default: m.CountryNewsSection })));
const ChaptersSection = lazy(() => import("@/components/home/ChaptersSection").then(m => ({ default: m.ChaptersSection })));
const InfiniteNewsFeed = lazy(() => import("@/components/home/InfiniteNewsFeed").then(m => ({ default: m.InfiniteNewsFeed })));

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

  const pageTitle = language === 'en' 
    ? 'Synchronization Point - Smart News, Real News' 
    : language === 'pl' 
    ? 'Punkt Synchronizacji - Smart News, Real News'
    : 'Точка Синхронізації - Smart News, Real News';
  
  const pageDescription = language === 'en'
    ? 'A book that writes itself. An archivist structures the chaos of human history through the lens of news, generating daily stories from real-world news.'
    : language === 'pl'
    ? 'Książka, która pisze się sama. Archiwista porządkuje chaos ludzkiej historii przez pryzmat wiadomości, generując codzienne opowiadania z prawdziwych wiadomości.'
    : 'Книга, що пише себе сама. Архіваріус структурує хаос людської історії крізь призму новин, генеруючи щоденні оповідання з реальних подій.';

  return (
    <div className="min-h-screen bg-background">
      <SEOHead 
        title={pageTitle}
        description={pageDescription}
        canonicalUrl="https://echoes2.com/"
        keywords={['AI', 'science fiction', 'news', 'narrative', 'Ukraine', 'наукова фантастика', 'новини', 'ШІ']}
      />
      <Header />
      
      <main>
        {/* Hero Section */}
        <HeroSection />
        
        {/* Latest USA Retold News */}
        <LatestUsaNews />
        
        {/* Latest USA News (simple, no retelling) */}
        <LatestUsaNewsSimple />
        
        <Suspense fallback={<div className="min-h-[200px]" />}>
          {/* Outrage Ink Section - above Trending */}
          <OutrageInkSection />
          
          {/* Trending Wiki Entities (12h) */}
          <TrendingWikiEntities />
          
          {/* Latest Stories - Grid layout */}
          <LatestStoriesSection parts={latestParts} />
          
          {/* Structure Explainer */}
          <StructureSection />
          
          {/* News by Country - 6 per country */}
          <CountryNewsSection />
          
          {/* Chapters Section */}
          <ChaptersSection chapters={allChapters} />
          
          {/* Infinite News Feed */}
          <InfiniteNewsFeed />
        </Suspense>
      </main>
      
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
