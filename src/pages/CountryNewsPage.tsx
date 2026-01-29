import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { Globe, Loader2, Calendar, Newspaper, Filter, RefreshCw, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Header } from "@/components/Header";
import { SEOHead } from "@/components/SEOHead";
import { OtherCountriesNews } from "@/components/OtherCountriesNews";
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
  url: string;
  slug: string | null;
  image_url: string | null;
  category: string | null;
  published_at: string | null;
  chat_dialogue: any;
  tweets: any;
  news_rss_feeds: {
    name: string;
  };
}

const CATEGORIES = [
  { value: 'all', label: { uk: 'Усі категорії', en: 'All categories', pl: 'Wszystkie kategorie' } },
  { value: 'general', label: { uk: 'Загальне', en: 'General', pl: 'Ogólne' } },
  { value: 'politics', label: { uk: 'Політика', en: 'Politics', pl: 'Polityka' } },
  { value: 'economy', label: { uk: 'Економіка', en: 'Economy', pl: 'Gospodarka' } },
  { value: 'technology', label: { uk: 'Технології', en: 'Technology', pl: 'Technologia' } },
  { value: 'science', label: { uk: 'Наука', en: 'Science', pl: 'Nauka' } },
  { value: 'culture', label: { uk: 'Культура', en: 'Culture', pl: 'Kultura' } },
  { value: 'sports', label: { uk: 'Спорт', en: 'Sports', pl: 'Sport' } },
  { value: 'world', label: { uk: 'Світ', en: 'World', pl: 'Świat' } },
];

const PAGE_SIZE = 30;

