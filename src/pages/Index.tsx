import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek, getMonth, getYear } from "date-fns";
import { uk } from "date-fns/locale";
import { Link } from "react-router-dom";
import { BookOpen, Calendar, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/Header";
import { MiniCalendar } from "@/components/MiniCalendar";
import { NarrativeSummary } from "@/components/NarrativeSummary";
import { supabase } from "@/integrations/supabase/client";
import type { Part } from "@/types/database";

function getPartLabel(part: any): { type: 'day' | 'week' | 'month'; label: string } {
  // This is a simplified version - in a real app you'd check if it's a special entry
  const date = new Date(part.date);
  const dayOfWeek = date.getDay();
  const dayOfMonth = date.getDate();
  
  // Sunday = summary of the week
  if (dayOfWeek === 0) {
    return { type: 'week', label: 'ТИЖДЕНЬ' };
  }
  
  // Last day of month = month summary (simplified check)
  if (dayOfMonth >= 28) {
    const nextDay = new Date(date);
    nextDay.setDate(dayOfMonth + 1);
    if (nextDay.getMonth() !== date.getMonth()) {
      return { type: 'month', label: 'МІСЯЦЬ' };
    }
  }
  
  return { type: 'day', label: 'ДЕНЬ' };
}

export default function Index() {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const { data: latestParts = [] } = useQuery({
    queryKey: ['latest-parts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('parts')
        .select('*')
        .eq('status', 'published')
        .order('date', { ascending: false })
        .limit(10);
      return (data || []) as Part[];
    }
  });

  const { data: weekParts = [] } = useQuery({
    queryKey: ['week-parts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('parts')
        .select('*')
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
        .select('*')
        .eq('year', getYear(now))
        .eq('month', getMonth(now) + 1)
        .maybeSingle();
      
      let chapter = null;
      if (volume) {
        const weekOfMonth = Math.ceil(now.getDate() / 7);
        const { data: chapterData } = await supabase
          .from('chapters')
          .select('*')
          .eq('volume_id', volume.id)
          .eq('week_of_month', weekOfMonth)
          .maybeSingle();
        chapter = chapterData;
      }
      
      return { volume, chapter };
    }
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        <div className="container mx-auto px-4 relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 border border-primary/30 bg-primary/5 mb-8">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-mono text-primary">AI-ГЕНЕРОВАНА НАУКОВА ФАНТАСТИКА</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold mb-6 text-glow font-sans tracking-tight">
              Точка Синхронізації
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-8 font-serif leading-relaxed">
              Книга, що пише сама себе. Штучний інтелект-архіватор структурує хаос 
              людської історії через призму наукової фантастики.
            </p>
            
            <div className="flex flex-wrap gap-4 justify-center">
              <Link to="/calendar">
                <Button size="lg" className="gap-2">
                  <Calendar className="w-5 h-5" />
                  Переглянути архів
                </Button>
              </Link>
              {latestParts[0] && (
                <Link to={`/read/${latestParts[0].date}`}>
                  <Button size="lg" variant="outline" className="gap-2">
                    <BookOpen className="w-5 h-5" />
                    Читати останнє
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Structure */}
      <section className="py-12 border-y border-border">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { title: 'МІСЯЦЬ → ТОМ', desc: 'Цілісна сюжетна арка глобального вектора людства' },
              { title: 'ТИЖДЕНЬ → ГЛАВА', desc: 'Синтез подій з монологом Наратора' },
              { title: 'ДЕНЬ → ЧАСТИНА', desc: 'Яскравий спалах через метафори та прогнози' },
            ].map(({ title, desc }) => (
              <div key={title} className="text-center">
                <h3 className="font-mono text-sm text-primary mb-2">{title}</h3>
                <p className="text-muted-foreground font-serif">{desc}</p>
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
              <h2 className="text-xl font-bold chapter-title mb-6">
                ОСТАННІ ЗАПИСИ
              </h2>
              
              <div className="space-y-4">
                {latestParts.map((part) => {
                  const partLabel = getPartLabel(part);
                  
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
                                {format(new Date(part.date), 'd MMMM yyyy', { locale: uk })}
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
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <MiniCalendar parts={latestParts} />
              <NarrativeSummary 
                weekParts={weekParts} 
                monthVolume={monthData?.volume}
                monthChapter={monthData?.chapter}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground font-mono">
            Стилістика: Рей Бредбері • Артур Кларк • Ніл Гейман
          </p>
        </div>
      </footer>
    </div>
  );
}
