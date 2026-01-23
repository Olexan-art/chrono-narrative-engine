import { useParams, Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { uk, enUS, pl } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar, BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { CharacterChat } from "@/components/CharacterChat";
import { TweetCard } from "@/components/TweetCard";
import { supabase } from "@/integrations/supabase/client";
import { useTrackView } from "@/hooks/useTrackView";
import { useLanguage } from "@/contexts/LanguageContext";

function parseContentWithLinks(content: string): React.ReactNode {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    
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

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts.length > 0 ? parts : content;
}

export default function ReadPage() {
  const { date } = useParams<{ date: string }>();
  const [searchParams] = useSearchParams();
  const partId = searchParams.get('id');
  const { language, t } = useLanguage();
  const dateLocale = language === 'en' ? enUS : language === 'pl' ? pl : uk;

  const { data: parts = [], isLoading } = useQuery({
    queryKey: ['read-parts', date],
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
        .eq('status', 'published')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!date
  });

  // Select which part to display
  const part = partId 
    ? parts.find((p: any) => p.id === partId) || parts[0]
    : parts[0];

  // Track view
  useTrackView('part', part?.id);

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
          <h1 className="text-2xl font-bold mb-2">
            {language === 'en' ? 'Part not found' : language === 'pl' ? 'Nie znaleziono części' : 'Частину не знайдено'}
          </h1>
          <p className="text-muted-foreground mb-8">
            {language === 'en' ? 'No published story for this date yet' : language === 'pl' ? 'Brak opublikowanej historii dla tej daty' : 'Для цієї дати ще немає опублікованого оповідання'}
          </p>
          <Link to="/calendar">
            <Button className="gap-2">
              <Calendar className="w-4 h-4" />
              {language === 'en' ? 'View Calendar' : language === 'pl' ? 'Zobacz Kalendarz' : 'Переглянути календар'}
            </Button>
          </Link>
        </main>
      </div>
    );
  }

  // Get localized content based on selected language
  const getLocalizedTitle = () => {
    if (language === 'en' && part.title_en) return part.title_en;
    if (language === 'pl' && part.title_pl) return part.title_pl;
    return part.title;
  };

  const getLocalizedContent = () => {
    if (language === 'en' && part.content_en) return part.content_en;
    if (language === 'pl' && part.content_pl) return part.content_pl;
    return part.content;
  };

  const localizedTitle = getLocalizedTitle();
  const localizedContent = getLocalizedContent();

  // Parse chat dialogue and tweets from JSONB
  const chatDialogue = part.chat_dialogue as any[] || [];
  const tweets = part.tweets as any[] || [];

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
              {format(new Date(part.date), 'd MMMM yyyy', { locale: dateLocale })}
            </span>
          </div>

          {/* Multiple stories selector */}
          {parts.length > 1 && (
            <div className="mb-6 flex flex-wrap gap-2">
              <span className="text-xs font-mono text-muted-foreground mr-2 self-center">
                {language === 'en' ? 'STORIES:' : language === 'pl' ? 'OPOWIADANIA:' : 'ОПОВІДАННЯ:'}
              </span>
              {parts.map((p: any, idx: number) => (
                <Link
                  key={p.id}
                  to={`/read/${date}?id=${p.id}`}
                  className={`px-3 py-1 text-sm border rounded-md transition-colors ${
                    p.id === part.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  #{idx + 1}
                </Link>
              ))}
            </div>
          )}

          {/* Cover Image 1 */}
          {part.cover_image_url && (
            <div className="mb-8 -mx-4 md:mx-0">
              <img 
                src={part.cover_image_url} 
                alt={localizedTitle}
                className="w-full max-h-96 object-cover border-y md:border border-border"
              />
            </div>
          )}

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-serif font-bold mb-4 text-glow">
            {localizedTitle}
          </h1>

          {/* Meta */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-8 font-mono">
            <span>{language === 'en' ? 'PART' : language === 'pl' ? 'CZĘŚĆ' : 'ЧАСТИНА'} {part.number}</span>
            <span>•</span>
            <span>{format(new Date(part.date), 'd MMMM yyyy', { locale: dateLocale })}</span>
          </div>

          {/* Content - First Half */}
          <div className="prose font-serif text-lg leading-relaxed text-foreground">
            {localizedContent.split('\n\n').slice(0, Math.ceil(localizedContent.split('\n\n').length / 2)).map((paragraph: string, i: number) => (
              <p key={i} className="mb-6">
                {parseContentWithLinks(paragraph)}
              </p>
            ))}
          </div>

          {/* Cover Image 2 - In the middle */}
          {part.cover_image_url_2 && (
            <div className="my-10 -mx-4 md:mx-0">
              <img 
                src={part.cover_image_url_2} 
                alt={`${localizedTitle} - ${language === 'en' ? 'illustration' : language === 'pl' ? 'ilustracja' : 'ілюстрація'} 2`}
                className="w-full max-h-80 object-cover border-y md:border border-border"
              />
            </div>
          )}

          {/* Content - Second Half */}
          <div className="prose font-serif text-lg leading-relaxed text-foreground">
            {localizedContent.split('\n\n').slice(Math.ceil(localizedContent.split('\n\n').length / 2)).map((paragraph: string, i: number) => (
              <p key={`second-${i}`} className="mb-6">
                {parseContentWithLinks(paragraph)}
              </p>
            ))}
          </div>

          {/* News Sources */}
          {part.news_sources && (part.news_sources as any[]).length > 0 && (
            <div className="mt-12 pt-8 border-t border-border">
              <h3 className="text-sm font-mono text-muted-foreground mb-4">
                {language === 'en' ? 'REAL NEWS SOURCES' : language === 'pl' ? 'ŹRÓDŁA WIADOMOŚCI' : 'ДЖЕРЕЛА РЕАЛЬНИХ ПОДІЙ'}
              </h3>
              <ul className="space-y-2">
                {(part.news_sources as any[]).map((source: any, i: number) => (
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

          {/* Character Chat Dialogue */}
          <CharacterChat messages={chatDialogue} />

          {/* Tweets */}
          <TweetCard tweets={tweets} />

          {/* Navigation */}
          <nav className="flex items-center justify-between mt-12 pt-8 border-t border-border">
            {adjacentParts?.prev ? (
              <Link to={`/read/${adjacentParts.prev.date}`}>
                <Button variant="outline" className="gap-2">
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">
                    {language === 'en' ? 'Previous' : language === 'pl' ? 'Poprzedni' : 'Попередня'}
                  </span>
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
                  <span className="hidden sm:inline">
                    {language === 'en' ? 'Next' : language === 'pl' ? 'Następny' : 'Наступна'}
                  </span>
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
