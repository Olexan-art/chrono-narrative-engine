import { useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { 
  ArrowLeft, ExternalLink, User, Building2, Globe, Newspaper, 
  RefreshCw, Trash2, ImageIcon, Sparkles, Network,
  Eye, Pencil, Loader2, Tag, Search, Check, X, ChevronLeft, ChevronRight,
  Download, FileText, ZoomIn, ThumbsUp, ThumbsDown, Hash, Edit,
  Briefcase, Flame, Shield, Heart, Zap, BookOpen, Scale, Megaphone, 
  Swords, FolderOpen
} from "lucide-react";
import { Header } from "@/components/Header";
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { EntityViewsChart } from "@/components/EntityViewsChart";
import { MarkdownContent } from "@/components/MarkdownContent";
import { EntityIntersectionGraph } from "@/components/EntityIntersectionGraph";
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
  slug: string | null;
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
  keywords: string[] | null;
  likes: number;
  dislikes: number;
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
  slug: string | null;
  shared_news_count: number;
}

interface OutrageInk {
  id: string;
  image_url: string;
  title: string | null;
  likes: number;
  dislikes: number;
  news_item_id: string | null;
}

interface ExtendedWikiData {
  title: string;
  extract: string;
  description?: string;
  image?: string;
  categories?: string[];
  infobox?: Record<string, string>;
}

interface SecondaryConnection {
  from: RelatedEntity;
  to: RelatedEntity;
  weight: number;
}

interface CaricatureLightbox {
  caricature: OutrageInk;
  newsItem?: NewsItem;
}

// Topic icons mapping - larger icons with more topics
const TOPIC_ICONS: Record<string, { icon: React.ReactNode; color: string }> = {
  'політика': { icon: <Globe className="w-5 h-5" />, color: 'text-blue-500' },
  'politics': { icon: <Globe className="w-5 h-5" />, color: 'text-blue-500' },
  'економіка': { icon: <Briefcase className="w-5 h-5" />, color: 'text-emerald-500' },
  'economy': { icon: <Briefcase className="w-5 h-5" />, color: 'text-emerald-500' },
  'бізнес': { icon: <Building2 className="w-5 h-5" />, color: 'text-indigo-500' },
  'business': { icon: <Building2 className="w-5 h-5" />, color: 'text-indigo-500' },
  'технології': { icon: <Zap className="w-5 h-5" />, color: 'text-violet-500' },
  'technology': { icon: <Zap className="w-5 h-5" />, color: 'text-violet-500' },
  'скандал': { icon: <Flame className="w-5 h-5" />, color: 'text-orange-500' },
  'scandal': { icon: <Flame className="w-5 h-5" />, color: 'text-orange-500' },
  'війна': { icon: <Shield className="w-5 h-5" />, color: 'text-red-500' },
  'war': { icon: <Shield className="w-5 h-5" />, color: 'text-red-500' },
  'здоров\'я': { icon: <Heart className="w-5 h-5" />, color: 'text-rose-500' },
  'health': { icon: <Heart className="w-5 h-5" />, color: 'text-rose-500' },
  'спорт': { icon: <ThumbsUp className="w-5 h-5" />, color: 'text-green-500' },
  'sport': { icon: <ThumbsUp className="w-5 h-5" />, color: 'text-green-500' },
  'наука': { icon: <Sparkles className="w-5 h-5" />, color: 'text-cyan-500' },
  'science': { icon: <Sparkles className="w-5 h-5" />, color: 'text-cyan-500' },
  'право': { icon: <Scale className="w-5 h-5" />, color: 'text-amber-500' },
  'law': { icon: <Scale className="w-5 h-5" />, color: 'text-amber-500' },
  'культура': { icon: <BookOpen className="w-5 h-5" />, color: 'text-purple-500' },
  'culture': { icon: <BookOpen className="w-5 h-5" />, color: 'text-purple-500' },
  'медіа': { icon: <Megaphone className="w-5 h-5" />, color: 'text-pink-500' },
  'media': { icon: <Megaphone className="w-5 h-5" />, color: 'text-pink-500' },
};

const NEWS_PER_PAGE = 70;

