import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addDays, subDays } from "date-fns";
import { uk, enUS, pl } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Newspaper, Image as ImageIcon, ExternalLink, Calendar, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { SEOHead } from "@/components/SEOHead";
import { useLanguage } from "@/contexts/LanguageContext";

interface NewsItem {
  id: string;
  title: string;
  title_en: string | null;
  slug: string | null;
  published_at: string | null;
  created_at: string;
  image_url: string | null;
  country: {
    code: string;
    name: string;
    flag: string;
  };
}

interface OutrageInkItem {
  id: string;
  image_url: string;
  title: string | null;
  likes: number;
  created_at: string;
  news_item: {
    id: string;
    slug: string;
    country: {
      code: string;
    };
  } | null;
}

async function fetchAllNews(startDateStr: string, endDateStr: string): Promise<NewsItem[]> {
  const allRows: NewsItem[] = [];
  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('news_rss_items')
      .select(`id, title, title_en, slug, published_at, created_at, image_url,
               country:news_countries(code, name, flag)`)
      .gte('created_at', `${startDateStr}T00:00:00`)
      .lte('created_at', `${endDateStr}T23:59:59`)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;

    if (data && data.length > 0) {
      allRows.push(...(data as unknown as NewsItem[]));
      offset += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  return allRows;
}

async function fetchAllInk(startDateStr: string, endDateStr: string): Promise<OutrageInkItem[]> {
  const allRows: OutrageInkItem[] = [];
  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('outrage_ink')
      .select(`id, image_url, title, likes, created_at,
               news_item:news_rss_items(id, slug, country:news_countries(code))`)
      .gte('created_at', `${startDateStr}T00:00:00`)
      .lte('created_at', `${endDateStr}T23:59:59`)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;

    if (data && data.length > 0) {
      allRows.push(...(data as unknown as OutrageInkItem[]));
      offset += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  return allRows;
}

const ITEMS_PER_PAGE = 12;

export default function PublicCalendarPage() {
  const { language } = useLanguage();
  const dateLocale = language === 'en' ? enUS : language === 'pl' ? pl : uk;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [activeTab, setActiveTab] = useState<'news' | 'images'>('news');
  const [newsPage, setNewsPage] = useState(1);
  const [imagesPage, setImagesPage] = useState(1);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startDateStr = format(monthStart, 'yyyy-MM-dd');
  const endDateStr = format(monthEnd, 'yyyy-MM-dd');

  const { data: newsItems = [], isLoading: newsLoading } = useQuery({
    queryKey: ['calendar-news', startDateStr, endDateStr],
    queryFn: () => fetchAllNews(startDateStr, endDateStr)
  });

  const { data: inkItems = [], isLoading: inkLoading } = useQuery({
    queryKey: ['calendar-ink', startDateStr, endDateStr],
    queryFn: () => fetchAllInk(startDateStr, endDateStr)
  });

  const getNewsForDate = (date: Date) => newsItems.filter(n => isSameDay(new Date(n.created_at), date));
  const getInkForDate = (date: Date) => inkItems.filter(i => isSameDay(new Date(i.created_at), date));

  const dayStats = useMemo(() => {
    const stats: Record<string, { news: number; ink: number }> = {};
    daysInMonth.forEach(day => {
      const key = format(day, 'yyyy-MM-dd');
      stats[key] = {
        news: getNewsForDate(day).length,
        ink: getInkForDate(day).length
      };
    });
    return stats;
  }, [newsItems, inkItems, daysInMonth]);

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
    setNewsPage(1);
    setImagesPage(1);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
    setNewsPage(1);
    setImagesPage(1);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
    setNewsPage(1);
    setImagesPage(1);
  };

  const prevDay = () => {
    if (selectedDate) {
      const newDate = subDays(selectedDate, 1);
      setSelectedDate(newDate);
      if (newDate < monthStart) {
        setCurrentDate(new Date(newDate.getFullYear(), newDate.getMonth()));
      }
      setNewsPage(1);
      setImagesPage(1);
    }
  };

  const nextDay = () => {
    if (selectedDate) {
      const newDate = addDays(selectedDate, 1);
      setSelectedDate(newDate);
      if (newDate > monthEnd) {
        setCurrentDate(new Date(newDate.getFullYear(), newDate.getMonth()));
      }
      setNewsPage(1);
      setImagesPage(1);
    }
  };

  const dayLabels = language === 'en' 
    ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
    : language === 'pl' 
    ? ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd']
    : ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

  const labels = {
    news: language === 'en' ? 'News' : language === 'pl' ? 'Wiadomości' : 'Новини',
    images: language === 'en' ? 'Images' : language === 'pl' ? 'Obrazy' : 'Картинки',
    noNews: language === 'en' ? 'No news for this day' : language === 'pl' ? 'Brak wiadomości' : 'Немає новин за цей день',
    noImages: language === 'en' ? 'No images for this day' : language === 'pl' ? 'Brak obrazów' : 'Немає картинок за цей день',
    pageTitle: language === 'en' ? 'News & Media Calendar' : language === 'pl' ? 'Kalendarz wiadomości' : 'Календар новин та медіа',
    today: language === 'en' ? 'Today' : language === 'pl' ? 'Dziś' : 'Сьогодні',
    loading: language === 'en' ? 'Loading...' : language === 'pl' ? 'Ładowanie...' : 'Завантаження...',
  };

  const pageDescription = language === 'en' 
    ? 'Browse news articles and satirical images organized by date' 
    : language === 'pl' 
    ? 'Przeglądaj artykuły i satyryczne obrazy według daty'
    : 'Переглядайте новини та сатиричні зображення за датами';

  const selectedNews = selectedDate ? getNewsForDate(selectedDate) : [];
  const selectedInk = selectedDate ? getInkForDate(selectedDate) : [];

  const totalNewsPages = Math.ceil(selectedNews.length / ITEMS_PER_PAGE);
  const paginatedNews = selectedNews.slice((newsPage - 1) * ITEMS_PER_PAGE, newsPage * ITEMS_PER_PAGE);

  const totalImagesPages = Math.ceil(selectedInk.length / ITEMS_PER_PAGE);
  const paginatedImages = selectedInk.slice((imagesPage - 1) * ITEMS_PER_PAGE, imagesPage * ITEMS_PER_PAGE);

  const isLoading = newsLoading || inkLoading;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={labels.pageTitle}
        description={pageDescription}
        canonicalUrl="https://echoes2.com/media-calendar"
        keywords={['calendar', 'news', 'images', 'satire', 'календар', 'новини']}
      />
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={prevMonth}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <h2 className="text-xl md:text-2xl font-bold min-w-[180px] text-center">
                {format(currentDate, 'LLLL yyyy', { locale: dateLocale })}
              </h2>
              <Button variant="outline" size="icon" onClick={nextMonth}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <Button variant="secondary" size="sm" onClick={goToToday} className="gap-2">
              <Calendar className="w-4 h-4" />
              {labels.today}
            </Button>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              {labels.loading}
            </div>
          )}

          <div className="grid lg:grid-cols-[1fr_420px] gap-6">
            <div>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {dayLabels.map(day => (
                  <div key={day} className="text-center text-sm font-mono text-muted-foreground py-2">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: (monthStart.getDay() + 6) % 7 }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square" />
                ))}
                
                {daysInMonth.map(day => {
                  const key = format(day, 'yyyy-MM-dd');
                  const stats = dayStats[key] || { news: 0, ink: 0 };
                  const hasNews = stats.news > 0;
                  const hasInk = stats.ink > 0;
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  
                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => {
                        setSelectedDate(day);
                        setNewsPage(1);
                        setImagesPage(1);
                      }}
                      className={`
                        aspect-square p-1 border rounded-md transition-all relative
                        ${isToday(day) ? 'border-primary border-2' : 'border-border'}
                        ${isSelected ? 'bg-primary/20 border-primary ring-2 ring-primary/50' : 'bg-card hover:bg-muted'}
                      `}
                    >
                      <span className={`text-sm font-mono block ${isToday(day) ? 'text-primary font-bold' : 'text-foreground'}`}>
                        {format(day, 'd')}
                      </span>
                      
                      <div className="absolute bottom-1 left-1 right-1 flex gap-0.5 justify-center flex-wrap">
                        {hasNews && (
                          <div className="flex items-center gap-0.5 bg-blue-500/20 rounded px-1">
                            <Newspaper className="w-2.5 h-2.5 text-blue-500" />
                            <span className="text-[9px] text-blue-600 dark:text-blue-400">{stats.news}</span>
                          </div>
                        )}
                        {hasInk && (
                          <div className="flex items-center gap-0.5 bg-rose-500/20 rounded px-1">
                            <ImageIcon className="w-2.5 h-2.5 text-rose-500" />
                            <span className="text-[9px] text-rose-600 dark:text-rose-400">{stats.ink}</span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Newspaper className="w-4 h-4 text-blue-500" />
                  <span>{newsItems.length} {labels.news.toLowerCase()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-rose-500" />
                  <span>{inkItems.length} {labels.images.toLowerCase()}</span>
                </div>
              </div>
            </div>

            <div className="border rounded-lg p-4 bg-card">
              {selectedDate ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <Button variant="ghost" size="icon" onClick={prevDay}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <h3 className="font-bold text-lg">
                      {format(selectedDate, 'd MMMM yyyy', { locale: dateLocale })}
                    </h3>
                    <Button variant="ghost" size="icon" onClick={nextDay}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <Tabs value={activeTab} onValueChange={(v) => {
                    setActiveTab(v as 'news' | 'images');
                    setNewsPage(1);
                    setImagesPage(1);
                  }}>
                    <TabsList className="w-full mb-4">
                      <TabsTrigger value="news" className="flex-1 gap-2">
                        <Newspaper className="w-4 h-4" />
                        {labels.news} ({selectedNews.length})
                      </TabsTrigger>
                      <TabsTrigger value="images" className="flex-1 gap-2">
                        <ImageIcon className="w-4 h-4" />
                        {labels.images} ({selectedInk.length})
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="news" className="space-y-3">
                      <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {paginatedNews.length > 0 ? (
                          paginatedNews.map(news => {
                            const title = language === 'en' && news.title_en ? news.title_en : news.title;
                            const countryCode = news.country?.code?.toLowerCase();
                            const newsLink = countryCode && news.slug ? `/news/${countryCode}/${news.slug}` : null;

                            return (
                              <Card key={news.id} className="overflow-hidden">
                                <CardContent className="p-3">
                                  <div className="flex gap-3">
                                    {news.image_url && (
                                      <img src={news.image_url} alt="" className="w-16 h-16 object-cover rounded shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1 mb-1">
                                        <span className="text-lg">{news.country?.flag}</span>
                                        <Badge variant="secondary" className="text-[10px]">{news.country?.code}</Badge>
                                      </div>
                                      <p className="text-sm font-medium line-clamp-2">{title}</p>
                                      {newsLink && (
                                        <Link to={newsLink} className="text-xs text-primary hover:underline flex items-center gap-1 mt-1">
                                          <ExternalLink className="w-3 h-3" />
                                          {language === 'en' ? 'Read' : 'Читати'}
                                        </Link>
                                      )}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })
                        ) : (
                          <p className="text-muted-foreground text-center py-8">{labels.noNews}</p>
                        )}
                      </div>

                      {totalNewsPages > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-3 border-t">
                          <Button variant="outline" size="sm" onClick={() => setNewsPage(p => Math.max(1, p - 1))} disabled={newsPage === 1}>
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          <span className="text-sm text-muted-foreground">{newsPage} / {totalNewsPages}</span>
                          <Button variant="outline" size="sm" onClick={() => setNewsPage(p => Math.min(totalNewsPages, p + 1))} disabled={newsPage === totalNewsPages}>
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="images">
                      <div className="max-h-[400px] overflow-y-auto">
                        {paginatedImages.length > 0 ? (
                          <div className="grid grid-cols-2 gap-2">
                            {paginatedImages.map(ink => {
                              const newsLink = ink.news_item?.slug && ink.news_item?.country?.code
                                ? `/news/${ink.news_item.country.code.toLowerCase()}/${ink.news_item.slug}`
                                : null;

                              return (
                                <Link key={ink.id} to={newsLink || '/ink-abyss'} className="group">
                                  <div className="relative aspect-square rounded-lg overflow-hidden border">
                                    <img src={ink.image_url} alt={ink.title || 'Satirical image'} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                    {ink.likes > 0 && (
                                      <Badge className="absolute top-1 right-1 bg-background/80">👍 {ink.likes}</Badge>
                                    )}
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-center py-8">{labels.noImages}</p>
                        )}
                      </div>

                      {totalImagesPages > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-3 border-t mt-3">
                          <Button variant="outline" size="sm" onClick={() => setImagesPage(p => Math.max(1, p - 1))} disabled={imagesPage === 1}>
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          <span className="text-sm text-muted-foreground">{imagesPage} / {totalImagesPages}</span>
                          <Button variant="outline" size="sm" onClick={() => setImagesPage(p => Math.min(totalImagesPages, p + 1))} disabled={imagesPage === totalImagesPages}>
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  {language === 'en' ? 'Select a date' : 'Виберіть дату'}
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