export default function CountryNewsPage() {
  const { countryCode } = useParams<{ countryCode: string }>();
  const { language, t } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const loadMoreRef = useRef<HTMLDivElement>(null);
  
  const dateLocale = language === 'uk' ? uk : language === 'pl' ? pl : enUS;

  // Fetch country info
  const { data: country, isLoading: countryLoading } = useQuery({
    queryKey: ['news-country', countryCode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news_countries')
        .select('*')
        .ilike('code', countryCode || '')
        .single();
      if (error) throw error;
      return data as NewsCountry;
    },
    enabled: !!countryCode
  });

  // Fetch all countries for navigation
  const { data: allCountries = [] } = useQuery({
    queryKey: ['all-news-countries'],
    queryFn: async () => {
      const { data } = await supabase
        .from('news_countries')
        .select('id, code, name, name_en, name_pl, flag')
        .eq('is_active', true)
        .order('sort_order');
      return data || [];
    }
  });

  // Infinite query for news items
  const {
    data: newsData,
    isLoading: newsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch
  } = useInfiniteQuery({
    queryKey: ['country-news-infinite', country?.id, selectedCategory],
    queryFn: async ({ pageParam = 0 }) => {
      if (!country?.id) return { items: [], nextPage: null };
      
      let query = supabase
        .from('news_rss_items')
        .select(`
          id, title, title_en, description, description_en, content_en,
          url, slug, image_url, category, published_at, chat_dialogue, tweets,
          news_rss_feeds!inner(name)
        `)
        .eq('country_id', country.id)
        .eq('is_archived', false)
        .not('slug', 'is', null)
        .order('published_at', { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);
      
      if (selectedCategory !== 'all') {
        query = query.eq('category', selectedCategory);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      const items = data as NewsItem[];
      return {
        items,
        nextPage: items.length === PAGE_SIZE ? pageParam + PAGE_SIZE : null
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    enabled: !!country?.id
  });

  // Flatten all pages into single array
  const newsItems = newsData?.pages.flatMap(page => page.items) || [];

  // Intersection observer for infinite scroll
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const [target] = entries;
    if (target.isIntersecting && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: '100px',
      threshold: 0.1
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [handleObserver]);

  const getCountryName = (c: NewsCountry) => {
    if (language === 'en' && c.name_en) return c.name_en;
    if (language === 'pl' && c.name_pl) return c.name_pl;
    return c.name;
  };

  const getCategoryLabel = (value: string) => {
    const cat = CATEGORIES.find(c => c.value === value);
    return cat ? cat.label[language] : value;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    try {
      return format(new Date(dateStr), 'dd MMM yyyy, HH:mm', { locale: dateLocale });
    } catch {
      return '';
    }
  };

  // Check if item has AI retold content
  const hasRetoldContent = (item: NewsItem) => {
    return item.content_en && item.content_en.length > 100;
  };

  // Check if item has dialogues
  const hasDialogues = (item: NewsItem) => {
    return item.chat_dialogue && Array.isArray(item.chat_dialogue) && item.chat_dialogue.length > 0;
  };

  if (countryLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!country) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">{t('notfound.title')}</h1>
          <Link to="/news" className="text-primary hover:underline">
            ← {t('newsdigest.title')}
          </Link>
        </div>
      </div>
    );
  }

  const countryName = getCountryName(country);
  const pageTitle = language === 'en' 
    ? `${countryName} News - Wormhole` 
    : language === 'pl'
    ? `Wiadomości z ${countryName} - Krotowina`
    : `Новини ${countryName} - Кротовиина`;

  const pageDescription = language === 'en'
    ? `Latest news from ${countryName} with AI-powered retelling and character dialogues`
    : language === 'pl'
    ? `Najnowsze wiadomości z ${countryName} z AI-streszczeniami i dialogami postaci`
    : `Останні новини з ${countryName} з AI-переказом та діалогами персонажів`;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={pageTitle}
        description={pageDescription}
        canonicalUrl={`https://echoes2.com/news/${countryCode?.toLowerCase()}`}
      />
      <Header />
      
      <main className="container mx-auto px-4 py-6">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:text-primary transition-colors">
            {t('nav.home')}
          </Link>
          <ChevronRight className="w-4 h-4" />
          <Link to="/news" className="hover:text-primary transition-colors">
            {t('newsdigest.title')}
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground flex items-center gap-1">
            {country.flag} {countryName}
          </span>
        </nav>

        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
              <span className="text-3xl">{country.flag}</span>
              {countryName}
            </h1>
          </div>

          {/* Country Navigation */}
          <div className="flex flex-wrap gap-2">
            {allCountries.map((c) => (
              <Link
                key={c.id}
                to={`/news/${c.code.toLowerCase()}`}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-all ${
                  c.code.toLowerCase() === countryCode?.toLowerCase()
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-primary/50 hover:bg-primary/5'
                }`}
              >
                <span>{c.flag}</span>
                <span className="hidden sm:inline">
                  {language === 'en' ? (c.name_en || c.name) : c.name}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[180px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label[language]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* News Grid */}
        {newsLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : newsItems.length === 0 ? (
          <div className="text-center py-16">
            <Newspaper className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">{t('newsdigest.empty')}</h3>
            <p className="text-muted-foreground">{t('newsdigest.empty_desc')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {newsItems.map((item, idx) => {
              const localizedTitle = language === 'en' 
                ? (item.title_en || item.title)
                : item.title;
              const localizedDescription = language === 'en'
                ? (item.description_en || item.description)
                : item.description;
              const isRetold = hasRetoldContent(item);
              const hasDialogue = hasDialogues(item);
              
              return (
                <Link 
                  key={item.id} 
                  to={`/news/${countryCode?.toLowerCase()}/${item.slug}`}
                  className="block animate-fade-in"
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  <Card className={`cosmic-card overflow-hidden group h-full transition-all duration-300 ${
                    isRetold 
                      ? 'border-primary/30 hover:border-primary/60 bg-primary/5' 
                      : 'hover:border-primary/50'
                  }`}>
                    {item.image_url ? (
                      <div className="aspect-video overflow-hidden relative">
                        <img
                          src={item.image_url}
                          alt={localizedTitle}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        {isRetold && (
                          <div className="absolute top-2 left-2">
                            <Badge className="bg-primary/90 text-primary-foreground gap-1">
                              <Sparkles className="w-3 h-3" />
                              Full retelling
                            </Badge>
                          </div>
                        )}
                      </div>
                    ) : isRetold && (
                      <div className="px-4 pt-4">
                        <Badge className="bg-primary/90 text-primary-foreground gap-1">
                          <Sparkles className="w-3 h-3" />
                          Full retelling
                        </Badge>
                      </div>
                    )}
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-xs">
                            {getCategoryLabel(item.category || 'general')}
                          </Badge>
                          {hasDialogue && (
                            <Badge variant="secondary" className="text-xs">
                              💬
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                          {item.news_rss_feeds?.name}
                        </span>
                      </div>
                      <CardTitle className="text-base line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                        {localizedTitle}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {localizedDescription && (
                        <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                          {localizedDescription}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        {item.published_at && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(item.published_at)}
                          </div>
                        )}
                        <span className="text-primary group-hover:translate-x-1 transition-transform">
                          →
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        {/* Infinite scroll trigger */}
        <div ref={loadMoreRef} className="py-8 flex justify-center">
          {isFetchingNextPage && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">
                {language === 'en' ? 'Loading more...' : language === 'pl' ? 'Ładowanie...' : 'Завантаження...'}
              </span>
            </div>
          )}
          {!hasNextPage && newsItems.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {language === 'en' ? 'All articles loaded' : language === 'pl' ? 'Wszystkie artykuły załadowane' : 'Усі статті завантажено'}
            </p>
          )}
        </div>

        {/* Cross-linking: News from Other Countries */}
        {countryCode && (
          <OtherCountriesNews excludeCountryCode={countryCode} />
        )}
      </main>
    </div>
  );
}
