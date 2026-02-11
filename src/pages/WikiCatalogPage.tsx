import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { 
  Search, User, Building2, Globe, Filter, Grid, List, 
  TrendingUp, Newspaper, ArrowRight, X
} from "lucide-react";
import { Header } from "@/components/Header";
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingEntities } from "@/components/TrendingEntities";
import { WikiCatalogSeoContent } from "@/components/WikiCatalogSeoContent";
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

// Ukrainian and English alphabet letters
const ALPHABET_UK = 'АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЮЯ'.split('');
const ALPHABET_EN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function WikiCatalogPage() {
  const { language } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFilter = searchParams.get('category') || '';
  const letterFilter = searchParams.get('letter') || '';
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Get alphabet based on language
  const alphabet = language === 'uk' ? ALPHABET_UK : ALPHABET_EN;

  const setLetterFilter = (letter: string) => {
    if (letter) {
      searchParams.set('letter', letter);
    } else {
      searchParams.delete('letter');
    }
    setSearchParams(searchParams);
  };

  const clearLetterFilter = () => {
    searchParams.delete('letter');
    setSearchParams(searchParams);
  };

  const clearCategoryFilter = () => {
    searchParams.delete('category');
    setSearchParams(searchParams);
  };

  // Fetch entities with news count, sorted by last mention
  const { data: entities, isLoading } = useQuery<WikiEntity[]>({
    queryKey: ['wiki-catalog', searchTerm, filterType, categoryFilter, letterFilter],
    queryFn: async () => {
      // Build query for entities first - more efficient
      let query = supabase
        .from('wiki_entities')
        .select('id, wiki_id, entity_type, name, name_en, description, description_en, image_url, search_count, slug')
        .order('search_count', { ascending: false })
        .limit(100);

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,name_en.ilike.%${searchTerm}%`);
      }

      if (filterType !== 'all') {
        query = query.eq('entity_type', filterType);
      }

      // Letter filter - search by first letter of name
      if (letterFilter) {
        query = query.or(`name.ilike.${letterFilter}%,name_en.ilike.${letterFilter}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) return [];

      // Get news counts only for the entities we're displaying (batch by IDs)
      const entityIds = data.map(e => e.id);
      const { data: newsLinks } = await supabase
        .from('news_wiki_entities')
        .select('wiki_entity_id')
        .in('wiki_entity_id', entityIds);

      // Count news per entity
      const entityStats = new Map<string, number>();
      for (const link of newsLinks || []) {
        entityStats.set(link.wiki_entity_id, (entityStats.get(link.wiki_entity_id) || 0) + 1);
      }

      // Add news counts
      const enrichedData = data.map(e => ({
        ...e,
        news_count: entityStats.get(e.id) || 0,
      }));

      // Sort by news_count first, then by search_count
      enrichedData.sort((a, b) => {
        if (b.news_count !== a.news_count) {
          return b.news_count - a.news_count;
        }
        return b.search_count - a.search_count;
      });

      return enrichedData as WikiEntity[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache
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
        canonicalUrl="https://bravennow.com/wiki"
        breadcrumbs={[
          {
            name: language === 'uk' ? 'Головна' : 'Home',
            url: 'https://bravennow.com/',
          },
          {
            name: t.title,
            url: 'https://bravennow.com/wiki',
          },
        ]}
        schemaType="CollectionPage"
        schemaExtra={{
          url: 'https://bravennow.com/wiki',
          mainEntity: {
            '@type': 'ItemList',
            name: t.title,
            description: t.description,
          },
        }}
      />

      <div className="min-h-screen bg-background">
        <Header />

        <main className="container mx-auto px-4 py-8">
          {/* Hero Section */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">{t.title}</h1>
            <p className="text-muted-foreground">{t.description}</p>
          </div>

          {/* Category Filter Active */}
          {categoryFilter && (
            <div className="mb-6 flex items-center gap-2">
              <span className="text-muted-foreground text-sm">
                {language === 'uk' ? 'Фільтр категорії:' : 'Category filter:'}
              </span>
              <Badge variant="secondary" className="text-sm gap-1">
                {categoryFilter}
                <button onClick={clearCategoryFilter} className="hover:text-destructive ml-1">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            </div>
          )}

          {/* Letter Filter Active */}
          {letterFilter && (
            <div className="mb-6 flex items-center gap-2">
              <span className="text-muted-foreground text-sm">
                {language === 'uk' ? 'Фільтр за літерою:' : 'Letter filter:'}
              </span>
              <Badge variant="secondary" className="text-sm gap-1">
                {letterFilter}
                <button onClick={clearLetterFilter} className="hover:text-destructive ml-1">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            </div>
          )}

          {/* Alphabet Filter */}
          <div className="mb-6 overflow-x-auto">
            <div className="flex gap-1 min-w-max pb-2">
              <Button
                variant={!letterFilter ? 'default' : 'ghost'}
                size="sm"
                className="min-w-[32px] h-8 px-2"
                onClick={clearLetterFilter}
              >
                {language === 'uk' ? 'Всі' : 'All'}
              </Button>
              {alphabet.map((letter) => (
                <Button
                  key={letter}
                  variant={letterFilter === letter ? 'default' : 'ghost'}
                  size="sm"
                  className="min-w-[32px] h-8 px-2 font-medium"
                  onClick={() => setLetterFilter(letter)}
                >
                  {letter}
                </Button>
              ))}
            </div>
          </div>

          {/* Trending Entities - Top 4 by 72h mentions */}
          <div className="mb-8">
            <TrendingEntities />
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

          {/* SEO Content Section */}
          <WikiCatalogSeoContent />
        </main>
      </div>
    </>
  );
}
