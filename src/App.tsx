import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Index from "./pages/Index";
import CalendarPage from "./pages/CalendarPage";
import DateStoriesPage from "./pages/DateStoriesPage";
import ReadPage from "./pages/ReadPage";
import ChapterPage from "./pages/ChapterPage";
import ChaptersPage from "./pages/ChaptersPage";
import VolumesPage from "./pages/VolumesPage";
import AdminPage from "./pages/AdminPage";
import EditPartPage from "./pages/EditPartPage";
import EditChapterPage from "./pages/EditChapterPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/date/:date" element={<DateStoriesPage />} />
            <Route path="/chapters" element={<ChaptersPage />} />
            <Route path="/volumes" element={<VolumesPage />} />
            <Route path="/read/:date" element={<ReadPage />} />
            <Route path="/chapter/:id" element={<ChapterPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/part/:id" element={<EditPartPage />} />
            <Route path="/admin/chapter/:id" element={<EditChapterPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
