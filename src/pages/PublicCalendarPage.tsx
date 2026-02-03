import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from "date-fns";
import { uk, enUS, pl } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Newspaper, Image as ImageIcon, ExternalLink } from "lucide-react";
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

export default function PublicCalendarPage() {
  const { t, language } = useLanguage();
  const dateLocale = language === 'en' ? enUS : language === 'pl' ? pl : uk;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [activeTab, setActiveTab] = useState<'news' | 'images'>('news');

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Fetch news for the month
  const { data: newsItems = [] } = useQuery({
    queryKey: ['calendar-news', format(currentDate, 'yyyy-MM')],
    queryFn: async () => {
      const { data } = await supabase
        .from('news_rss_items')
        .select(`
          id, title, title_en, slug, published_at, created_at, image_url,
          country:news_countries(code, name, flag)
        `)
        .gte('created_at', format(monthStart, 'yyyy-MM-dd'))
        .lte('created_at', format(monthEnd, 'yyyy-MM-dd') + 'T23:59:59')
        .order('created_at', { ascending: false });
      return (data || []) as NewsItem[];
    }
  });

  // Fetch outrage ink for the month
  const { data: inkItems = [] } = useQuery({
    queryKey: ['calendar-ink', format(currentDate, 'yyyy-MM')],
    queryFn: async () => {
      const { data } = await supabase
        .from('outrage_ink')
        .select(`
          id, image_url, title, likes, created_at,
          news_item:news_rss_items(id, slug, country:news_countries(code))
        `)
        .gte('created_at', format(monthStart, 'yyyy-MM-dd'))
        .lte('created_at', format(monthEnd, 'yyyy-MM-dd') + 'T23:59:59')
        .order('created_at', { ascending: false });
      return (data || []) as OutrageInkItem[];
    }
  });

  const getNewsForDate = (date: Date) => {
    return newsItems.filter(n => isSameDay(new Date(n.created_at), date));
  };

  const getInkForDate = (date: Date) => {
    return inkItems.filter(i => isSameDay(new Date(i.created_at), date));
  };

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));

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
  };

  const pageDescription = language === 'en' 
    ? 'Browse news articles and satirical images organized by date' 
    : language === 'pl' 
    ? 'Przeglądaj artykuły i satyryczne obrazy według daty'
    : 'Переглядайте новини та сатиричні зображення за датами';

  const selectedNews = selectedDate ? getNewsForDate(selectedDate) : [];
  const selectedInk = selectedDate ? getInkForDate(selectedDate) : [];

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
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-6">
            <Button variant="outline" size="icon" onClick={prevMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <h2 className="text-2xl font-bold">
              {format(currentDate, 'LLLL yyyy', { locale: dateLocale })}
            </h2>
            
            <Button variant="outline" size="icon" onClick={nextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="grid lg:grid-cols-[1fr_400px] gap-6">
            {/* Calendar Grid */}
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
                  const dayNews = getNewsForDate(day);
                  const dayInk = getInkForDate(day);
                  const hasNews = dayNews.length > 0;
                  const hasInk = dayInk.length > 0;
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  
                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => setSelectedDate(day)}
                      className={`
                        aspect-square p-1 border rounded-md transition-all relative
                        ${isToday(day) ? 'border-primary border-2' : 'border-border'}
                        ${isSelected ? 'bg-primary/20 border-primary ring-2 ring-primary/50' : 'bg-card hover:bg-muted'}
                      `}
                    >
                      <span className={`
                        text-sm font-mono block
                        ${isToday(day) ? 'text-primary font-bold' : 'text-foreground'}
                      `}>
                        {format(day, 'd')}
                      </span>
                      
                      {/* Indicators */}
                      <div className="absolute bottom-1 left-1 right-1 flex gap-1 justify-center">
                        {hasNews && (
                          <div className="flex items-center gap-0.5 bg-blue-500/20 rounded px-1">
                            <Newspaper className="w-2.5 h-2.5 text-blue-500" />
                            <span className="text-[9px] text-blue-600">{dayNews.length}</span>
                          </div>
                        )}
                        {hasInk && (
                          <div className="flex items-center gap-0.5 bg-rose-500/20 rounded px-1">
                            <ImageIcon className="w-2.5 h-2.5 text-rose-500" />
                            <span className="text-[9px] text-rose-600">{dayInk.length}</span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Date Panel */}
            <div className="border rounded-lg p-4 bg-card">
              {selectedDate ? (
                <>
                  <h3 className="font-bold text-lg mb-4">
                    {format(selectedDate, 'd MMMM yyyy', { locale: dateLocale })}
                  </h3>
                  
                  <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'news' | 'images')}>
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

                    <TabsContent value="news" className="space-y-3 max-h-[500px] overflow-y-auto">
                      {selectedNews.length > 0 ? (
                        selectedNews.map(news => {
                          const title = language === 'en' && news.title_en ? news.title_en : news.title;
                          const countryCode = (news.country as any)?.code?.toLowerCase();
                          const newsLink = countryCode && news.slug 
                            ? `/news/${countryCode}/${news.slug}` 
                            : null;

                          return (
                            <Card key={news.id} className="overflow-hidden">
                              <CardContent className="p-3">
                                <div className="flex gap-3">
                                  {news.image_url && (
                                    <img 
                                      src={news.image_url} 
                                      alt=""
                                      className="w-16 h-16 object-cover rounded shrink-0"
                                    />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1 mb-1">
                                      <span className="text-lg">{(news.country as any)?.flag}</span>
                                      <Badge variant="secondary" className="text-[10px]">
                                        {(news.country as any)?.code}
                                      </Badge>
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
                    </TabsContent>

                    <TabsContent value="images" className="max-h-[500px] overflow-y-auto">
                      {selectedInk.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2">
                          {selectedInk.map(ink => {
                            const newsLink = ink.news_item?.slug && (ink.news_item?.country as any)?.code
                              ? `/news/${(ink.news_item.country as any).code.toLowerCase()}/${ink.news_item.slug}`
                              : null;

                            return (
                              <Link 
                                key={ink.id} 
                                to={newsLink || '/ink-abyss'}
                                className="group"
                              >
                                <div className="relative aspect-square rounded-lg overflow-hidden border">
                                  <img 
                                    src={ink.image_url} 
                                    alt={ink.title || 'Satirical image'}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                  />
                                  {ink.likes > 0 && (
                                    <Badge className="absolute top-1 right-1 bg-background/80">
                                      👍 {ink.likes}
                                    </Badge>
                                  )}
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-center py-8">{labels.noImages}</p>
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
