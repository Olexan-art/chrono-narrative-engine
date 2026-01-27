import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { 
  Calendar, BookOpen, Library, Newspaper, ChevronRight, 
  Globe, Loader2, MapPin 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SEOHead } from "@/components/SEOHead";
import { useLanguage } from "@/contexts/LanguageContext";

const BASE_URL = 'https://echoes2.com';

export default function SitemapPage() {
  const { language } = useLanguage();

  // Fetch all data for sitemap
  const { data, isLoading } = useQuery({
    queryKey: ['html-sitemap'],
    queryFn: async () => {
      const [partsResult, chaptersResult, volumesResult, countriesResult, newsResult] = await Promise.all([
        supabase
          .from('parts')
          .select('date, title, title_en, number')
          .eq('status', 'published')
          .order('date', { ascending: false })
          .limit(50),
        supabase
          .from('chapters')
          .select('number, title, title_en')
          .order('number', { ascending: false }),
        supabase
          .from('volumes')
          .select('year, month, title, title_en')
          .order('year', { ascending: false }),
        supabase
          .from('news_countries')
          .select('id, code, name, name_en')
          .eq('is_active', true)
          .order('sort_order'),
        supabase
          .from('news_rss_items')
          .select('slug, title, title_en, country_id')
          .not('slug', 'is', null)
          .order('fetched_at', { ascending: false })
          .limit(100)
      ]);

      // Group news by country
      const newsByCountry: Record<string, any[]> = {};
      const countryMap = new Map(countriesResult.data?.map(c => [c.id, c]) || []);
      
      for (const item of newsResult.data || []) {
        const country = countryMap.get(item.country_id);
        if (country) {
          const code = country.code.toLowerCase();
          if (!newsByCountry[code]) {
            newsByCountry[code] = [];
          }
          newsByCountry[code].push(item);
        }
      }

      return {
        parts: partsResult.data || [],
        chapters: chaptersResult.data || [],
        volumes: volumesResult.data || [],
        countries: countriesResult.data || [],
        newsByCountry
      };
    }
  });

  const getTitle = (item: { title: string; title_en?: string | null }) => {
    if (language === 'en' && item.title_en) return item.title_en;
    return item.title;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title="Sitemap | Synchronization Point"
        description="Complete HTML sitemap for Synchronization Point - AI Archive of Human History. Navigate all stories, chapters, volumes, and news articles."
        canonicalUrl={`${BASE_URL}/sitemap`}
      />
      
      <div className="min-h-screen py-24 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4 flex items-center justify-center gap-3">
              <MapPin className="w-8 h-8 text-primary" />
              Sitemap
            </h1>
            <p className="text-muted-foreground">
              Повна карта сайту Synchronization Point
            </p>
          </div>

          <div className="grid gap-8">
            {/* Static Pages */}
            <section className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                Головні сторінки
              </h2>
              <ul className="space-y-2">
                {[
                  { url: '/', name: 'Головна', nameEn: 'Home' },
                  { url: '/calendar', name: 'Календар', nameEn: 'Calendar' },
                  { url: '/chapters', name: 'Глави', nameEn: 'Chapters' },
                  { url: '/volumes', name: 'Томи', nameEn: 'Volumes' },
                  { url: '/news-digest', name: 'Новини', nameEn: 'News Digest' }
                ].map(page => (
                  <li key={page.url} className="flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    <Link 
                      to={page.url} 
                      className="text-primary hover:underline"
                    >
                      {language === 'en' ? page.nameEn : page.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            {/* Recent Stories */}
            <section className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                Останні історії
              </h2>
              <ul className="space-y-2 max-h-[300px] overflow-y-auto">
                {data?.parts.map(part => (
                  <li key={`${part.date}-${part.number}`} className="flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    <Link 
                      to={`/read/${part.date}/${part.number}`} 
                      className="text-primary hover:underline truncate"
                    >
                      {part.date} - {getTitle(part)}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link 
                to="/calendar" 
                className="text-sm text-muted-foreground hover:text-primary mt-4 inline-block"
              >
                Переглянути всі →
              </Link>
            </section>

            {/* Chapters */}
            <section className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Глави
              </h2>
              <ul className="space-y-2 columns-2 md:columns-3">
                {data?.chapters.map(chapter => (
                  <li key={chapter.number} className="flex items-center gap-2 break-inside-avoid">
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    <Link 
                      to={`/chapter/${chapter.number}`} 
                      className="text-primary hover:underline"
                    >
                      Глава {chapter.number}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            {/* Volumes */}
            <section className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Library className="w-5 h-5 text-primary" />
                Томи
              </h2>
              <ul className="space-y-2 columns-2 md:columns-3">
                {data?.volumes.map(volume => {
                  const yearMonth = `${volume.year}-${String(volume.month).padStart(2, '0')}`;
                  return (
                    <li key={yearMonth} className="flex items-center gap-2 break-inside-avoid">
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      <Link 
                        to={`/volume/${yearMonth}`} 
                        className="text-primary hover:underline"
                      >
                        {yearMonth}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* News by Country */}
            {data?.countries.map(country => {
              const countryCode = country.code.toLowerCase();
              const newsItems = data.newsByCountry[countryCode] || [];
              if (newsItems.length === 0) return null;
              
              return (
                <section key={country.id} className="bg-card border border-border rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Newspaper className="w-5 h-5 text-primary" />
                    {language === 'en' ? country.name_en || country.name : country.name}
                  </h2>
                  <ul className="space-y-2 max-h-[200px] overflow-y-auto">
                    {newsItems.slice(0, 20).map((item: any) => (
                      <li key={item.slug} className="flex items-center gap-2">
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        <Link 
                          to={`/news/${countryCode}/${item.slug}`} 
                          className="text-primary hover:underline truncate"
                        >
                          {getTitle(item)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {newsItems.length > 20 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      +{newsItems.length - 20} більше новин
                    </p>
                  )}
                </section>
              );
            })}
          </div>

          {/* Footer with XML sitemap link */}
          <div className="text-center mt-12 text-sm text-muted-foreground">
            <p>
              Для пошукових систем: 
              <a 
                href="https://echoes2.com/sitemap.xml" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline ml-1"
              >
                XML Sitemap
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