export default function WikiEntityPage() {
  const { entityId } = useParams<{ entityId: string }>();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { isAuthenticated: isAdmin } = useAdminStore();
  const [isEditingExtract, setIsEditingExtract] = useState(false);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editedExtract, setEditedExtract] = useState("");
  const [editedName, setEditedName] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [isExtendedParsing, setIsExtendedParsing] = useState(false);
  const [isFetchingImages, setIsFetchingImages] = useState(false);
  const [extendedData, setExtendedData] = useState<ExtendedWikiData | null>(null);
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set());
  const [newsPage, setNewsPage] = useState(1);
  const [selectedCaricature, setSelectedCaricature] = useState<CaricatureLightbox | null>(null);
  const queryClient = useQueryClient();

  // Fetch entity data - support both slug and id
  const { data: entity, isLoading } = useQuery({
    queryKey: ['wiki-entity', entityId],
    queryFn: async () => {
      // Try by slug first, then by id
      let query = supabase.from('wiki_entities').select('*');
      
      // Check if it's a UUID pattern
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entityId || '');
      
      if (isUuid) {
        query = query.eq('id', entityId);
      } else {
        query = query.eq('slug', entityId);
      }
      
      const { data, error } = await query.single();

      if (error) {
        // Fallback: try slug if id failed
        if (isUuid) {
          const { data: slugData, error: slugError } = await supabase
            .from('wiki_entities')
            .select('*')
            .eq('slug', entityId)
            .single();
          if (!slugError && slugData) return slugData as WikiEntity;
        }
        throw error;
      }
      
      // Redirect to slug URL if accessed by ID and slug exists
      if (isUuid && data?.slug) {
        navigate(`/wiki/${data.slug}`, { replace: true });
      }
      
      return data as WikiEntity;
    },
    enabled: !!entityId,
  });

  // Fetch ALL linked news (no limit for proper counting and pagination)
  const { data: allLinkedNews = [] } = useQuery({
    queryKey: ['entity-news-all', entity?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news_wiki_entities')
        .select(`
          news_item:news_rss_items(
            id, slug, title, title_en, description, description_en,
            image_url, published_at, themes, themes_en, keywords, country_id,
            likes, dislikes,
            country:news_countries(code, flag, name)
          )
        `)
        .eq('wiki_entity_id', entity?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data
        .filter(d => d.news_item)
        .map(d => {
          const item = d.news_item as any;
          return { ...item, country: item.country } as NewsItem;
        });
    },
    enabled: !!entity?.id,
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

  // Calculate total news likes/dislikes
  const totalNewsLikes = useMemo(() => 
    allLinkedNews.reduce((sum, n) => sum + (n.likes || 0), 0),
    [allLinkedNews]
  );
  const totalNewsDislikes = useMemo(() => 
    allLinkedNews.reduce((sum, n) => sum + (n.dislikes || 0), 0),
    [allLinkedNews]
  );

  // Aggregate views from all news
  const { data: aggregatedViews = 0 } = useQuery({
    queryKey: ['entity-views', entity?.id, newsIds.length],
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

  // Fetch caricatures - search via news items linked to this entity
  const { data: caricatures = [] } = useQuery({
    queryKey: ['entity-caricatures', entity?.id, newsIds.length],
    queryFn: async () => {
      // First try direct entity links
      const { data: directLinks } = await supabase
        .from('outrage_ink_entities')
        .select('outrage_ink_id')
        .eq('wiki_entity_id', entity?.id);

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
          .select('id, image_url, title, likes, dislikes, news_item_id')
          .in('id', allInkIds);
        
        return (inks || []) as OutrageInk[];
      }

      if (directIds.length === 0) return [];

      const { data: inks } = await supabase
        .from('outrage_ink')
        .select('id, image_url, title, likes, dislikes, news_item_id')
        .in('id', directIds);

      return (inks || []) as OutrageInk[];
    },
    enabled: !!entity?.id,
  });

  // Calculate caricature likes/dislikes
  const totalCaricatureLikes = useMemo(() => 
    caricatures.reduce((sum, c) => sum + (c.likes || 0), 0),
    [caricatures]
  );
  const totalCaricatureDislikes = useMemo(() => 
    caricatures.reduce((sum, c) => sum + (c.dislikes || 0), 0),
    [caricatures]
  );

  // Combined aggregated rating: views + news likes + caricature likes
  const aggregatedRating = aggregatedViews + totalNewsLikes + totalCaricatureLikes;

  // Fetch daily views for chart (last 7 days)
  const { data: dailyViews = [] } = useQuery({
    queryKey: ['entity-daily-views', entity?.id, newsIds.length],
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

  // Extract aggregated keywords from news
  const allKeywords = useMemo(() => {
    const keywordCount: Record<string, number> = {};
    allLinkedNews.forEach(news => {
      if (news.keywords) {
        news.keywords.forEach(kw => {
          keywordCount[kw] = (keywordCount[kw] || 0) + 1;
        });
      }
    });
    return Object.entries(keywordCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
  }, [allLinkedNews]);

  // Fetch Wikipedia categories automatically
  const { data: wikiCategories = [] } = useQuery({
    queryKey: ['wiki-categories', entity?.id, entity?.wiki_url],
    queryFn: async (): Promise<string[]> => {
      if (!entity?.wiki_url) return [];
      
      try {
        // Extract page title from wiki URL
        const url = new URL(entity.wiki_url);
        const pathParts = url.pathname.split('/');
        const pageTitle = pathParts[pathParts.length - 1];
        
        // Determine wiki language
        const wikiLang = url.hostname.includes('uk.wikipedia') ? 'uk' : 'en';
        
        // Fetch categories from Wikipedia API
        const apiUrl = `https://${wikiLang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=categories&cllimit=20&format=json&origin=*`;
        
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        const pages = data?.query?.pages;
        if (!pages) return [];
        
        const pageId = Object.keys(pages)[0];
        const categories = pages[pageId]?.categories || [];
        
        return categories
          .map((c: { title: string }) => c.title.replace(/^(Category:|Категорія:)/i, ''))
          .filter((c: string) => !c.includes('Вікіпедія') && !c.includes('Wikipedia') && !c.includes('Articles') && c.length < 60);
      } catch {
        return [];
      }
    },
    enabled: !!entity?.wiki_url,
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });

  // Fetch related entities (entities that appear in the same news)
  const { data: relatedEntities = [] } = useQuery({
    queryKey: ['related-entities', entity?.id],
    queryFn: async () => {
      // Get all news IDs where this entity appears
      const { data: newsLinks } = await supabase
        .from('news_wiki_entities')
        .select('news_item_id')
        .eq('wiki_entity_id', entity?.id);

      if (!newsLinks?.length) return [];

      const newsIdsForRelated = newsLinks.map(l => l.news_item_id);

      // Find other entities in those same news items
      const { data: otherLinks } = await supabase
        .from('news_wiki_entities')
        .select(`
          wiki_entity:wiki_entities(id, name, name_en, image_url, entity_type, slug)
        `)
        .in('news_item_id', newsIdsForRelated)
        .neq('wiki_entity_id', entity?.id);

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
    enabled: !!entity?.id,
  });

  // Fetch secondary connections (connections between related entities)
  const { data: secondaryConnections = [] } = useQuery({
    queryKey: ['secondary-connections', entity?.id, relatedEntities.length],
    queryFn: async (): Promise<SecondaryConnection[]> => {
      if (relatedEntities.length < 2) return [];

      const relatedIds = relatedEntities.map(e => e.id);
      
      // For each pair of related entities, check if they share news
      const connections: SecondaryConnection[] = [];
      
      // Get all news-entity links for related entities
      const { data: allLinks } = await supabase
        .from('news_wiki_entities')
        .select('news_item_id, wiki_entity_id')
        .in('wiki_entity_id', relatedIds);

      if (!allLinks) return [];

      // Group news by entity
      const entityNewsMap = new Map<string, Set<string>>();
      for (const link of allLinks) {
        if (!entityNewsMap.has(link.wiki_entity_id)) {
          entityNewsMap.set(link.wiki_entity_id, new Set());
        }
        entityNewsMap.get(link.wiki_entity_id)!.add(link.news_item_id);
      }

      // Find connections between pairs
      for (let i = 0; i < relatedEntities.length; i++) {
        for (let j = i + 1; j < relatedEntities.length; j++) {
          const entity1 = relatedEntities[i];
          const entity2 = relatedEntities[j];
          const news1 = entityNewsMap.get(entity1.id) || new Set();
          const news2 = entityNewsMap.get(entity2.id) || new Set();
          
          // Count shared news
          let sharedCount = 0;
          news1.forEach(newsId => {
            if (news2.has(newsId)) sharedCount++;
          });

          if (sharedCount > 0) {
            connections.push({
              from: entity1,
              to: entity2,
              weight: sharedCount,
            });
          }
        }
      }

      return connections.sort((a, b) => b.weight - a.weight).slice(0, 15);
    },
    enabled: relatedEntities.length >= 2,
  });

  // Delete entity mutation (admin only)
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('wiki_entities')
        .delete()
        .eq('id', entity?.id);
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
        refreshEntity: entity?.id,
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
        .eq('id', entity?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Збережено');
      setIsEditingExtract(false);
      queryClient.invalidateQueries({ queryKey: ['wiki-entity', entityId] });
    },
  });

  // Save entity info mutation
  const saveInfoMutation = useMutation({
    mutationFn: async () => {
      const updates: Record<string, string> = {};
      if (language === 'en') {
        updates.name_en = editedName;
        updates.description_en = editedDescription;
      } else {
        updates.name = editedName;
        updates.description = editedDescription;
      }
      const { error } = await supabase
        .from('wiki_entities')
        .update(updates)
        .eq('id', entity?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Збережено');
      setIsEditingInfo(false);
      queryClient.invalidateQueries({ queryKey: ['wiki-entity', entityId] });
    },
  });

  // Update image mutation
  const updateImageMutation = useMutation({
    mutationFn: async (imageUrl: string) => {
      const { error } = await supabase
        .from('wiki_entities')
        .update({ image_url: imageUrl })
        .eq('id', entity?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Зображення оновлено');
      queryClient.invalidateQueries({ queryKey: ['wiki-entity', entityId] });
    },
  });

  // AI format extract
  const formatWithAi = async () => {
    setIsAiProcessing(true);
    try {
      const result = await callEdgeFunction<{ success: boolean; formatted?: string; error?: string }>('search-wiki', {
        action: 'format_extract',
        entityId: entity?.id,
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
      .eq('id', entity?.id);

    if (error) {
      toast.error('Помилка збереження');
      return;
    }

    toast.success('Дані оновлено');
    setExtendedData(null);
    queryClient.invalidateQueries({ queryKey: ['wiki-entity', entityId] });
  };

  // Fetch images from Wikipedia
  const fetchWikiImages = async () => {
    if (!entity) return;
    setIsFetchingImages(true);
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
        // Auto-select image if found
        if (result.data.image) {
          setSelectedSections(new Set(['image']));
        } else {
          toast.info(language === 'uk' ? 'Зображення не знайдено' : 'No images found');
        }
      } else {
        throw new Error(result.error || 'Failed to fetch images');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsFetchingImages(false);
    }
  };

  // Open caricature lightbox with related news
  const openCaricatureLightbox = async (caricature: OutrageInk) => {
    let newsItem: NewsItem | undefined;
    
    if (caricature.news_item_id) {
      // Find from existing list or fetch
      newsItem = allLinkedNews.find(n => n.id === caricature.news_item_id);
      
      if (!newsItem) {
        const { data } = await supabase
          .from('news_rss_items')
          .select('id, slug, title, title_en, description, description_en, image_url, published_at, likes, dislikes, country:news_countries(code, flag, name)')
          .eq('id', caricature.news_item_id)
          .single();
        
        if (data) {
          newsItem = { ...data, country: data.country } as any;
        }
      }
    }
    
    setSelectedCaricature({ caricature, newsItem });
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

  const startEditingInfo = () => {
    if (!entity) return;
    setEditedName(language === 'en' && entity.name_en ? entity.name_en : entity.name);
    setEditedDescription((language === 'en' && entity.description_en ? entity.description_en : entity.description) || '');
    setIsEditingInfo(true);
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
  const entitySlug = entity.slug || entity.id;

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

  const getTopicIcon = (topic: string): { icon: React.ReactNode; color: string } => {
    const lowerTopic = topic.toLowerCase();
    for (const [key, data] of Object.entries(TOPIC_ICONS)) {
      if (lowerTopic.includes(key)) return data;
    }
    return { icon: <Tag className="w-5 h-5" />, color: 'text-muted-foreground' };
  };

  return (
    <>
      <SEOHead
        title={`${name} | Echoes Wiki`}
        description={description || extract?.slice(0, 160) || `Information about ${name}`}
        canonicalUrl={`https://echoes2.com/wiki/${entitySlug}`}
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
                  <div className="md:w-64 flex-shrink-0 relative group">
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
                    {/* Admin overlay for image */}
                    {isAdmin && (
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <div className="flex flex-col gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={fetchWikiImages}
                            disabled={isFetchingImages}
                            className="gap-2"
                          >
                            {isFetchingImages ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                            Wiki
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              const searchQuery = encodeURIComponent(`${name} ${entity.entity_type === 'person' ? 'photo portrait' : 'logo'}`);
                              window.open(`https://www.google.com/search?tbm=isch&q=${searchQuery}`, '_blank');
                            }}
                            className="gap-2"
                          >
                            <Search className="w-4 h-4" />
                            Google
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              const url = prompt(language === 'uk' ? 'Введіть URL зображення:' : 'Enter image URL:');
                              if (url && url.startsWith('http')) {
                                updateImageMutation.mutate(url);
                              }
                            }}
                            disabled={updateImageMutation.isPending}
                            className="gap-2"
                          >
                            <ExternalLink className="w-4 h-4" />
                            URL
                          </Button>
                          <label className="cursor-pointer">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="gap-2 w-full pointer-events-none"
                              asChild
                            >
                              <span>
                                <ImageIcon className="w-4 h-4" />
                                Upload
                              </span>
                            </Button>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file || !entity?.id) return;
                                
                                const ext = file.name.split('.').pop() || 'jpg';
                                const fileName = `${entity.id}.${ext}`;
                                
                                const { data, error } = await supabase.storage
                                  .from('covers')
                                  .upload(`wiki/${fileName}`, file, { upsert: true });
                                
                                if (error) {
                                  toast.error('Upload failed: ' + error.message);
                                  return;
                                }
                                
                                const { data: urlData } = supabase.storage
                                  .from('covers')
                                  .getPublicUrl(`wiki/${fileName}`);
                                
                                updateImageMutation.mutate(urlData.publicUrl);
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Entity Info */}
                  <CardContent className="flex-1 p-6">
                    {isEditingInfo ? (
                      <div className="space-y-4">
                        <Input
                          value={editedName}
                          onChange={(e) => setEditedName(e.target.value)}
                          placeholder={language === 'uk' ? "Ім'я" : 'Name'}
                          className="text-xl font-bold"
                        />
                        <Textarea
                          value={editedDescription}
                          onChange={(e) => setEditedDescription(e.target.value)}
                          placeholder={language === 'uk' ? 'Опис' : 'Description'}
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => saveInfoMutation.mutate()}
                            disabled={saveInfoMutation.isPending}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            {language === 'uk' ? 'Зберегти' : 'Save'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setIsEditingInfo(false)}
                          >
                            <X className="w-4 h-4 mr-1" />
                            {language === 'uk' ? 'Скасувати' : 'Cancel'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
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
                                onClick={startEditingInfo}
                                title={language === 'uk' ? 'Редагувати' : 'Edit'}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
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
                      </>
                    )}
                  </CardContent>
                </div>
              </Card>

              {/* Views Chart */}
              {dailyViews.some(d => d.views > 0) && (
                <EntityViewsChart data={dailyViews} />
              )}


              {/* Entity Intersection Graph */}
              {relatedEntities.length > 0 && (
                <EntityIntersectionGraph 
                  mainEntity={{
                    name: entity.name,
                    name_en: entity.name_en,
                    image_url: entity.image_url,
                    entity_type: entity.entity_type,
                  }}
                  relatedEntities={relatedEntities}
                  secondaryConnections={secondaryConnections}
                />
              )}

              {/* Compact Rating Block */}
              <div className="flex items-center justify-between gap-4 p-4 bg-muted/50 rounded-xl border border-border">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Swords className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <span className="text-2xl font-bold text-primary">
                      {aggregatedRating.toLocaleString()}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {language === 'uk' ? 'Загальний рейтинг' : 'Total Rating'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Eye className="w-4 h-4" />
                    <span>{aggregatedViews.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <ThumbsUp className="w-4 h-4" />
                    <span>{(totalNewsLikes + totalCaricatureLikes).toLocaleString()}</span>
                  </div>
                  {(totalNewsDislikes + totalCaricatureDislikes) > 0 && (
                    <div className="flex items-center gap-1 text-destructive/70">
                      <ThumbsDown className="w-4 h-4" />
                      <span>{(totalNewsDislikes + totalCaricatureDislikes).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Key Information Block */}
              <Card className="border-2 border-primary/20">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Sparkles className="w-5 h-5 text-primary" />
                        {language === 'uk' ? 'Ключова інформація' : 'Key Information'}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {language === 'uk' ? 'Основні дані про сутність' : 'Core information about the entity'}
                      </CardDescription>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={fetchWikiImages}
                          disabled={isFetchingImages}
                          className="border-primary/30 hover:bg-primary/10"
                        >
                          {isFetchingImages ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4 mr-1" />
                          )}
                          {language === 'uk' ? 'Витягнути фото' : 'Fetch Images'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={runExtendedParsing}
                          disabled={isExtendedParsing}
                          className="border-primary/30 hover:bg-primary/10"
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
                          className="border-primary/30 hover:bg-primary/10"
                        >
                          <Pencil className="w-4 h-4 mr-1" />
                          {language === 'uk' ? 'Редагувати' : 'Edit'}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  {isEditingExtract ? (
                    <div className="space-y-4">
                      <Textarea
                        value={editedExtract}
                        onChange={(e) => setEditedExtract(e.target.value)}
                        rows={10}
                        className="w-full font-mono text-sm"
                        placeholder={language === 'uk' ? 'Введіть текст...' : 'Enter text...'}
                      />
                      <div className="flex gap-2 flex-wrap p-3 bg-muted/50 rounded-lg">
                        <Button
                          size="sm"
                          onClick={() => saveExtractMutation.mutate(editedExtract)}
                          disabled={saveExtractMutation.isPending}
                          className="flex-1 sm:flex-none"
                        >
                          <Check className="w-4 h-4 mr-1" />
                          {language === 'uk' ? 'Зберегти' : 'Save'}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={formatWithAi}
                          disabled={isAiProcessing}
                          className="flex-1 sm:flex-none"
                        >
                          {isAiProcessing ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <Sparkles className="w-4 h-4 mr-1 text-primary" />
                          )}
                          {language === 'uk' ? 'Форматувати ШІ' : 'Format with AI'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setIsEditingExtract(false)}
                        >
                          <X className="w-4 h-4 mr-1" />
                          {language === 'uk' ? 'Скасувати' : 'Cancel'}
                        </Button>
                      </div>
                    </div>
                  ) : extract ? (
                    <div className="space-y-6">
                      <MarkdownContent content={extract} />
                      
                      {/* Categories Sub-block */}
                      {wikiCategories.length > 0 && (
                        <div className="pt-4 border-t border-border/50">
                          <h4 className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
                            <FolderOpen className="w-4 h-4" />
                            {language === 'uk' ? 'Категорії Wikipedia' : 'Wikipedia Categories'}
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {wikiCategories.slice(0, 12).map((category, idx) => (
                              <Link
                                key={idx}
                                to={`/wiki?category=${encodeURIComponent(category)}`}
                                className="inline-flex"
                              >
                                <Badge 
                                  variant="outline" 
                                  className="text-xs cursor-pointer hover:bg-primary/10 hover:border-primary transition-colors"
                                >
                                  {category}
                                </Badge>
                              </Link>
                            ))}
                            {wikiCategories.length > 12 && (
                              <Badge variant="secondary" className="text-xs">
                                +{wikiCategories.length - 12}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <FileText className="w-12 h-12 text-muted-foreground/30 mb-3" />
                      <p className="text-muted-foreground italic">
                        {language === 'uk' ? 'Інформація ще не завантажена' : 'Information not yet loaded'}
                      </p>
                      {isAdmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={runExtendedParsing}
                          disabled={isExtendedParsing}
                          className="mt-3"
                        >
                          {isExtendedParsing ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4 mr-1" />
                          )}
                          {language === 'uk' ? 'Завантажити з Wikipedia' : 'Load from Wikipedia'}
                        </Button>
                      )}
                    </div>
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
                        <button 
                          key={c.id} 
                          onClick={() => openCaricatureLightbox(c)}
                          className="group text-left relative"
                        >
                          <div className="aspect-square rounded-lg overflow-hidden border border-border relative">
                            <img
                              src={c.image_url}
                              alt={c.title || ''}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <ZoomIn className="w-8 h-8 text-white drop-shadow-lg" />
                            </div>
                          </div>
                          {c.title && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{c.title}</p>
                          )}
                        </button>
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
                          to={`/wiki/${related.slug || related.id}`}
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

              {/* Topics Block - Compact for Sidebar */}
              {sortedTopics.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Tag className="w-4 h-4 text-primary" />
                      {language === 'uk' ? 'Теми' : 'Topics'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-1.5">
                      {sortedTopics.slice(0, 8).map(([topic, count]) => {
                        const { color } = getTopicIcon(topic);
                        return (
                          <Badge 
                            key={topic} 
                            variant="outline"
                            className={`text-xs ${color}`}
                          >
                            {topic}
                            <span className="ml-1 text-muted-foreground/70">({count})</span>
                          </Badge>
                        );
                      })}
                      {sortedTopics.length > 8 && (
                        <Badge variant="secondary" className="text-xs">
                          +{sortedTopics.length - 8}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Keywords Block - Compact for Sidebar */}
              {allKeywords.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Hash className="w-4 h-4 text-primary" />
                      {language === 'uk' ? 'Ключові слова' : 'Keywords'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-1.5">
                      {allKeywords.slice(0, 12).map(([keyword, count]) => (
                        <Badge key={keyword} variant="secondary" className="text-xs">
                          {keyword}
                          <span className="ml-1 text-muted-foreground/70">({count})</span>
                        </Badge>
                      ))}
                      {allKeywords.length > 12 && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          +{allKeywords.length - 12}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

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
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <ThumbsUp className="w-4 h-4" />
                      {language === 'uk' ? 'Лайків' : 'Likes'}
                    </span>
                    <span className="font-medium text-primary">{(totalNewsLikes + totalCaricatureLikes).toLocaleString()}</span>
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

      {/* Caricature Lightbox Modal */}
      <Dialog open={!!selectedCaricature} onOpenChange={() => setSelectedCaricature(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
          {selectedCaricature && (
            <>
              <div className="relative">
                <img
                  src={selectedCaricature.caricature.image_url}
                  alt={selectedCaricature.caricature.title || ''}
                  className="w-full h-auto max-h-[60vh] object-contain bg-black"
                />
              </div>
              <div className="p-4 space-y-3">
                {selectedCaricature.caricature.title && (
                  <h3 className="font-medium text-lg">{selectedCaricature.caricature.title}</h3>
                )}
                
                {/* Related News */}
                {selectedCaricature.newsItem && (
                  <div className="border-t pt-3 mt-3">
                    <p className="text-sm text-muted-foreground mb-2">
                      {language === 'uk' ? 'Новина-джерело:' : 'Source news:'}
                    </p>
                    <Link
                      to={selectedCaricature.newsItem.slug 
                        ? `/news/${selectedCaricature.newsItem.country?.code?.toLowerCase()}/${selectedCaricature.newsItem.slug}` 
                        : '#'}
                      className="flex gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedCaricature(null)}
                    >
                      {selectedCaricature.newsItem.image_url && (
                        <img
                          src={selectedCaricature.newsItem.image_url}
                          alt=""
                          className="w-16 h-16 rounded object-cover flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span>{selectedCaricature.newsItem.country?.flag}</span>
                          {selectedCaricature.newsItem.published_at && (
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(selectedCaricature.newsItem.published_at), 'dd.MM.yyyy')}
                            </span>
                          )}
                        </div>
                        <h4 className="font-medium text-sm line-clamp-2">
                          {language === 'en' && selectedCaricature.newsItem.title_en 
                            ? selectedCaricature.newsItem.title_en 
                            : selectedCaricature.newsItem.title}
                        </h4>
                      </div>
                    </Link>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
