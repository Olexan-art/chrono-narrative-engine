import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Calendar, BookOpen, Library, Newspaper, ChevronRight,
  Globe, Loader2, MapPin, Users
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SEOHead } from "@/components/SEOHead";
import { Header } from "@/components/Header";
import { useLanguage } from "@/contexts/LanguageContext";
import { topicPath } from "@/lib/topicSlug";

const BASE_URL = 'https://bravennow.com';

export default function SitemapPage() {
  const { language } = useLanguage();

  // Fetch all data for sitemap
  const { data, isLoading } = useQuery({
    queryKey: ['html-sitemap'],
    queryFn: async () => {
      const [countriesResult, newsResult, wikiResult] = await Promise.all([
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
          .limit(100),
        supabase
          .from('wiki_entities')
          .select('id, slug, name, name_en, entity_type, search_count')
          .order('search_count', { ascending: false })
          .limit(200)
      ]);

      // Fetch themes for top topics (all-time counts)
      const topicsResult = await supabase
        .from('news_rss_items')
        .select('themes')
        .not('themes', 'is', null)
        .limit(30000);

      // Count topics
      const topicCounts = new Map<string, number>();
      for (const item of topicsResult.data || []) {
        if (Array.isArray(item.themes)) {
          for (const t of item.themes) {
            if (t && typeof t === 'string') {
              topicCounts.set(t, (topicCounts.get(t) || 0) + 1);
            }
          }
        }
      }

      const topTopics = Array.from(topicCounts.entries())
        .map(([topic, count]) => ({ topic, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 100);

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
        countries: countriesResult.data || [],
        newsByCountry,
        wikiEntities: wikiResult.data || [],
        topTopics
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
      <Header />

      <div className="min-h-screen py-8 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4 flex items-center justify-center gap-3">
              <MapPin className="w-8 h-8 text-primary" />
              Sitemap
            </h1>
            <p className="text-muted-foreground">
              Complete site map of Synchronization Point
            </p>
          </div>

          <div className="grid gap-8">
            {/* Static Pages */}
            <section className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                Main Pages
              </h2>
              <ul className="space-y-2">
                {[
                  { url: '/', name: 'Home' },
                  { url: '/topics', name: 'Topics' },
                  { url: '/news', name: 'News Hub' },
                  { url: '/wiki', name: 'Entity Catalog' }
                ].map(page => (
                  <li key={page.url} className="flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    <Link
                      to={page.url}
                      className="text-primary hover:underline"
                    >
                      {page.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            {/* Topics */}
            <section className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                Topics
              </h2>
              <ul className="space-y-2 max-h-[320px] overflow-y-auto">
                {data?.topTopics && data.topTopics.length > 0 ? (
                  data.topTopics.map((t: any) => (
                    <li key={t.topic} className="flex items-center gap-2">
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      <Link to={topicPath(t.topic)} className="text-primary hover:underline truncate">
                        {t.topic}
                      </Link>
                      <span className="text-xs text-muted-foreground">({t.count})</span>
                    </li>
                  ))
                ) : (
                  <li className="flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    <a href="/topics" className="text-primary hover:underline">All Topics</a>
                  </li>
                )}
              </ul>
            </section>

            {/* Wiki Entities */}
            <section className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Wiki Entities ({data?.wikiEntities.length || 0})
              </h2>
              <ul className="space-y-2 columns-2 md:columns-3 max-h-[400px] overflow-y-auto">
                {data?.wikiEntities.map(entity => (
                  <li key={entity.id} className="flex items-center gap-2 break-inside-avoid">
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    <Link
                      to={`/wiki/${entity.slug || entity.id}`}
                      className="text-primary hover:underline truncate"
                    >
                      {language === 'en' && entity.name_en ? entity.name_en : entity.name}
                    </Link>
                    <span className="text-xs text-muted-foreground shrink-0">
                      ({entity.entity_type})
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                to="/wiki"
                className="text-sm text-muted-foreground hover:text-primary mt-4 inline-block"
              >
                View all entities →
              </Link>
            </section>

            {/* News Countries Hub */}
            <section className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Newspaper className="w-5 h-5 text-primary" />
                News by Country
              </h2>
              <ul className="space-y-3">
                {data?.countries.map(country => {
                  const countryCode = country.code.toLowerCase();
                  const newsCount = data.newsByCountry[countryCode]?.length || 0;

                  return (
                    <li key={country.id} className="flex items-center gap-3">
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      <Link
                        to={`/news/${countryCode}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {country.name_en || country.name}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        ({newsCount} articles)
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Recent News by Country */}
            {data?.countries.map(country => {
              const countryCode = country.code.toLowerCase();
              const newsItems = data.newsByCountry[countryCode] || [];
              if (newsItems.length === 0) return null;

              return (
                <section key={country.id} className="bg-card border border-border rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                      <Newspaper className="w-5 h-5 text-primary" />
                      {country.name_en || country.name} News
                    </h2>
                    <Link
                      to={`/news/${countryCode}`}
                      className="text-sm text-primary hover:underline"
                    >
                      View all →
                    </Link>
                  </div>
                  <ul className="space-y-2 max-h-[200px] overflow-y-auto">
                    {newsItems.slice(0, 15).map((item: any) => (
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
                  {newsItems.length > 15 && (
                    <Link
                      to={`/news/${countryCode}`}
                      className="text-sm text-muted-foreground hover:text-primary mt-3 inline-block"
                    >
                      +{newsItems.length - 15} more articles →
                    </Link>
                  )}
                </section>
              );
            })}
          </div>

          {/* Footer with XML sitemap link */}
          <div className="text-center mt-12 text-sm text-muted-foreground">
            <p>
              For search engines:
              <a
                href="https://bravennow.com/sitemap.xml"
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
