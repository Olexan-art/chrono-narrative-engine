import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { 
  ArrowLeft, ExternalLink, User, Building2, Globe, Newspaper, 
  RefreshCw, Trash2, TrendingUp, ImageIcon, Sparkles, Network,
  Eye, Pencil, Loader2, Tag
} from "lucide-react";
import { Header } from "@/components/Header";
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAdminStore } from "@/stores/adminStore";
import { callEdgeFunction } from "@/lib/api";
import { toast } from "sonner";

interface WikiEntity {
  id: string;
  wiki_id: string;
  entity_type: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  image_url: string | null;
  wiki_url: string;
  wiki_url_en: string | null;
  extract: string | null;
  extract_en: string | null;
  search_count: number;
  created_at: string;
  last_searched_at: string | null;
}

interface NewsItem {
  id: string;
  slug: string | null;
  title: string;
  title_en: string | null;
  description: string | null;
  description_en: string | null;
  image_url: string | null;
  published_at: string | null;
  themes: string[] | null;
  themes_en: string[] | null;
  country: {
    code: string;
    flag: string;
    name: string;
  };
}

interface RelatedEntity {
  id: string;
  name: string;
  name_en: string | null;
  image_url: string | null;
  entity_type: string;
  shared_news_count: number;
}

interface OutrageInk {
  id: string;
  image_url: string;
  title: string | null;
  likes: number;
  dislikes: number;
}

