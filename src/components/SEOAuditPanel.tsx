import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Search, AlertTriangle, CheckCircle, XCircle, RefreshCw, Loader2, 
  ExternalLink, Globe, FileText, Image, Link2, Tag, Zap,
  ChevronDown, ChevronUp, Sparkles, Bot, MapIcon, BookOpen, Newspaper, Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { callEdgeFunction } from "@/lib/api";
import { toast } from "sonner";

interface SEOIssue {
  id: string;
  type: 'error' | 'warning' | 'info';
  category: string;
  page: string;
  title: string;
  description: string;
  recommendation: string;
  autoFixable: boolean;
}

const BASE_URL = 'https://bravennow.com';

const SEO_RULES = {
  title: { min: 30, max: 60 },
  description: { min: 120, max: 160 },
} as const;

// All static pages with their SEO status
const STATIC_PAGES = [
  { url: '/', name: 'Головна', hasCanonical: true, hasDescription: true, hasH1: true },
  { url: '/calendar', name: 'Календар', hasCanonical: true, hasDescription: true, hasH1: true },
  { url: '/chapters', name: 'Глави', hasCanonical: true, hasDescription: true, hasH1: true },
  { url: '/volumes', name: 'Томи', hasCanonical: true, hasDescription: true, hasH1: true },
  { url: '/news', name: 'News Hub', hasCanonical: true, hasDescription: true, hasH1: true },
  { url: '/news-digest', name: 'News Digest (redirect)', hasCanonical: true, hasDescription: true, hasH1: false },
  { url: '/wiki', name: 'Wiki Каталог', hasCanonical: true, hasDescription: true, hasH1: true },
  { url: '/ink-abyss', name: 'Outrage Ink', hasCanonical: true, hasDescription: true, hasH1: true },
  { url: '/sitemap', name: 'HTML Sitemap', hasCanonical: true, hasDescription: true, hasH1: true },
  { url: '/install', name: 'Install PWA', hasCanonical: true, hasDescription: true, hasH1: true },
  { url: '/privacy', name: 'Privacy', hasCanonical: true, hasDescription: true, hasH1: true },
  { url: '/media-calendar', name: 'Media Calendar', hasCanonical: true, hasDescription: true, hasH1: true },
] as const;

