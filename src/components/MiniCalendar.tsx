import { useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, startOfWeek, endOfWeek, isSameWeek } from "date-fns";
import { uk, enUS, pl } from "date-fns/locale";
import { ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Part } from "@/types/database";

interface Chapter {
  id: string;
  title: string;
  week_of_month: number;
  volume_id: string;
}

interface MiniCalendarProps {
  parts: Part[];
  chapters?: Chapter[];
}

export function MiniCalendar({ parts, chapters = [] }: MiniCalendarProps) {
  const { language, t } = useLanguage();
  const dateLocale = language === 'en' ? enUS : language === 'pl' ? pl : uk;
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get all parts for a specific date (count)
  const getPartsForDate = (date: Date) => {
    return parts.filter(p => isSameDay(new Date(p.date), date));
  };

  // Get chapter for a specific week
  const getChapterForWeek = (date: Date, weekOfMonth: number) => {
    return chapters.find(c => c.week_of_month === weekOfMonth);
  };

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));

  const dayLabels = language === 'en' 
    ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
    : language === 'pl' 
    ? ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd']
    : ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

  return (
    <Card className="cosmic-card overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 transition-all duration-200 hover:scale-110 active:scale-95" 
            onClick={prevMonth}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <CardTitle className="text-sm font-mono">
            {format(currentDate, 'LLLL yyyy', { locale: dateLocale })}
          </CardTitle>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 transition-all duration-200 hover:scale-110 active:scale-95" 
            onClick={nextMonth}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {dayLabels.map(day => (
            <div key={day} className="text-center text-xs font-mono text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: (monthStart.getDay() + 6) % 7 }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}
          
          {daysInMonth.map(day => {
            const dayParts = getPartsForDate(day);
            const partCount = dayParts.length;
            const hasParts = partCount > 0;
            
            return hasParts ? (
              <Link
                key={day.toISOString()}
                to={`/date/${format(day, 'yyyy-MM-dd')}`}
                className={`
                  aspect-square flex flex-col items-center justify-center text-xs rounded-sm
                  transition-all duration-200 hover:scale-110 active:scale-95 relative
                  ${isToday(day) ? 'font-bold ring-1 ring-primary' : ''}
                  bg-primary/20 text-primary hover:bg-primary/30 hover:shadow-md
                `}
              >
                <span>{format(day, 'd')}</span>
                {partCount > 1 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-secondary text-secondary-foreground rounded-full text-[10px] flex items-center justify-center font-bold animate-scale-in">
                    {partCount}
                  </span>
                )}
                {partCount === 1 && (
                  <span className="absolute bottom-0.5 w-1 h-1 bg-primary rounded-full" />
                )}
              </Link>
            ) : (
              <div
                key={day.toISOString()}
                className={`
                  aspect-square flex items-center justify-center text-xs rounded-sm
                  ${isToday(day) ? 'font-bold text-primary' : 'text-muted-foreground'}
                `}
              >
                {format(day, 'd')}
              </div>
            );
          })}
        </div>

        {/* Chapters for this month */}
        {chapters.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border space-y-2">
            <span className="text-xs font-mono text-muted-foreground uppercase">
              {t('chapters.title')}
            </span>
            {chapters.map((chapter, index) => (
              <Link 
                key={chapter.id}
                to={`/chapter/${chapter.id}`}
                className="flex items-center gap-2 p-2 rounded-sm bg-secondary/30 hover:bg-secondary/50 transition-all duration-200 hover:translate-x-1 active:scale-[0.98] animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <BookOpen className="w-3 h-3 text-primary shrink-0" />
                <span className="text-xs truncate">{chapter.title}</span>
                <span className="text-[10px] font-mono text-muted-foreground ml-auto shrink-0">
                  {t('week').charAt(0).toUpperCase()}{chapter.week_of_month}
                </span>
              </Link>
            ))}
          </div>
        )}

        <Link to="/calendar">
          <Button variant="outline" size="sm" className="w-full mt-4 text-xs transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]">
            {t('calendar.view_full')}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
