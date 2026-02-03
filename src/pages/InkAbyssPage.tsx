import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { uk, enUS, pl } from "date-fns/locale";
import { Link } from "react-router-dom";
import { Palette, ThumbsUp, ThumbsDown, Calendar, User, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Header } from "@/components/Header";
import { SEOHead } from "@/components/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

interface InkItem {
  id: string;
  image_url: string;
  title: string | null;
  likes: number;
  dislikes: number;
  created_at: string;
  news_item: {
    id: string;
    slug: string;
    title: string;
    title_en: string | null;
    keywords: string[] | null;
    country: {
      code: string;
      name: string;
      name_en: string | null;
      flag: string;
    };
  } | null;
  entities: Array<{
    wiki_entity: {
      id: string;
      name: string;
      name_en: string | null;
      entity_type: string;
      image_url: string | null;
    };
  }>;
}

interface GroupedByDate {
  date: string;
  items: InkItem[];
}

export default function InkAbyssPage() {
  const { language } = useLanguage();
  const dateLocale = language === 'en' ? enUS : language === 'pl' ? pl : uk;

  const t = {
    title: 'The Ink Abyss',
    subtitle: language === 'en' 
      ? 'Satirical Art Timeline' 
      : language === 'pl' 
      ? 'Oś czasu sztuki satyrycznej'
      : 'Хронологія сатиричного мистецтва',
    noItems: language === 'en' 
      ? 'No satirical artwork yet' 
      : language === 'pl' 
      ? 'Brak satyrycznych dzieł'
      : 'Сатиричних робіт ще немає',
    viewNews: language === 'en' ? 'View news' : language === 'pl' ? 'Zobacz wiadomość' : 'Переглянути новину',
  };

  const { data: groupedItems = [], isLoading } = useQuery({
    queryKey: ['ink-abyss-gallery'],
    queryFn: async () => {
      const { data } = await supabase
        .from('outrage_ink')
        .select(`
          id, image_url, title, likes, dislikes, created_at,
          news_item:news_rss_items(
            id, slug, title, title_en, keywords, published_at,
            country:news_countries(code, name, name_en, flag)
          ),
          entities:outrage_ink_entities(
            wiki_entity:wiki_entities(id, name, name_en, entity_type, image_url)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!data) return [];

      // Group by news publication date (fallback to created_at)
      const grouped = new Map<string, InkItem[]>();
      for (const item of data as InkItem[]) {
        const newsDate = (item.news_item as any)?.published_at;
        const dateToUse = newsDate ? new Date(newsDate) : new Date(item.created_at);
        const date = format(dateToUse, 'yyyy-MM-dd');
        if (!grouped.has(date)) {
          grouped.set(date, []);
        }
        grouped.get(date)!.push(item);
      }

      // Sort groups by date descending
      const sortedEntries = Array.from(grouped.entries()).sort((a, b) => b[0].localeCompare(a[0]));

      return sortedEntries.map(([date, items]) => ({
        date,
        items
      })) as GroupedByDate[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const pageTitle = 'The Ink Abyss | Satirical Art Gallery';
  const pageDescription = language === 'en'
    ? 'A timeline gallery of satirical political artwork and caricatures inspired by world news.'
    : language === 'pl'
    ? 'Galeria satyrycznych dzieł politycznych inspirowanych światowymi wiadomościami.'
    : 'Галерея сатиричних політичних робіт та карикатур, натхненних світовими новинами.';

  return (
    <div className="min-h-screen bg-background">
      <SEOHead 
        title={pageTitle}
        description={pageDescription}
        canonicalUrl="https://echoes2.com/ink-abyss"
        keywords={['satire', 'caricature', 'political art', 'cartoon', 'news']}
      />
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Palette className="w-8 h-8 text-rose-500" />
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-rose-500 to-orange-500 bg-clip-text text-transparent">
              {t.title}
            </h1>
          </div>
          <p className="text-muted-foreground">{t.subtitle}</p>
        </div>

        {/* Timeline */}
        {isLoading ? (
          <div className="space-y-12">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-4">
                <Skeleton className="h-8 w-32" />
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {[1, 2, 3, 4, 5].map(j => (
                    <Skeleton key={j} className="aspect-square rounded-lg" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : groupedItems.length === 0 ? (
          <div className="text-center py-20">
            <Palette className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">{t.noItems}</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-rose-500 via-orange-500 to-transparent" />

            <div className="space-y-12">
              {groupedItems.map((group, groupIdx) => (
                <div key={group.date} className="relative">
                  {/* Date marker */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-8 h-8 rounded-full bg-rose-500 flex items-center justify-center z-10">
                      <Calendar className="w-4 h-4 text-white" />
                    </div>
                    <h2 className="text-lg font-semibold">
                      {format(new Date(group.date), 'MMMM d, yyyy', { locale: dateLocale })}
                    </h2>
                    <Badge variant="secondary" className="ml-auto">
                      {group.items.length} {language === 'en' ? 'artworks' : language === 'pl' ? 'prac' : 'робіт'}
                    </Badge>
                  </div>

                  {/* Items grid */}
                  <div className="ml-12 md:ml-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {group.items.map((item, idx) => {
                      const newsTitle = language === 'en' && item.news_item?.title_en 
                        ? item.news_item.title_en 
                        : item.news_item?.title;
                      const newsLink = item.news_item?.slug && item.news_item?.country?.code
                        ? `/news/${item.news_item.country.code.toLowerCase()}/${item.news_item.slug}`
                        : null;

                      return (
                        <Card 
                          key={item.id} 
                          className="overflow-hidden group animate-fade-in"
                          style={{ animationDelay: `${idx * 50}ms` }}
                        >
                          <div className="relative">
                            <img 
                              src={item.image_url} 
                              alt={item.title || newsTitle || 'Satirical artwork'}
                              title={item.title || newsTitle || undefined}
                              className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />

                            {/* Votes overlay */}
                            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                              <div className="bg-background/80 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-2">
                                <span className="flex items-center gap-1 text-green-500">
                                  <ThumbsUp className="w-3 h-3" />
                                  <span className="text-xs">{item.likes}</span>
                                </span>
                                <span className="flex items-center gap-1 text-red-500">
                                  <ThumbsDown className="w-3 h-3" />
                                  <span className="text-xs">{item.dislikes}</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          <CardContent className="p-3 space-y-2">
                            {/* Entity tags */}
                            {item.entities && item.entities.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {item.entities.slice(0, 3).map((e: any) => {
                                  const entityName = language === 'en' && e.wiki_entity?.name_en 
                                    ? e.wiki_entity.name_en 
                                    : e.wiki_entity?.name;
                                  const isPerson = e.wiki_entity?.entity_type === 'person';
                                  
                                  return entityName ? (
                                    <Badge 
                                      key={e.wiki_entity?.id} 
                                      variant="outline"
                                      className="text-[10px] gap-1"
                                    >
                                      {isPerson && <User className="w-2 h-2" />}
                                      {entityName}
                                    </Badge>
                                  ) : null;
                                })}
                              </div>
                            )}

                            {/* News keywords */}
                            {item.news_item?.keywords && item.news_item.keywords.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {item.news_item.keywords.slice(0, 3).map((kw: string, i: number) => (
                                  <span key={i} className="text-[10px] text-muted-foreground">
                                    #{kw}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Link to news */}
                            {newsLink && (
                              <Link 
                                to={newsLink}
                                className="flex items-center gap-1 text-xs text-primary hover:underline line-clamp-2"
                              >
                                <ExternalLink className="w-3 h-3 shrink-0" />
                                {newsTitle}
                              </Link>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-border mt-12">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground font-mono">
            {language === 'en' 
              ? 'Art speaks where words fail' 
              : language === 'pl' 
              ? 'Sztuka mówi tam, gdzie słowa zawodzą'
              : 'Мистецтво говорить там, де слова безсилі'}
          </p>
        </div>
      </footer>
    </div>
  );
}