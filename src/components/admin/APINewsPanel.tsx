import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Globe, Rss, Calendar, TrendingUp, RefreshCw } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { callEdgeFunction } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

interface APINewsItem {
  id: string;
  title: string;
  description: string;
  url: string;
  image_url: string;
  published_at: string;
  scheduled_publish_at: string;
  source_type: string;
  fetched_at: string;
}

interface FetchResult {
  success: boolean;
  source?: string;
  total?: number;
  inserted?: number;
  itemIds?: string[];
  message?: string;
  error?: string;
}

interface Props {
  password: string;
}

export function APINewsPanel({ password }: Props) {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const [selectedSource, setSelectedSource] = useState<'thenewsapi' | 'gnews' | 'all'>('thenewsapi');
  const [limit, setLimit] = useState(100);
  const [countryCode, setCountryCode] = useState('us');
  const [languageCode, setLanguageCode] = useState('en');

  // Fetch API news statistics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['api-news-stats'],
    queryFn: async () => {
      const { count: theNewsCount } = await supabase
        .from('news_rss_items')
        .select('id', { count: 'exact', head: true })
        .eq('source_type', 'api_thenewsapi');

      const { count: gNewsCount } = await supabase
        .from('news_rss_items')
        .select('id', { count: 'exact', head: true })
        .eq('source_type', 'api_gnews');

      const { count: scheduledCount } = await supabase
        .from('news_rss_items')
        .select('id', { count: 'exact', head: true })
        .not('scheduled_publish_at', 'is', null)
        .gte('scheduled_publish_at', new Date().toISOString());

      return {
        theNewsAPI: theNewsCount || 0,
        gNews: gNewsCount || 0,
        scheduled: scheduledCount || 0,
        total: (theNewsCount || 0) + (gNewsCount || 0)
      };
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Fetch recent API news
  const { data: recentNews = [], isLoading: newsLoading } = useQuery({
    queryKey: ['recent-api-news'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news_rss_items')
        .select('id, title, description, url, image_url, published_at, scheduled_publish_at, source_type, fetched_at')
        .in('source_type', ['api_thenewsapi', 'api_gnews'])
        .order('fetched_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as APINewsItem[];
    }
  });

  // Fetch news mutation
  const fetchMutation = useMutation({
    mutationFn: async ({ source, limit, country, language }: { source: string; limit: number; country: string; language: string }) => {
      const result = await callEdgeFunction<FetchResult>('fetch-api-news', {
        source,
        limit,
        country,
        language
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch news');
      }
      
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['api-news-stats'] });
      queryClient.invalidateQueries({ queryKey: ['recent-api-news'] });
      
      toast.success(
        language === 'uk' ? 'Новини завантажено!' : 'News fetched!',
        {
          description: result.message || `Inserted ${result.inserted} articles`
        }
      );
    },
    onError: (error) => {
      toast.error(
        language === 'uk' ? 'Помилка' : 'Error',
        {
          description: error instanceof Error ? error.message : 'Failed to fetch news'
        }
      );
    }
  });

  const handleFetch = () => {
    fetchMutation.mutate({
      source: selectedSource,
      limit,
      country: countryCode,
      language: languageCode
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Globe className="w-6 h-6 text-primary" />
          {language === 'uk' ? 'API Джерела Новин' : 'API News Sources'}
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          {language === 'uk' 
            ? 'Завантаження новин з TheNewsAPI та GNews з розподілом публікації на 24 години'
            : 'Fetch news from TheNewsAPI and GNews with 24-hour distributed publishing'
          }
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              TheNewsAPI
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.theNewsAPI || 0}</div>
            <p className="text-xs text-muted-foreground">
              {language === 'uk' ? 'статей' : 'articles'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Rss className="w-4 h-4 text-green-500" />
              GNews
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.gNews || 0}</div>
            <p className="text-xs text-muted-foreground">
              {language === 'uk' ? 'статей' : 'articles'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4 text-orange-500" />
              {language === 'uk' ? 'Заплановано' : 'Scheduled'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.scheduled || 0}</div>
            <p className="text-xs text-muted-foreground">
              {language === 'uk' ? 'на 24 год' : 'for 24h'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Globe className="w-4 h-4 text-purple-500" />
              {language === 'uk' ? 'Всього' : 'Total'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {language === 'uk' ? 'API статей' : 'API articles'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Fetch Controls */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg">{language === 'uk' ? 'Завантажити Новини' : 'Fetch News'}</CardTitle>
          <CardDescription>
            {language === 'uk'
              ? 'Отримати 100 новин з розподілом публікацій на 24 години'
              : 'Fetch 100 articles distributed over 24 hours'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="source">{language === 'uk' ? 'Джерело' : 'Source'}</Label>
              <Select value={selectedSource} onValueChange={(v: any) => setSelectedSource(v)}>
                <SelectTrigger id="source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="thenewsapi">TheNewsAPI</SelectItem>
                  <SelectItem value="gnews">GNews</SelectItem>
<SelectItem value="all">{language === 'uk' ? 'Обидва' : 'Both'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="limit">{language === 'uk' ? 'Кількість' : 'Limit'}</Label>
              <Input
                id="limit"
                type="number"
                min="1"
                max="100"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">{language === 'uk' ? 'Країна' : 'Country'}</Label>
              <Select value={countryCode} onValueChange={setCountryCode}>
                <SelectTrigger id="country">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="us">🇺🇸 USA</SelectItem>
                  <SelectItem value="ua">🇺🇦 Ukraine</SelectItem>
                  <SelectItem value="gb">🇬🇧 UK</SelectItem>
                  <SelectItem value="de">🇩🇪 Germany</SelectItem>
                  <SelectItem value="fr">🇫🇷 France</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">{language === 'uk' ? 'Мова' : 'Language'}</Label>
              <Select value={languageCode} onValueChange={setLanguageCode}>
                <SelectTrigger id="language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="uk">Українська</SelectItem>
                  <SelectItem value="de">Deutsch</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleFetch}
            disabled={fetchMutation.isPending}
            className="w-full md:w-auto"
            size="lg"
          >
            {fetchMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {language === 'uk' ? 'Завантаження...' : 'Fetching...'}
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                {language === 'uk' ? 'Завантажити Новини' : 'Fetch News'}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Recent News List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{language === 'uk' ? 'Останні API Новини' : 'Recent API News'}</CardTitle>
          <CardDescription>
            {language === 'uk' ? 'Нещодавно завантажені статті' : 'Recently fetched articles'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {newsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : recentNews.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {language === 'uk' ? 'Поки немає API новин' : 'No API news yet'}
            </p>
          ) : (
            <div className="space-y-3">
              {recentNews.map((news) => (
                <div key={news.id} className="flex gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                  {news.image_url && (
                    <img
                      src={news.image_url}
                      alt={news.title}
                      className="w-20 h-20 object-cover rounded"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="font-medium text-sm line-clamp-2">{news.title}</h4>
                      <Badge variant={news.source_type === 'api_thenewsapi' ? 'default' : 'secondary'} className="shrink-0">
                        {news.source_type === 'api_thenewsapi' ? 'TheNews' : 'GNews'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
                      {news.description}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(news.scheduled_publish_at || news.published_at).toLocaleString()}
                      </span>
                      {news.scheduled_publish_at && (
                        <Badge variant="outline" className="text-xs">
                          {language === 'uk' ? 'Заплановано' : 'Scheduled'}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
