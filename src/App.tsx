import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { GDPRConsent } from "@/components/GDPRConsent";
import Index from "./pages/Index";
import CalendarPage from "./pages/CalendarPage";
import DateStoriesPage from "./pages/DateStoriesPage";
import ReadPage from "./pages/ReadPage";
import ChapterPage from "./pages/ChapterPage";
import ChaptersPage from "./pages/ChaptersPage";
import VolumesPage from "./pages/VolumesPage";
import VolumePage from "./pages/VolumePage";
import VolumeRedirect from "./pages/VolumeRedirect";
import ChapterRedirect from "./pages/ChapterRedirect";
import NewsHubPage from "./pages/NewsHubPage";
import CountryNewsPage from "./pages/CountryNewsPage";
import NewsArticlePage from "./pages/NewsArticlePage";
import NewsDigestRedirect from "./pages/NewsDigestRedirect";
import InkAbyssPage from "./pages/InkAbyssPage";
import SitemapPage from "./pages/SitemapPage";
import AdminPage from "./pages/AdminPage";
import EditPartPage from "./pages/EditPartPage";
import EditChapterPage from "./pages/EditChapterPage";
import InstallPage from "./pages/InstallPage";
import PrivacyPage from "./pages/PrivacyPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <GDPRConsent />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/calendar" element={<CalendarPage />} />
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
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/part/:id" element={<EditPartPage />} />
            <Route path="/admin/chapter/:id" element={<EditChapterPage />} />
            <Route path="/install" element={<InstallPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
