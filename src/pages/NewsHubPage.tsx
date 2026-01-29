import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Globe, ArrowRight, Loader2, Newspaper, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { SEOHead } from "@/components/SEOHead";
import { NewsHubSeoContent } from "@/components/NewsHubSeoContent";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { uk, enUS, pl } from "date-fns/locale";

interface NewsCountry {
  id: string;
  code: string;
  name: string;
  name_en: string | null;
  name_pl: string | null;
  flag: string;
}

interface NewsItem {
  id: string;
  title: string;
  title_en: string | null;
  description: string | null;
  description_en: string | null;
  content_en: string | null;
  image_url: string | null;
  published_at: string | null;
  slug: string | null;
  category: string | null;
}

interface CountryWithNews {
  country: NewsCountry;
  news: NewsItem[];
  totalCount: number;
}

const NEWS_PREVIEW_COUNT = 4;

export default function NewsHubPage() {
  const { language, t } = useLanguage();
  const dateLocale = language === 'uk' ? uk : language === 'pl' ? pl : enUS;

  const { data: countriesWithNews = [], isLoading } = useQuery({
    queryKey: ['news-hub-countries', language],
    queryFn: async () => {
      // Get all active countries
      const { data: countries } = await supabase
        .from('news_countries')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (!countries?.length) return [];

      const results: CountryWithNews[] = [];

      for (const country of countries) {
        // Get count
        const { count } = await supabase
          .from('news_rss_items')
          .select('id', { count: 'exact', head: true })
          .eq('country_id', country.id)
          .eq('is_archived', false)
          .not('slug', 'is', null);

        // Get latest news
        const { data: newsItems } = await supabase
          .from('news_rss_items')
          .select(`
            id, title, title_en, description, description_en, content_en,
            image_url, published_at, slug, category
          `)
          .eq('country_id', country.id)
          .eq('is_archived', false)
          .not('slug', 'is', null)
          .order('published_at', { ascending: false })
          .limit(NEWS_PREVIEW_COUNT);

        results.push({
          country,
          news: newsItems || [],
          totalCount: count || 0
        });
      }

      return results;
    },
    staleTime: 1000 * 60 * 5,
  });

  const getCountryName = (country: NewsCountry) => {
    if (language === 'en' && country.name_en) return country.name_en;
    if (language === 'pl' && country.name_pl) return country.name_pl;
    return country.name;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    try {
      return format(new Date(dateStr), 'd MMM, HH:mm', { locale: dateLocale });
    } catch {
      return '';
    }
  };

  const hasRetoldContent = (item: NewsItem) => {
    return item.content_en && item.content_en.length > 100;
  };

  const pageTitle = language === 'en' 
    ? 'World News & Events Digest: USA, Ukraine, Poland, India' 
    : language === 'pl'
    ? 'Przegląd Wiadomości Światowych: USA, Ukraina, Polska, Indie'
    : 'Дайджест Світових Новин: США, Україна, Польща, Індія';

  const pageDescription = language === 'en'
    ? 'Read the latest world news on Synchronization Point. A daily digest of events from the USA, Ukraine, Poland, and India. Real facts and structured updates serving as the foundation for the AI Archive of Human History.'
    : language === 'pl'
    ? 'Przegląd wiadomości ze świata z AI-streszczeniami i dialogami postaci z USA, Ukrainy, Polski i Indii.'
    : 'AI-дайджест новин з усього світу з переказом та діалогами персонажів зі США, України, Польщі та Індії.';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={pageTitle}
        description={pageDescription}
        canonicalUrl="https://echoes2.com/news"
      />
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-10">
          <Badge variant="outline" className="mb-4">
            <Globe className="w-3 h-3 mr-1" />
            {t('newsdigest.badge')}
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            {t('newsdigest.title')}
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t('newsdigest.description')}
          </p>
        </div>

        {/* Countries Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {countriesWithNews.map(({ country, news, totalCount }) => {
            const countryName = getCountryName(country);
            
            return (
              <Card key={country.id} className="cosmic-card overflow-hidden group">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-3">
                      <span className="text-3xl">{country.flag}</span>
                      <div>
                        <h2 className="text-xl font-bold">{countryName}</h2>
                        <p className="text-sm text-muted-foreground font-normal">
                          {totalCount} {language === 'en' ? 'articles' : language === 'pl' ? 'artykułów' : 'статей'}
                        </p>
                      </div>
                    </CardTitle>
                    <Link 
                      to={`/news/${country.code.toLowerCase()}`}
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      {language === 'en' ? 'View all' : language === 'pl' ? 'Zobacz wszystkie' : 'Усі новини'}
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {news.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Newspaper className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">{t('newsdigest.empty')}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {news.map((item, idx) => {
                        const localizedTitle = language === 'en' 
                          ? (item.title_en || item.title)
                          : item.title;
                        const isRetold = hasRetoldContent(item);

                        return (
                          <Link
                            key={item.id}
                            to={`/news/${country.code.toLowerCase()}/${item.slug}`}
                            className="group/item block"
                          >
                            <article 
                              className={`flex gap-3 p-2.5 rounded-lg border transition-all duration-200 ${
                                isRetold 
                                  ? 'border-primary/30 bg-primary/5 hover:border-primary/50' 
                                  : 'border-border/50 hover:border-primary/50 hover:bg-primary/5'
                              }`}
                            >
                              {item.image_url && (
                                <img 
                                  src={item.image_url} 
                                  alt="" 
                                  className="w-16 h-16 object-cover rounded shrink-0"
                                  loading="lazy"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-1">
                                  {isRetold && (
                                    <Badge variant="default" className="text-[10px] px-1 py-0 h-4 gap-0.5">
                                      <Sparkles className="w-2 h-2" />
                                      AI
                                    </Badge>
                                  )}
                                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                                    {item.category || 'news'}
                                  </Badge>
                                </div>
                                <h4 className="text-sm font-medium line-clamp-2 group-hover/item:text-primary transition-colors">
                                  {localizedTitle}
                                </h4>
                                {item.published_at && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {formatDate(item.published_at)}
                                  </span>
                                )}
                              </div>
                            </article>
                          </Link>
                        );
                      })}
                    </div>
                  )}

                  {/* View more link */}
                  {totalCount > NEWS_PREVIEW_COUNT && (
                    <Link 
                      to={`/news/${country.code.toLowerCase()}`}
                      className="mt-4 flex items-center justify-center gap-2 py-2 text-sm text-primary hover:underline"
                    >
                      {language === 'en' 
                        ? `+${totalCount - NEWS_PREVIEW_COUNT} more articles` 
                        : language === 'pl'
                        ? `+${totalCount - NEWS_PREVIEW_COUNT} więcej artykułów`
                        : `+${totalCount - NEWS_PREVIEW_COUNT} ще статей`}
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* SEO Content Section */}
        <NewsHubSeoContent />
      </main>
    </div>
  );
}
