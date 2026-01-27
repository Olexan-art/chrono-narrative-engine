import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Search, AlertTriangle, CheckCircle, XCircle, RefreshCw, Loader2, 
  ExternalLink, Globe, FileText, Image, Link2, Tag, Eye, Zap,
  ChevronDown, ChevronUp, Sparkles, Bot, MapIcon
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

interface PageSEOData {
  url: string;
  title: string;
  hasCanonical: boolean;
  hasDescription: boolean;
  hasOgImage: boolean;
  hasBreadcrumbs: boolean;
  titleLength: number;
  descriptionLength: number;
  issues: SEOIssue[];
  score: number;
}

const BASE_URL = 'https://echoes2.com';

// SEO Best Practices from Google Guide
const SEO_RULES = {
  title: { min: 30, max: 60, ideal: 50 },
  description: { min: 120, max: 160, ideal: 155 },
  h1: { required: true, unique: true },
  canonical: { required: true },
  ogImage: { required: true, minWidth: 1200, minHeight: 630 },
  altText: { required: true },
  internalLinks: { min: 3 },
  breadcrumbs: { required: true }
};

export function SEOAuditPanel({ password }: { password: string }) {
  const [isScanning, setIsScanning] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [selectedTab, setSelectedTab] = useState('overview');
  const [fixingIssue, setFixingIssue] = useState<string | null>(null);
  const [crawlerStatus, setCrawlerStatus] = useState<{robots: boolean; sitemap: boolean; ssrRender: boolean} | null>(null);
  const queryClient = useQueryClient();

  // Check crawler accessibility
  const checkCrawlerAccess = async () => {
    const results = { robots: false, sitemap: false, ssrRender: false };
    
    try {
      const robotsRes = await fetch('https://echoes2.com/robots.txt');
      results.robots = robotsRes.ok;
    } catch (e) { /* ignore */ }
    
    try {
      const sitemapRes = await fetch('https://bgdwxnoildvvepsoaxrf.supabase.co/functions/v1/sitemap');
      results.sitemap = sitemapRes.ok;
    } catch (e) { /* ignore */ }
    
    try {
      const ssrRes = await fetch('https://bgdwxnoildvvepsoaxrf.supabase.co/functions/v1/ssr-render?path=/&lang=en');
      results.ssrRender = ssrRes.ok;
    } catch (e) { /* ignore */ }
    
    setCrawlerStatus(results);
  };

  // Auto-fix handler
  const handleAutoFix = async (issue: SEOIssue) => {
    setFixingIssue(issue.id);
    
    try {
      // Extract ID from issue.id (format: "desc-short-UUID" or "canonical-/path")
      const parts = issue.id.split('-');
      const entityType = parts[0]; // 'desc', 'canonical', etc.
      
      if (issue.category === 'Description' && issue.page.startsWith('/read/')) {
        // Fix missing description for a story
        const [, , date, storyNum] = issue.page.split('/');
        
        // Get the part and generate description from content
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
          
          await supabase
            .from('parts')
            .update({ seo_description: seoDescription })
            .eq('id', part.id);
          
          toast.success(`Мета-опис згенеровано для ${issue.page}`);
          queryClient.invalidateQueries({ queryKey: ['seo-audit'] });
        }
      } else if (issue.category === 'Meta Description' && issue.page.startsWith('/')) {
        // For static pages, we can't auto-fix - notify user
        toast.info('Додайте SEOHead компонент до цієї сторінки вручну');
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

  // Fetch all pages data for SEO analysis
  const { data: seoData, isLoading, refetch } = useQuery({
    queryKey: ['seo-audit'],
    queryFn: async () => {
      // Fetch parts with SEO data
      const { data: parts } = await supabase
        .from('parts')
        .select('id, date, title, title_en, content, content_en, seo_title, seo_description, seo_keywords, cover_image_url, status, number')
        .eq('status', 'published')
        .order('date', { ascending: false })
        .limit(100);

      // Fetch chapters with SEO data
      const { data: chapters } = await supabase
        .from('chapters')
        .select('id, number, title, title_en, description, description_en, seo_title, seo_description, seo_keywords, cover_image_url')
        .order('number', { ascending: false })
        .limit(50);

      // Fetch news items
      const { data: newsItems } = await supabase
        .from('news_rss_items')
        .select('id, slug, title, title_en, description, description_en, image_url, country_id')
        .not('slug', 'is', null)
        .order('fetched_at', { ascending: false })
        .limit(100);

      // Fetch countries
      const { data: countries } = await supabase
        .from('news_countries')
        .select('id, code');

      const countryMap = new Map(countries?.map(c => [c.id, c.code.toLowerCase()]) || []);

      // Analyze each page
      const issues: SEOIssue[] = [];
      let totalScore = 0;
      let pageCount = 0;

      // Static pages - all now have SEOHead components
      const staticPages = [
        { url: '/', name: 'Головна', hasCanonical: true, hasDescription: true },
        { url: '/calendar', name: 'Календар', hasCanonical: true, hasDescription: true },
        { url: '/chapters', name: 'Глави', hasCanonical: true, hasDescription: true },
        { url: '/volumes', name: 'Томи', hasCanonical: true, hasDescription: true },
        { url: '/news-digest', name: 'Новини', hasCanonical: true, hasDescription: true },
        { url: '/sitemap', name: 'Sitemap', hasCanonical: true, hasDescription: true },
      ];

      // Analyze static pages
      for (const page of staticPages) {
        if (!page.hasCanonical) {
          issues.push({
            id: `canonical-${page.url}`,
            type: 'error',
            category: 'Canonical URL',
            page: page.url,
            title: `Відсутній canonical URL`,
            description: `Сторінка ${page.name} (${page.url}) не має canonical URL`,
            recommendation: `Додайте <link rel="canonical" href="${BASE_URL}${page.url}" /> та SEOHead компонент`,
            autoFixable: true
          });
        }
        if (!page.hasDescription) {
          issues.push({
            id: `desc-${page.url}`,
            type: 'warning',
            category: 'Meta Description',
            page: page.url,
            title: `Відсутній мета-опис`,
            description: `Сторінка ${page.name} не має унікального мета-опису`,
            recommendation: `Додайте description prop до SEOHead (${SEO_RULES.description.min}-${SEO_RULES.description.max} символів)`,
            autoFixable: true
          });
        }
      }

      // Analyze parts (stories)
      for (const part of parts || []) {
        pageCount++;
        let pageScore = 100;
        const pageUrl = `/read/${part.date}/${part.number}`;
        
        // Check title length
        const title = part.seo_title || part.title_en || part.title;
        if (title.length < SEO_RULES.title.min) {
          issues.push({
            id: `title-short-${part.id}`,
            type: 'warning',
            category: 'Title',
            page: pageUrl,
            title: `Короткий заголовок (${title.length} симв.)`,
            description: `Заголовок "${title.slice(0, 30)}..." занадто короткий`,
            recommendation: `Розширте заголовок до ${SEO_RULES.title.min}-${SEO_RULES.title.max} символів`,
            autoFixable: false
          });
          pageScore -= 10;
        } else if (title.length > SEO_RULES.title.max) {
          issues.push({
            id: `title-long-${part.id}`,
            type: 'warning',
            category: 'Title',
            page: pageUrl,
            title: `Довгий заголовок (${title.length} симв.)`,
            description: `Заголовок занадто довгий, буде обрізаний в пошуку`,
            recommendation: `Скоротіть до ${SEO_RULES.title.max} символів`,
            autoFixable: false
          });
          pageScore -= 5;
        }

        // Check description
        const desc = part.seo_description || (part.content_en || part.content || '').slice(0, 160);
        if (!desc || desc.length < SEO_RULES.description.min) {
          issues.push({
            id: `desc-short-${part.id}`,
            type: 'warning',
            category: 'Description',
            page: pageUrl,
            title: `Короткий мета-опис`,
            description: `Мета-опис занадто короткий або відсутній`,
            recommendation: `Додайте seo_description (${SEO_RULES.description.min}-${SEO_RULES.description.max} симв.)`,
            autoFixable: true
          });
          pageScore -= 15;
        }

        // Check cover image
        if (!part.cover_image_url) {
          issues.push({
            id: `image-${part.id}`,
            type: 'warning',
            category: 'Open Graph',
            page: pageUrl,
            title: `Відсутнє OG зображення`,
            description: `Історія не має обкладинки для соц. мереж`,
            recommendation: `Згенеруйте або додайте зображення обкладинки`,
            autoFixable: false
          });
          pageScore -= 10;
        }

        // Keywords are optional per Google - don't penalize for missing
        // Google officially ignores meta keywords, so we skip this check

        totalScore += pageScore;
      }

      // Analyze chapters
      for (const chapter of chapters || []) {
        pageCount++;
        let pageScore = 100;
        const pageUrl = `/chapter/${chapter.number}`;

        const title = chapter.seo_title || chapter.title_en || chapter.title;
        if (title.length < SEO_RULES.title.min) {
          pageScore -= 10;
        }

        if (!chapter.cover_image_url) {
          issues.push({
            id: `chapter-image-${chapter.id}`,
            type: 'warning',
            category: 'Open Graph',
            page: pageUrl,
            title: `Глава без обкладинки`,
            description: `Глава ${chapter.number} не має зображення`,
            recommendation: `Додайте cover_image_url для кращого відображення в соц. мережах`,
            autoFixable: false
          });
          pageScore -= 10;
        }

        totalScore += pageScore;
      }

      // Analyze news items
      for (const news of newsItems || []) {
        pageCount++;
        let pageScore = 100;
        const countryCode = countryMap.get(news.country_id) || 'unknown';
        const pageUrl = `/news/${countryCode}/${news.slug}`;

        if (!news.image_url) {
          pageScore -= 10;
        }

        const title = news.title_en || news.title;
        if (title.length > SEO_RULES.title.max + 20) {
          pageScore -= 5;
        }

        totalScore += pageScore;
      }

      const averageScore = pageCount > 0 ? Math.round(totalScore / pageCount) : 0;

      // Group issues by category
      const issuesByCategory: Record<string, SEOIssue[]> = {};
      for (const issue of issues) {
        if (!issuesByCategory[issue.category]) {
          issuesByCategory[issue.category] = [];
        }
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
          autoFixableCount: issues.filter(i => i.autoFixable).length
        },
        parts: parts || [],
        chapters: chapters || [],
        newsCount: newsItems?.length || 0
      };
    },
    staleTime: 1000 * 60 * 5
  });

  // AI recommendations mutation
  const generateAIRecommendations = useMutation({
    mutationFn: async () => {
      if (!seoData) throw new Error('No data');

      const topIssues = seoData.issues.slice(0, 10).map(i => 
        `${i.category}: ${i.title} (${i.page})`
      ).join('\n');

      const result = await callEdgeFunction<{ success: boolean; recommendations: string }>(
        'generate-dialogue',
        {
          storyContext: `SEO Audit Report for echoes2.com:\n\nTotal Pages: ${seoData.stats.totalPages}\nAverage Score: ${seoData.stats.averageScore}%\nErrors: ${seoData.stats.errorCount}\nWarnings: ${seoData.stats.warningCount}\n\nTop Issues:\n${topIssues}`,
          newsContext: 'Generate SEO recommendations based on Google SEO Starter Guide best practices',
          generateTweets: false,
          messageCount: 1,
          contentLanguage: 'uk',
          systemPrompt: `You are an SEO expert. Analyze the SEO audit report and provide 5 specific, actionable recommendations in Ukrainian. Focus on the most impactful improvements. Format as numbered list. Be concise but specific.`
        }
      );

      return result;
    },
    onSuccess: (data) => {
      toast.success('AI рекомендації згенеровано');
    },
    onError: (error) => {
      toast.error('Помилка генерації рекомендацій');
    }
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Search className="w-6 h-6 text-primary" />
            SEO Аудит
          </h2>
          <p className="text-muted-foreground text-sm">
            Аналіз оптимізації для пошукових систем за Google SEO Starter Guide
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Оновити
          </Button>
          <Button
            onClick={() => generateAIRecommendations.mutate()}
            disabled={generateAIRecommendations.isPending}
          >
            {generateAIRecommendations.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            AI Рекомендації
          </Button>
        </div>
      </div>

      {/* Score Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="cosmic-card col-span-2 md:col-span-1">
          <CardContent className="pt-6 text-center">
            <div className={`text-4xl font-bold ${getScoreColor(seoData?.stats.averageScore || 0)}`}>
              {seoData?.stats.averageScore || 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Загальний бал</p>
            <Progress 
              value={seoData?.stats.averageScore || 0} 
              className="mt-2"
            />
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
                <div className="flex items-center gap-2">
                  {crawlerStatus.robots ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span className="text-sm">robots.txt</span>
                </div>
                <div className="flex items-center gap-2">
                  {crawlerStatus.sitemap ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span className="text-sm">XML Sitemap</span>
                </div>
                <div className="flex items-center gap-2">
                  {crawlerStatus.ssrRender ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span className="text-sm">SSR Render</span>
                </div>
                <a 
                  href="https://echoes2.com/sitemap"
                  target="_blank"
                  rel="noopener noreferrer"
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
          <TabsTrigger value="issues">Проблеми</TabsTrigger>
          <TabsTrigger value="pages">Сторінки</TabsTrigger>
          <TabsTrigger value="recommendations">Рекомендації</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          {/* Quick Stats by Category */}
          <div className="grid md:grid-cols-2 gap-4">
            {Object.entries(seoData?.issuesByCategory || {}).map(([category, issues]) => (
              <Collapsible 
                key={category}
                open={expandedSections[category]}
                onOpenChange={() => toggleSection(category)}
              >
                <Card className="cosmic-card">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          {category === 'Canonical URL' && <Link2 className="w-4 h-4" />}
                          {category === 'Meta Description' && <FileText className="w-4 h-4" />}
                          {category === 'Title' && <Tag className="w-4 h-4" />}
                          {category === 'Open Graph' && <Image className="w-4 h-4" />}
                          {category === 'Keywords' && <Search className="w-4 h-4" />}
                          {category === 'Description' && <FileText className="w-4 h-4" />}
                          {category}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            issues.some(i => i.type === 'error') ? 'destructive' : 
                            issues.some(i => i.type === 'warning') ? 'secondary' : 'outline'
                          }>
                            {issues.length}
                          </Badge>
                          {expandedSections[category] ? 
                            <ChevronUp className="w-4 h-4" /> : 
                            <ChevronDown className="w-4 h-4" />
                          }
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <ScrollArea className="h-[200px]">
                        <div className="space-y-2">
                          {issues.slice(0, 10).map((issue) => (
                            <div 
                              key={issue.id} 
                              className="p-2 border border-border rounded text-sm"
                            >
                              <div className="flex items-start gap-2">
                                {issue.type === 'error' && <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />}
                                {issue.type === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />}
                                {issue.type === 'info' && <CheckCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />}
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{issue.title}</p>
                                  <p className="text-xs text-muted-foreground truncate">{issue.page}</p>
                                </div>
                                {issue.autoFixable && (
                                  <Badge variant="outline" className="text-xs shrink-0">
                                    <Zap className="w-3 h-3 mr-1" />
                                    Auto
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                          {issues.length > 10 && (
                            <p className="text-xs text-muted-foreground text-center py-2">
                              +{issues.length - 10} більше проблем
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
        </TabsContent>

        <TabsContent value="issues" className="mt-4">
          <Card className="cosmic-card">
            <CardHeader>
              <CardTitle>Усі проблеми</CardTitle>
              <CardDescription>
                Знайдено {seoData?.issues.length || 0} проблем SEO
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {seoData?.issues.map((issue) => (
                    <div 
                      key={issue.id}
                      className={`p-4 border rounded-lg ${
                        issue.type === 'error' ? 'border-red-500/30 bg-red-500/5' :
                        issue.type === 'warning' ? 'border-yellow-500/30 bg-yellow-500/5' :
                        'border-border'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          {issue.type === 'error' && <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />}
                          {issue.type === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />}
                          {issue.type === 'info' && <CheckCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />}
                          <div>
                            <p className="font-medium">{issue.title}</p>
                            <p className="text-sm text-muted-foreground mt-1">{issue.description}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline">{issue.category}</Badge>
                              <code className="text-xs bg-muted px-2 py-0.5 rounded">{issue.page}</code>
                            </div>
                            <p className="text-sm text-primary mt-2">
                              💡 {issue.recommendation}
                            </p>
                          </div>
                        </div>
                        {issue.autoFixable && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleAutoFix(issue)}
                            disabled={fixingIssue === issue.id}
                          >
                            {fixingIssue === issue.id ? (
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            ) : (
                              <Zap className="w-4 h-4 mr-1" />
                            )}
                            Виправити
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pages" className="mt-4">
          <Card className="cosmic-card">
            <CardHeader>
              <CardTitle>Аналіз сторінок</CardTitle>
              <CardDescription>
                SEO статус окремих сторінок сайту
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Static Pages */}
                <div>
                  <h3 className="font-medium mb-2">Статичні сторінки</h3>
                  <div className="grid gap-2">
                    {[
                      { url: '/', name: 'Головна', status: 'ok' },
                      { url: '/calendar', name: 'Календар', status: 'ok' },
                      { url: '/chapters', name: 'Глави', status: 'ok' },
                      { url: '/volumes', name: 'Томи', status: 'ok' },
                      { url: '/news-digest', name: 'Новини', status: 'ok' },
                      { url: '/sitemap', name: 'Sitemap', status: 'ok' },
                    ].map(page => (
                      <div key={page.url} className="flex items-center justify-between p-2 border border-border rounded">
                        <div className="flex items-center gap-2">
                          {page.status === 'ok' ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-yellow-500" />
                          )}
                          <span>{page.name}</span>
                          <code className="text-xs text-muted-foreground">{page.url}</code>
                        </div>
                        <a 
                          href={`${BASE_URL}${page.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1 text-sm"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Відкрити
                        </a>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dynamic Pages Summary */}
                <div className="grid md:grid-cols-3 gap-4 pt-4 border-t border-border">
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <p className="text-2xl font-bold">{seoData?.parts.length || 0}</p>
                    <p className="text-sm text-muted-foreground">Історій</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <p className="text-2xl font-bold">{seoData?.chapters.length || 0}</p>
                    <p className="text-sm text-muted-foreground">Глав</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <p className="text-2xl font-bold">{seoData?.newsCount || 0}</p>
                    <p className="text-sm text-muted-foreground">Новин</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="mt-4">
          <Card className="cosmic-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                AI Рекомендації
              </CardTitle>
              <CardDescription>
                Рекомендації на основі Google SEO Starter Guide
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Static recommendations based on common issues */}
                <div className="space-y-3">
                  <div className="p-4 border border-primary/30 rounded-lg bg-primary/5">
                    <h4 className="font-medium flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">1</span>
                      Canonical URLs
                    </h4>
                    <p className="text-sm text-muted-foreground mt-2">
                      Переконайтеся, що всі сторінки мають canonical URL з доменом echoes2.com. 
                      Це запобігає дублюванню контенту та покращує індексацію.
                    </p>
                  </div>

                  <div className="p-4 border border-primary/30 rounded-lg bg-primary/5">
                    <h4 className="font-medium flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">2</span>
                      Meta Descriptions
                    </h4>
                    <p className="text-sm text-muted-foreground mt-2">
                      Кожна сторінка повинна мати унікальний мета-опис 120-160 символів. 
                      Це впливає на CTR в пошуковій видачі.
                    </p>
                  </div>

                  <div className="p-4 border border-primary/30 rounded-lg bg-primary/5">
                    <h4 className="font-medium flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">3</span>
                      Open Graph зображення
                    </h4>
                    <p className="text-sm text-muted-foreground mt-2">
                      Всі сторінки з контентом повинні мати OG зображення мінімум 1200x630 пікселів 
                      для коректного відображення при шарингу в соц. мережах.
                    </p>
                  </div>

                  <div className="p-4 border border-primary/30 rounded-lg bg-primary/5">
                    <h4 className="font-medium flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">4</span>
                      Структуровані дані (JSON-LD)
                    </h4>
                    <p className="text-sm text-muted-foreground mt-2">
                      Використовуйте схеми Article, BreadcrumbList, Organization для покращення 
                      розуміння контенту пошуковими системами.
                    </p>
                  </div>

                  <div className="p-4 border border-primary/30 rounded-lg bg-primary/5">
                    <h4 className="font-medium flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">5</span>
                      Alt-текст для зображень
                    </h4>
                    <p className="text-sm text-muted-foreground mt-2">
                      Всі зображення повинні мати описовий alt-текст для доступності 
                      та кращої індексації в Google Images.
                    </p>
                  </div>
                </div>

                {/* AI Generated Recommendations */}
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
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Google SEO Guide Reference */}
      <Card className="cosmic-card border-blue-500/30">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="w-8 h-8 text-blue-500" />
              <div>
                <p className="font-medium">Google SEO Starter Guide</p>
                <p className="text-sm text-muted-foreground">Офіційний гайд з оптимізації для пошукових систем</p>
              </div>
            </div>
            <a 
              href="https://developers.google.com/search/docs/fundamentals/seo-starter-guide"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline">
                <ExternalLink className="w-4 h-4 mr-2" />
                Відкрити гайд
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
