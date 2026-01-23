import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek, getMonth, getYear } from "date-fns";
import { uk, enUS, pl } from "date-fns/locale";
import { Link } from "react-router-dom";
import { BookOpen, Calendar, Sparkles, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/Header";
import { MiniCalendar } from "@/components/MiniCalendar";
import { NarrativeSummary } from "@/components/NarrativeSummary";
import { HeroTweets } from "@/components/HeroTweets";
import { SEOHead } from "@/components/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Part } from "@/types/database";

const ITEMS_PER_PAGE = 10;

function getPartLabel(part: any, t: (key: string) => string): { type: 'day' | 'week' | 'month'; label: string } {
  const date = new Date(part.date);
  const dayOfWeek = date.getDay();
  const dayOfMonth = date.getDate();
  
  if (dayOfWeek === 0) {
    return { type: 'week', label: t('month') === 'MONTH' ? 'WEEK' : 'ТИЖДЕНЬ' };
  }
  
  if (dayOfMonth >= 28) {
    const nextDay = new Date(date);
    nextDay.setDate(dayOfMonth + 1);
    if (nextDay.getMonth() !== date.getMonth()) {
      return { type: 'month', label: t('month') };
    }
  }
  
  return { type: 'day', label: t('day') };
}

export default function Index() {
  const { t, language } = useLanguage();
  const dateLocale = language === 'en' ? enUS : language === 'pl' ? pl : uk;
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const [currentPage, setCurrentPage] = useState(1);

  const { data: partsData } = useQuery({
    queryKey: ['latest-parts', currentPage],
    queryFn: async () => {
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      
      const { data, count } = await supabase
        .from('parts')
        .select('id, title, content, date, status, tweets, cover_image_url', { count: 'exact' })
        .eq('status', 'published')
        .order('date', { ascending: false })
        .range(from, to);
      
      return {
        parts: (data || []) as Part[],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / ITEMS_PER_PAGE)
      };
    }
  });

  const latestParts = partsData?.parts || [];
  const totalPages = partsData?.totalPages || 1;
  const totalCount = partsData?.totalCount || 0;

  const { data: weekParts = [] } = useQuery({
    queryKey: ['week-parts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('parts')
        .select('id, title, date, status')
        .eq('status', 'published')
        .gte('date', format(weekStart, 'yyyy-MM-dd'))
        .lte('date', format(weekEnd, 'yyyy-MM-dd'))
        .order('date', { ascending: true });
      return (data || []) as Part[];
    }
  });

  const { data: monthData } = useQuery({
    queryKey: ['month-volume', getYear(now), getMonth(now) + 1],
    queryFn: async () => {
      const { data: volume } = await supabase
        .from('volumes')
        .select('id, title, year, month')
        .eq('year', getYear(now))
        .eq('month', getMonth(now) + 1)
        .maybeSingle();
      
      let chapter = null;
      let monthChapters: { id: string; title: string; week_of_month: number; volume_id: string }[] = [];
      
      if (volume) {
        const weekOfMonth = Math.ceil(now.getDate() / 7);
        const { data: chapterData } = await supabase
          .from('chapters')
          .select('id, title, week_of_month, volume_id')
          .eq('volume_id', volume.id)
          .eq('week_of_month', weekOfMonth)
          .maybeSingle();
        chapter = chapterData;
        
        // Get all chapters for current month for calendar
        const { data: allMonthChapters } = await supabase
          .from('chapters')
          .select('id, title, week_of_month, volume_id')
          .eq('volume_id', volume.id)
          .order('week_of_month', { ascending: true });
        monthChapters = allMonthChapters || [];
      }
      
      return { volume, chapter, monthChapters };
    }
  });

  const { data: allChapters = [] } = useQuery({
    queryKey: ['all-chapters'],
    queryFn: async () => {
      const { data } = await supabase
        .from('chapters')
        .select(`
          *,
          volume:volumes(*)
        `)
        .not('narrator_monologue', 'is', null)
        .order('created_at', { ascending: false })
        .limit(6);
      return data || [];
    }
  });

  return (
    <div className="min-h-screen bg-background">
      <SEOHead />
      <Header />
      
      {/* Hero - Split Layout */}
      <section className="relative py-8 md:py-12 overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        <div className="container mx-auto px-4 relative">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            {/* Left - Main Content */}
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 border border-primary/30 bg-primary/5 mb-3">
                <Sparkles className="w-3 h-3 text-primary" />
                <span className="text-xs font-mono text-primary">{t('hero.badge')}</span>
              </div>
              
              <h1 className="text-3xl md:text-4xl font-bold mb-2 text-glow font-sans tracking-tight">
                {t('hero.title')}
              </h1>
              
              <p className="text-sm text-muted-foreground mb-4 font-serif leading-relaxed max-w-lg mx-auto lg:mx-0">
                {t('hero.description')}
              </p>
              
              <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
                <Link to="/calendar">
                  <Button size="sm" className="gap-2">
                    <Calendar className="w-4 h-4" />
                    {t('hero.archive')}
                  </Button>
                </Link>
                {latestParts[0] && (
                  <Link to={`/read/${latestParts[0].date}`}>
                    <Button size="sm" variant="outline" className="gap-2">
                      <BookOpen className="w-4 h-4" />
                      {t('hero.latest')}
                    </Button>
                  </Link>
                )}
              </div>
            </div>

            {/* Right - Tweets Carousel */}
            <div className="lg:pl-4">
              <div className="flex items-center gap-2 mb-3 justify-center lg:justify-start">
                <span className="text-lg font-bold">MW</span>
                <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                  {t('tweets.title')}
                </span>
              </div>
              <HeroTweets parts={latestParts} />
            </div>
          </div>
        </div>
      </section>

      {/* Structure */}
      <section className="py-8 border-y border-border">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { title: t('structure.month'), desc: t('structure.month.desc') },
              { title: t('structure.week'), desc: t('structure.week.desc') },
              { title: t('structure.day'), desc: t('structure.day.desc') },
            ].map(({ title, desc }) => (
              <div key={title} className="text-center">
                <h3 className="font-mono text-sm text-primary mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground font-serif">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Main Content Grid */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Latest Parts */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold chapter-title">
                  {t('latest.title')}
                </h2>
                <Badge variant="outline" className="font-mono">
                  {totalCount} {language === 'en' ? 'stories' : language === 'pl' ? 'opowieści' : 'оповідань'}
                </Badge>
              </div>

              <div className="space-y-4">
                {latestParts.map((part) => {
                  const partLabel = getPartLabel(part, t);
                  
                  return (
                    <Link key={part.id} to={`/read/${part.date}`} className="group block">
                      <article className="cosmic-card p-4 border border-border hover:border-primary/50 transition-all">
                        <div className="flex items-start gap-4">
                          {part.cover_image_url && (
                            <img 
                              src={part.cover_image_url} 
                              alt=""
                              className="w-20 h-20 md:w-24 md:h-24 object-cover border border-border shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge 
                                variant={partLabel.type === 'day' ? 'secondary' : 'default'}
                                className="text-xs font-mono"
                              >
                                {partLabel.label}
                              </Badge>
                              <span className="text-xs font-mono text-muted-foreground">
                                {format(new Date(part.date), 'd MMMM yyyy', { locale: dateLocale })}
                              </span>
                            </div>
                            <h3 className="font-serif font-medium text-base md:text-lg group-hover:text-primary transition-colors line-clamp-1">
                              {part.title}
                            </h3>
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1 font-serif">
                              {part.content?.slice(0, 120)}...
                            </p>
                          </div>
                          <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0 hidden md:block" />
                        </div>
                      </article>
                    </Link>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {currentPage > 2 && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => setCurrentPage(1)}>1</Button>
                        {currentPage > 3 && <span className="text-muted-foreground">...</span>}
                      </>
                    )}
                    
                    {[currentPage - 1, currentPage, currentPage + 1]
                      .filter(p => p >= 1 && p <= totalPages)
                      .map(p => (
                        <Button
                          key={p}
                          variant={p === currentPage ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setCurrentPage(p)}
                        >
                          {p}
                        </Button>
                      ))}
                    
                    {currentPage < totalPages - 1 && (
                      <>
                        {currentPage < totalPages - 2 && <span className="text-muted-foreground">...</span>}
                        <Button variant="ghost" size="sm" onClick={() => setCurrentPage(totalPages)}>{totalPages}</Button>
                      </>
                    )}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <MiniCalendar parts={latestParts} chapters={monthData?.monthChapters} />
              <NarrativeSummary 
                weekParts={weekParts} 
                monthVolume={monthData?.volume}
                monthChapter={monthData?.chapter}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Chapters Section */}
      {allChapters.length > 0 && (
        <section className="py-12 border-t border-border">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold chapter-title">
                {t('chapters.title')}
              </h2>
              <Badge variant="outline" className="font-mono">
                {allChapters.length} {t('chapters.count')}
              </Badge>
            </div>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {allChapters.map((chapter: any) => (
                <Link 
                  key={chapter.id} 
                  to={`/chapter/${chapter.id}`}
                  className="group block"
                >
                  <article className="cosmic-card border border-border hover:border-primary/50 transition-all overflow-hidden h-full">
                    {/* Cover Image */}
                    <div className="relative h-48 bg-muted">
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
                          {t('chapter')} {chapter.number}
                        </Badge>
                      </div>
                    </div>
                    
                    {/* Content */}
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-mono text-muted-foreground">
                          {chapter.volume?.title || 'Том'}
                        </span>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-xs font-mono text-muted-foreground">
                          {t('week')} {chapter.week_of_month}
                        </span>
                      </div>
                      
                      <h3 className="font-serif font-medium text-lg group-hover:text-primary transition-colors line-clamp-2 mb-2">
                        {chapter.title}
                      </h3>
                      
                      {chapter.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 font-serif">
                          {chapter.description}
                        </p>
                      )}
                      
                      {/* Indicators */}
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                        {chapter.narrator_monologue && (
                          <span className="text-xs text-primary font-mono">
                            ✦ {t('monologue')}
                          </span>
                        )}
                        {chapter.narrator_commentary && (
                          <span className="text-xs text-secondary-foreground font-mono">
                            ◆ {t('commentary')}
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground font-mono">
            {t('footer.style')}
          </p>
        </div>
      </footer>
    </div>
  );
}
