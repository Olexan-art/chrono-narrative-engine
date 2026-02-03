import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, subMonths, addMonths } from "date-fns";
import { uk } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Newspaper, ExternalLink, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";

interface NewsCount {
  date: string;
  count: number;
}

interface NewsItem {
  id: string;
  title: string;
  slug: string | null;
  published_at: string | null;
  created_at: string;
  country: {
    code: string;
    flag: string;
  };
}

export function NewsCalendarPanel() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Fetch news counts per day for the current month
  const { data: newsCounts = [], isLoading: isLoadingCounts } = useQuery({
    queryKey: ['admin-news-calendar', format(currentMonth, 'yyyy-MM')],
    queryFn: async () => {
      const startDate = format(monthStart, 'yyyy-MM-dd');
      const endDate = format(monthEnd, 'yyyy-MM-dd');
      
      const { data } = await supabase
        .from('news_rss_items')
        .select('created_at')
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`);

      // Group by date
      const counts: Record<string, number> = {};
      (data || []).forEach((item) => {
        const date = format(new Date(item.created_at), 'yyyy-MM-dd');
        counts[date] = (counts[date] || 0) + 1;
      });

      return Object.entries(counts).map(([date, count]) => ({ date, count }));
    },
  });

  // Fetch news for selected date
  const { data: selectedDateNews = [], isLoading: isLoadingNews } = useQuery({
    queryKey: ['admin-news-by-date', selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null],
    queryFn: async () => {
      if (!selectedDate) return [];
      
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const { data } = await supabase
        .from('news_rss_items')
        .select(`
          id, title, slug, published_at, created_at,
          country:news_countries(code, flag)
        `)
        .gte('created_at', `${dateStr}T00:00:00`)
        .lte('created_at', `${dateStr}T23:59:59`)
        .order('created_at', { ascending: false })
        .limit(100);

      return data as unknown as NewsItem[];
    },
    enabled: !!selectedDate,
  });

  const getCountForDate = (date: Date): number => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return newsCounts.find(c => c.date === dateStr)?.count || 0;
  };

  const dayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

  return (
    <Card className="cosmic-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-primary" />
          Календар новин
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Calendar */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <h3 className="text-lg font-semibold">
                {format(currentMonth, 'LLLL yyyy', { locale: uk })}
              </h3>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {isLoadingCounts ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-7 gap-1">
                  {dayLabels.map(day => (
                    <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {/* Empty cells for days before month start */}
                  {Array.from({ length: (monthStart.getDay() + 6) % 7 }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square" />
                  ))}
                  
                  {daysInMonth.map(day => {
                    const count = getCountForDate(day);
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    
                    return (
                      <Button
                        key={day.toISOString()}
                        variant={isSelected ? "default" : "ghost"}
                        className={`
                          aspect-square flex flex-col items-center justify-center p-1 h-auto relative
                          ${isToday(day) ? 'ring-1 ring-primary' : ''}
                          ${count > 0 ? 'hover:bg-primary/10' : 'opacity-50'}
                        `}
                        onClick={() => count > 0 && setSelectedDate(day)}
                        disabled={count === 0}
                      >
                        <span className="text-sm">{format(day, 'd')}</span>
                        {count > 0 && (
                          <Badge 
                            variant="secondary" 
                            className="text-[10px] h-4 px-1 absolute -top-1 -right-1"
                          >
                            {count}
                          </Badge>
                        )}
                      </Button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Selected date news */}
          <div className="space-y-4">
            {selectedDate ? (
              <>
                <h3 className="text-lg font-semibold">
                  Новини за {format(selectedDate, 'd MMMM yyyy', { locale: uk })}
                </h3>
                
                {isLoadingNews ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2 pr-4">
                      {selectedDateNews.map((item) => (
                        <Card key={item.id} className="p-3 hover:bg-accent/50 transition-colors">
                          <div className="space-y-2">
                            <div className="flex items-start gap-2">
                              {item.country && (
                                <span className="text-lg shrink-0">{item.country.flag}</span>
                              )}
                              <p className="text-sm line-clamp-2 flex-1">{item.title}</p>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(item.created_at), 'HH:mm')}
                              </span>
                              {item.slug && item.country && (
                                <Button asChild variant="ghost" size="sm" className="h-6 text-xs">
                                  <Link to={`/news/${item.country.code.toLowerCase()}/${item.slug}`}>
                                    <ExternalLink className="w-3 h-3 mr-1" />
                                    Відкрити
                                  </Link>
                                </Button>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                <p className="text-sm">Виберіть день для перегляду новин</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