export function SEOAuditPanel({ password }: { password: string }) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [selectedTab, setSelectedTab] = useState('overview');
  const [fixingIssue, setFixingIssue] = useState<string | null>(null);
  const [crawlerStatus, setCrawlerStatus] = useState<{robots: boolean; sitemap: boolean; ssrRender: boolean; wikiSitemap: boolean; newsSitemap: boolean} | null>(null);
  const [isBulkFixing, setIsBulkFixing] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const queryClient = useQueryClient();

  // Check crawler accessibility
  const checkCrawlerAccess = async () => {
    const results = { robots: false, sitemap: false, ssrRender: false, wikiSitemap: false, newsSitemap: false };
    
    const checks = [
      fetch('https://echoes2.com/robots.txt').then(r => { results.robots = r.ok; }).catch(() => {}),
      fetch('https://bgdwxnoildvvepsoaxrf.supabase.co/functions/v1/sitemap').then(r => { results.sitemap = r.ok; }).catch(() => {}),
      fetch('https://bgdwxnoildvvepsoaxrf.supabase.co/functions/v1/ssr-render?path=/&lang=en').then(r => { results.ssrRender = r.ok; }).catch(() => {}),
      fetch('https://bgdwxnoildvvepsoaxrf.supabase.co/functions/v1/wiki-sitemap').then(r => { results.wikiSitemap = r.ok; }).catch(() => {}),
      fetch('https://bgdwxnoildvvepsoaxrf.supabase.co/functions/v1/news-sitemap?country=us').then(r => { results.newsSitemap = r.ok; }).catch(() => {}),
    ];
    
    await Promise.all(checks);
    setCrawlerStatus(results);
  };

  // Auto-fix handler
  const handleAutoFix = async (issue: SEOIssue) => {
    setFixingIssue(issue.id);
    
    try {
      if (issue.category === 'Description' && issue.page.startsWith('/read/')) {
        const [, , date, storyNum] = issue.page.split('/');
        
        const { data: part } = await supabase
          .from('parts')
          .select('id, content, content_en')
          .eq('date', date)
          .eq('number', parseInt(storyNum))
          .single();
        
        if (part) {
          const content = part.content_en || part.content || '';
          const cleanContent = content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
          const seoDescription = cleanContent.slice(0, 155) + (cleanContent.length > 155 ? '...' : '');
          
          await supabase.from('parts').update({ seo_description: seoDescription }).eq('id', part.id);
          toast.success(`Мета-опис згенеровано для ${issue.page}`);
          queryClient.invalidateQueries({ queryKey: ['seo-audit'] });
        }
      } else {
        toast.info('Автовиправлення для цього типу проблем поки недоступне');
      }
    } catch (error) {
      console.error('Auto-fix error:', error);
      toast.error('Помилка автовиправлення');
    } finally {
      setFixingIssue(null);
    }
  };

  // Bulk auto-fix all missing meta descriptions
  const handleBulkAutoFix = async () => {
    setIsBulkFixing(true);
    
    try {
      const { data: partsToFix } = await supabase
        .from('parts')
        .select('id, content, content_en, seo_description')
        .eq('status', 'published')
        .or('seo_description.is.null,seo_description.eq.')
        .limit(200);
      
      if (!partsToFix || partsToFix.length === 0) {
        toast.info('Усі історії вже мають мета-описи');
        setIsBulkFixing(false);
        return;
      }
      
      let fixedCount = 0;
      for (const part of partsToFix) {
        if (part.seo_description && part.seo_description.length > 50) continue;
        
        const content = part.content_en || part.content || '';
        const cleanContent = content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        if (cleanContent.length < 50) continue;
        
        const seoDescription = cleanContent.slice(0, 155) + (cleanContent.length > 155 ? '...' : '');
        const { error } = await supabase.from('parts').update({ seo_description: seoDescription }).eq('id', part.id);
        if (!error) fixedCount++;
      }
      
      toast.success(`Згенеровано ${fixedCount} мета-описів`);
      queryClient.invalidateQueries({ queryKey: ['seo-audit'] });
    } catch (error) {
      console.error('Bulk fix error:', error);
      toast.error('Помилка масового виправлення');
    } finally {
      setIsBulkFixing(false);
    }
  };

  // Ping search engines
  const handlePingSearchEngines = async () => {
    setIsPinging(true);
    try {
      const result = await callEdgeFunction<{
        success: boolean;
        results: Array<{ service: string; success: boolean }>;
      }>('ping-sitemap', {});
      
      if (result.success) {
        toast.success('Пошукові системи повідомлені про оновлення');
      } else {
        const failed = result.results.filter(r => !r.success).map(r => r.service).join(', ');
        toast.warning(`Деякі сервіси не відповіли: ${failed}`);
      }
    } catch (error) {
      toast.error('Помилка пінгу пошукових систем');
    } finally {
      setIsPinging(false);
    }
  };

  // Main SEO audit query
  const { data: seoData, isLoading, refetch } = useQuery({
    queryKey: ['seo-audit'],
    queryFn: async () => {
      // Parallel data fetching
      const [partsRes, chaptersRes, newsRes, countriesRes, wikiRes, cachedRes] = await Promise.all([
        supabase.from('parts')
          .select('id, date, title, title_en, content_en, seo_title, seo_description, cover_image_url, status, number')
          .eq('status', 'published')
          .order('date', { ascending: false })
          .limit(200),
        supabase.from('chapters')
          .select('id, number, title, title_en, seo_title, seo_description, cover_image_url')
          .order('number', { ascending: false })
          .limit(50),
        supabase.from('news_rss_items')
          .select('id, slug, title, title_en, description_en, content_en, image_url, country_id')
          .not('slug', 'is', null)
          .not('content_en', 'is', null)
          .order('fetched_at', { ascending: false })
          .limit(200),
        supabase.from('news_countries').select('id, code'),
        supabase.from('wiki_entities')
          .select('id, name, name_en, description_en, extract_en, image_url, slug')
          .not('slug', 'is', null)
          .order('search_count', { ascending: false })
          .limit(200),
        supabase.from('cached_pages')
          .select('path, updated_at, html_size_bytes')
          .order('updated_at', { ascending: false })
          .limit(500),
      ]);

      const parts = partsRes.data || [];
      const chapters = chaptersRes.data || [];
      const newsItems = newsRes.data || [];
      const wikiEntities = wikiRes.data || [];
      const cachedPages = cachedRes.data || [];
      const countryMap = new Map((countriesRes.data || []).map(c => [c.id, c.code.toLowerCase()]));
      const cachedPathSet = new Set(cachedPages.map(c => c.path));

      const issues: SEOIssue[] = [];
      let totalScore = 0;
      let pageCount = 0;

      // --- Static pages analysis ---
      for (const page of STATIC_PAGES) {
        pageCount++;
        let score = 100;
        if (!page.hasCanonical) {
          issues.push({
            id: `canonical-${page.url}`, type: 'error', category: 'Canonical',
            page: page.url, title: 'Відсутній canonical URL',
            description: `Сторінка ${page.name} не має canonical URL`,
            recommendation: `Додайте canonicalUrl="${BASE_URL}${page.url}" до SEOHead`, autoFixable: false
          });
          score -= 20;
        }
        if (!page.hasDescription) {
          issues.push({
            id: `desc-${page.url}`, type: 'warning', category: 'Description',
            page: page.url, title: 'Відсутній мета-опис',
            description: `${page.name} не має унікального мета-опису`,
            recommendation: `Додайте description до SEOHead (${SEO_RULES.description.min}-${SEO_RULES.description.max} симв.)`,
            autoFixable: false
          });
          score -= 15;
        }
        totalScore += score;
      }

      // --- Stories analysis ---
      for (const part of parts) {
        pageCount++;
        let score = 100;
        const pageUrl = `/read/${part.date}/${part.number}`;
        
        const title = part.seo_title || part.title_en || part.title;
        if (title.length < SEO_RULES.title.min) {
          issues.push({
            id: `title-short-${part.id}`, type: 'warning', category: 'Title',
            page: pageUrl, title: `Короткий заголовок (${title.length} симв.)`,
            description: `"${title.slice(0, 40)}..."`,
            recommendation: `Розширте до ${SEO_RULES.title.min}-${SEO_RULES.title.max} символів`,
            autoFixable: false
          });
          score -= 10;
        } else if (title.length > SEO_RULES.title.max) {
          score -= 5;
        }

        const desc = part.seo_description || (part.content_en || '').slice(0, 160);
        if (!desc || desc.length < SEO_RULES.description.min) {
          issues.push({
            id: `desc-short-${part.id}`, type: 'warning', category: 'Description',
            page: pageUrl, title: 'Короткий/відсутній мета-опис',
            description: `Мета-опис ${desc ? desc.length : 0} симв.`,
            recommendation: `Додайте seo_description (${SEO_RULES.description.min}-${SEO_RULES.description.max} симв.)`,
            autoFixable: true
          });
          score -= 15;
        }

        if (!part.cover_image_url) {
          issues.push({
            id: `og-img-${part.id}`, type: 'warning', category: 'OG Image',
            page: pageUrl, title: 'Відсутнє OG зображення',
            description: 'Немає обкладинки для соц. мереж',
            recommendation: 'Згенеруйте або додайте зображення обкладинки',
            autoFixable: false
          });
          score -= 10;
        }
        totalScore += score;
      }

      // --- Chapters analysis ---
      for (const chapter of chapters) {
        pageCount++;
        let score = 100;
        const pageUrl = `/chapter/${chapter.number}`;

        if (!chapter.cover_image_url) {
          issues.push({
            id: `ch-img-${chapter.id}`, type: 'warning', category: 'OG Image',
            page: pageUrl, title: `Глава ${chapter.number} без обкладинки`,
            description: 'Немає зображення для соц. мереж',
            recommendation: 'Додайте cover_image_url', autoFixable: false
          });
          score -= 10;
        }
        totalScore += score;
      }

      // --- News analysis ---
      let newsWithRetelling = 0;
      let newsWithImage = 0;
      for (const news of newsItems) {
        pageCount++;
        let score = 100;
        const countryCode = countryMap.get(news.country_id) || 'unknown';
        const pageUrl = `/news/${countryCode}/${news.slug}`;

        if (news.content_en && news.content_en.length > 100) newsWithRetelling++;
        if (news.image_url) newsWithImage++;

        if (!news.image_url) score -= 10;
        const title = news.title_en || news.title;
        if (title.length > SEO_RULES.title.max + 20) score -= 5;

        // Check if news is cached for SSR
        if (!cachedPathSet.has(`/news/${countryCode}/${news.slug}`)) {
          score -= 5;
        }
        totalScore += score;
      }

      // --- Wiki entities analysis ---
      let wikiWithDescription = 0;
      let wikiWithImage = 0;
      let wikiCached = 0;
      for (const entity of wikiEntities) {
        pageCount++;
        let score = 100;
        const pageUrl = `/wiki/${entity.slug}`;

        if (entity.description_en || entity.extract_en) wikiWithDescription++;
        if (entity.image_url) wikiWithImage++;
        if (cachedPathSet.has(pageUrl)) wikiCached++;

        if (!entity.description_en && !entity.extract_en) {
          score -= 15;
        }
        if (!entity.image_url) {
          score -= 10;
        }
        if (!cachedPathSet.has(pageUrl)) {
          score -= 5;
        }
        totalScore += score;
      }

      const averageScore = pageCount > 0 ? Math.round(totalScore / pageCount) : 0;

      // Group issues by category
      const issuesByCategory: Record<string, SEOIssue[]> = {};
      for (const issue of issues) {
        if (!issuesByCategory[issue.category]) issuesByCategory[issue.category] = [];
        issuesByCategory[issue.category].push(issue);
      }

      return {
        issues,
        issuesByCategory,
        stats: {
          totalPages: pageCount,
          averageScore,
          errorCount: issues.filter(i => i.type === 'error').length,
          warningCount: issues.filter(i => i.type === 'warning').length,
          infoCount: issues.filter(i => i.type === 'info').length,
          autoFixableCount: issues.filter(i => i.autoFixable).length,
        },
        coverage: {
          stories: { total: parts.length, withImage: parts.filter(p => p.cover_image_url).length, withDesc: parts.filter(p => p.seo_description && p.seo_description.length > 50).length },
          chapters: { total: chapters.length, withImage: chapters.filter(c => c.cover_image_url).length },
          news: { total: newsItems.length, withRetelling: newsWithRetelling, withImage: newsWithImage },
          wiki: { total: wikiEntities.length, withDescription: wikiWithDescription, withImage: wikiWithImage, cached: wikiCached },
          cache: { total: cachedPages.length, avgSize: cachedPages.length > 0 ? Math.round(cachedPages.reduce((a, c) => a + (c.html_size_bytes || 0), 0) / cachedPages.length / 1024) : 0 },
        },
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  // AI recommendations
  const generateAIRecommendations = useMutation({
    mutationFn: async () => {
      if (!seoData) throw new Error('No data');

      const topIssues = seoData.issues.slice(0, 10).map(i => `${i.category}: ${i.title} (${i.page})`).join('\n');

      return callEdgeFunction<{ success: boolean; recommendations: string }>(
        'generate-dialogue',
        {
          storyContext: `SEO Audit Report for bravennow.com:\n\nTotal Pages: ${seoData.stats.totalPages}\nAverage Score: ${seoData.stats.averageScore}%\nErrors: ${seoData.stats.errorCount}\nWarnings: ${seoData.stats.warningCount}\n\nTop Issues:\n${topIssues}\n\nCoverage:\nStories: ${seoData.coverage.stories.total} (${seoData.coverage.stories.withDesc} with desc)\nNews: ${seoData.coverage.news.total} (${seoData.coverage.news.withRetelling} retold)\nWiki: ${seoData.coverage.wiki.total} (${seoData.coverage.wiki.cached} cached)`,
          newsContext: 'Generate SEO recommendations based on Google SEO Starter Guide best practices',
          generateTweets: false,
          messageCount: 1,
          contentLanguage: 'uk',
          systemPrompt: 'You are an SEO expert. Analyze the SEO audit report and provide 5 specific, actionable recommendations in Ukrainian. Focus on the most impactful improvements. Format as numbered list. Be concise but specific.',
        }
      );
    },
    onSuccess: () => toast.success('AI рекомендації згенеровано'),
    onError: () => toast.error('Помилка генерації рекомендацій'),
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const coverage = seoData?.coverage;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Search className="w-6 h-6 text-primary" />
            SEO Аудит
          </h2>
          <p className="text-muted-foreground text-sm">
            Аналіз оптимізації за Google SEO Starter Guide • react-helmet-async + JSON-LD + SSR
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Оновити
          </Button>
          <Button variant="outline" onClick={handleBulkAutoFix} disabled={isBulkFixing}>
            {isBulkFixing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
            Масове виправлення
          </Button>
          <Button variant="outline" onClick={handlePingSearchEngines} disabled={isPinging}>
            {isPinging ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Globe className="w-4 h-4 mr-2" />}
            Пінг Google/Bing
          </Button>
          <Button onClick={() => generateAIRecommendations.mutate()} disabled={generateAIRecommendations.isPending}>
            {generateAIRecommendations.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            AI Рекомендації
          </Button>
        </div>
      </div>

      {/* Score + Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="cosmic-card col-span-2 md:col-span-1">
          <CardContent className="pt-6 text-center">
            <div className={`text-4xl font-bold ${getScoreColor(seoData?.stats.averageScore || 0)}`}>
              {seoData?.stats.averageScore || 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Загальний бал</p>
            <Progress value={seoData?.stats.averageScore || 0} className="mt-2" />
          </CardContent>
        </Card>

        <Card className="cosmic-card">
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{seoData?.stats.errorCount || 0}</p>
              <p className="text-xs text-muted-foreground">Помилок</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cosmic-card">
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{seoData?.stats.warningCount || 0}</p>
              <p className="text-xs text-muted-foreground">Попереджень</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cosmic-card">
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{seoData?.stats.totalPages || 0}</p>
              <p className="text-xs text-muted-foreground">Сторінок</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cosmic-card">
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{seoData?.stats.autoFixableCount || 0}</p>
              <p className="text-xs text-muted-foreground">Авто-виправлень</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SEO Coverage Dashboard */}
      {coverage && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="cosmic-card">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Історії</span>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between"><span>Всього:</span><span className="font-mono">{coverage.stories.total}</span></div>
                <div className="flex justify-between"><span>З описом:</span><span className="font-mono">{coverage.stories.withDesc}</span></div>
                <div className="flex justify-between"><span>З OG Image:</span><span className="font-mono">{coverage.stories.withImage}</span></div>
              </div>
            </CardContent>
          </Card>

          <Card className="cosmic-card">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Глави</span>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between"><span>Всього:</span><span className="font-mono">{coverage.chapters.total}</span></div>
                <div className="flex justify-between"><span>З OG Image:</span><span className="font-mono">{coverage.chapters.withImage}</span></div>
              </div>
            </CardContent>
          </Card>

          <Card className="cosmic-card">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-2">
                <Newspaper className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Новини</span>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between"><span>Всього:</span><span className="font-mono">{coverage.news.total}</span></div>
                <div className="flex justify-between"><span>Retold:</span><span className="font-mono">{coverage.news.withRetelling}</span></div>
                <div className="flex justify-between"><span>З Image:</span><span className="font-mono">{coverage.news.withImage}</span></div>
              </div>
            </CardContent>
          </Card>

          <Card className="cosmic-card">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Wiki</span>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between"><span>Всього:</span><span className="font-mono">{coverage.wiki.total}</span></div>
                <div className="flex justify-between"><span>З описом:</span><span className="font-mono">{coverage.wiki.withDescription}</span></div>
                <div className="flex justify-between"><span>Кешовано:</span><span className="font-mono">{coverage.wiki.cached}</span></div>
              </div>
            </CardContent>
          </Card>

          <Card className="cosmic-card">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-2">
                <Bot className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">SSR Кеш</span>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between"><span>Сторінок:</span><span className="font-mono">{coverage.cache.total}</span></div>
                <div className="flex justify-between"><span>Сер. розмір:</span><span className="font-mono">{coverage.cache.avgSize} KB</span></div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Crawler Accessibility */}
      <Card className="cosmic-card border-green-500/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="w-5 h-5 text-green-500" />
            Доступність для пошукових ботів
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 flex-wrap">
            {!crawlerStatus ? (
              <Button variant="outline" size="sm" onClick={checkCrawlerAccess}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Перевірити доступність
              </Button>
            ) : (
              <>
                {[
                  { key: 'robots', label: 'robots.txt' },
                  { key: 'sitemap', label: 'XML Sitemap' },
                  { key: 'wikiSitemap', label: 'Wiki Sitemap' },
                  { key: 'newsSitemap', label: 'News Sitemap' },
                  { key: 'ssrRender', label: 'SSR Render' },
                ].map(item => (
                  <div key={item.key} className="flex items-center gap-2">
                    {crawlerStatus[item.key as keyof typeof crawlerStatus] ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className="text-sm">{item.label}</span>
                  </div>
                ))}
                <a 
                  href="https://bravennow.com/sitemap"
                  target="_blank" rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1 text-sm ml-auto"
                >
                  <MapIcon className="w-4 h-4" />
                  HTML Sitemap
                </a>
                <Button variant="ghost" size="sm" onClick={checkCrawlerAccess}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Огляд</TabsTrigger>
          <TabsTrigger value="issues">
            Проблеми
            {(seoData?.issues.length || 0) > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">{seoData?.issues.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="pages">Сторінки</TabsTrigger>
          <TabsTrigger value="recommendations">Рекомендації</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {Object.entries(seoData?.issuesByCategory || {}).map(([category, issues]) => (
              <Collapsible key={category} open={expandedSections[category]} onOpenChange={() => toggleSection(category)}>
                <Card className="cosmic-card">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          {category === 'Canonical' && <Link2 className="w-4 h-4" />}
                          {category === 'Description' && <FileText className="w-4 h-4" />}
                          {category === 'Title' && <Tag className="w-4 h-4" />}
                          {category === 'OG Image' && <Image className="w-4 h-4" />}
                          {category}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge variant={issues.some(i => i.type === 'error') ? 'destructive' : 'secondary'}>
                            {issues.length}
                          </Badge>
                          {expandedSections[category] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <ScrollArea className="h-[200px]">
                        <div className="space-y-2">
                          {issues.slice(0, 15).map(issue => (
                            <div key={issue.id} className="p-2 border border-border rounded text-sm">
                              <div className="flex items-start gap-2">
                                {issue.type === 'error' && <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />}
                                {issue.type === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />}
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{issue.title}</p>
                                  <p className="text-xs text-muted-foreground truncate">{issue.page}</p>
                                </div>
                                {issue.autoFixable && (
                                  <Badge variant="outline" className="text-xs shrink-0">
                                    <Zap className="w-3 h-3 mr-1" />Auto
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                          {issues.length > 15 && (
                            <p className="text-xs text-muted-foreground text-center py-2">
                              +{issues.length - 15} більше
                            </p>
                          )}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))}
          </div>

          {/* Infrastructure summary */}
          <Card className="cosmic-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">SEO Інфраструктура</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                {[
                  { label: 'react-helmet-async', ok: true, desc: 'Мета-теги через Helmet' },
                  { label: 'JSON-LD Schemas', ok: true, desc: 'Organization, Article, Breadcrumbs' },
                  { label: 'Code Splitting', ok: true, desc: 'React.lazy для маршрутів' },
                  { label: 'OptimizedImage', ok: true, desc: 'Lazy load + srcset + WebP' },
                  { label: 'Hreflang', ok: true, desc: 'uk, en, pl, x-default' },
                  { label: 'SSR для ботів', ok: true, desc: 'ssr-render Edge Function' },
                  { label: 'PWA', ok: true, desc: 'Service Worker + manifest' },
                  { label: 'Dublin Core', ok: true, desc: 'DC.title, DC.language...' },
                ].map(item => (
                  <div key={item.label} className="flex items-start gap-2 p-2 rounded bg-muted/30">
                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Issues Tab */}
        <TabsContent value="issues" className="mt-4">
          <Card className="cosmic-card">
            <CardHeader>
              <CardTitle>Усі проблеми ({seoData?.issues.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {seoData?.issues.map(issue => (
                    <div key={issue.id} className={`p-4 border rounded-lg ${
                      issue.type === 'error' ? 'border-red-500/30 bg-red-500/5' :
                      issue.type === 'warning' ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-border'
                    }`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          {issue.type === 'error' && <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />}
                          {issue.type === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />}
                          <div>
                            <p className="font-medium">{issue.title}</p>
                            <p className="text-sm text-muted-foreground mt-1">{issue.description}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline">{issue.category}</Badge>
                              <code className="text-xs bg-muted px-2 py-0.5 rounded">{issue.page}</code>
                            </div>
                            <p className="text-sm text-primary mt-2">💡 {issue.recommendation}</p>
                          </div>
                        </div>
                        {issue.autoFixable && (
                          <Button size="sm" variant="outline" onClick={() => handleAutoFix(issue)} disabled={fixingIssue === issue.id}>
                            {fixingIssue === issue.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Zap className="w-4 h-4 mr-1" />}
                            Виправити
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  {(!seoData?.issues.length) && (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                      <p>Проблем не знайдено! 🎉</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pages Tab */}
        <TabsContent value="pages" className="mt-4">
          <Card className="cosmic-card">
            <CardHeader>
              <CardTitle>Аналіз сторінок</CardTitle>
              <CardDescription>SEO статус окремих сторінок (Helmet + canonical + JSON-LD)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">Статичні сторінки ({STATIC_PAGES.length})</h3>
                  <div className="grid gap-2">
                    {STATIC_PAGES.map(page => (
                      <div key={page.url} className="flex items-center justify-between p-2 border border-border rounded">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span>{page.name}</span>
                          <code className="text-xs text-muted-foreground">{page.url}</code>
                          {page.hasCanonical && <Badge variant="outline" className="text-xs">canonical</Badge>}
                        </div>
                        <a href={`${BASE_URL}${page.url}`} target="_blank" rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1 text-sm">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid md:grid-cols-4 gap-4 pt-4 border-t border-border">
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <p className="text-2xl font-bold">{coverage?.stories.total || 0}</p>
                    <p className="text-sm text-muted-foreground">Історій</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <p className="text-2xl font-bold">{coverage?.chapters.total || 0}</p>
                    <p className="text-sm text-muted-foreground">Глав</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <p className="text-2xl font-bold">{coverage?.news.total || 0}</p>
                    <p className="text-sm text-muted-foreground">Новин</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <p className="text-2xl font-bold">{coverage?.wiki.total || 0}</p>
                    <p className="text-sm text-muted-foreground">Wiki сутностей</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recommendations Tab */}
        <TabsContent value="recommendations" className="mt-4">
          <Card className="cosmic-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                AI Рекомендації
              </CardTitle>
              <CardDescription>На основі Google SEO Starter Guide</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { n: 1, title: 'Canonical URLs', desc: 'Всі сторінки мають canonical URL з доменом bravennow.com через react-helmet-async. Це запобігає дублюванню контенту.' },
                  { n: 2, title: 'Meta Descriptions', desc: `Кожна сторінка повинна мати унікальний мета-опис ${SEO_RULES.description.min}-${SEO_RULES.description.max} символів. Використовуйте "Масове виправлення" для автогенерації.` },
                  { n: 3, title: 'Open Graph зображення', desc: 'Всі сторінки з контентом повинні мати OG зображення мінімум 1200x630px для коректного шарингу в соц. мережах.' },
                  { n: 4, title: 'Структуровані дані (JSON-LD)', desc: 'SEOHead автоматично генерує Organization, Article/WebSite та BreadcrumbList схеми для кращого розуміння контенту пошуковими системами.' },
                  { n: 5, title: 'SSR та кешування', desc: 'Пріоритетні сторінки (новини + топ-500 Wiki) кешуються в cached_pages на 24 години для миттєвої віддачі ботам без JS.' },
                ].map(item => (
                  <div key={item.n} className="p-4 border border-primary/30 rounded-lg bg-primary/5">
                    <h4 className="font-medium flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">{item.n}</span>
                      {item.title}
                    </h4>
                    <p className="text-sm text-muted-foreground mt-2">{item.desc}</p>
                  </div>
                ))}
              </div>

              {generateAIRecommendations.data && (
                <div className="mt-6 p-4 border border-primary rounded-lg bg-primary/10">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Персоналізовані рекомендації AI
                  </h4>
                  <div className="text-sm whitespace-pre-wrap">
                    {JSON.stringify(generateAIRecommendations.data, null, 2)}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Google SEO Guide */}
      <Card className="cosmic-card border-blue-500/30">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="w-8 h-8 text-blue-500" />
              <div>
                <p className="font-medium">Google SEO Starter Guide</p>
                <p className="text-sm text-muted-foreground">Офіційний гайд з оптимізації</p>
              </div>
            </div>
            <a href="https://developers.google.com/search/docs/fundamentals/seo-starter-guide" target="_blank" rel="noopener noreferrer">
              <Button variant="outline">
                <ExternalLink className="w-4 h-4 mr-2" />
                Відкрити
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
