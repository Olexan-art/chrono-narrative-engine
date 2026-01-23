import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { Link } from "react-router-dom";
import { BookOpen, Calendar, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";

export default function Index() {
  const { data: latestParts = [] } = useQuery({
    queryKey: ['latest-parts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('parts')
        .select('*')
        .eq('status', 'published')
        .order('date', { ascending: false })
        .limit(5);
      return data || [];
    }
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero */}
      <section className="relative py-24 overflow-hidden">
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
              людської історії через призму наукової фантастики, перетворюючи 
              реальні новини на футуристичні оповідання.
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
      <section className="py-16 border-y border-border">
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

      {/* Latest */}
      {latestParts.length > 0 && (
        <section className="py-16">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl font-bold chapter-title text-center mb-12">
              ОСТАННІ ЗАПИСИ
            </h2>
            
            <div className="grid gap-6 max-w-2xl mx-auto">
              {latestParts.map((part: any) => (
                <Link key={part.id} to={`/read/${part.date}`} className="group">
                  <article className="cosmic-card p-6 border border-border hover:border-primary/50 transition-all">
                    <div className="flex items-start gap-4">
                      {part.cover_image_url && (
                        <img 
                          src={part.cover_image_url} 
                          alt=""
                          className="w-24 h-24 object-cover border border-border shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-muted-foreground mb-1">
                          {format(new Date(part.date), 'd MMMM yyyy', { locale: uk })}
                        </p>
                        <h3 className="font-serif font-medium text-lg group-hover:text-primary transition-colors">
                          {part.title}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1 font-serif">
                          {part.content?.slice(0, 150)}...
                        </p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
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
            Стилістика: Рей Бредбері • Артур Кларк • Ніл Гейман
          </p>
        </div>
      </footer>
    </div>
  );
}
