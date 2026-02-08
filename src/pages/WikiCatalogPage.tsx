import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { 
  Search, User, Building2, Globe, Filter, Grid, List, 
  TrendingUp, Newspaper, ArrowRight
} from "lucide-react";
import { Header } from "@/components/Header";
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingEntities } from "@/components/TrendingEntities";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

interface WikiEntity {
  id: string;
  wiki_id: string;
  entity_type: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  image_url: string | null;
  search_count: number;
  slug: string | null;
  news_count?: number;
}

type FilterType = 'all' | 'person' | 'company' | 'organization';
type ViewMode = 'grid' | 'list';

export default function WikiCatalogPage() {
  const { language } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Fetch entities with news count, sorted by last mention
  const { data: entities, isLoading } = useQuery({
    queryKey: ['wiki-catalog', searchTerm, filterType],
    queryFn: async () => {
      // First get latest news links for each entity
      const { data: latestLinks } = await supabase
        .from('news_wiki_entities')
        .select('wiki_entity_id, created_at')
        .order('created_at', { ascending: false });

      // Build map of entity -> latest mention date and count
      const entityStats = new Map<string, { lastMention: string; count: number }>();
      for (const link of latestLinks || []) {
        const existing = entityStats.get(link.wiki_entity_id);
        if (existing) {
          existing.count++;
        } else {
          entityStats.set(link.wiki_entity_id, { 
            lastMention: link.created_at, 
            count: 1 
          });
        }
      }

      let query = supabase
        .from('wiki_entities')
        .select('id, wiki_id, entity_type, name, name_en, description, description_en, image_url, search_count, slug')
        .limit(100);

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,name_en.ilike.%${searchTerm}%`);
      }

      if (filterType !== 'all') {
        query = query.eq('entity_type', filterType);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!data) return [];

      // Add news counts and sort by last mention
      const enrichedData = data.map(e => ({
        ...e,
        news_count: entityStats.get(e.id)?.count || 0,
        last_mention: entityStats.get(e.id)?.lastMention || null,
      }));

      // Sort by last mention (most recent first), then by search_count
      enrichedData.sort((a, b) => {
        if (a.last_mention && b.last_mention) {
          return new Date(b.last_mention).getTime() - new Date(a.last_mention).getTime();
        }
        if (a.last_mention) return -1;
        if (b.last_mention) return 1;
        return b.search_count - a.search_count;
      });

      return enrichedData as WikiEntity[];
    },
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['wiki-catalog-stats'],
    queryFn: async () => {
      const { count: total } = await supabase
        .from('wiki_entities')
        .select('*', { count: 'exact', head: true });

      const { count: persons } = await supabase
        .from('wiki_entities')
        .select('*', { count: 'exact', head: true })
        .eq('entity_type', 'person');

      const { count: companies } = await supabase
        .from('wiki_entities')
        .select('*', { count: 'exact', head: true })
        .eq('entity_type', 'company');

      return {
        total: total || 0,
        persons: persons || 0,
        companies: companies || 0,
      };
    },
  });

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'person': return <User className="w-4 h-4" />;
      case 'company': return <Building2 className="w-4 h-4" />;
      default: return <Globe className="w-4 h-4" />;
    }
  };

  const t = {
    title: language === 'uk' ? 'Каталог сутностей' : language === 'pl' ? 'Katalog podmiotów' : 'Entity Catalog',
    description: language === 'uk' 
      ? 'Персони, компанії та організації у новинах' 
      : 'People, companies and organizations in the news',
    search: language === 'uk' ? 'Пошук...' : 'Search...',
    all: language === 'uk' ? 'Всі' : 'All',
    persons: language === 'uk' ? 'Персони' : 'People',
    companies: language === 'uk' ? 'Компанії' : 'Companies',
    organizations: language === 'uk' ? 'Організації' : 'Organizations',
    mentions: language === 'uk' ? 'згадок' : 'mentions',
    news: language === 'uk' ? 'новин' : 'news',
    noResults: language === 'uk' ? 'Нічого не знайдено' : 'No results found',
  };

  return (
    <>
      <SEOHead
        title={`${t.title} | Echoes`}
        description={t.description}
        canonicalUrl="https://echoes2.com/wiki"
      />

      <div className="min-h-screen bg-background">
        <Header />

        <main className="container mx-auto px-4 py-8">
          {/* Hero Section */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">{t.title}</h1>
            <p className="text-muted-foreground">{t.description}</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8 max-w-md mx-auto">
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="text-2xl font-bold">{stats?.total || 0}</div>
                <p className="text-xs text-muted-foreground">{t.all}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="text-2xl font-bold flex items-center justify-center gap-1">
                  <User className="w-4 h-4" />
                  {stats?.persons || 0}
                </div>
                <p className="text-xs text-muted-foreground">{t.persons}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="text-2xl font-bold flex items-center justify-center gap-1">
                  <Building2 className="w-4 h-4" />
                  {stats?.companies || 0}
                </div>
                <p className="text-xs text-muted-foreground">{t.companies}</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6 items-center justify-between">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t.search}
                  className="pl-9 w-64"
                />
              </div>

              <div className="flex gap-1">
                <Button
                  variant={filterType === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterType('all')}
                >
                  {t.all}
                </Button>
                <Button
                  variant={filterType === 'person' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterType('person')}
                >
                  <User className="w-3 h-3 mr-1" />
                  {t.persons}
                </Button>
                <Button
                  variant={filterType === 'company' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterType('company')}
                >
                  <Building2 className="w-3 h-3 mr-1" />
                  {t.companies}
                </Button>
              </div>
            </div>

            <div className="flex gap-1">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Entity Grid/List */}
          {isLoading ? (
            <div className={viewMode === 'grid' 
              ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4' 
              : 'space-y-2'
            }>
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className={viewMode === 'grid' ? 'h-48' : 'h-20'} />
              ))}
            </div>
          ) : entities && entities.length > 0 ? (
            viewMode === 'grid' ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {entities.map((entity) => {
                  const name = language === 'en' && entity.name_en ? entity.name_en : entity.name;
                  const description = language === 'en' && entity.description_en 
                    ? entity.description_en 
                    : entity.description;

                  return (
                    <Link
                      key={entity.id}
                      to={`/wiki/${entity.slug || entity.id}`}
                      className="group"
                    >
                      <Card className="overflow-hidden h-full hover:shadow-lg transition-shadow">
                        <div className="aspect-square relative overflow-hidden">
                          {entity.image_url ? (
                            <img
                              src={entity.image_url}
                              alt={name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-full h-full bg-muted flex items-center justify-center">
                              {getEntityIcon(entity.entity_type)}
                            </div>
                          )}
                          <Badge 
                            variant="secondary" 
                            className="absolute top-2 left-2 text-[10px]"
                          >
                            {getEntityIcon(entity.entity_type)}
                          </Badge>
                        </div>
                        <CardContent className="p-3">
                          <h3 className="font-medium text-sm line-clamp-1 group-hover:text-primary transition-colors">
                            {name}
                          </h3>
                          {description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                              {description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-0.5">
                              <TrendingUp className="w-3 h-3" />
                              {entity.search_count}
                            </span>
                            {entity.news_count !== undefined && entity.news_count > 0 && (
                              <span className="flex items-center gap-0.5">
                                <Newspaper className="w-3 h-3" />
                                {entity.news_count}
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {entities.map((entity) => {
                  const name = language === 'en' && entity.name_en ? entity.name_en : entity.name;
                  const description = language === 'en' && entity.description_en 
                    ? entity.description_en 
                    : entity.description;

                  return (
                    <Link
                      key={entity.id}
                      to={`/wiki/${entity.slug || entity.id}`}
                      className="flex items-center gap-4 p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors group"
                    >
                      {entity.image_url ? (
                        <img
                          src={entity.image_url}
                          alt={name}
                          className="w-14 h-14 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          {getEntityIcon(entity.entity_type)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium group-hover:text-primary transition-colors">
                            {name}
                          </h3>
                          <Badge variant="outline" className="text-[10px]">
                            {entity.entity_type}
                          </Badge>
                        </div>
                        {description && (
                          <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                            {description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-shrink-0">
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-4 h-4" />
                          {entity.search_count}
                        </span>
                        {entity.news_count !== undefined && entity.news_count > 0 && (
                          <span className="flex items-center gap-1">
                            <Newspaper className="w-4 h-4" />
                            {entity.news_count}
                          </span>
                        )}
                        <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              {t.noResults}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