export default function WikiEntityPage() {
  const { entityId } = useParams<{ entityId: string }>();
  const { language } = useLanguage();
  const { isAuthenticated: isAdmin } = useAdminStore();
  const [isEditingExtract, setIsEditingExtract] = useState(false);
  const [editedExtract, setEditedExtract] = useState("");
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const queryClient = useQueryClient();

  // Fetch entity data
  const { data: entity, isLoading } = useQuery({
    queryKey: ['wiki-entity', entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wiki_entities')
        .select('*')
        .eq('id', entityId)
        .single();

      if (error) throw error;
      return data as WikiEntity;
    },
    enabled: !!entityId,
  });

  // Fetch linked news with themes
  const { data: linkedNews = [] } = useQuery({
    queryKey: ['entity-news', entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news_wiki_entities')
        .select(`
          news_item:news_rss_items(
            id, slug, title, title_en, description, description_en,
            image_url, published_at, themes, themes_en, country_id,
            country:news_countries(code, flag, name)
          )
        `)
        .eq('wiki_entity_id', entityId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return data
        .filter(d => d.news_item)
        .map(d => {
          const item = d.news_item as any;
          return { ...item, country: item.country } as NewsItem;
        });
    },
    enabled: !!entityId,
  });

  // Aggregate views from all news
  const { data: aggregatedViews = 0 } = useQuery({
    queryKey: ['entity-views', entityId],
    queryFn: async () => {
      const newsIds = linkedNews.map(n => n.id);
      if (!newsIds.length) return 0;
      
      const { data, error } = await supabase
        .from('view_counts')
        .select('views')
        .eq('entity_type', 'news')
        .in('entity_id', newsIds);
      
      if (error) return 0;
      return data.reduce((sum, v) => sum + (v.views || 0), 0);
    },
    enabled: linkedNews.length > 0,
  });

  // Extract topics from news
  const allTopics = linkedNews.reduce((acc, news) => {
    const themes = language === 'en' && news.themes_en ? news.themes_en : news.themes;
    if (themes) {
      themes.forEach(t => {
        acc[t] = (acc[t] || 0) + 1;
      });
    }
    return acc;
  }, {} as Record<string, number>);

  const sortedTopics = Object.entries(allTopics)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  // Fetch related entities (entities that appear in the same news)
  const { data: relatedEntities = [] } = useQuery({
    queryKey: ['related-entities', entityId],
    queryFn: async () => {
      // Get all news IDs where this entity appears
      const { data: newsLinks } = await supabase
        .from('news_wiki_entities')
        .select('news_item_id')
        .eq('wiki_entity_id', entityId);

      if (!newsLinks?.length) return [];

      const newsIds = newsLinks.map(l => l.news_item_id);

      // Find other entities in those same news items
      const { data: otherLinks } = await supabase
        .from('news_wiki_entities')
        .select(`
          wiki_entity:wiki_entities(id, name, name_en, image_url, entity_type)
        `)
        .in('news_item_id', newsIds)
        .neq('wiki_entity_id', entityId);

      if (!otherLinks) return [];

      // Count occurrences
      const entityCounts = new Map<string, { entity: any; count: number }>();
      for (const link of otherLinks) {
        if (!link.wiki_entity) continue;
        const e = link.wiki_entity as any;
        const existing = entityCounts.get(e.id);
        if (existing) {
          existing.count++;
        } else {
          entityCounts.set(e.id, { entity: e, count: 1 });
        }
      }

      return Array.from(entityCounts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map(({ entity, count }) => ({
          ...entity,
          shared_news_count: count,
        })) as RelatedEntity[];
    },
    enabled: !!entityId,
  });

  // Fetch caricatures
  const { data: caricatures = [] } = useQuery({
    queryKey: ['entity-caricatures', entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outrage_ink_entities')
        .select(`
          outrage_ink:outrage_ink(id, image_url, title, likes, dislikes)
        `)
        .eq('wiki_entity_id', entityId);

      if (error) return [];

      return data
        .filter(d => d.outrage_ink)
        .map(d => d.outrage_ink as OutrageInk);
    },
    enabled: !!entityId,
  });

  // Delete entity mutation (admin only)
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('wiki_entities')
        .delete()
        .eq('id', entityId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Сутність видалено');
      window.location.href = '/wiki';
    },
  });

  // Refresh entity data from Wikipedia
  const refreshMutation = useMutation({
    mutationFn: async () => {
      const result = await callEdgeFunction<{ success: boolean; error?: string }>('search-wiki', {
        wikiUrl: entity?.wiki_url,
        refreshEntity: entityId,
        language: language === 'uk' ? 'uk' : 'en',
      });
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      toast.success('Дані оновлено');
      queryClient.invalidateQueries({ queryKey: ['wiki-entity', entityId] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-96" />
        </main>
      </div>
    );
  }

  if (!entity) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <p>Entity not found</p>
        </main>
      </div>
    );
  }

  const name = language === 'en' && entity.name_en ? entity.name_en : entity.name;
  const description = language === 'en' && entity.description_en ? entity.description_en : entity.description;
  const extract = language === 'en' && entity.extract_en ? entity.extract_en : entity.extract;
  const wikiUrl = language === 'en' && entity.wiki_url_en ? entity.wiki_url_en : entity.wiki_url;

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'person': return <User className="w-5 h-5" />;
      case 'company': return <Building2 className="w-5 h-5" />;
      default: return <Globe className="w-5 h-5" />;
    }
  };

  const entityTypeLabel = {
    person: language === 'uk' ? 'Персона' : language === 'pl' ? 'Osoba' : 'Person',
    company: language === 'uk' ? 'Компанія' : language === 'pl' ? 'Firma' : 'Company',
    organization: language === 'uk' ? 'Організація' : language === 'pl' ? 'Organizacja' : 'Organization',
    unknown: language === 'uk' ? 'Сутність' : language === 'pl' ? 'Podmiot' : 'Entity',
  }[entity.entity_type] || entity.entity_type;

  return (
    <>
      <SEOHead
        title={`${name} | Echoes Wiki`}
        description={description || extract?.slice(0, 160) || `Information about ${name}`}
        canonicalUrl={`https://echoes2.com/wiki/${entity.id}`}
        image={entity.image_url || undefined}
      />
      
      <div className="min-h-screen bg-background">
        <Header />
        
        <main className="container mx-auto px-4 py-8">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <Link to="/wiki" className="hover:text-foreground flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />
              {language === 'uk' ? 'Каталог сутностей' : 'Entity Catalog'}
            </Link>
            <span>/</span>
            <span className="text-foreground">{name}</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Hero Section */}
              <Card className="overflow-hidden">
                <div className="flex flex-col md:flex-row">
                  {/* Entity Image */}
                  <div className="md:w-64 flex-shrink-0">
                    {entity.image_url ? (
                      <img
                        src={entity.image_url}
                        alt={name}
                        className="w-full h-64 md:h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-64 bg-muted flex items-center justify-center">
                        {getEntityIcon(entity.entity_type)}
                      </div>
                    )}
                  </div>

                  {/* Entity Info */}
                  <CardContent className="flex-1 p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <Badge variant="secondary" className="mb-2">
                          {getEntityIcon(entity.entity_type)}
                          <span className="ml-1">{entityTypeLabel}</span>
                        </Badge>
                        <h1 className="text-2xl font-bold">{name}</h1>
                        {description && (
                          <p className="text-muted-foreground mt-1">{description}</p>
                        )}
                      </div>
                      
                      {/* Admin Actions */}
                      {isAdmin && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => refreshMutation.mutate()}
                            disabled={refreshMutation.isPending}
                          >
                            <RefreshCw className={`w-4 h-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => {
                              if (confirm('Видалити сутність?')) {
                                deleteMutation.mutate();
                              }
                            }}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="flex flex-wrap gap-4 mt-4 text-sm">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Newspaper className="w-4 h-4" />
                        <span>{linkedNews.length} {language === 'uk' ? 'новин' : 'news articles'}</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <TrendingUp className="w-4 h-4" />
                        <span>{entity.search_count} {language === 'uk' ? 'згадок' : 'mentions'}</span>
                      </div>
                    </div>

                    {/* Wikipedia Link */}
                    <div className="mt-4">
                      <a
                        href={wikiUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Wikipedia
                      </a>
                    </div>
                  </CardContent>
                </div>
              </Card>

              {/* Key Information Block */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="w-5 h-5 text-primary" />
                    {language === 'uk' ? 'Ключова інформація' : 'Key Information'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {extract ? (
                    <p className="text-muted-foreground leading-relaxed">{extract}</p>
                  ) : (
                    <p className="text-muted-foreground italic">
                      {language === 'uk' ? 'Інформація ще не завантажена' : 'Information not yet loaded'}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Caricatures */}
              {caricatures.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <ImageIcon className="w-5 h-5 text-primary" />
                      {language === 'uk' ? 'Карикатури' : 'Caricatures'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {caricatures.map((c) => (
                        <Link key={c.id} to="/ink-abyss" className="group">
                          <div className="aspect-square rounded-lg overflow-hidden border border-border">
                            <img
                              src={c.image_url}
                              alt={c.title || ''}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          </div>
                          {c.title && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{c.title}</p>
                          )}
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* News Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Newspaper className="w-5 h-5 text-primary" />
                    {language === 'uk' ? 'Новини з цією сутністю' : 'News featuring this entity'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {linkedNews.length > 0 ? (
                    <div className="space-y-4">
                      {linkedNews.map((news) => (
                        <Link
                          key={news.id}
                          to={news.slug ? `/news/${news.country?.code?.toLowerCase()}/${news.slug}` : '#'}
                          className="flex gap-4 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                        >
                          {news.image_url && (
                            <img
                              src={news.image_url}
                              alt=""
                              className="w-20 h-20 rounded object-cover flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span>{news.country?.flag}</span>
                              {news.published_at && (
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(news.published_at), 'dd.MM.yyyy')}
                                </span>
                              )}
                            </div>
                            <h3 className="font-medium line-clamp-2">
                              {language === 'en' && news.title_en ? news.title_en : news.title}
                            </h3>
                            {news.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                {language === 'en' && news.description_en ? news.description_en : news.description}
                              </p>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      {language === 'uk' ? 'Новин поки немає' : 'No news yet'}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Related Entities */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Network className="w-5 h-5 text-primary" />
                    {language === 'uk' ? "Пов'язані сутності" : 'Related Entities'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {relatedEntities.length > 0 ? (
                    <div className="space-y-3">
                      {relatedEntities.map((related) => (
                        <Link
                          key={related.id}
                          to={`/wiki/${related.id}`}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          {related.image_url ? (
                            <img
                              src={related.image_url}
                              alt=""
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                              {related.entity_type === 'person' ? (
                                <User className="w-4 h-4" />
                              ) : (
                                <Building2 className="w-4 h-4" />
                              )}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm line-clamp-1">
                              {language === 'en' && related.name_en ? related.name_en : related.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {related.shared_news_count} {language === 'uk' ? 'спільних новин' : 'shared news'}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm text-center py-4">
                      {language === 'uk' ? "Пов'язаних сутностей не знайдено" : 'No related entities found'}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Statistics */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {language === 'uk' ? 'Статистика' : 'Statistics'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {language === 'uk' ? 'Додано' : 'Added'}
                    </span>
                    <span>{format(new Date(entity.created_at), 'dd.MM.yyyy')}</span>
                  </div>
                  {entity.last_searched_at && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {language === 'uk' ? 'Останній пошук' : 'Last search'}
                      </span>
                      <span>{format(new Date(entity.last_searched_at), 'dd.MM.yyyy HH:mm')}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {language === 'uk' ? 'Всього згадок' : 'Total mentions'}
                    </span>
                    <span>{entity.search_count}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
