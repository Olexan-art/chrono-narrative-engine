import { useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from "date-fns";
import { uk } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Part } from "@/types/database";

interface MiniCalendarProps {
  parts: Part[];
}

export function MiniCalendar({ parts }: MiniCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getPartForDate = (date: Date) => {
    return parts.find(p => isSameDay(new Date(p.date), date));
  };

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));

  return (
    <Card className="cosmic-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <CardTitle className="text-sm font-mono">
            {format(currentDate, 'LLLL yyyy', { locale: uk })}
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map(day => (
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
            const part = getPartForDate(day);
            
            return part ? (
              <Link
                key={day.toISOString()}
                to={`/read/${format(day, 'yyyy-MM-dd')}`}
                className={`
                  aspect-square flex items-center justify-center text-xs rounded-sm
                  transition-all hover:scale-110
                  ${isToday(day) ? 'font-bold' : ''}
                  ${part ? 'bg-primary/20 text-primary hover:bg-primary/30' : 'hover:bg-muted'}
                `}
              >
                {format(day, 'd')}
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

        <Link to="/calendar">
          <Button variant="outline" size="sm" className="w-full mt-4 text-xs">
            Повний календар
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
