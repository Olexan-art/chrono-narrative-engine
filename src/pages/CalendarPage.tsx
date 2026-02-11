import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from "date-fns";
import { uk, enUS, pl } from "date-fns/locale";
import { ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { SEOHead } from "@/components/SEOHead";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Part } from "@/types/database";
import { useAdminStore } from "@/stores/adminStore";

export default function CalendarPage() {
  const { t, language } = useLanguage();
  const dateLocale = language === 'en' ? enUS : language === 'pl' ? pl : uk;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const { isAuthenticated } = useAdminStore();

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const { data: parts = [] } = useQuery({
    queryKey: ['parts', format(currentDate, 'yyyy-MM'), language],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts')
        .select('*')
        .gte('date', format(monthStart, 'yyyy-MM-dd'))
        .lte('date', format(monthEnd, 'yyyy-MM-dd'));
      
      if (error) throw error;
      return (data || []) as Part[];
    }
  });

  const getPartsForDate = (date: Date) => {
    return parts.filter(p => isSameDay(new Date(p.date), date));
  };

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));

  const dayLabels = language === 'en' 
    ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
    : language === 'pl' 
    ? ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd']
    : ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

  const getLocalizedTitle = (part: Part) => {
    if (language === 'en') return (part as any).title_en || part.title;
    if (language === 'pl') return (part as any).title_pl || part.title;
    return part.title;
  };

  const getLocalizedContent = (part: Part) => {
    if (language === 'en') return (part as any).content_en || part.content;
    if (language === 'pl') return (part as any).content_pl || part.content;
    return part.content;
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'published': return t('calendar.published');
      case 'scheduled': return t('calendar.scheduled');
      default: return t('calendar.draft');
    }
  };

  const pageTitle = language === 'en' ? 'Story Calendar' : language === 'pl' ? 'Kalendarz historii' : 'Календар історій';
  const pageDescription = language === 'en' 
    ? 'Browse daily AI-generated science fiction stories based on real-world news events' 
    : language === 'pl' 
    ? 'Przeglądaj codzienne historie science fiction generowane przez AI na podstawie prawdziwych wydarzeń'
    : 'Переглядайте щоденні оповідання наукової фантастики, згенеровані ШІ на основі реальних новин';

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={pageTitle}
        description={pageDescription}
        canonicalUrl="https://bravennow.com/calendar"
        keywords={['calendar', 'daily', 'stories', 'AI', 'science fiction', 'календар', 'історії']}
      />
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <Button variant="outline" size="icon" onClick={prevMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <h2 className="text-2xl font-bold chapter-title text-glow">
              {format(currentDate, 'LLLL yyyy', { locale: dateLocale })}
            </h2>
            
            <Button variant="outline" size="icon" onClick={nextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-2 mb-4">
            {dayLabels.map(day => (
              <div key={day} className="text-center text-sm font-mono text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {/* Empty cells for days before month starts */}
            {Array.from({ length: (monthStart.getDay() + 6) % 7 }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}
            
            {daysInMonth.map(day => {
              const dayParts = getPartsForDate(day);
              const hasPart = dayParts.length > 0;
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={`
                    aspect-square p-2 border transition-all relative group
                    ${isToday(day) ? 'border-primary' : 'border-border'}
                    ${isSelected ? 'bg-primary/20 border-primary border-glow' : 'bg-card hover:bg-muted'}
                    ${hasPart ? 'ring-2 ring-primary/30' : ''}
                  `}
                >
                  <span className={`
                    text-sm font-mono
                    ${isToday(day) ? 'text-primary font-bold' : 'text-foreground'}
                  `}>
                    {format(day, 'd')}
                  </span>
                  
                  {hasPart && (
                    <div className="absolute bottom-1 left-1 right-1 flex gap-0.5 justify-center">
                      {dayParts.slice(0, 3).map((p, i) => (
                        <div 
                          key={p.id}
                          className={`w-2 h-1 ${p.status === 'published' ? 'bg-primary' : 'bg-secondary'}`}
                        />
                      ))}
                      {dayParts.length > 3 && (
                        <span className="text-[8px] text-muted-foreground">+{dayParts.length - 3}</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {selectedDate && (
            <div className="mt-8 cosmic-card p-6 border">
              <h3 className="font-bold text-lg mb-4">
                {format(selectedDate, 'd MMMM yyyy', { locale: dateLocale })}
              </h3>
              
              {(() => {
                const dayParts = getPartsForDate(selectedDate);
                
                if (dayParts.length > 0) {
                  return (
                    <div className="space-y-4">
                      {dayParts.length > 1 && (
                        <p className="text-sm text-muted-foreground font-mono">
                          {dayParts.length} {t('calendar.stories_on_date')}
                        </p>
                      )}
                      
                      {dayParts.map((part, idx) => (
                        <div key={part.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                          <div className="flex items-center gap-2 mb-2">
                            {dayParts.length > 1 && (
                              <span className="text-xs font-mono text-muted-foreground">#{idx + 1}</span>
                            )}
                            <span className={`
                              px-2 py-0.5 text-xs font-mono border
                              ${part.status === 'published' ? 'border-primary text-primary' : 'border-muted-foreground text-muted-foreground'}
                            `}>
                              {getStatusLabel(part.status || 'draft')}
                            </span>
                          </div>
                          <h4 className="font-serif text-lg">{getLocalizedTitle(part)}</h4>
                          <p className="text-muted-foreground font-serif line-clamp-2 text-sm mt-1">
                            {getLocalizedContent(part).slice(0, 150)}...
                          </p>
                          <div className="flex gap-2 mt-3">
                            <Link to={`/date/${part.date}`}>
                              <Button size="sm" className="gap-2">
                                <BookOpen className="w-4 h-4" />
                                {t('calendar.view')}
                              </Button>
                            </Link>
                            {isAuthenticated && (
                              <Link to={`/admin/part/${part.id}`}>
                                <Button variant="outline" size="sm">
                                  {t('calendar.edit')}
                                </Button>
                              </Link>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                }
                
                return (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4 font-serif">
                      {t('calendar.no_parts')}
                    </p>
                    {isAuthenticated && (
                      <Link to="/admin">
                        <Button className="gap-2">
                          {t('calendar.go_to_generation')}
                        </Button>
                      </Link>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
