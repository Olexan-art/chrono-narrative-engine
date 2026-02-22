import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { GDPRConsent } from "@/components/GDPRConsent";

// Eager: homepage (critical path)
import Index from "./pages/Index";

// Lazy: all other routes
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const PublicCalendarPage = lazy(() => import("./pages/PublicCalendarPage"));
const DateStoriesPage = lazy(() => import("./pages/DateStoriesPage"));
const ReadPage = lazy(() => import("./pages/ReadPage"));
const ChapterPage = lazy(() => import("./pages/ChapterPage"));
const ChaptersPage = lazy(() => import("./pages/ChaptersPage"));
const VolumesPage = lazy(() => import("./pages/VolumesPage"));
const VolumePage = lazy(() => import("./pages/VolumePage"));
const VolumeRedirect = lazy(() => import("./pages/VolumeRedirect"));
const ChapterRedirect = lazy(() => import("./pages/ChapterRedirect"));
const NewsHubPage = lazy(() => import("./pages/NewsHubPage"));
const CountryNewsPage = lazy(() => import("./pages/CountryNewsPage"));
const NewsArticlePage = lazy(() => import("./pages/NewsArticlePage"));
const NewsDigestRedirect = lazy(() => import("./pages/NewsDigestRedirect"));
const InkAbyssPage = lazy(() => import("./pages/InkAbyssPage"));
const SitemapPage = lazy(() => import("./pages/SitemapPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const EditPartPage = lazy(() => import("./pages/EditPartPage"));
const EditChapterPage = lazy(() => import("./pages/EditChapterPage"));
const LLMManagementPage = lazy(() => import("./pages/admin/LLMManagementPage"));
const NewsProcessingPage = lazy(() => import("./pages/admin/NewsProcessingPage"));
const LocalRetellPage = lazy(() => import("./pages/admin/LocalRetellPage"));
const LocalWikiPage = lazy(() => import("./pages/admin/LocalWikiPage"));
const InstallPage = lazy(() => import("./pages/InstallPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const DmcaPage = lazy(() => import("./pages/DmcaPage"));
const WikiCatalogPage = lazy(() => import("./pages/WikiCatalogPage"));
const WikiEntityPage = lazy(() => import("./pages/WikiEntityPage"));
const NewsTopicsCatalogPage = lazy(() => import("./pages/NewsTopicsCatalogPage"));
const NewsTopicPage = lazy(() => import("./pages/NewsTopicPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ContactPage = lazy(() => import("./pages/ContactPage"));

import { AdminGuard } from "@/components/AdminGuard";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <GDPRConsent />
          <BrowserRouter>
            <Suspense fallback={<div className="min-h-screen bg-background" />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/media-calendar" element={<PublicCalendarPage />} />
                <Route path="/date/:date" element={<DateStoriesPage />} />
                <Route path="/chapters" element={<ChaptersPage />} />
                <Route path="/volumes" element={<VolumesPage />} />
                <Route path="/volume/:yearMonth" element={<VolumePage />} />
                <Route path="/volume-legacy/:id" element={<VolumeRedirect />} />
                <Route path="/sitemap" element={<SitemapPage />} />
                <Route path="/news" element={<NewsHubPage />} />
                <Route path="/news-digest" element={<NewsDigestRedirect />} />
                <Route path="/news/:countryCode" element={<CountryNewsPage />} />
                <Route path="/news/:country/:slug" element={<NewsArticlePage />} />
                <Route path="/ink-abyss" element={<InkAbyssPage />} />
                <Route path="/read/:date" element={<ReadPage />} />
                <Route path="/read/:date/:storyNumber" element={<ReadPage />} />
                <Route path="/chapter/:number" element={<ChapterPage />} />
                <Route path="/chapter-legacy/:id" element={<ChapterRedirect />} />
                <Route element={<AdminGuard />}>
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="/admin/part/:id" element={<EditPartPage />} />
                  <Route path="/admin/chapter/:id" element={<EditChapterPage />} />
                  <Route path="/admin/llm" element={<LLMManagementPage />} />
                  <Route path="/admin/news-processing" element={<NewsProcessingPage />} />
                  <Route path="/admin/local-retell" element={<LocalRetellPage />} />
                  <Route path="/admin/local-wiki" element={<LocalWikiPage />} />
                </Route>
                <Route path="/install" element={<InstallPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/dmca" element={<DmcaPage />} />
                <Route path="/wiki" element={<WikiCatalogPage />} />
                <Route path="/wiki/:entityId" element={<WikiEntityPage />} />
                <Route path="/topics" element={<NewsTopicsCatalogPage />} />
                <Route path="/topics/:topicSlug" element={<NewsTopicPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
