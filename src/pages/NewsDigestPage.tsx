import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Globe, Loader2, ExternalLink, Calendar, Newspaper, Filter, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Header } from "@/components/Header";
import { SEOHead } from "@/components/SEOHead";
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
  feed_id: string;
  country_id: string;
  title: string;
  title_en: string | null;
  description: string | null;
  description_en: string | null;
  url: string;
  slug: string | null;
  image_url: string | null;
  category: string | null;
  published_at: string | null;
  news_rss_feeds: {
    name: string;
  };
}

const CATEGORIES = [
  { value: 'all', label: { uk: 'Усі', en: 'All', pl: 'Wszystkie' } },
  { value: 'general', label: { uk: 'Загальне', en: 'General', pl: 'Ogólne' } },
  { value: 'politics', label: { uk: 'Політика', en: 'Politics', pl: 'Polityka' } },
  { value: 'economy', label: { uk: 'Економіка', en: 'Economy', pl: 'Gospodarka' } },
  { value: 'technology', label: { uk: 'Технології', en: 'Technology', pl: 'Technologia' } },
  { value: 'science', label: { uk: 'Наука', en: 'Science', pl: 'Nauka' } },
  { value: 'culture', label: { uk: 'Культура', en: 'Culture', pl: 'Kultura' } },
  { value: 'sports', label: { uk: 'Спорт', en: 'Sports', pl: 'Sport' } },
  { value: 'world', label: { uk: 'Світ', en: 'World', pl: 'Świat' } },
];

export default function NewsDigestPage() {
  const { language, t } = useLanguage();
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  const dateLocale = language === 'uk' ? uk : language === 'pl' ? pl : enUS;

  // Fetch countries
  const { data: countries, isLoading: countriesLoading } = useQuery({
    queryKey: ['news-countries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news_countries')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      
      // Set first country as default
      if (data && data.length > 0 && !selectedCountry) {
        setSelectedCountry(data[0].id);
      }
      
      return data as NewsCountry[];
    }
  });

  // Fetch news items
  const { data: newsItems, isLoading: newsLoading, refetch } = useQuery({
    queryKey: ['news-rss-items', selectedCountry, selectedCategory],
    queryFn: async () => {
      if (!selectedCountry) return [];
      
      let query = supabase
        .from('news_rss_items')
        .select(`
          *,
          news_rss_feeds!inner(name),
          country:news_countries!inner(code)
        `)
        .eq('country_id', selectedCountry)
        .eq('is_archived', false)
        .not('slug', 'is', null)
        .order('published_at', { ascending: false })
        .limit(50);
      
      if (selectedCategory !== 'all') {
        query = query.eq('category', selectedCategory);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as (NewsItem & { country: { code: string } })[];
    },
    enabled: !!selectedCountry
  });

  const getCountryName = (country: NewsCountry) => {
    if (language === 'en' && country.name_en) return country.name_en;
    if (language === 'pl' && country.name_pl) return country.name_pl;
    return country.name;
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

  if (countriesLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={t('newsdigest.title')}
        description={t('newsdigest.description')}
        canonicalUrl="https://echoes2.com/news-digest"
      />
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <Badge variant="outline" className="mb-4">
            <Globe className="w-3 h-3 mr-1" />
            {t('newsdigest.badge')}
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            {t('newsdigest.title')}
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t('newsdigest.description')}
          </p>
        </div>

        {/* Country Tabs */}
        <Tabs value={selectedCountry || undefined} onValueChange={setSelectedCountry} className="w-full">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
            <TabsList className="grid grid-cols-4 w-full sm:w-auto">
              {countries?.map(country => (
                <TabsTrigger key={country.id} value={country.id} className="gap-2 px-4">
                  <span className="text-lg">{country.flag}</span>
                  <span className="hidden sm:inline">{getCountryName(country)}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            
            <div className="flex items-center gap-2">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[150px]">
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
          </div>

          {countries?.map(country => (
            <TabsContent key={country.id} value={country.id}>
              {newsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : newsItems?.length === 0 ? (
                <div className="text-center py-16">
                  <Newspaper className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-medium mb-2">{t('newsdigest.empty')}</h3>
                  <p className="text-muted-foreground">{t('newsdigest.empty_desc')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {newsItems?.map(item => {
                    const countryCode = item.country?.code?.toLowerCase() || 'ua';
                    const localizedTitle = language === 'en' 
                      ? (item.title_en || item.title)
                      : item.title;
                    const localizedDescription = language === 'en'
                      ? (item.description_en || item.description)
                      : item.description;
                    
                    return (
                      <Link 
                        key={item.id} 
                        to={`/news/${countryCode}/${item.slug}`}
                        className="block"
                      >
                        <Card className="cosmic-card overflow-hidden group hover:border-primary/50 transition-colors h-full">
                          {item.image_url && (
                            <div className="aspect-video overflow-hidden">
                              <img
                                src={item.image_url}
                                alt={localizedTitle}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            </div>
                          )}
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <Badge variant="outline" className="text-xs">
                                {getCategoryLabel(item.category || 'general')}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
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
                            <div className="flex items-center justify-between">
                              {item.published_at && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Calendar className="w-3 h-3" />
                                  {formatDate(item.published_at)}
                                </div>
                              )}
                              <span className="flex items-center gap-1 text-xs text-primary">
                                {t('news.read')}
                                <ExternalLink className="w-3 h-3" />
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
}
