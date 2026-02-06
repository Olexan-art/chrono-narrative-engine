import { useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { uk, enUS, pl } from "date-fns/locale";
import { ArrowLeft, ExternalLink, Sparkles, Loader2, RefreshCw, ChevronLeft, ChevronRight, Twitter, Flame, Languages, Share2, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Header } from "@/components/Header";
import { SEOHead } from "@/components/SEOHead";
import { NewsDialogueSection } from "@/components/NewsDialogueSection";
import { RelatedCountryNews } from "@/components/RelatedCountryNews";
import { OtherCountriesNews } from "@/components/OtherCountriesNews";
import { NewsTweetCard } from "@/components/NewsTweetCard";
import { NewsKeyPoints, NewsKeywords } from "@/components/NewsKeyPoints";
import { NewsWikiEntities } from "@/components/NewsWikiEntities";
import { RelatedEntitiesNews } from "@/components/RelatedEntitiesNews";
import { EntityHighlightedContent } from "@/components/EntityHighlightedContent";
import { OutrageInkBlock } from "@/components/OutrageInkBlock";
import { OriginalSourceBlock } from "@/components/OriginalSourceBlock";
import { NewsImageBlock } from "@/components/NewsImageBlock";
import { NewsVoteBlock } from "@/components/NewsVoteBlock";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { adminAction, callEdgeFunction } from "@/lib/api";
import { toast } from "sonner";
import { useAdminStore } from "@/stores/adminStore";
import { LLM_MODELS, LLMProvider } from "@/types/database";

// Default Lovable AI models (always available)
const LOVABLE_MODELS = LLM_MODELS.lovable.text;

export default function NewsArticlePage() {
  const { country, slug } = useParams<{ country: string; slug: string }>();
  const { t, language } = useLanguage();
  const dateLocale = language === 'en' ? enUS : language === 'pl' ? pl : uk;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isAuthenticated: isAdminAuthenticated, password: adminPassword } = useAdminStore();

  // Fetch ONLY availability flags via admin backend (no secret keys exposed to the client)
  // NOTE: Don't swallow errors here — if we return `null` on a transient backend issue,
  // React Query will cache it as a successful result (and the model list stays incomplete).
  const { data: settings } = useQuery({
    queryKey: ['llm-settings-available'],
    queryFn: async () => {
      if (!adminPassword) return null;

      const result = await adminAction<{
        success: boolean;
        availability: {
          hasOpenai: boolean;
          hasGemini: boolean;
          hasGeminiV22: boolean;
          hasAnthropic: boolean;
          hasZai: boolean;
          hasMistral: boolean;
        };
      }>('getLLMAvailability', adminPassword);

      if (!result?.success) {
        throw new Error('Failed to fetch LLM availability');
      }

      return result.availability;
    },
    enabled: isAdminAuthenticated && !!adminPassword,
    // Make the list self-heal quickly after backend redeploys.
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    retry: 2,
  });

  // Build available models list based on configured API keys
  const availableModels = useMemo(() => {
    const models: { value: string; label: string; provider?: LLMProvider }[] = [];
    
    // Lovable AI models are always available
    LOVABLE_MODELS.forEach(m => models.push({ ...m, provider: 'lovable' }));
    
    if (settings?.hasZai) {
      LLM_MODELS.zai.text.forEach(m => models.push({ ...m, provider: 'zai' }));
    }
    if (settings?.hasMistral) {
      LLM_MODELS.mistral.text.forEach(m => models.push({ ...m, provider: 'mistral' }));
    }
    if (settings?.hasOpenai) {
      LLM_MODELS.openai.text.forEach(m => models.push({ ...m, provider: 'openai' }));
    }
    if (settings?.hasGemini) {
      LLM_MODELS.gemini.text.forEach(m => models.push({ ...m, provider: 'gemini' }));
    }
    if (settings?.hasGeminiV22) {
      LLM_MODELS.geminiV22.text.forEach(m => models.push({ ...m, provider: 'geminiV22' }));
    }
    if (settings?.hasAnthropic) {
      LLM_MODELS.anthropic.text.forEach(m => models.push({ ...m, provider: 'anthropic' }));
    }
    
    return models;
  }, [settings]);

  const [selectedModel, setSelectedModel] = useState(LOVABLE_MODELS[0]?.value || '');
  const [selectedTweetModel, setSelectedTweetModel] = useState(LOVABLE_MODELS[0]?.value || '');

  // Helper to get localized field - defined early so can be used in mutations
  const getLocalizedField = (field: string, articleData?: any) => {
    const data = articleData || article;
    if (!data) return '';
    // Try language-specific field first, fallback to English, then base field
    const langField = (data as any)[`${field}_${language}`];
    const enField = (data as any)[`${field}_en`];
    const baseField = (data as any)[field];
    return langField || enField || baseField;
  };

  // Fetch news article by country code and slug
  const { data: article, isLoading } = useQuery({
    queryKey: ['news-article', country, slug],
    queryFn: async () => {
      // First get country by code (case-insensitive)
      const { data: countryData } = await supabase
        .from('news_countries')
        .select('id, name, name_en, name_pl, flag, code')
        .ilike('code', country || '')
        .maybeSingle();
      
      if (!countryData) throw new Error('Country not found');

      const { data: item } = await supabase
        .from('news_rss_items')
        .select(`
          *,
          feed:news_rss_feeds(name, category)
        `)
        .eq('country_id', countryData.id)
        .eq('slug', slug)
        .maybeSingle();
      
      if (!item) throw new Error('Article not found');
      
      return { ...item, country: countryData };
    },
    enabled: !!country && !!slug
  });

  // Fetch adjacent news articles for navigation
  const { data: adjacentNews } = useQuery({
    queryKey: ['adjacent-news', article?.id, article?.country_id],
    queryFn: async () => {
      if (!article?.published_at || !article?.country_id) return { prev: null, next: null };

      // Get previous article (older)
      const { data: prevData } = await supabase
        .from('news_rss_items')
        .select('id, slug, title, title_en')
        .eq('country_id', article.country_id)
        .not('slug', 'is', null)
        .lt('published_at', article.published_at)
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Get next article (newer)
      const { data: nextData } = await supabase
        .from('news_rss_items')
        .select('id, slug, title, title_en')
        .eq('country_id', article.country_id)
        .not('slug', 'is', null)
        .gt('published_at', article.published_at)
        .order('published_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      return { prev: prevData, next: nextData };
    },
    enabled: !!article?.id && !!article?.country_id && !!article?.published_at
  });

  // Detect the language of the news content
  const detectNewsLanguage = (): string => {
    if (!article) return 'en';
    
    // Default based on country code FIRST (most reliable)
    const countryCode = article.country?.code?.toLowerCase();
    if (countryCode === 'ua') return 'uk';
    if (countryCode === 'pl') return 'pl';
    
    // For India - check specific language content
    if (countryCode === 'in') {
      if (article.content_hi || article.title_hi) return 'hi';
      if (article.content_ta || article.title_ta) return 'ta';
      if (article.content_te || article.title_te) return 'te';
      if (article.content_bn || article.title_bn) return 'bn';
      return 'hi'; // Default to Hindi for India
    }
    
    return 'en';
  };

  // Generate character dialogue for this news
  const generateDialogueMutation = useMutation({
    mutationFn: async () => {
      if (!article) throw new Error('No article');
      
      const contentLanguage = detectNewsLanguage();
      console.log('Generating dialogue in language:', contentLanguage);
      
      const result = await callEdgeFunction<{
        success: boolean;
        dialogue: Array<{
          id: string;
          character: string;
          name: string;
          avatar: string;
          message: string;
          likes: number;
          characterLikes: Array<{ characterId: string; name: string; avatar: string }>;
          replyTo?: string;
          threadId?: string;
        }>;
      }>('generate-dialogue', {
        storyContext: `News article: ${getLocalizedField('title')}\n\n${getLocalizedField('description') || ''}\n\n${getLocalizedField('content') || ''}`,
        newsContext: `Source: ${article.feed?.name || 'RSS'}, Category: ${article.category || article.feed?.category || 'general'}`,
        messageCount: 5,
        enableThreading: true,
        threadProbability: 30,
        contentLanguage // Pass the detected language
      });
      
      if (!result.success) throw new Error('Generation failed');
      
      // Save dialogue to article
      await supabase
        .from('news_rss_items')
        .update({ chat_dialogue: result.dialogue })
        .eq('id', article.id);
      
      return result.dialogue;
    },
    onSuccess: () => {
      toast.success(t('news.dialogue_generated'));
      queryClient.invalidateQueries({ queryKey: ['news-article', country, slug] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Error generating dialogue');
    }
  });

  // Generate tweets for this news
  const generateTweetsMutation = useMutation({
    mutationFn: async () => {
      if (!article) throw new Error('No article');
      
      const contentLanguage = detectNewsLanguage();
      console.log('Generating tweets in language:', contentLanguage, 'with model:', selectedTweetModel);
      
      const result = await callEdgeFunction<{
        success: boolean;
        tweets: Array<{
          author: string;
          handle: string;
          content: string;
          likes: number;
          retweets: number;
        }>;
      }>('generate-dialogue', {
        storyContext: `News article: ${getLocalizedField('title')}\n\n${getLocalizedField('description') || ''}\n\n${getLocalizedField('content') || ''}`,
        newsContext: `Source: ${article.feed?.name || 'RSS'}, Category: ${article.category || article.feed?.category || 'general'}`,
        generateTweets: true,
        tweetCount: 4,
        contentLanguage,
        model: selectedTweetModel,
        isHypeTweet: true
      });
      
      if (!result.success) throw new Error('Tweet generation failed');
      
      // Save tweets to article
      await supabase
        .from('news_rss_items')
        .update({ tweets: result.tweets })
        .eq('id', article.id);
      
      return result.tweets;
    },
    onSuccess: () => {
      toast.success(language === 'en' ? 'Hype tweet generated!' : language === 'pl' ? 'Hype tweet wygenerowany!' : 'Хайповий твіт згенеровано!');
      queryClient.invalidateQueries({ queryKey: ['news-article', country, slug] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Error generating tweets');
    }
  });
  const generateStoryMutation = useMutation({
    mutationFn: async () => {
      if (!article) throw new Error('No article');
      
      // Navigate to admin with pre-filled news
      window.open(`/admin?generateFromNews=${article.id}`, '_blank');
    }
  });

  // Retell news using AI
  const retellNewsMutation = useMutation({
    mutationFn: async () => {
      if (!article) throw new Error('No article');
      
      const result = await callEdgeFunction<{ success: boolean; content: string; error?: string }>(
        'retell-news',
        { newsId: article.id, model: selectedModel }
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to retell news');
      }
      
      return result.content;
    },
    onSuccess: () => {
      toast.success(t('news.retold'));
      queryClient.invalidateQueries({ queryKey: ['news-article', country, slug] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Error retelling news');
    }
  });

  // Translate news to English mutation - MUST be before conditional returns
  const translateToEnglishMutation = useMutation({
    mutationFn: async () => {
      if (!article) throw new Error('No article');
      
      const result = await callEdgeFunction<{ success: boolean; error?: string }>(
        'translate-news',
        { newsId: article.id, targetLanguage: 'en' }
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Translation failed');
      }
      
      return result;
    },
    onSuccess: () => {
      toast.success('Перекладено на англійську');
      queryClient.invalidateQueries({ queryKey: ['news-article', country, slug] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Error translating');
    }
  });

  // Scrape full article content - Admin only
  const scrapeNewsMutation = useMutation({
    mutationFn: async () => {
      if (!article) throw new Error('No article');
      
      // Call scrape-news edge function
      const result = await callEdgeFunction<{
        success: boolean;
        data?: {
          title: string;
          description: string;
          content: string;
          imageUrl: string;
          sourceUrl: string;
        };
        error?: string;
      }>('scrape-news', { url: article.url });
      
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to scrape article');
      }
      
      // Save scraped content to original_content
      const { error } = await supabase
        .from('news_rss_items')
        .update({ original_content: result.data.content })
        .eq('id', article.id);
      
      if (error) throw error;
      
      return result.data;
    },
    onSuccess: (data) => {
      toast.success(
        language === 'en' 
          ? `Scraped ${data.content.length} characters` 
          : language === 'pl' 
          ? `Pobrano ${data.content.length} znaków`
          : `Спарсено ${data.content.length} символів`
      );
      queryClient.invalidateQueries({ queryKey: ['news-article', country, slug] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Error scraping article');
    }
  });

  // Delete news mutation - Admin only
  const deleteNewsMutation = useMutation({
    mutationFn: async () => {
      if (!article) throw new Error('No article');
      
      // First delete related entities
      await supabase
        .from('news_wiki_entities')
        .delete()
        .eq('news_item_id', article.id);
      
      // Delete the news item itself
      const { error } = await supabase
        .from('news_rss_items')
        .delete()
        .eq('id', article.id);
      
      if (error) throw error;
      
      return article.id;
    },
    onSuccess: () => {
      toast.success(language === 'en' ? 'Article deleted' : language === 'pl' ? 'Artykuł usunięty' : 'Новину видалено');
      // Navigate back to country news page
      navigate(`/news/${country}`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Error deleting article');
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">{t('news.not_found')}</h1>
          <Link to="/news-digest">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('news.back_to_digest')}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const countryName = language === 'en' 
    ? article.country.name_en || article.country.name
    : language === 'pl'
    ? article.country.name_pl || article.country.name
    : article.country.name;

  const chatDialogue = Array.isArray(article.chat_dialogue) ? article.chat_dialogue : [];
  const tweets = Array.isArray((article as any).tweets) ? (article as any).tweets : [];
  const keyPoints = Array.isArray((article as any).key_points) ? (article as any).key_points : [];
  const themes = Array.isArray((article as any).themes) ? (article as any).themes : [];
  const articleKeywords = Array.isArray((article as any).keywords) ? (article as any).keywords : [];

  // Check if this is a Ukrainian news article (for translate button)
  const isUkrainianNews = article.country?.code?.toLowerCase() === 'ua';
  const hasEnglishContent = !!(article.content_en || article.title_en);
  
  // English key points and themes for bilingual display
  const keyPointsEn = Array.isArray((article as any).key_points_en) ? (article as any).key_points_en : [];
  const themesEn = Array.isArray((article as any).themes_en) ? (article as any).themes_en : [];

  // Generate SEO keywords from content
  const generateKeywords = (): string[] => {
    const baseKeywords = ['news', 'новини', article.category || 'general'];
    const countryKeywords = [countryName, article.country.code];
    const titleWords = getLocalizedField('title')
      ?.split(/\s+/)
      .filter((w: string) => w.length > 4)
      .slice(0, 5) || [];
    return [...baseKeywords, ...countryKeywords, ...titleWords];
  };

  // Generate clean description for SEO
  const generateSeoDescription = (): string => {
    const desc = getLocalizedField('description') || getLocalizedField('content') || '';
    const cleanDesc = desc.replace(/\s+/g, ' ').trim();
    return cleanDesc.slice(0, 155) + (cleanDesc.length > 155 ? '...' : '');
  };

  // Canonical URL
  const canonicalUrl = `https://echoes2.com/news/${article.country.code.toLowerCase()}/${slug}`;

  // Breadcrumbs for SEO - structured path: News Digest > All Countries > Country > Article
  const allCountriesLabel = language === 'en' ? 'All Countries' : language === 'pl' ? 'Wszystkie kraje' : 'Усі країни';
  const breadcrumbs = [
    { name: language === 'en' ? 'News Digest' : language === 'pl' ? 'Przegląd wiadomości' : 'Дайджест новин', url: 'https://echoes2.com/news' },
    { name: allCountriesLabel, url: 'https://echoes2.com/news' },
    { name: countryName, url: `https://echoes2.com/news/${article.country.code.toLowerCase()}` },
    { name: getLocalizedField('title')?.slice(0, 50) || 'Article', url: canonicalUrl }
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead 
        title={getLocalizedField('title')}
        description={generateSeoDescription()}
        keywords={generateKeywords()}
        type="article"
        image={article.image_url || undefined}
        canonicalUrl={canonicalUrl}
        publishedAt={article.published_at || undefined}
        author={article.feed?.name || 'RSS Feed'}
        breadcrumbs={breadcrumbs}
      />
      <Header />
      
      <main className="container mx-auto px-4 py-6 md:py-10">
        {/* Breadcrumb - Clickable: News Digest > All Countries > Country > Article */}
        <nav className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-sm text-muted-foreground mb-6" aria-label="Breadcrumb">
          <Link to="/news" className="hover:text-primary transition-colors whitespace-nowrap">
            {language === 'en' ? 'News Digest' : language === 'pl' ? 'Przegląd' : 'Дайджест'}
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <Link to="/news" className="hover:text-primary transition-colors whitespace-nowrap">
            {language === 'en' ? 'All Countries' : language === 'pl' ? 'Wszystkie kraje' : 'Усі країни'}
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <Link 
            to={`/news/${article.country.code.toLowerCase()}`} 
            className="hover:text-primary transition-colors flex items-center gap-1 whitespace-nowrap"
          >
            <span>{article.country.flag}</span>
            <span>{countryName}</span>
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <span className="text-foreground truncate max-w-[200px]" title={getLocalizedField('title')}>
            {getLocalizedField('title')}
          </span>
        </nav>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <article className="space-y-6">
              {/* Header */}
              <header>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="outline" className="font-mono text-xs">
                    {article.country.flag} {countryName}
                  </Badge>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {article.category || article.feed?.category || 'general'}
                  </Badge>
                  {article.published_at && (
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(article.published_at), 'd MMM yyyy, HH:mm', { locale: dateLocale })}
                    </span>
                  )}
                </div>
                
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold font-serif leading-tight mb-2">
                  {getLocalizedField('title')}
                </h1>

                {/* Verified source badge - after title */}
                {article.feed?.name && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                    <Badge variant="outline" className="gap-1.5 bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" strokeLinejoin="round"/>
                        <polyline points="22,4 12,14.01 9,11.01" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {language === 'en' ? 'Verified' : language === 'pl' ? 'Zweryfikowane' : 'Перевірено'}
                    </Badge>
                    <span className="text-muted-foreground">—</span>
                    <a 
                      href={article.url} 
                      target="_blank" 
                      rel="nofollow noopener noreferrer"
                      className="hover:text-primary transition-colors underline-offset-2 hover:underline"
                    >
                      {article.feed.name}
                    </a>
                  </div>
                )}

                {/* Keywords - under title */}
                <NewsKeywords keywords={articleKeywords} />
                

                {/* News Image with admin controls */}
                <NewsImageBlock
                  imageUrl={article.image_url}
                  newsId={article.id}
                  title={getLocalizedField('title')}
                  keywords={articleKeywords}
                  themes={themes}
                  keyPoints={keyPoints}
                  hasRetelling={!!(article.content_en && article.content_en.length > 100)}
                  isAdmin={isAdminAuthenticated}
                  onImageUpdate={() => queryClient.invalidateQueries({ queryKey: ['news-article', country, slug] })}
                />

                {/* Voting block - prominent placement under image */}
                <div className="mt-4 p-4 rounded-lg bg-card/50 border border-border/50">
                  <NewsVoteBlock 
                    newsId={article.id} 
                    likes={(article as any).likes || 0} 
                    dislikes={(article as any).dislikes || 0}
                    className="justify-center"
                    showLabel={true}
                    size="lg"
                  />
                </div>
              </header>

              {/* Key Points Block - before content */}
              <NewsKeyPoints 
                keyPoints={keyPoints} 
                themes={themes} 
                keywords={articleKeywords}
                isUkrainian={isUkrainianNews}
                keyPointsEn={keyPointsEn}
                themesEn={themesEn}
              />
              <div className="prose prose-invert max-w-none">
                {getLocalizedField('description') && (
                  <p className="text-lg text-muted-foreground font-serif leading-relaxed">
                    {getLocalizedField('description')}
                  </p>
                )}
                
                {getLocalizedField('content') && (() => {
                  const fullContent = getLocalizedField('content');
                  // Split content into lead paragraph and rest
                  const paragraphs = fullContent.split(/\n\n+/);
                  const leadParagraph = paragraphs[0] || '';
                  const restContent = paragraphs.slice(1).join('\n\n');
                  
                  return (
                    <>
                      {/* Lead paragraph - highlighted with accent border only (no background) */}
                      {leadParagraph && (
                        <div className="mt-4 pl-4 border-l-4 border-accent">
                          <EntityHighlightedContent
                            newsId={article.id}
                            content={leadParagraph}
                            className="text-foreground font-serif leading-relaxed text-lg"
                          />
                        </div>
                      )}
                      {/* Rest of content */}
                      {restContent && (
                        <EntityHighlightedContent
                          newsId={article.id}
                          content={restContent}
                          className="mt-4 text-foreground/90 font-serif leading-relaxed whitespace-pre-wrap"
                        />
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Original Source Block */}
              <OriginalSourceBlock 
                originalContent={article.original_content}
                sourceUrl={article.url}
                sourceName={article.feed?.name}
                className="mt-6"
                isAdmin={isAdminAuthenticated}
                newsId={article.id}
                onContentUpdate={() => queryClient.invalidateQueries({ queryKey: ['news-article', country, slug] })}
              />

              {/* Related Entities News - before original link */}
              <RelatedEntitiesNews 
                newsId={article.id}
                countryCode={article.country.code}
                className="mt-6"
              />

              {/* Voting block */}
              <NewsVoteBlock 
                newsId={article.id} 
                likes={(article as any).likes || 0} 
                dislikes={(article as any).dislikes || 0}
                className="mt-6 mb-4"
              />

              {/* Original link, share, and translate button */}
              <div className="pt-4 border-t border-border flex flex-wrap items-center gap-3">
                <a 
                  href={article.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-primary hover:underline text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  {t('news.read_original')}
                </a>
                
                {/* Share to Twitter/X button */}
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                    `${getLocalizedField('title')}\n\n📰 via @bravenewnews4`
                  )}&url=${encodeURIComponent(canonicalUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white text-xs font-medium transition-colors"
                >
                  <Twitter className="w-3.5 h-3.5" fill="currentColor" />
                  <span>{language === 'en' ? 'Share on X' : language === 'pl' ? 'Udostępnij na X' : 'Поділитися в X'}</span>
                </a>
                
                {/* Translate to English button - for Ukrainian news only */}
                {isUkrainianNews && !hasEnglishContent && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => translateToEnglishMutation.mutate()}
                    disabled={translateToEnglishMutation.isPending}
                  >
                    {translateToEnglishMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Languages className="w-4 h-4" />
                    )}
                    Перекласти на англійську
                  </Button>
                )}
                {isUkrainianNews && hasEnglishContent && (
                  <Badge variant="secondary" className="gap-1">
                    <Languages className="w-3 h-3" />
                    EN available
                  </Badge>
                )}
              </div>

              {/* Navigation - Previous / Next - moved above tweets */}
              <nav className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                {adjacentNews?.prev ? (
                  <Link to={`/news/${article.country.code.toLowerCase()}/${adjacentNews.prev.slug}`}>
                    <Button variant="outline" className="gap-2">
                      <ChevronLeft className="w-4 h-4" />
                      <span className="hidden sm:inline max-w-[150px] truncate">
                        {language === 'en' ? (adjacentNews.prev.title_en || adjacentNews.prev.title) : adjacentNews.prev.title}
                      </span>
                      <span className="sm:hidden">
                        {language === 'en' ? 'Previous' : language === 'pl' ? 'Poprzedni' : 'Попередня'}
                      </span>
                    </Button>
                  </Link>
                ) : (
                  <div />
                )}
                
                <Link to={`/news/${article.country.code.toLowerCase()}`}>
                  <Button variant="ghost" size="sm" className="text-xs">
                    {article.country.flag} {language === 'en' ? 'All news' : language === 'pl' ? 'Wszystkie' : 'Всі новини'}
                  </Button>
                </Link>
                
                {adjacentNews?.next ? (
                  <Link to={`/news/${article.country.code.toLowerCase()}/${adjacentNews.next.slug}`}>
                    <Button variant="outline" className="gap-2">
                      <span className="hidden sm:inline max-w-[150px] truncate">
                        {language === 'en' ? (adjacentNews.next.title_en || adjacentNews.next.title) : adjacentNews.next.title}
                      </span>
                      <span className="sm:hidden">
                        {language === 'en' ? 'Next' : language === 'pl' ? 'Następny' : 'Наступна'}
                      </span>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </Link>
                ) : (
                  <div />
                )}
              </nav>

              {/* Tweets Section */}
              {tweets.length > 0 && (
                <NewsTweetCard tweets={tweets} />
              )}
              
              {/* Generate Tweets Button - Admin only */}
              {isAdminAuthenticated && (
                <div className="pt-4">
                  <Button 
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => generateTweetsMutation.mutate()}
                    disabled={generateTweetsMutation.isPending}
                  >
                    {generateTweetsMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Twitter className="w-4 h-4" />
                    )}
                    {tweets.length > 0 
                      ? (language === 'en' ? 'Regenerate Tweets' : language === 'pl' ? 'Regeneruj tweety' : 'Перегенерувати твіти')
                      : (language === 'en' ? 'Generate Tweets' : language === 'pl' ? 'Generuj tweety' : 'Генерувати твіти')
                    }
                  </Button>
                </div>
              )}
            </article>


            {/* Character Dialogue Section - MOBILE ONLY (below article) */}
            <NewsDialogueSection
              chatDialogue={chatDialogue as any}
              isAdminAuthenticated={isAdminAuthenticated}
              isGenerating={generateDialogueMutation.isPending}
              onGenerateDialogue={() => generateDialogueMutation.mutate()}
              className="mt-8 lg:hidden"
            />

            {/* Other Countries News - After navigation */}
            <OtherCountriesNews
              excludeCountryCode={article.country.code}
              className="mt-8"
            />

            {/* Related Country News - MOBILE ONLY */}
            <RelatedCountryNews
              countryId={article.country_id}
              countryCode={article.country.code}
              countryName={countryName}
              countryFlag={article.country.flag}
              currentArticleId={article.id}
              className="mt-8 lg:hidden"
            />
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* Generate Story Card - Admin only */}
            {isAdminAuthenticated && (
              <>
                {/* Retell News Card */}
                <Card className="border-accent/30 bg-accent/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-accent-foreground" />
                      {t('news.retell')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {t('news.retell_desc')}
                    </p>
                    <Select value={selectedModel} onValueChange={setSelectedModel}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t('news.select_model')} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableModels.map(model => (
                          <SelectItem key={model.value} value={model.value}>
                            {model.provider && model.provider !== 'lovable' ? `[${model.provider.toUpperCase()}] ` : ''}{model.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      className="w-full gap-2"
                      variant="secondary"
                      onClick={() => retellNewsMutation.mutate()}
                      disabled={retellNewsMutation.isPending}
                    >
                      {retellNewsMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      {retellNewsMutation.isPending ? t('news.retelling') : t('news.retell')}
                    </Button>
                  </CardContent>
                </Card>

                {/* Full Retelling Card - runs retell + tweets + dialogue with progress indicator */}
                <Card className="border-primary/30 bg-primary/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      {language === 'en' ? 'Full Retelling' : language === 'pl' ? 'Pełny przekaz' : 'Повний переказ'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {language === 'en' 
                        ? 'Generate full retelling with key points, tweets, and dialogue' 
                        : language === 'pl' 
                        ? 'Wygeneruj pełny przekaz z kluczowymi punktami, tweetami i dialogiem'
                        : 'Згенерувати повний переказ з тезами, твітами та діалогом'}
                    </p>
                    
                    {/* Progress indicator showing current step */}
                    {(retellNewsMutation.isPending || generateTweetsMutation.isPending || generateDialogueMutation.isPending) && (
                      <div className="space-y-2 py-2">
                        <div className="flex items-center gap-2 text-xs">
                          {retellNewsMutation.isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin text-primary" />
                          ) : retellNewsMutation.isSuccess ? (
                            <span className="w-3 h-3 rounded-full bg-green-500" />
                          ) : (
                            <span className="w-3 h-3 rounded-full bg-muted" />
                          )}
                          <span className={retellNewsMutation.isPending ? 'text-primary font-medium' : retellNewsMutation.isSuccess ? 'text-green-500' : 'text-muted-foreground'}>
                            1. {language === 'en' ? 'Retelling' : language === 'pl' ? 'Przekaz' : 'Переказ'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          {generateTweetsMutation.isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin text-primary" />
                          ) : generateTweetsMutation.isSuccess ? (
                            <span className="w-3 h-3 rounded-full bg-green-500" />
                          ) : (
                            <span className="w-3 h-3 rounded-full bg-muted" />
                          )}
                          <span className={generateTweetsMutation.isPending ? 'text-primary font-medium' : generateTweetsMutation.isSuccess ? 'text-green-500' : 'text-muted-foreground'}>
                            2. {language === 'en' ? 'Tweets' : language === 'pl' ? 'Tweety' : 'Твіти'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          {generateDialogueMutation.isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin text-primary" />
                          ) : generateDialogueMutation.isSuccess ? (
                            <span className="w-3 h-3 rounded-full bg-green-500" />
                          ) : (
                            <span className="w-3 h-3 rounded-full bg-muted" />
                          )}
                          <span className={generateDialogueMutation.isPending ? 'text-primary font-medium' : generateDialogueMutation.isSuccess ? 'text-green-500' : 'text-muted-foreground'}>
                            3. {language === 'en' ? 'Dialogue' : language === 'pl' ? 'Dialog' : 'Діалог'}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    <Select value={selectedTweetModel} onValueChange={setSelectedTweetModel}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t('news.select_model')} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableModels.map(model => (
                          <SelectItem key={model.value} value={model.value}>
                            {model.provider && model.provider !== 'lovable' ? `[${model.provider.toUpperCase()}] ` : ''}{model.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      className="w-full gap-2"
                      onClick={async () => {
                        try {
                          toast.info(language === 'en' ? 'Starting full retelling...' : language === 'pl' ? 'Rozpoczynam pełny przekaz...' : 'Запускаю повний переказ...');
                          // Run retell first
                          await retellNewsMutation.mutateAsync();
                          // Then generate tweets
                          await generateTweetsMutation.mutateAsync();
                          // Then generate dialogue
                          await generateDialogueMutation.mutateAsync();
                          toast.success(language === 'en' ? 'Full retelling complete!' : language === 'pl' ? 'Pełny przekaz zakończony!' : 'Повний переказ завершено!');
                        } catch (error) {
                          console.error('Full retelling failed:', error);
                        }
                      }}
                      disabled={retellNewsMutation.isPending || generateTweetsMutation.isPending || generateDialogueMutation.isPending}
                    >
                      {(retellNewsMutation.isPending || generateTweetsMutation.isPending || generateDialogueMutation.isPending) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      {(retellNewsMutation.isPending || generateTweetsMutation.isPending || generateDialogueMutation.isPending)
                        ? (language === 'en' ? 'Processing...' : language === 'pl' ? 'Przetwarzanie...' : 'Обробка...')
                        : (language === 'en' ? 'Run Full Retelling' : language === 'pl' ? 'Uruchom pełny przekaz' : 'Запустити повний переказ')}
                    </Button>
                  </CardContent>
                </Card>

                {/* Scrape Full Article Card - Admin only */}
                <Card className="border-primary/30 bg-primary/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Download className="w-4 h-4 text-primary" />
                      {language === 'en' ? 'Scrape Full Article' : language === 'pl' ? 'Pobierz pełny artykuł' : 'Спарсити повний текст'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {language === 'en' 
                        ? 'Fetch full content from source URL and save to original_content' 
                        : language === 'pl' 
                        ? 'Pobierz pełną treść z URL źródła i zapisz do original_content'
                        : 'Завантажити повний текст з URL джерела та зберегти в original_content'}
                    </p>
                    {article.original_content && (
                      <Badge variant="outline" className="text-xs">
                        {language === 'en' ? 'Has content' : language === 'pl' ? 'Ma treść' : 'Є контент'}: {article.original_content.length} {language === 'en' ? 'chars' : language === 'pl' ? 'znaków' : 'символів'}
                      </Badge>
                    )}
                    <Button 
                      className="w-full gap-2"
                      variant="outline"
                      onClick={() => scrapeNewsMutation.mutate()}
                      disabled={scrapeNewsMutation.isPending}
                    >
                      {scrapeNewsMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      {scrapeNewsMutation.isPending 
                        ? (language === 'en' ? 'Scraping...' : language === 'pl' ? 'Pobieranie...' : 'Парсинг...') 
                        : article.original_content 
                          ? (language === 'en' ? 'Re-scrape Article' : language === 'pl' ? 'Ponownie pobierz' : 'Перепарсити')
                          : (language === 'en' ? 'Scrape Now' : language === 'pl' ? 'Pobierz teraz' : 'Спарсити зараз')}
                    </Button>
                  </CardContent>
                </Card>

                {/* Delete Article Card - Admin only, danger zone */}
                <Card className="border-destructive/30 bg-destructive/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-destructive">
                      <Trash2 className="w-4 h-4" />
                      {language === 'en' ? 'Delete Article' : language === 'pl' ? 'Usuń artykuł' : 'Видалити новину'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {language === 'en' 
                        ? 'Permanently delete this article and all related data' 
                        : language === 'pl' 
                        ? 'Trwale usuń ten artykuł i wszystkie powiązane dane'
                        : 'Назавжди видалити цю новину та всі пов\'язані дані'}
                    </p>
                    <Button 
                      className="w-full gap-2"
                      variant="destructive"
                      onClick={() => {
                        const confirmMsg = language === 'en' 
                          ? 'Are you sure you want to delete this article? This cannot be undone.' 
                          : language === 'pl' 
                          ? 'Czy na pewno chcesz usunąć ten artykuł? Tej operacji nie można cofnąć.'
                          : 'Ви впевнені, що хочете видалити цю новину? Цю дію неможливо скасувати.';
                        if (window.confirm(confirmMsg)) {
                          deleteNewsMutation.mutate();
                        }
                      }}
                      disabled={deleteNewsMutation.isPending}
                    >
                      {deleteNewsMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      {deleteNewsMutation.isPending 
                        ? (language === 'en' ? 'Deleting...' : language === 'pl' ? 'Usuwanie...' : 'Видалення...') 
                        : (language === 'en' ? 'Delete Forever' : language === 'pl' ? 'Usuń na zawsze' : 'Видалити назавжди')}
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Source Info */}
            <Card className="relative overflow-hidden">
              {/* Background logo watermark */}
              {article.url && (() => {
                try {
                  const domain = new URL(article.url).hostname;
                  return (
                    <img 
                      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`}
                      alt=""
                      className="absolute -top-2 -right-2 w-[35%] h-auto opacity-[0.08] pointer-events-none select-none"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  );
                } catch {
                  return null;
                }
              })()}
              <CardHeader className="pb-3 relative z-10">
                <CardTitle className="text-base">{t('news.source_info')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm relative z-10">
                {/* Source logo with domain info */}
                {article.url && (() => {
                  try {
                    const domain = new URL(article.url).hostname;
                    return (
                      <div className="flex items-center gap-3 pb-2 border-b border-border">
                        <img 
                          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                          alt=""
                          className="w-6 h-6 rounded"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium truncate">{article.feed?.name || domain}</span>
                          <a 
                            href={article.url}
                            target="_blank"
                            rel="nofollow noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-primary truncate"
                          >
                            {domain}
                          </a>
                        </div>
                      </div>
                    );
                  } catch {
                    return null;
                  }
                })()}
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ID</span>
                  <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono select-all">
                    {article.id.slice(0, 8)}
                  </code>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('news.feed')}</span>
                  <span>{article.feed?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('news.category')}</span>
                  <span>{article.category || article.feed?.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('news.fetched')}</span>
                  <span>{format(new Date(article.fetched_at), 'd MMM yyyy', { locale: dateLocale })}</span>
                </div>

                {/* Admin controls */}
                {isAdminAuthenticated && (
                  <div className="pt-3 border-t border-border space-y-2">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {language === 'en' ? 'Admin' : language === 'pl' ? 'Admin' : 'Адмін'}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs h-7"
                        onClick={() => {
                          queryClient.invalidateQueries({ queryKey: ['news-article', country, slug] });
                          toast.success(language === 'en' ? 'Refreshed' : language === 'pl' ? 'Odświeżono' : 'Оновлено');
                        }}
                      >
                        <RefreshCw className="w-3 h-3" />
                        {language === 'en' ? 'Refresh' : language === 'pl' ? 'Odśwież' : 'Оновити'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs h-7"
                        onClick={() => {
                          window.open(`/admin?tab=news-archive&newsId=${article.id}`, '_blank');
                        }}
                      >
                        <ExternalLink className="w-3 h-3" />
                        {language === 'en' ? 'Edit' : language === 'pl' ? 'Edytuj' : 'Редагувати'}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="gap-1.5 text-xs h-7"
                        onClick={async () => {
                          if (!confirm(language === 'en' ? 'Delete this news?' : language === 'pl' ? 'Usunąć tę wiadomość?' : 'Видалити цю новину?')) return;
                          try {
                            await supabase.from('news_rss_items').delete().eq('id', article.id);
                            toast.success(language === 'en' ? 'Deleted' : language === 'pl' ? 'Usunięto' : 'Видалено');
                            window.location.href = `/news/${country}`;
                          } catch (e) {
                            toast.error('Error deleting');
                          }
                        }}
                      >
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3,6 5,6 21,6" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        {language === 'en' ? 'Delete' : language === 'pl' ? 'Usuń' : 'Видалити'}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Outrage Ink Block - below Source */}
            <OutrageInkBlock
              newsItemId={article.id}
              newsTitle={getLocalizedField('title') || article.title}
              isAdmin={isAdminAuthenticated}
            />

            {/* Wikipedia Entities */}
            <NewsWikiEntities 
              newsId={article.id}
              title={getLocalizedField('title')}
              keywords={articleKeywords}
              showSearchButton
            />

            {/* Character Dialogue Section - DESKTOP ONLY (in sidebar) */}
            <NewsDialogueSection
              chatDialogue={chatDialogue as any}
              isAdminAuthenticated={isAdminAuthenticated}
              isGenerating={generateDialogueMutation.isPending}
              onGenerateDialogue={() => generateDialogueMutation.mutate()}
              className="hidden lg:block"
            />

            {/* Related Country News - DESKTOP ONLY */}
            <RelatedCountryNews
              countryId={article.country_id}
              countryCode={article.country.code}
              countryName={countryName}
              countryFlag={article.country.flag}
              currentArticleId={article.id}
              className="hidden lg:block"
            />
          </aside>
        </div>
      </main>
    </div>
  );
}
