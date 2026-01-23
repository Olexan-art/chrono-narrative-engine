import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar, BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import type { Part } from "@/types/database";

function parseContentWithLinks(content: string): React.ReactNode {
  // Parse markdown-style links [text](url)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    // Add text before the link
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    
    // Add the link
    parts.push(
      <a
        key={match.index}
        href={match[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="news-link"
      >
        {match[1]}
      </a>
    );
    
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts.length > 0 ? parts : content;
}

export default function ReadPage() {
  const { date } = useParams<{ date: string }>();

  const { data: part, isLoading, error } = useQuery({
    queryKey: ['read-part', date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts')
        .select(`
          *,
          chapter:chapters(
            *,
            volume:volumes(*)
          )
        `)
        .eq('date', date)
        .maybeSingle();
      
      if (error) throw error;
      return data as any;
    },
    enabled: !!date
  });

  const { data: adjacentParts } = useQuery({
    queryKey: ['adjacent-parts', date],
    queryFn: async () => {
      const [prevResult, nextResult] = await Promise.all([
        supabase
          .from('parts')
          .select('date, title')
          .lt('date', date)
          .eq('status', 'published')
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('parts')
          .select('date, title')
          .gt('date', date)
          .eq('status', 'published')
          .order('date', { ascending: true })
          .limit(1)
          .maybeSingle()
      ]);

      return {
        prev: prevResult.data,
        next: nextResult.data
      };
    },
    enabled: !!date
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!part) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-16 text-center">
          <BookOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Частину не знайдено</h1>
          <p className="text-muted-foreground mb-8">
            Для цієї дати ще немає опублікованого оповідання
          </p>
          <Link to="/calendar">
            <Button className="gap-2">
              <Calendar className="w-4 h-4" />
              Переглянути календар
            </Button>
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <article className="max-w-3xl mx-auto">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8 font-mono">
            {part.chapter?.volume && (
              <>
                <span>{part.chapter.volume.title}</span>
                <span>/</span>
              </>
            )}
            {part.chapter && (
              <>
                <span>{part.chapter.title}</span>
                <span>/</span>
              </>
            )}
            <span className="text-foreground">
              {format(new Date(part.date), 'd MMMM yyyy', { locale: uk })}
            </span>
          </div>

          {/* Cover Image */}
          {part.cover_image_url && (
            <div className="mb-8 -mx-4 md:mx-0">
              <img 
                src={part.cover_image_url} 
                alt={part.title}
                className="w-full max-h-96 object-cover border-y md:border border-border"
              />
            </div>
          )}

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-serif font-bold mb-4 text-glow">
            {part.title}
          </h1>

          {/* Meta */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-8 font-mono">
            <span>ЧАСТИНА {part.number}</span>
            <span>•</span>
            <span>{format(new Date(part.date), 'd MMMM yyyy', { locale: uk })}</span>
          </div>

          {/* Content */}
          <div className="prose font-serif text-lg leading-relaxed text-foreground">
            {part.content.split('\n\n').map((paragraph, i) => (
              <p key={i} className="mb-6">
                {parseContentWithLinks(paragraph)}
              </p>
            ))}
          </div>

          {/* News Sources */}
          {part.news_sources && part.news_sources.length > 0 && (
            <div className="mt-12 pt-8 border-t border-border">
              <h3 className="text-sm font-mono text-muted-foreground mb-4">
                ДЖЕРЕЛА РЕАЛЬНИХ ПОДІЙ
              </h3>
              <ul className="space-y-2">
                {part.news_sources.map((source, i) => (
                  <li key={i}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm news-link"
                    >
                      {source.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex items-center justify-between mt-12 pt-8 border-t border-border">
            {adjacentParts?.prev ? (
              <Link to={`/read/${adjacentParts.prev.date}`}>
                <Button variant="outline" className="gap-2">
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Попередня</span>
                </Button>
              </Link>
            ) : (
              <div />
            )}
            
            <Link to="/calendar">
              <Button variant="ghost" size="icon">
                <Calendar className="w-5 h-5" />
              </Button>
            </Link>
            
            {adjacentParts?.next ? (
              <Link to={`/read/${adjacentParts.next.date}`}>
                <Button variant="outline" className="gap-2">
                  <span className="hidden sm:inline">Наступна</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
            ) : (
              <div />
            )}
          </nav>
        </article>
      </main>
    </div>
  );
}
