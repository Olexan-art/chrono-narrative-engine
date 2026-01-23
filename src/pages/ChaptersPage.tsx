import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, getMonth, getYear } from "date-fns";
import { uk } from "date-fns/locale";
import { Link } from "react-router-dom";
import { BookOpen, ChevronLeft, ChevronRight, Filter, Sparkles, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/Header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

const ITEMS_PER_PAGE = 9;

export default function ChaptersPage() {
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch all volumes for filter
  const { data: volumes = [] } = useQuery({
    queryKey: ['volumes-filter'],
    queryFn: async () => {
      const { data } = await supabase
        .from('volumes')
        .select('id, title, year, month')
        .order('year', { ascending: false })
        .order('month', { ascending: false });
      return data || [];
    }
  });

  // Fetch chapters with pagination and filtering
  const { data: chaptersData, isLoading } = useQuery({
    queryKey: ['chapters-list', selectedMonth, currentPage],
    queryFn: async () => {
      let query = supabase
        .from('chapters')
        .select(`
          *,
          volume:volumes(*)
        `, { count: 'exact' })
        .not('narrator_monologue', 'is', null)
        .order('created_at', { ascending: false });

      // Apply month filter
      if (selectedMonth !== "all") {
        query = query.eq('volume_id', selectedMonth);
      }

      // Pagination
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      
      if (error) throw error;
      
      return {
        chapters: data || [],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / ITEMS_PER_PAGE)
      };
    }
  });

  const chapters = chaptersData?.chapters || [];
  const totalPages = chaptersData?.totalPages || 1;

  const handleMonthChange = (value: string) => {
    setSelectedMonth(value);
    setCurrentPage(1); // Reset to first page when filter changes
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Badge variant="outline" className="font-mono">АРХІВ</Badge>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold font-serif mb-4">
            Глави Тижнів
          </h1>
          <p className="text-muted-foreground font-serif">
            Повний перелік тижневих синтезів з Монологами Незнайомця та Коментарями Наратора
          </p>
        </div>

        {/* Filters */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="flex flex-wrap items-center gap-4 p-4 bg-card/50 border border-border rounded-lg">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-mono text-muted-foreground">ФІЛЬТР:</span>
            </div>
            
            <Select value={selectedMonth} onValueChange={handleMonthChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Оберіть місяць" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Усі місяці</SelectItem>
                {volumes.map((volume: any) => (
                  <SelectItem key={volume.id} value={volume.id}>
                    {volume.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {chaptersData?.totalCount !== undefined && (
              <Badge variant="secondary" className="ml-auto">
                {chaptersData.totalCount} глав
              </Badge>
            )}
          </div>
        </div>

        {/* Chapters Grid */}
        {isLoading ? (
          <div className="max-w-4xl mx-auto grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-48 bg-muted rounded-t-lg" />
                <div className="p-4 border border-t-0 border-border rounded-b-lg">
                  <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                  <div className="h-6 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-4 bg-muted rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : chapters.length === 0 ? (
          <div className="max-w-4xl mx-auto text-center py-16">
            <BookOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-bold mb-2">Глав ще немає</h2>
            <p className="text-muted-foreground">
              {selectedMonth !== "all" 
                ? "Для обраного місяця глав не знайдено" 
                : "Спочатку згенеруйте тижневі синтези в адмінці"}
            </p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {chapters.map((chapter: any) => (
              <Link 
                key={chapter.id} 
                to={`/chapter/${chapter.id}`}
                className="group block"
              >
                <article className="cosmic-card border border-border hover:border-primary/50 transition-all overflow-hidden h-full flex flex-col">
                  {/* Cover Image */}
                  <div className="relative h-48 bg-muted shrink-0">
                    {chapter.cover_image_url ? (
                      <img 
                        src={chapter.cover_image_url} 
                        alt={chapter.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
                        <BookOpen className="w-12 h-12 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                    
                    {/* Chapter Badge */}
                    <div className="absolute top-3 left-3">
                      <Badge className="font-mono text-xs">
                        ГЛАВА {chapter.number}
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-mono text-muted-foreground">
                        {chapter.volume?.title || 'Том'}
                      </span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-xs font-mono text-muted-foreground">
                        Тиждень {chapter.week_of_month}
                      </span>
                    </div>
                    
                    <h3 className="font-serif font-medium text-lg group-hover:text-primary transition-colors line-clamp-2 mb-2">
                      {chapter.title}
                    </h3>
                    
                    {chapter.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 font-serif flex-1">
                        {chapter.description}
                      </p>
                    )}
                    
                    {/* Indicators */}
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border">
                      {chapter.narrator_monologue && (
                        <div className="flex items-center gap-1 text-xs text-primary font-mono">
                          <Sparkles className="w-3 h-3" />
                          Монолог
                        </div>
                      )}
                      {chapter.narrator_commentary && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                          <MessageCircle className="w-3 h-3" />
                          Коментар
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="max-w-4xl mx-auto mt-8 flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <div className="flex items-center gap-1">
              {[...Array(totalPages)].map((_, i) => {
                const page = i + 1;
                // Show first, last, current, and adjacent pages
                if (
                  page === 1 ||
                  page === totalPages ||
                  Math.abs(page - currentPage) <= 1
                ) {
                  return (
                    <Button
                      key={page}
                      variant={page === currentPage ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className="w-9"
                    >
                      {page}
                    </Button>
                  );
                } else if (
                  (page === 2 && currentPage > 3) ||
                  (page === totalPages - 1 && currentPage < totalPages - 2)
                ) {
                  return <span key={page} className="px-2 text-muted-foreground">...</span>;
                }
                return null;
              })}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
