import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { uk, enUS, pl } from "date-fns/locale";
import { ArrowLeft, ExternalLink, MessageCircle, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { SEOHead } from "@/components/SEOHead";
import { ThreadedCharacterChat } from "@/components/ThreadedCharacterChat";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { callEdgeFunction } from "@/lib/api";
import { toast } from "sonner";

export default function NewsArticlePage() {
  const { country, slug } = useParams<{ country: string; slug: string }>();
  const { t, language } = useLanguage();
  const dateLocale = language === 'en' ? enUS : language === 'pl' ? pl : uk;
  const queryClient = useQueryClient();

  // Fetch news article by country code and slug
  const { data: article, isLoading } = useQuery({
    queryKey: ['news-article', country, slug],
    queryFn: async () => {
      // First get country by code
      const { data: countryData } = await supabase
        .from('news_countries')
        .select('id, name, name_en, name_pl, flag, code')
        .eq('code', country)
        .single();
      
      if (!countryData) throw new Error('Country not found');

      const { data: item } = await supabase
        .from('news_rss_items')
        .select(`
          *,
          feed:news_rss_feeds(name, category)
        `)
        .eq('country_id', countryData.id)
        .eq('slug', slug)
        .single();
      
      if (!item) throw new Error('Article not found');
      
      return { ...item, country: countryData };
    },
    enabled: !!country && !!slug
  });

  // Generate character dialogue for this news
  const generateDialogueMutation = useMutation({
    mutationFn: async () => {
      if (!article) throw new Error('No article');
      
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
        storyContext: `News article: ${article.title}\n\n${article.description || ''}\n\n${article.content || ''}`,
        newsContext: `Source: ${article.feed?.name || 'RSS'}, Category: ${article.category || article.feed?.category || 'general'}`,
        messageCount: 5,
        enableThreading: true,
        threadProbability: 30
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

  // Generate story from this news
  const generateStoryMutation = useMutation({
    mutationFn: async () => {
      if (!article) throw new Error('No article');
      
      // Navigate to admin with pre-filled news
      window.open(`/admin?generateFromNews=${article.id}`, '_blank');
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

  return (
    <div className="min-h-screen bg-background">
      <SEOHead 
        title={getLocalizedField('title')}
        description={getLocalizedField('description')?.slice(0, 160)}
      />
      <Header />
      
      <main className="container mx-auto px-4 py-6 md:py-10">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to="/news-digest" className="hover:text-primary transition-colors">
            {t('newsdigest.title')}
          </Link>
          <span>/</span>
          <span>{article.country.flag} {countryName}</span>
          <span>/</span>
          <span className="text-foreground truncate max-w-[200px]">{getLocalizedField('title')}</span>
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
            </article>

            {/* Character Dialogue Section */}
            <section className="mt-12">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  {t('chat.observers')}
                </h2>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => generateDialogueMutation.mutate()}
                    disabled={generateDialogueMutation.isPending}
                  >
                    {generateDialogueMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <MessageCircle className="w-4 h-4 mr-2" />
                    )}
                    {chatDialogue.length > 0 ? t('news.regenerate_dialogue') : t('news.generate_dialogue')}
                  </Button>
                </div>
              </div>

              {chatDialogue.length > 0 ? (
                <ThreadedCharacterChat messages={chatDialogue as any} />
              ) : (
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>{t('news.no_dialogue')}</p>
                    <p className="text-sm mt-2">{t('news.generate_dialogue_hint')}</p>
                  </CardContent>
                </Card>
              )}
            </section>
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
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

            {/* Source Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('news.source_info')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
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
          </aside>
        </div>
      </main>
    </div>
  );
}
