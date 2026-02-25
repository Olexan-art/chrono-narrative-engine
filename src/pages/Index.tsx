import { lazy, Suspense } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { HeroSection } from "@/components/home/HeroSection";
import { HomeTopicsBanner, HomeTrending14dBanner } from "@/components/home/HomeTopicsBanner";
import { LatestUsaNews } from "@/components/home/LatestUsaNews";
import { LatestUsaNewsSimple } from "@/components/home/LatestUsaNewsSimple";
import { HolidayTimeline } from "@/components/home/HolidayTimeline";
import { useLanguage } from "@/contexts/LanguageContext";

// Lazy load below-the-fold sections to reduce main-thread work
const OutrageInkSection = lazy(() => import("@/components/home/OutrageInkSection").then(m => ({ default: m.OutrageInkSection })));
const TrendingWikiEntities = lazy(() => import("@/components/home/TrendingWikiEntities").then(m => ({ default: m.TrendingWikiEntities })));
const StructureSection = lazy(() => import("@/components/home/StructureSection").then(m => ({ default: m.StructureSection })));
const CountryNewsSection = lazy(() => import("@/components/home/CountryNewsSection").then(m => ({ default: m.CountryNewsSection })));
const InfiniteNewsFeed = lazy(() => import("@/components/home/InfiniteNewsFeed").then(m => ({ default: m.InfiniteNewsFeed })));

export default function Index() {
  const { language } = useLanguage();

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

        {/* US Holidays Timeline */}
        <HolidayTimeline />

        {/* Latest USA Retold News */}
        <LatestUsaNews />

        {/* Trending topics 14d — after Full retelling */}
        <HomeTrending14dBanner />

        {/* Latest USA News (simple, no retelling) */}
        <LatestUsaNewsSimple />

        <Suspense fallback={<div className="min-h-[200px]" />}>
          {/* Outrage Ink Section - above Trending */}
          <OutrageInkSection />

          {/* Trending Wiki Entities (12h) */}
          <TrendingWikiEntities />

          {/* Structure Explainer */}
          <StructureSection />

          {/* News by Country - 6 per country */}
          <CountryNewsSection />

          {/* Paginated News Feed */}
          <InfiniteNewsFeed />
        </Suspense>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
