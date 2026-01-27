import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { uk, enUS, pl } from "date-fns/locale";
import { ArrowLeft, ExternalLink, Sparkles, Loader2, RefreshCw, ChevronLeft, ChevronRight, Twitter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Header } from "@/components/Header";
import { SEOHead } from "@/components/SEOHead";
import { NewsDialogueSection } from "@/components/NewsDialogueSection";
import { NewsTweetCard } from "@/components/NewsTweetCard";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { callEdgeFunction } from "@/lib/api";
import { toast } from "sonner";
import { useAdminStore } from "@/stores/adminStore";

const AI_MODELS = [
  { value: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash (швидкий)' },
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro (точний)' },
  { value: 'google/gemini-3-pro-preview', label: 'Gemini 3 Pro' },
  { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini' },
  { value: 'openai/gpt-5', label: 'GPT-5 (потужний)' },
];
export default function NewsArticlePage() {
  const { country, slug } = useParams<{ country: string; slug: string }>();
  const { t, language } = useLanguage();
  const dateLocale = language === 'en' ? enUS : language === 'pl' ? pl : uk;
  const queryClient = useQueryClient();
  const { isAuthenticated: isAdminAuthenticated } = useAdminStore();
  const [selectedModel, setSelectedModel] = useState(AI_MODELS[0].value);

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
      console.log('Generating tweets in language:', contentLanguage);
      
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
        contentLanguage
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
      toast.success(language === 'en' ? 'Tweets generated' : language === 'pl' ? 'Tweety wygenerowane' : 'Твіти згенеровано');
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

  // Get localized content based on current language
  const getLocalizedField = (field: string) => {
    // Try language-specific field first, fallback to English, then base field
    const langField = (article as any)[`${field}_${language}`];
    const enField = (article as any)[`${field}_en`];
    const baseField = (article as any)[field];
    return langField || enField || baseField;
  };

  const countryName = language === 'en' 
    ? article.country.name_en || article.country.name
    : language === 'pl'
    ? article.country.name_pl || article.country.name
    : article.country.name;

  const chatDialogue = Array.isArray(article.chat_dialogue) ? article.chat_dialogue : [];
  const tweets = Array.isArray((article as any).tweets) ? (article as any).tweets : [];

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

  // Breadcrumbs for SEO
  const breadcrumbs = [
    { name: t('newsdigest.title'), url: 'https://echoes2.com/news-digest' },
    { name: countryName, url: `https://echoes2.com/news-digest?country=${article.country.code}` },
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
        {/* Breadcrumb - Clickable */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6" aria-label="Breadcrumb">
          <Link to="/news-digest" className="hover:text-primary transition-colors">
            {t('newsdigest.title')}
          </Link>
          <span>/</span>
          <Link 
            to={`/news-digest?country=${article.country.id}`} 
            className="hover:text-primary transition-colors flex items-center gap-1"
          >
            <span>{article.country.flag}</span>
            <span>{countryName}</span>
          </Link>
          <span>/</span>
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
                
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold font-serif leading-tight mb-4">
                  {getLocalizedField('title')}
                </h1>
                
                {article.image_url && (
                  <img 
                    src={article.image_url} 
                    alt="" 
                    className="w-full h-auto max-h-96 object-cover rounded-lg border border-border mb-4"
                  />
                )}
              </header>

              {/* Content */}
              <div className="prose prose-invert max-w-none">
                {getLocalizedField('description') && (
                  <p className="text-lg text-muted-foreground font-serif leading-relaxed">
                    {getLocalizedField('description')}
                  </p>
                )}
                
                {getLocalizedField('content') && (
                  <div className="mt-4 text-foreground/90 font-serif leading-relaxed whitespace-pre-wrap">
                    {getLocalizedField('content')}
                  </div>
                )}
              </div>

              {/* Original link */}
              <div className="pt-4 border-t border-border">
                <a 
                  href={article.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-primary hover:underline"
                >
                  <ExternalLink className="w-4 h-4" />
                  {t('news.read_original')}
                </a>
              </div>

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

            {/* Navigation - Previous / Next */}
            <nav className="flex items-center justify-between mt-8 pt-6 border-t border-border">
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
              
              <Link to={`/news-digest?country=${article.country.code}`}>
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
                        {AI_MODELS.map(model => (
                          <SelectItem key={model.value} value={model.value}>
                            {model.label}
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

                {/* Generate Story Card */}
                <Card className="border-primary/30 bg-primary/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      {t('news.create_story')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      {t('news.create_story_desc')}
                    </p>
                    <Button 
                      className="w-full gap-2"
                      onClick={() => generateStoryMutation.mutate()}
                    >
                      <Sparkles className="w-4 h-4" />
                      {t('news.generate_story')}
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Source Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('news.source_info')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
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
              </CardContent>
            </Card>

            {/* Character Dialogue Section - DESKTOP ONLY (in sidebar) */}
            <NewsDialogueSection
              chatDialogue={chatDialogue as any}
              isAdminAuthenticated={isAdminAuthenticated}
              isGenerating={generateDialogueMutation.isPending}
              onGenerateDialogue={() => generateDialogueMutation.mutate()}
              className="hidden lg:block"
            />
          </aside>
        </div>
      </main>
    </div>
  );
}
