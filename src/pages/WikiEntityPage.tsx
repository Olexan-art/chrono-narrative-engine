import { useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { 
  ArrowLeft, ExternalLink, User, Building2, Globe, Newspaper, 
  RefreshCw, Trash2, ImageIcon, Sparkles, Network, Share2,
  Eye, Pencil, Loader2, Tag, Search, Check, X, ChevronLeft, ChevronRight,
  Download, FileText, ZoomIn, ThumbsUp, ThumbsDown, Hash, Edit,
  Briefcase, Flame, Shield, Heart, Zap, BookOpen, Scale, Megaphone, 
  Swords, FolderOpen, Rss, BrainCircuit, ChevronDown, ChevronUp, Lightbulb,
  Link2, Plus
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { EntityViewsChart } from "@/components/EntityViewsChart";
import { MarkdownContent } from "@/components/MarkdownContent";
import { EntityLinkedContent } from "@/components/EntityLinkedContent";
import { EntityIntersectionGraph } from "@/components/EntityIntersectionGraph";
import { EntityGhostlyGraph } from "@/components/EntityGhostlyGraph";
import { EntityCyberpunkGraph } from "@/components/EntityCyberpunkGraph";
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
  const [graphVariant, setGraphVariant] = useState<'tree' | 'ghostly' | 'cyberpunk'>('cyberpunk');
  const [narrativeAnalyses, setNarrativeAnalyses] = useState<Record<string, any>>({});
  const [analyzingMonth, setAnalyzingMonth] = useState<string | null>(null);
  const [expandedNarrativeMonths, setExpandedNarrativeMonths] = useState<Set<string>>(new Set());
  const [expandedNarrativeDetails, setExpandedNarrativeDetails] = useState<Set<string>>(new Set());
  const [compareMonths, setCompareMonths] = useState<[string, string] | null>(null);
  const [showRelatedDialog, setShowRelatedDialog] = useState(false);
  const [relatedResults, setRelatedResults] = useState<any[]>([]);
  const [relatedLoading, setRelatedLoading] = useState<'news' | 'wiki' | null>(null);
  const [addingEntityUrl, setAddingEntityUrl] = useState("");
  const [addingEntity, setAddingEntity] = useState(false);
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

  // Fetch RSS feed sources for this entity's news
  const { data: feedSources = [] } = useQuery({
    queryKey: ['entity-feed-sources', entity?.id],
    queryFn: async () => {
      if (!entity?.id) return [];
      
      // Get news item IDs linked to this entity
      const { data: newsLinks } = await supabase
        .from('news_wiki_entities')
        .select('news_item_id')
        .eq('wiki_entity_id', entity.id);
      
      if (!newsLinks?.length) return [];
      
      const newsItemIds = newsLinks.map(l => l.news_item_id);
      
      // Get feed_id from those news items (batch in chunks of 100)
      const feedCounts: Record<string, number> = {};
      for (let i = 0; i < newsItemIds.length; i += 100) {
        const chunk = newsItemIds.slice(i, i + 100);
        const { data: items } = await supabase
          .from('news_rss_items')
          .select('feed_id')
          .in('id', chunk);
        
        if (items) {
          items.forEach(item => {
            feedCounts[item.feed_id] = (feedCounts[item.feed_id] || 0) + 1;
          });
        }
      }
      
      const feedIds = Object.keys(feedCounts);
      if (feedIds.length === 0) return [];
      
      // Fetch feed details
      const { data: feeds } = await supabase
        .from('news_rss_feeds')
        .select('id, name, url, default_image_url, country:news_countries(flag, name)')
        .in('id', feedIds);
      
      if (!feeds) return [];
      
      return feeds
        .map(feed => ({
          id: feed.id,
          name: feed.name,
          url: feed.url,
          default_image_url: feed.default_image_url,
          country: feed.country as any,
          count: feedCounts[feed.id] || 0,
          favicon: `https://www.google.com/s2/favicons?domain=${new URL(feed.url).hostname}&sz=32`,
        }))
        .sort((a, b) => b.count - a.count);
    },
    enabled: !!entity?.id,
    staleTime: 1000 * 60 * 10,
  });

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

  // Load saved narrative analyses from DB
  const { data: savedNarratives = [] } = useQuery({
    queryKey: ['narrative-analyses', entity?.id, language],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('narrative_analyses')
        .select('*')
        .eq('entity_id', entity?.id)
        .eq('language', language === 'uk' ? 'uk' : 'en')
        .order('year_month', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!entity?.id,
  });

  // Merge saved narratives into state on load
  useMemo(() => {
    if (savedNarratives.length > 0) {
      const merged: Record<string, any> = { ...narrativeAnalyses };
      savedNarratives.forEach(n => {
        if (!merged[n.year_month]) {
          merged[n.year_month] = {
            success: true,
            yearMonth: n.year_month,
            newsCount: n.news_count,
            analysis: n.analysis,
            relatedEntities: n.related_entities,
            is_regenerated: n.is_regenerated,
            saved_at: n.updated_at,
          };
        }
      });
      // Only update if different
      if (Object.keys(merged).length !== Object.keys(narrativeAnalyses).length) {
        setNarrativeAnalyses(merged);
      }
    }
  }, [savedNarratives]);

  // Analyze narratives for a specific month
  const analyzeNarratives = async (yearMonth: string, regenerate = false) => {
    if (!entity) return;
    setAnalyzingMonth(yearMonth);
    try {
      const result = await callEdgeFunction<any>('analyze-narratives', {
        entityId: entity.id,
        yearMonth,
        language: language === 'uk' ? 'uk' : 'en',
        regenerate,
      });
      if (result.success) {
        setNarrativeAnalyses(prev => ({ ...prev, [yearMonth]: result }));
        setExpandedNarrativeMonths(prev => new Set(prev).add(yearMonth));
        queryClient.invalidateQueries({ queryKey: ['narrative-analyses', entity.id] });
        toast.success(language === 'uk' ? (regenerate ? 'Перегенеровано' : 'Аналіз завершено') : (regenerate ? 'Regenerated' : 'Analysis complete'));
      } else {
        throw new Error(result.error || 'Analysis failed');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAnalyzingMonth(null);
    }
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
                  {/* Entity Image with Topic overlay */}
                  <div className="md:w-64 flex-shrink-0 relative group">
                    {/* Topic overlay removed from image — moved to info block */}
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
                        <div className="flex items-start justify-between gap-4 relative">
                          <div>
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <Badge variant="secondary">
                                {getEntityIcon(entity.entity_type)}
                                <span className="ml-1">{entityTypeLabel}</span>
                              </Badge>
                              {/* Sentiment badge from latest narrative */}
                              {(() => {
                                const sortedMonths = Object.keys(narrativeAnalyses).sort((a, b) => b.localeCompare(a));
                                if (sortedMonths.length === 0) return null;
                                const latest = narrativeAnalyses[sortedMonths[0]];
                                const sentiment = latest?.analysis?.sentiment || 'neutral';
                                const sMap: Record<string, { bg: string; border: string; text: string; icon: string; label: string }> = {
                                  positive: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/40', text: 'text-emerald-400', icon: '🟢', label: language === 'uk' ? 'Позитивний' : 'Positive' },
                                  negative: { bg: 'bg-red-500/15', border: 'border-red-500/40', text: 'text-red-400', icon: '🔴', label: language === 'uk' ? 'Негативний' : 'Negative' },
                                  mixed: { bg: 'bg-amber-500/15', border: 'border-amber-500/40', text: 'text-amber-400', icon: '🟡', label: language === 'uk' ? 'Змішаний' : 'Mixed' },
                                  neutral: { bg: 'bg-blue-500/15', border: 'border-blue-500/40', text: 'text-blue-400', icon: '⚪', label: language === 'uk' ? 'Нейтральний' : 'Neutral' },
                                };
                                const s = sMap[sentiment] || sMap.neutral;
                                return (
                                  <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${s.bg} ${s.border} border animate-in fade-in duration-500`}>
                                    <span className="text-xs">{s.icon}</span>
                                    <span className={`text-[10px] font-bold uppercase ${s.text}`}>{s.label}</span>
                                    <span className="text-[9px] text-muted-foreground ml-1">{sortedMonths[0]}</span>
                                  </div>
                                );
                              })()}
                            </div>
                            <h1 className="text-2xl font-bold">{name}</h1>
                            {description && (
                              <p className="text-muted-foreground mt-1">{description}</p>
                            )}
                          </div>
                          {/* Topic #1 overlay — top right of the info block */}
                          {sortedTopics.length > 0 && (
                            <div className="absolute -top-2 -right-2 pointer-events-none select-none">
                              <p className="text-3xl md:text-4xl font-black font-mono uppercase tracking-widest text-primary/20 text-right leading-none whitespace-nowrap">
                                {sortedTopics[0][0]}
                              </p>
                            </div>
                          )}
                          
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

                        {/* Topics inline in hero */}
                        {sortedTopics.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-4">
                            {sortedTopics.slice(0, 6).map(([topic, count]) => {
                              const { icon, color } = getTopicIcon(topic);
                              return (
                                <Badge key={topic} variant="outline" className={`text-xs gap-1 ${color}`}>
                                  {icon}
                                  {topic}
                                  <span className="text-muted-foreground/70">({count})</span>
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </div>
              </Card>

              {/* Latest News Block */}
              {allLinkedNews.length > 0 && (
                <Card className="overflow-hidden border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="text-[10px] px-2 py-0.5 uppercase tracking-wide">
                        {language === 'uk' ? 'Останнє' : 'Latest'}
                      </Badge>
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Zap className="w-4 h-4 text-primary" />
                        {language === 'uk' ? 'Остання новина' : 'Latest News'}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {(() => {
                      const latestNews = allLinkedNews[0];
                      const newsTitle = language === 'en' && latestNews.title_en ? latestNews.title_en : latestNews.title;
                      const newsDesc = language === 'en' && latestNews.description_en ? latestNews.description_en : latestNews.description;
                      return (
                        <Link 
                          to={`/news/${latestNews.country?.code || 'ua'}/${latestNews.slug || latestNews.id}`}
                          className="block group"
                        >
                          <div className="flex gap-4">
                            {latestNews.image_url && (
                              <img 
                                src={latestNews.image_url} 
                                alt={newsTitle}
                                className="w-24 h-20 object-cover rounded-lg flex-shrink-0 group-hover:scale-105 transition-transform"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">
                                {newsTitle}
                              </h3>
                              {newsDesc && (
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                  {newsDesc}
                                </p>
                              )}
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                {latestNews.country && (
                                  <span className="flex items-center gap-1">
                                    <span>{latestNews.country.flag}</span>
                                    {latestNews.country.name}
                                  </span>
                                )}
                                {latestNews.published_at && (
                                  <span>
                                    {format(new Date(latestNews.published_at), 'dd.MM.yyyy')}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <ThumbsUp className="w-3 h-3" />
                                  {latestNews.likes}
                                </span>
                              </div>
                            </div>
                          </div>
                        </Link>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}

              {/* Narrative Timeline Block — only show if analyses exist */}
              {Object.keys(narrativeAnalyses).length > 0 && (() => {
                const sortedMonths = Object.keys(narrativeAnalyses).sort((a, b) => b.localeCompare(a));
                const latestMonth = sortedMonths[0];

                const getSentimentStyle = (sentiment: string) => {
                  switch (sentiment) {
                    case 'positive': return { bg: 'bg-emerald-500/15', border: 'border-emerald-500/40', text: 'text-emerald-400', icon: '🟢', label: language === 'uk' ? 'Позитивний' : 'Positive' };
                    case 'negative': return { bg: 'bg-red-500/15', border: 'border-red-500/40', text: 'text-red-400', icon: '🔴', label: language === 'uk' ? 'Негативний' : 'Negative' };
                    case 'mixed': return { bg: 'bg-amber-500/15', border: 'border-amber-500/40', text: 'text-amber-400', icon: '🟡', label: language === 'uk' ? 'Змішаний' : 'Mixed' };
                    default: return { bg: 'bg-blue-500/15', border: 'border-blue-500/40', text: 'text-blue-400', icon: '⚪', label: language === 'uk' ? 'Нейтральний' : 'Neutral' };
                  }
                };

                return (
                  <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <BrainCircuit className="w-5 h-5 text-primary" />
                        {language === 'uk' ? 'Наративний аналіз' : 'Narrative Analysis'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {sortedMonths.map((month, monthIdx) => {
                        const data = narrativeAnalyses[month];
                        const analysis = data.analysis;
                        const isLatest = month === latestMonth;
                        const isExpanded = expandedNarrativeMonths.has(month);
                        const isDetailsExpanded = expandedNarrativeDetails.has(month);
                        const sentimentStyle = getSentimentStyle(analysis.sentiment || 'neutral');

                        if (!isLatest && !isExpanded) {
                          return (
                            <Collapsible key={month}>
                              <CollapsibleTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="w-full justify-between text-xs font-mono"
                                  onClick={() => setExpandedNarrativeMonths(prev => {
                                    const s = new Set(prev);
                                    s.add(month);
                                    return s;
                                  })}
                                >
                                  <span className="flex items-center gap-2">
                                    <Lightbulb className="w-3.5 h-3.5 text-primary" />
                                    {month} — {data.newsCount} {language === 'uk' ? 'новин' : 'news'}
                                  </span>
                                  <ChevronDown className="w-4 h-4" />
                                </Button>
                              </CollapsibleTrigger>
                            </Collapsible>
                          );
                        }

                        return (
                          <div key={month} className="space-y-3">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="font-mono text-xs gap-1.5 bg-primary/10 border-primary/30">
                                  {month}
                                  <span className="text-muted-foreground">• {data.newsCount} {language === 'uk' ? 'новин' : 'news'}</span>
                                </Badge>
                                {data.is_regenerated && (
                                  <Badge variant="secondary" className="text-[10px] gap-1 bg-amber-500/10 text-amber-400 border-amber-500/30">
                                    <RefreshCw className="w-2.5 h-2.5" />
                                    {language === 'uk' ? 'Оновлено' : 'Updated'}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {/* Sentiment Badge - Enhanced */}
                                {analysis.sentiment && (
                                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${sentimentStyle.bg} ${sentimentStyle.border} border transition-all duration-500 animate-in fade-in slide-in-from-right-2`}>
                                    <span className="text-sm animate-pulse">{sentimentStyle.icon}</span>
                                    <span className={`text-xs font-semibold uppercase tracking-wide ${sentimentStyle.text}`}>
                                      {sentimentStyle.label}
                                    </span>
                                  </div>
                                )}
                                {isAdmin && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-[10px] gap-1"
                                    onClick={() => analyzeNarratives(month, true)}
                                    disabled={analyzingMonth === month}
                                    title={language === 'uk' ? 'Перегенерувати' : 'Regenerate'}
                                  >
                                    {analyzingMonth === month ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <RefreshCw className="w-3 h-3" />
                                    )}
                                  </Button>
                                )}
                                {!isLatest && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2"
                                    onClick={() => setExpandedNarrativeMonths(prev => {
                                      const s = new Set(prev);
                                      s.delete(month);
                                      return s;
                                    })}
                                  >
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                              </div>
                            </div>

                            {/* Summary - always visible */}
                            {analysis.narrative_summary && (
                              <p className="text-sm text-muted-foreground italic border-l-2 border-primary/30 pl-3">
                                {analysis.narrative_summary}
                              </p>
                            )}

                            {/* Read more - collapsible details */}
                            <Collapsible open={isDetailsExpanded} onOpenChange={(open) => {
                              setExpandedNarrativeDetails(prev => {
                                const s = new Set(prev);
                                if (open) s.add(month); else s.delete(month);
                                return s;
                              });
                            }}>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="w-full justify-center text-xs gap-1.5 text-primary hover:text-primary">
                                  {isDetailsExpanded ? (
                                    <><ChevronUp className="w-3.5 h-3.5" />{language === 'uk' ? 'Згорнути' : 'Show less'}</>
                                  ) : (
                                    <><ChevronDown className="w-3.5 h-3.5" />{language === 'uk' ? 'Читати більше' : 'Read more'}</>
                                  )}
                                </Button>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="space-y-3 pt-2">
                                {/* Key Takeaways */}
                                {analysis.key_takeaways?.length > 0 && (
                                  <ul className="space-y-2">
                                    {analysis.key_takeaways.map((kt: any, i: number) => (
                                      <li key={i} className="flex items-start gap-3 text-sm">
                                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                                          {i + 1}
                                        </span>
                                        <div className="flex-1">
                                          <span className="text-foreground/90 leading-relaxed">{kt.point}</span>
                                          {kt.newsLinks?.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                              {kt.newsLinks.map((nl: any, j: number) => (
                                                <Link
                                                  key={j}
                                                  to={nl.url}
                                                  className="text-[10px] text-primary hover:underline truncate max-w-[180px] inline-flex items-center gap-0.5"
                                                >
                                                  <Newspaper className="w-2.5 h-2.5 flex-shrink-0" />
                                                  {nl.title}
                                                </Link>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                )}

                                {/* Related entity roles */}
                                {analysis.related_entity_roles?.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/30">
                                    {analysis.related_entity_roles.map((r: any, i: number) => (
                                      <Badge key={i} variant="outline" className="text-[10px] gap-1">
                                        <User className="w-2.5 h-2.5" />
                                        {r.name}: {r.role}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </CollapsibleContent>
                            </Collapsible>

                            {monthIdx < sortedMonths.length - 1 && <div className="border-b border-border/30" />}
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Narrative Comparison */}
              {Object.keys(narrativeAnalyses).length >= 2 && (() => {
                const months = Object.keys(narrativeAnalyses).sort((a, b) => b.localeCompare(a));
                
                return (
                  <Card className="border-secondary/20 bg-gradient-to-br from-secondary/5 to-transparent">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Scale className="w-4 h-4 text-secondary" />
                        {language === 'uk' ? 'Порівняти наративи' : 'Compare Narratives'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase mb-1 block">{language === 'uk' ? 'Місяць A' : 'Month A'}</label>
                          <select
                            className="w-full h-8 text-xs bg-muted rounded px-2 border border-border"
                            value={compareMonths?.[0] || ''}
                            onChange={(e) => setCompareMonths(prev => [e.target.value, prev?.[1] || months[1] || ''])}
                          >
                            <option value="">—</option>
                            {months.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase mb-1 block">{language === 'uk' ? 'Місяць B' : 'Month B'}</label>
                          <select
                            className="w-full h-8 text-xs bg-muted rounded px-2 border border-border"
                            value={compareMonths?.[1] || ''}
                            onChange={(e) => setCompareMonths(prev => [prev?.[0] || months[0] || '', e.target.value])}
                          >
                            <option value="">—</option>
                            {months.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>
                      </div>

                      {compareMonths && compareMonths[0] && compareMonths[1] && compareMonths[0] !== compareMonths[1] && (() => {
                        const a = narrativeAnalyses[compareMonths[0]]?.analysis;
                        const b = narrativeAnalyses[compareMonths[1]]?.analysis;
                        if (!a || !b) return null;

                        const getSentStyle = (s: string) => {
                          switch (s) {
                            case 'positive': return { bg: 'bg-emerald-500/15', text: 'text-emerald-400', icon: '🟢' };
                            case 'negative': return { bg: 'bg-red-500/15', text: 'text-red-400', icon: '🔴' };
                            case 'mixed': return { bg: 'bg-amber-500/15', text: 'text-amber-400', icon: '🟡' };
                            default: return { bg: 'bg-blue-500/15', text: 'text-blue-400', icon: '⚪' };
                          }
                        };

                        const sA = getSentStyle(a.sentiment || 'neutral');
                        const sB = getSentStyle(b.sentiment || 'neutral');

                        return (
                          <div className="space-y-4 pt-3 border-t border-border/30">
                            {/* Sentiment comparison */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className={`p-2 rounded-lg ${sA.bg} text-center`}>
                                <span className="text-lg">{sA.icon}</span>
                                <p className={`text-[10px] font-semibold uppercase ${sA.text}`}>{compareMonths[0]}</p>
                                <p className={`text-xs ${sA.text}`}>{a.sentiment}</p>
                              </div>
                              <div className={`p-2 rounded-lg ${sB.bg} text-center`}>
                                <span className="text-lg">{sB.icon}</span>
                                <p className={`text-[10px] font-semibold uppercase ${sB.text}`}>{compareMonths[1]}</p>
                                <p className={`text-xs ${sB.text}`}>{b.sentiment}</p>
                              </div>
                            </div>

                            {/* Summary comparison */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2">
                                {a.narrative_summary}
                              </div>
                              <div className="text-xs text-muted-foreground italic border-l-2 border-secondary/30 pl-2">
                                {b.narrative_summary}
                              </div>
                            </div>

                            {/* Takeaways count comparison */}
                            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                              <span>{compareMonths[0]}: {a.key_takeaways?.length || 0} {language === 'uk' ? 'тез' : 'takeaways'}</span>
                              <span className="text-border">vs</span>
                              <span>{compareMonths[1]}: {b.key_takeaways?.length || 0} {language === 'uk' ? 'тез' : 'takeaways'}</span>
                            </div>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Views Chart */}
              {dailyViews.some(d => d.views > 0) && (
                <EntityViewsChart data={dailyViews} />
              )}


              {/* Entity Intersection Graph with variant toggle */}
              {relatedEntities.length > 0 && (
                <>
                  <div className="flex items-center gap-2 justify-end">
                    <Button
                      variant={graphVariant === 'cyberpunk' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setGraphVariant('cyberpunk')}
                      className="gap-1.5 text-xs"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      Cyberpunk
                    </Button>
                    <Button
                      variant={graphVariant === 'tree' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setGraphVariant('tree')}
                      className="gap-1.5 text-xs"
                    >
                      <Network className="w-3.5 h-3.5" />
                      {language === 'uk' ? 'Дерево' : 'Tree'}
                    </Button>
                    <Button
                      variant={graphVariant === 'ghostly' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setGraphVariant('ghostly')}
                      className="gap-1.5 text-xs"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      {language === 'uk' ? 'Примарні' : 'Ghostly'}
                    </Button>
                  </div>
                  {graphVariant === 'cyberpunk' ? (
                    <EntityCyberpunkGraph 
                      mainEntity={{
                        id: entity.id,
                        slug: entity.slug,
                        name: entity.name,
                        name_en: entity.name_en,
                        description: entity.description,
                        description_en: entity.description_en,
                        image_url: entity.image_url,
                        entity_type: entity.entity_type,
                        shared_news_count: totalMentions,
                      }}
                      relatedEntities={relatedEntities}
                      secondaryConnections={secondaryConnections}
                    />
                  ) : graphVariant === 'tree' ? (
                    <EntityIntersectionGraph 
                      mainEntity={{
                        id: entity.id,
                        slug: entity.slug,
                        name: entity.name,
                        name_en: entity.name_en,
                        description: entity.description,
                        description_en: entity.description_en,
                        image_url: entity.image_url,
                        entity_type: entity.entity_type,
                        shared_news_count: totalMentions,
                      }}
                      relatedEntities={relatedEntities}
                      secondaryConnections={secondaryConnections}
                      feedSources={feedSources.slice(0, 6).map(f => ({ id: f.id, name: f.name, favicon: f.favicon }))}
                    />
                  ) : (
                    <EntityGhostlyGraph 
                      mainEntity={{
                        id: entity.id,
                        slug: entity.slug,
                        name: entity.name,
                        name_en: entity.name_en,
                        description: entity.description,
                        description_en: entity.description_en,
                        image_url: entity.image_url,
                        entity_type: entity.entity_type,
                        shared_news_count: totalMentions,
                      }}
                      relatedEntities={relatedEntities}
                      secondaryConnections={secondaryConnections}
                    />
                  )}
                </>
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
                      <EntityLinkedContent content={extract} excludeEntityId={entity?.id} />
                      
                      {/* Categories Sub-block */}
                      {wikiCategories.length > 0 && (
                        <div className="pt-4 border-t border-border/50">
                          <h4 className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
                            <FolderOpen className="w-4 h-4" />
                            {language === 'uk' ? 'Категорії Wikipedia' : 'Wikipedia Categories'}
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {wikiCategories.slice(0, 12).map((category, idx) => {
                              // Determine wiki language from entity URL
                              const wikiLang = entity?.wiki_url?.includes('uk.wikipedia') ? 'uk' : 'en';
                              const wikiSearchUrl = `https://${wikiLang}.wikipedia.org/wiki/Category:${encodeURIComponent(category.replace(/ /g, '_'))}`;
                              
                              return (
                                <a
                                  key={idx}
                                  href={wikiSearchUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex"
                                >
                                  <Badge 
                                    variant="outline" 
                                    className="text-xs cursor-pointer hover:bg-primary/10 hover:border-primary transition-colors gap-1"
                                  >
                                    <ExternalLink className="w-2.5 h-2.5" />
                                    {category}
                                  </Badge>
                                </a>
                              );
                            })}
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

              {/* Archive Block */}
              {allLinkedNews.length > 0 && (() => {
                const archiveMap: Record<string, number> = {};
                allLinkedNews.forEach(n => {
                  if (n.published_at) {
                    const key = format(new Date(n.published_at), 'yyyy-MM');
                    archiveMap[key] = (archiveMap[key] || 0) + 1;
                  }
                });
                const archiveEntries = Object.entries(archiveMap).sort((a, b) => b[0].localeCompare(a[0]));
                if (archiveEntries.length === 0) return null;
                return (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <FolderOpen className="w-4 h-4 text-primary" />
                        {language === 'uk' ? 'Архів' : 'Archive'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-1 max-h-64 overflow-y-auto">
                        {archiveEntries.slice(0, 24).map(([month, count]) => (
                          <div key={month} className="flex items-center justify-between text-xs py-1.5 border-b border-border/30 last:border-0 gap-1">
                            <span className="font-mono text-muted-foreground">{month}</span>
                            <div className="flex items-center gap-1.5">
                              <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{count}</Badge>
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 px-1.5 text-[10px] gap-1 text-primary hover:text-primary"
                                  onClick={() => analyzeNarratives(month)}
                                  disabled={analyzingMonth === month}
                                >
                                  {analyzingMonth === month ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <BrainCircuit className="w-3 h-3" />
                                  )}
                                  {language === 'uk' ? 'Аналіз' : 'Analyze'}
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Sources Block */}
              {(allLinkedNews.length > 0 || feedSources.length > 0) && (() => {
                const sourceMap: Record<string, number> = {};
                allLinkedNews.forEach(n => {
                  const source = n.country?.name;
                  if (source) sourceMap[source] = (sourceMap[source] || 0) + 1;
                });
                const sources = Object.entries(sourceMap).sort((a, b) => b[1] - a[1]);
                if (sources.length === 0 && feedSources.length === 0) return null;
                return (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Globe className="w-4 h-4 text-primary" />
                        {language === 'uk' ? 'Джерела' : 'Sources'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-3">
                      {/* Country sources */}
                      {sources.length > 0 && (
                        <div className="grid grid-cols-1 gap-2">
                          {sources.map(([source, count]) => {
                            const country = allLinkedNews.find(n => n.country?.name === source)?.country;
                            return (
                              <div key={source} className="group/source flex items-center gap-3 px-4 py-3 rounded-lg bg-gradient-to-r from-muted/60 to-muted/20 border border-border/40 hover:border-primary/30 hover:from-primary/10 hover:to-transparent transition-all duration-300">
                                {country?.flag && <span className="text-xl">{country.flag}</span>}
                                <div className="flex-1 min-w-0">
                                  <span className="font-semibold text-sm">{source}</span>
                                </div>
                                <Badge variant="outline" className="font-mono text-xs border-primary/30 bg-primary/5 text-primary">
                                  {count}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {/* RSS Feed sources */}
                      {feedSources.length > 0 && (
                        <div className="space-y-2.5">
                          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                            <Rss className="w-3 h-3" />
                            RSS Feeds
                          </p>
                          <div className="grid grid-cols-1 gap-2">
                      {feedSources.map(feed => (
                              <div key={feed.id} className="group/feed flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-gradient-to-r from-card to-muted/10 border border-border/30 hover:border-[hsl(var(--chart-4))]/40 transition-all duration-200 relative overflow-hidden">
                                <img
                                  src={feed.favicon}
                                  alt=""
                                  className="w-4 h-4 rounded-sm flex-shrink-0"
                                  onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                                />
                                <span className="font-medium text-xs truncate flex-1 min-w-0">{feed.name}</span>
                                <Badge variant="outline" className="font-mono text-[10px] h-4 px-1 border-[hsl(var(--chart-4))]/30 bg-[hsl(var(--chart-4))]/5 text-[hsl(var(--chart-4))]">
                                  {feed.count}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })()}
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
