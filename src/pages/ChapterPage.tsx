import { useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { uk, enUS, pl } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar, BookOpen, Loader2, Sparkles, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { ChapterTweets } from "@/components/ChapterTweets";
import { ChapterChat } from "@/components/ChapterChat";
import { SEOHead } from "@/components/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { useTrackView } from "@/hooks/useTrackView";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Tweet, ChatMessage } from "@/types/database";
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

// UUID regex pattern for detecting old URLs
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ChapterPage() {
  const { number } = useParams<{ number: string }>();
  const navigate = useNavigate();
  const { language } = useLanguage();

  const isUUID = number && UUID_REGEX.test(number);
  const chapterNumber = isUUID ? 0 : Number(number);

  // If UUID is detected, fetch the chapter to get its number for redirect
  const { data: legacyChapter } = useQuery({
    queryKey: ['chapter-legacy-redirect', number],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chapters')
        .select('number')
        .eq('id', number)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!isUUID
  });

  // Redirect from UUID to friendly URL
  useEffect(() => {
    if (legacyChapter?.number) {
      navigate(`/chapter/${legacyChapter.number}`, { replace: true });
    }
  }, [legacyChapter, navigate]);

  const { data: chapter, isLoading } = useQuery({
    queryKey: ['chapter-by-number', chapterNumber],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chapters')
        .select(`
          *,
          volume:volumes(*)
        `)
        .eq('number', chapterNumber)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!chapterNumber && !isUUID
  });

  // Fetch parts for this chapter (excluding just_business category)
  const { data: parts = [] } = useQuery({
    queryKey: ['chapter-parts', chapter?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts')
        .select('*')
        .eq('chapter_id', chapter!.id)
        .or('category.is.null,category.neq.just_business')
        .order('date', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!chapter?.id
  });

  // Fetch adjacent chapters (by global chapter number, not within volume)
  const { data: adjacentChapters } = useQuery({
    queryKey: ['adjacent-chapters-global', chapterNumber],
    queryFn: async () => {
      const [prevResult, nextResult] = await Promise.all([
        supabase
          .from('chapters')
          .select('id, title, number')
          .lt('number', chapterNumber)
          .order('number', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('chapters')
          .select('id, title, number')
          .gt('number', chapterNumber)
          .order('number', { ascending: true })
          .limit(1)
          .maybeSingle()
      ]);

      return {
        prev: prevResult.data,
        next: nextResult.data
      };
    },
    enabled: !!chapterNumber
  });

  // Track view
  useTrackView('chapter', chapter?.id);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!chapter) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-16 text-center">
          <BookOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Главу не знайдено</h1>
          <p className="text-muted-foreground mb-8">
            Ця глава ще не існує
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

  // Get localized content
  const getLocalizedField = (field: string, enField: string, plField: string) => {
    if (language === 'en' && (chapter as any)[enField]) return (chapter as any)[enField];
    if (language === 'pl' && (chapter as any)[plField]) return (chapter as any)[plField];
    return (chapter as any)[field];
  };

  const localizedTitle = getLocalizedField('title', 'title_en', 'title_pl');
  const localizedDescription = getLocalizedField('description', 'description_en', 'description_pl');
  const localizedMonologue = getLocalizedField('narrator_monologue', 'narrator_monologue_en', 'narrator_monologue_pl');
  const localizedCommentary = getLocalizedField('narrator_commentary', 'narrator_commentary_en', 'narrator_commentary_pl');

  // Combine all parts content with localization
  const combinedContent = parts.map((p: any) => {
    if (language === 'en' && p.content_en) return p.content_en;
    if (language === 'pl' && p.content_pl) return p.content_pl;
    return p.content;
  }).join('\n\n---\n\n');
  
  const allNewsSources = parts.flatMap((p: any) => (p.news_sources as any[]) || []);
  
  // Get localized chat dialogue and tweets
  const getLocalizedChatDialogue = () => {
    if (language === 'en' && (chapter as any).chat_dialogue_en) return (chapter as any).chat_dialogue_en as ChatMessage[];
    if (language === 'pl' && (chapter as any).chat_dialogue_pl) return (chapter as any).chat_dialogue_pl as ChatMessage[];
    return Array.isArray(chapter.chat_dialogue) ? (chapter.chat_dialogue as unknown as ChatMessage[]) : [];
  };

  const getLocalizedTweets = () => {
    if (language === 'en' && (chapter as any).tweets_en) return (chapter as any).tweets_en as Tweet[];
    if (language === 'pl' && (chapter as any).tweets_pl) return (chapter as any).tweets_pl as Tweet[];
    return Array.isArray(chapter.tweets) ? (chapter.tweets as unknown as Tweet[]) : [];
  };

  const chapterChat = getLocalizedChatDialogue();
  const chapterTweets = getLocalizedTweets();

  const dateLocale = language === 'en' ? enUS : language === 'pl' ? pl : uk;

  // SEO: Meta title with localized chapter title
  const metaTitle = `${localizedTitle} | ${language === 'en' ? 'Synchronization Point' : language === 'pl' ? 'Punkt Synchronizacji' : 'Точка Синхронізації'}`;
  
  // SEO: Meta description - first 600 characters of combined content
  const metaDescription = combinedContent
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove markdown links, keep text
    .replace(/\n+/g, ' ') // Replace newlines with spaces
    .trim()
    .substring(0, 600);

  const canonicalUrl = `https://bravennow.com/chapter/${chapter.number}`;
  const volumeUrl = chapter.volume 
    ? `https://bravennow.com/volume/${(chapter.volume as any).year}-${String((chapter.volume as any).month).padStart(2, '0')}`
    : `https://bravennow.com/volumes`;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={metaTitle}
        description={metaDescription}
        type="article"
        image={chapter.cover_image_url || undefined}
        canonicalUrl={canonicalUrl}
        publishedAt={chapter.created_at || undefined}
        keywords={chapter.seo_keywords || ['AI', 'science fiction', 'chapter', 'narrative']}
        breadcrumbs={[
          { name: language === 'en' ? 'Home' : language === 'pl' ? 'Strona główna' : 'Головна', url: 'https://bravennow.com/' },
          { name: chapter.volume ? (chapter.volume as any).title : '', url: volumeUrl },
          { name: localizedTitle, url: canonicalUrl }
        ]}
      />
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <article className="max-w-4xl mx-auto">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8 font-mono">
            {chapter.volume && (
              <>
                <span>{(chapter.volume as any).title}</span>
                <span>/</span>
              </>
            )}
            <span className="text-foreground">{language === 'en' ? 'Week' : language === 'pl' ? 'Tydzień' : 'Тиждень'} {chapter.week_of_month}</span>
          </div>

          {/* Cover Image */}
          {chapter.cover_image_url && (
            <div className="mb-8 -mx-4 md:mx-0 relative">
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10" />
              <img 
                src={chapter.cover_image_url} 
                alt={localizedTitle}
                className="w-full max-h-[500px] object-cover border-y md:border md:rounded-lg border-border"
              />
            </div>
          )}

          {/* Chapter Badge */}
          <div className="flex items-center gap-2 mb-4">
            <span className="px-3 py-1 bg-primary/20 border border-primary/30 rounded-full text-xs font-mono text-primary">
              {language === 'en' ? 'CHAPTER' : language === 'pl' ? 'ROZDZIAŁ' : 'ГЛАВА'} {chapter.number}
            </span>
            <span className="px-3 py-1 bg-secondary/50 border border-border rounded-full text-xs font-mono text-muted-foreground">
              {language === 'en' ? 'WEEK' : language === 'pl' ? 'TYDZIEŃ' : 'ТИЖДЕНЬ'} {chapter.week_of_month}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-6 text-glow leading-tight">
            {localizedTitle}
          </h1>

          {/* Description */}
          {localizedDescription && (
            <p className="text-xl text-muted-foreground font-serif italic mb-8 border-l-2 border-primary/30 pl-4">
              {localizedDescription}
            </p>
          )}

          {/* Stranger's Monologue - MOVED TO TOP */}
          {localizedMonologue && (
            <section className="relative mb-12">
              {/* Decorative elements */}
              <div className="absolute -left-4 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-primary/50 to-transparent" />
              
              <div className="bg-gradient-to-br from-primary/5 via-card/80 to-primary/5 border border-primary/20 rounded-lg p-8 md:p-10 relative overflow-hidden">
                {/* Glow effect */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                
                {/* Header */}
                <div className="flex items-center gap-3 mb-6 relative">
                  <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-serif font-bold text-primary">
                      {language === 'en' ? "Stranger's Monologue" : language === 'pl' ? "Monolog Nieznajomego" : "Монолог Незнайомця"}
                    </h2>
                    <p className="text-xs font-mono text-muted-foreground">
                      {language === 'en' ? "MYSTERIOUS GUEST" : language === 'pl' ? "TAJEMNICZY GOŚĆ" : "ТАЄМНИЧИЙ ГІСТЬ"}
                    </p>
                  </div>
                </div>

                {/* Content */}
                <div className="relative font-serif text-lg leading-relaxed italic text-foreground/90 space-y-4">
                  {localizedMonologue.split('\n\n').map((paragraph: string, i: number) => (
                    <p key={i} className="first-letter:text-3xl first-letter:font-bold first-letter:text-primary first-letter:mr-1">
                      {parseContentWithLinks(paragraph)}
                    </p>
                  ))}
                </div>

                {/* Signature */}
                <div className="mt-8 text-right">
                  <span className="text-sm font-mono text-primary/60">
                    — {language === 'en' ? "The Stranger" : language === 'pl' ? "Nieznajomy" : "Незнайомець"}
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* Narrator's Commentary - MOVED TO TOP */}
          {localizedCommentary && (
            <section className="relative mb-12">
              {/* Decorative elements */}
              <div className="absolute -right-4 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-secondary/50 to-transparent" />
              
              <div className="bg-gradient-to-bl from-secondary/10 via-muted/30 to-secondary/5 border border-border rounded-lg p-8 md:p-10 relative overflow-hidden">
                {/* Circuit pattern hint */}
                <div className="absolute bottom-0 left-0 w-48 h-48 opacity-5">
                  <svg viewBox="0 0 100 100" className="w-full h-full">
                    <pattern id="circuit" patternUnits="userSpaceOnUse" width="20" height="20">
                      <path d="M10 0v10h10M0 10h10" stroke="currentColor" fill="none" strokeWidth="0.5"/>
                    </pattern>
                    <rect width="100" height="100" fill="url(#circuit)"/>
                  </svg>
                </div>
                
                {/* Header */}
                <div className="flex items-center gap-3 mb-6 relative">
                  <div className="w-12 h-12 rounded-full bg-secondary/30 border border-secondary/40 flex items-center justify-center">
                    <MessageCircle className="w-6 h-6 text-secondary-foreground" />
                  </div>
                  <div>
                    <h2 className="text-xl font-serif font-bold">
                      {language === 'en' ? "Narrator's Commentary" : language === 'pl' ? "Komentarz Narratora" : "Коментар Наратора"}
                    </h2>
                    <p className="text-xs font-mono text-muted-foreground">
                      {language === 'en' ? "AI ARCHIVIST" : language === 'pl' ? "ARCHIWISTA AI" : "ШІ-АРХІВАТОР"}
                    </p>
                  </div>
                </div>

                {/* Content */}
                <div className="relative font-serif text-lg leading-relaxed text-foreground/90 space-y-4">
                  {localizedCommentary.split('\n\n').map((paragraph: string, i: number) => (
                    <p key={i}>
                      {parseContentWithLinks(paragraph)}
                    </p>
                  ))}
                </div>

                {/* Signature */}
                <div className="mt-8 text-right">
                  <span className="text-sm font-mono text-muted-foreground">
                    — {language === 'en' ? "Synchronization Point Narrator" : language === 'pl' ? "Narrator Punktu Synchronizacji" : "Наратор Точки Синхронізації"}
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* Parts Timeline */}
          {parts.length > 0 && (
            <div className="mb-12 p-4 bg-card/50 border border-border rounded-lg">
              <h3 className="text-xs font-mono text-muted-foreground mb-3">
                {language === 'en' ? "DAILY ENTRIES OF THE WEEK" : language === 'pl' ? "CODZIENNE WPISY TYGODNIA" : "ДЕННІ ЗАПИСИ ТИЖНЯ"}
              </h3>
              <div className="flex flex-wrap gap-2">
                {parts.map((p: any) => (
                  <Link
                    key={p.id}
                    to={`/read/${p.date}`}
                    className="px-3 py-1 text-sm border border-border rounded hover:border-primary/50 transition-colors"
                  >
                    {format(new Date(p.date), 'd MMM', { locale: dateLocale })}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="prose font-serif text-lg leading-relaxed text-foreground mb-16">
            {combinedContent.split('\n\n').map((paragraph: string, i: number) => {
              if (paragraph === '---') {
                return <hr key={i} className="my-8 border-border" />;
              }
              return (
                <p key={i} className="mb-6">
                  {parseContentWithLinks(paragraph)}
                </p>
              );
            })}
          </div>

          {/* Tweets */}
          <ChapterTweets tweets={chapterTweets} />

          {/* Character Chat */}
          <ChapterChat messages={chapterChat} />

          {/* Tweets */}
          <ChapterTweets tweets={chapterTweets} />

          {/* Character Chat */}
          <ChapterChat messages={chapterChat} />

          {/* News Sources */}
          {allNewsSources.length > 0 && (
            <div className="mt-12 pt-8 border-t border-border">
              <h3 className="text-sm font-mono text-muted-foreground mb-4">
                ДЖЕРЕЛА РЕАЛЬНИХ ПОДІЙ ({allNewsSources.length})
              </h3>
              <ul className="space-y-2 columns-1 md:columns-2 gap-8">
                {allNewsSources.slice(0, 20).map((source: any, i: number) => (
                  <li key={i} className="break-inside-avoid">
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
            {adjacentChapters?.prev ? (
              <Link to={`/chapter/${adjacentChapters.prev.number}`}>
                <Button variant="outline" className="gap-2">
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">{language === 'en' ? 'Chapter' : language === 'pl' ? 'Rozdział' : 'Глава'} {adjacentChapters.prev.number}</span>
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
            
            {adjacentChapters?.next ? (
              <Link to={`/chapter/${adjacentChapters.next.number}`}>
                <Button variant="outline" className="gap-2">
                  <span className="hidden sm:inline">{language === 'en' ? 'Chapter' : language === 'pl' ? 'Rozdział' : 'Глава'} {adjacentChapters.next.number}</span>
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
