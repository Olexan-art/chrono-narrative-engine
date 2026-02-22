import { lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { HeroSection } from "@/components/home/HeroSection";
import { HomeTopicsBanner } from "@/components/home/HomeTopicsBanner";
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
    ? 'BravenNow | Brave New World'
    : language === 'pl'
      ? 'BravenNow | Brave New World'
      : 'BravenNow | Brave New World';

  const pageDescription = language === 'en'
    ? 'Brave New World — A book that writes itself through smart news based on real news events.'
    : language === 'pl'
      ? 'Brave New World — Książka, która pisze się sama poprzez smart news oparte na prawdziwych wydarzeniach.'
      : 'Brave New World — Книга, що пише себе сама через розумні новини на основі реальних подій.';

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={pageTitle}
        description={pageDescription}
        canonicalUrl="https://bravennow.com/"
        keywords={['AI', 'science fiction', 'news', 'narrative', 'Ukraine', 'наукова фантастика', 'новини', 'ШІ']}
      />
      <Header />

      <main>
        {/* Hero Section */}
        <HeroSection />

        {/* Top Topics + Trending 14d */}
        <HomeTopicsBanner />

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
      <Footer />
    </div>
  );
}
