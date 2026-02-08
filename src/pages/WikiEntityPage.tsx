import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { 
  ArrowLeft, ExternalLink, User, Building2, Globe, Newspaper, 
  RefreshCw, Trash2, ImageIcon, Sparkles, Network,
  Eye, Pencil, Loader2, Tag, Search, Check, X, ChevronLeft, ChevronRight
} from "lucide-react";
import { Header } from "@/components/Header";
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { EntityViewsChart } from "@/components/EntityViewsChart";
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

interface ExtendedWikiData {
  title: string;
  extract: string;
  description?: string;
  image?: string;
  categories?: string[];
  infobox?: Record<string, string>;
}

const NEWS_PER_PAGE = 70;

export default function WikiEntityPage() {
  const { entityId } = useParams<{ entityId: string }>();
  const { language } = useLanguage();
  const { isAuthenticated: isAdmin } = useAdminStore();
  const [isEditingExtract, setIsEditingExtract] = useState(false);
  const [editedExtract, setEditedExtract] = useState("");
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [isExtendedParsing, setIsExtendedParsing] = useState(false);
  const [extendedData, setExtendedData] = useState<ExtendedWikiData | null>(null);
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set());
  const [newsPage, setNewsPage] = useState(1);
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

  // Fetch ALL linked news (no limit for proper counting and pagination)
  const { data: allLinkedNews = [] } = useQuery({
    queryKey: ['entity-news-all', entityId],
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
        .order('created_at', { ascending: false });

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

  // Pagination logic for news
  const totalNewsPages = Math.ceil(allLinkedNews.length / NEWS_PER_PAGE);
  const paginatedNews = useMemo(() => {
    const start = (newsPage - 1) * NEWS_PER_PAGE;
    return allLinkedNews.slice(start, start + NEWS_PER_PAGE);
  }, [allLinkedNews, newsPage]);

  // Count total mentions (number of linked news)
  const totalMentions = allLinkedNews.length;

  // Get all news IDs for aggregating views
  const newsIds = useMemo(() => allLinkedNews.map(n => n.id), [allLinkedNews]);

  // Aggregate views from all news
  const { data: aggregatedViews = 0 } = useQuery({
    queryKey: ['entity-views', entityId, newsIds.length],
    queryFn: async () => {
      if (!newsIds.length) return 0;
      
      const { data, error } = await supabase
        .from('view_counts')
        .select('views')
        .eq('entity_type', 'news')
        .in('entity_id', newsIds);
      
      if (error) return 0;
      return data.reduce((sum, v) => sum + (v.views || 0), 0);
    },
    enabled: newsIds.length > 0,
  });

  // Fetch daily views for chart (last 7 days)
  const { data: dailyViews = [] } = useQuery({
    queryKey: ['entity-daily-views', entityId, newsIds.length],
    queryFn: async () => {
      if (!newsIds.length) return [];
      
      const { data, error } = await supabase
        .from('daily_views')
        .select('view_date, views, entity_id')
        .eq('entity_type', 'news')
        .in('entity_id', newsIds)
        .gte('view_date', format(subDays(new Date(), 7), 'yyyy-MM-dd'))
        .order('view_date', { ascending: true });
      
      if (error) return [];
      
      // Aggregate by date
      const byDate: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
        byDate[d] = 0;
      }
      
      for (const row of data) {
        if (byDate[row.view_date] !== undefined) {
          byDate[row.view_date] += row.views;
        }
      }
      
      return Object.entries(byDate).map(([date, views]) => ({
        date,
        label: format(new Date(date), 'dd.MM'),
        views,
      }));
    },
    enabled: newsIds.length > 0,
  });

  // Extract topics from news
  const allTopics = allLinkedNews.reduce((acc, news) => {
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

      const newsIdsForRelated = newsLinks.map(l => l.news_item_id);

      // Find other entities in those same news items
      const { data: otherLinks } = await supabase
        .from('news_wiki_entities')
        .select(`
          wiki_entity:wiki_entities(id, name, name_en, image_url, entity_type)
        `)
        .in('news_item_id', newsIdsForRelated)
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

  // Fetch caricatures - search via news items linked to this entity
  const { data: caricatures = [] } = useQuery({
    queryKey: ['entity-caricatures', entityId, newsIds.length],
    queryFn: async () => {
      // First try direct entity links
      const { data: directLinks } = await supabase
        .from('outrage_ink_entities')
        .select('outrage_ink_id')
        .eq('wiki_entity_id', entityId);

      const directIds = directLinks?.map(l => l.outrage_ink_id) || [];

      // Also search via news items (outrage_ink has news_item_id)
      if (newsIds.length > 0) {
        const { data: newsLinks } = await supabase
          .from('outrage_ink')
          .select('id')
          .in('news_item_id', newsIds);
        
        const newsBasedIds = newsLinks?.map(l => l.id) || [];
        
        // Combine and deduplicate
        const allInkIds = [...new Set([...directIds, ...newsBasedIds])];
        
        if (allInkIds.length === 0) return [];
        
        const { data: inks } = await supabase
          .from('outrage_ink')
          .select('id, image_url, title, likes, dislikes')
          .in('id', allInkIds);
        
        return (inks || []) as OutrageInk[];
      }

      if (directIds.length === 0) return [];

      const { data: inks } = await supabase
        .from('outrage_ink')
        .select('id, image_url, title, likes, dislikes')
        .in('id', directIds);

      return (inks || []) as OutrageInk[];
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

  // Save extract mutation
  const saveExtractMutation = useMutation({
    mutationFn: async (newExtract: string) => {
      const field = language === 'en' ? 'extract_en' : 'extract';
      const { error } = await supabase
        .from('wiki_entities')
        .update({ [field]: newExtract })
        .eq('id', entityId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Збережено');
      setIsEditingExtract(false);
      queryClient.invalidateQueries({ queryKey: ['wiki-entity', entityId] });
    },
  });

  // AI format extract
  const formatWithAi = async () => {
    setIsAiProcessing(true);
    try {
      const result = await callEdgeFunction<{ success: boolean; formatted?: string; error?: string }>('search-wiki', {
        action: 'format_extract',
        entityId,
        currentExtract: editedExtract || extract,
        entityName: name,
        language: language === 'uk' ? 'uk' : 'en',
      });
      if (result.success && result.formatted) {
        setEditedExtract(result.formatted);
        toast.success('Відформатовано');
      } else {
        throw new Error(result.error || 'AI formatting failed');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsAiProcessing(false);
    }
  };

  // Extended Wikipedia parsing
  const runExtendedParsing = async () => {
    if (!entity) return;
    setIsExtendedParsing(true);
    try {
      const result = await callEdgeFunction<{ 
        success: boolean; 
        data?: ExtendedWikiData; 
        error?: string 
      }>('search-wiki', {
        action: 'extended_parse',
        wikiUrl: entity.wiki_url,
        language: language === 'uk' ? 'uk' : 'en',
      });
      
      if (result.success && result.data) {
        setExtendedData(result.data);
        setSelectedSections(new Set(['extract']));
      } else {
        throw new Error(result.error || 'Extended parsing failed');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsExtendedParsing(false);
    }
  };

  // Apply selected sections from extended data
  const applyExtendedData = async () => {
    if (!extendedData) return;
    
    const updates: Record<string, string | null> = {};
    
    if (selectedSections.has('extract') && extendedData.extract) {
      const field = language === 'en' ? 'extract_en' : 'extract';
      updates[field] = extendedData.extract;
    }
    if (selectedSections.has('description') && extendedData.description) {
      const field = language === 'en' ? 'description_en' : 'description';
      updates[field] = extendedData.description;
    }
    if (selectedSections.has('image') && extendedData.image) {
      updates['image_url'] = extendedData.image;
    }

    if (Object.keys(updates).length === 0) {
      toast.info('Нічого не вибрано');
      return;
    }

    const { error } = await supabase
      .from('wiki_entities')
      .update(updates)
      .eq('id', entityId);

    if (error) {
      toast.error('Помилка збереження');
      return;
    }

    toast.success('Дані оновлено');
    setExtendedData(null);
    queryClient.invalidateQueries({ queryKey: ['wiki-entity', entityId] });
  };

  const toggleSection = (section: string) => {
    const newSet = new Set(selectedSections);
    if (newSet.has(section)) {
      newSet.delete(section);
    } else {
      newSet.add(section);
    }
    setSelectedSections(newSet);
  };

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

          {/* Big Aggregated Rating Block - Always Show */}
          <div className="mb-6 flex items-center justify-center gap-4 py-6 px-8 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 rounded-2xl border-2 border-primary/30 shadow-lg">
            <div className="bg-primary/20 p-3 rounded-full">
              <Eye className="w-10 h-10 text-primary" />
            </div>
            <div className="text-center">
              <span className="text-4xl md:text-5xl font-bold text-primary">
                {aggregatedViews.toLocaleString()}
              </span>
              <p className="text-lg text-muted-foreground mt-1">
                {language === 'uk' ? 'Агрегований рейтинг переглядів' : 'Aggregated Views Rating'}
              </p>
            </div>
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
                            title="Оновити з Wikipedia"
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
                            title="Видалити"
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
                        <span>{totalMentions} {language === 'uk' ? 'новин' : 'news articles'}</span>
                      </div>
                      {caricatures.length > 0 && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <ImageIcon className="w-4 h-4" />
                          <span>{caricatures.length} {language === 'uk' ? 'карикатур' : 'caricatures'}</span>
                        </div>
                      )}
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

              {/* Views Chart */}
              {dailyViews.some(d => d.views > 0) && (
                <EntityViewsChart data={dailyViews} />
              )}

              {/* Topics Block */}
              {sortedTopics.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Tag className="w-5 h-5 text-primary" />
                      Topics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {sortedTopics.map(([topic, count]) => (
                        <Badge key={topic} variant="outline" className="text-sm">
                          {topic}
                          <span className="ml-1 text-muted-foreground">({count})</span>
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Key Information Block */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Sparkles className="w-5 h-5 text-primary" />
                      {language === 'uk' ? 'Ключова інформація' : 'Key Information'}
                    </CardTitle>
                    {isAdmin && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={runExtendedParsing}
                          disabled={isExtendedParsing}
                        >
                          {isExtendedParsing ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <Search className="w-4 h-4 mr-1" />
                          )}
                          {language === 'uk' ? 'Розширений парсінг' : 'Extended Parse'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditedExtract(extract || '');
                            setIsEditingExtract(true);
                          }}
                        >
                          <Pencil className="w-4 h-4 mr-1" />
                          {language === 'uk' ? 'Редагувати' : 'Edit'}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isEditingExtract ? (
                    <div className="space-y-3">
                      <Textarea
                        value={editedExtract}
                        onChange={(e) => setEditedExtract(e.target.value)}
                        rows={8}
                        className="w-full"
                      />
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          onClick={() => saveExtractMutation.mutate(editedExtract)}
                          disabled={saveExtractMutation.isPending}
                        >
                          {language === 'uk' ? 'Зберегти' : 'Save'}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={formatWithAi}
                          disabled={isAiProcessing}
                        >
                          {isAiProcessing ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <Sparkles className="w-4 h-4 mr-1" />
                          )}
                          {language === 'uk' ? 'Форматувати ШІ' : 'Format with AI'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setIsEditingExtract(false)}
                        >
                          {language === 'uk' ? 'Скасувати' : 'Cancel'}
                        </Button>
                      </div>
                    </div>
                  ) : extract ? (
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{extract}</p>
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
                      {language === 'uk' ? 'Карикатури' : 'Caricatures'} ({caricatures.length})
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

              {/* News Section with Pagination */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Newspaper className="w-5 h-5 text-primary" />
                    {language === 'uk' ? 'Новини з цією сутністю' : 'News featuring this entity'}
                    <span className="text-muted-foreground font-normal">({totalMentions})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {paginatedNews.length > 0 ? (
                    <div className="space-y-4">
                      {paginatedNews.map((news) => (
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

                      {/* Pagination */}
                      {totalNewsPages > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setNewsPage(p => Math.max(1, p - 1))}
                            disabled={newsPage === 1}
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          <span className="text-sm text-muted-foreground">
                            {newsPage} / {totalNewsPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setNewsPage(p => Math.min(totalNewsPages, p + 1))}
                            disabled={newsPage === totalNewsPages}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
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
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {language === 'uk' ? 'Згадок у новинах' : 'News mentions'}
                    </span>
                    <span className="font-medium">{totalMentions}</span>
                  </div>
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      {language === 'uk' ? 'Переглядів' : 'Views'}
                    </span>
                    <span className="font-bold text-lg text-primary">{aggregatedViews.toLocaleString()}</span>
                  </div>
                  {caricatures.length > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <ImageIcon className="w-4 h-4" />
                        {language === 'uk' ? 'Карикатур' : 'Caricatures'}
                      </span>
                      <span className="font-medium">{caricatures.length}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>

      {/* Extended Parsing Modal */}
      <Dialog open={!!extendedData} onOpenChange={() => setExtendedData(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {language === 'uk' ? 'Знайдені дані з Wikipedia' : 'Wikipedia Data Found'}
            </DialogTitle>
          </DialogHeader>

          {extendedData && (
            <div className="space-y-4">
              {/* Title */}
              <div className="p-3 border rounded-lg">
                <p className="font-medium">{extendedData.title}</p>
              </div>

              {/* Description */}
              {extendedData.description && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedSections.has('description')}
                      onCheckedChange={() => toggleSection('description')}
                    />
                    <span className="font-medium">{language === 'uk' ? 'Опис' : 'Description'}</span>
                  </div>
                  <p className="text-sm text-muted-foreground ml-6">{extendedData.description}</p>
                </div>
              )}

              {/* Extract */}
              {extendedData.extract && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedSections.has('extract')}
                      onCheckedChange={() => toggleSection('extract')}
                    />
                    <span className="font-medium">{language === 'uk' ? 'Витяг' : 'Extract'}</span>
                  </div>
                  <p className="text-sm text-muted-foreground ml-6 line-clamp-6">{extendedData.extract}</p>
                </div>
              )}

              {/* Image */}
              {extendedData.image && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedSections.has('image')}
                      onCheckedChange={() => toggleSection('image')}
                    />
                    <span className="font-medium">{language === 'uk' ? 'Зображення' : 'Image'}</span>
                  </div>
                  <img 
                    src={extendedData.image} 
                    alt="" 
                    className="ml-6 w-32 h-32 object-cover rounded-lg"
                  />
                </div>
              )}

              {/* Categories */}
              {extendedData.categories && extendedData.categories.length > 0 && (
                <div className="space-y-2">
                  <span className="font-medium">{language === 'uk' ? 'Категорії' : 'Categories'}</span>
                  <div className="flex flex-wrap gap-1 ml-0">
                    {extendedData.categories.slice(0, 10).map((cat, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{cat}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendedData(null)}>
              <X className="w-4 h-4 mr-1" />
              {language === 'uk' ? 'Скасувати' : 'Cancel'}
            </Button>
            <Button onClick={applyExtendedData} disabled={selectedSections.size === 0}>
              <Check className="w-4 h-4 mr-1" />
              {language === 'uk' ? 'Застосувати вибране' : 'Apply Selected'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
