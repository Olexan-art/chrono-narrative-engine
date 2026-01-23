import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import CalendarPage from "./pages/CalendarPage";
import ReadPage from "./pages/ReadPage";
import ChapterPage from "./pages/ChapterPage";
import ChaptersPage from "./pages/ChaptersPage";
import AdminPage from "./pages/AdminPage";
import EditPartPage from "./pages/EditPartPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/chapters" element={<ChaptersPage />} />
          <Route path="/read/:date" element={<ReadPage />} />
          <Route path="/chapter/:id" element={<ChapterPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/part/:id" element={<EditPartPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
