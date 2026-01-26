import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Globe, Plus, Trash2, RefreshCw, Loader2, CheckCircle2, XCircle, ExternalLink, Rss, AlertCircle, Download, Search, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { callEdgeFunction } from "@/lib/api";
import { FeedNewsViewer } from "./FeedNewsViewer";

interface NewsCountry {
  id: string;
  code: string;
  name: string;
  flag: string;
  is_active: boolean;
}

interface RSSFeed {
  id: string;
  country_id: string;
  name: string;
  url: string;
  category: string;
  is_active: boolean;
  last_fetched_at: string | null;
  fetch_error: string | null;
  items_count?: number;
}

interface FeedCheckResult {
  feedId: string;
  feedName: string;
  rssItemCount: number;
  dbItemCount: number;
  canFetch: boolean;
  error?: string;
}

const CATEGORIES = [
  { value: 'general', label: 'Загальне' },
  { value: 'politics', label: 'Політика' },
  { value: 'economy', label: 'Економіка' },
  { value: 'technology', label: 'Технології' },
  { value: 'science', label: 'Наука' },
  { value: 'culture', label: 'Культура' },
  { value: 'sports', label: 'Спорт' },
  { value: 'world', label: 'Світ' },
];

interface Props {
  password: string;
}

export function NewsDigestPanel({ password }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [newFeed, setNewFeed] = useState({ name: '', url: '', category: 'general' });
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; error?: string; itemCount?: number } | null>(null);
  const [checkingFeedId, setCheckingFeedId] = useState<string | null>(null);
  const [feedCheckResult, setFeedCheckResult] = useState<FeedCheckResult | null>(null);
  const [fetchLimit, setFetchLimit] = useState(10);
  const [showFetchDialog, setShowFetchDialog] = useState(false);
  const [viewingFeed, setViewingFeed] = useState<{ id: string; name: string } | null>(null);

  // Fetch countries
  const { data: countries, isLoading: countriesLoading } = useQuery({
    queryKey: ['news-countries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news_countries')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as NewsCountry[];
    }
  });

  // Fetch feeds for selected country with item counts
  const { data: feeds, isLoading: feedsLoading } = useQuery({
    queryKey: ['news-rss-feeds', selectedCountry],
    queryFn: async () => {
      if (!selectedCountry) return [];
      const { data: feedsData, error } = await supabase
        .from('news_rss_feeds')
        .select('*')
        .eq('country_id', selectedCountry)
        .order('created_at', { ascending: false });
      if (error) throw error;
      
      // Get item counts for each feed
      const feedsWithCounts = await Promise.all((feedsData as RSSFeed[]).map(async (feed) => {
        const { count } = await supabase
          .from('news_rss_items')
          .select('*', { count: 'exact', head: true })
          .eq('feed_id', feed.id);
        return { ...feed, items_count: count || 0 };
      }));
      
      return feedsWithCounts;
    },
    enabled: !!selectedCountry
  });

  // Fetch items count per country
  const { data: itemCounts } = useQuery({
    queryKey: ['news-rss-items-count'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news_rss_items')
        .select('country_id');
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      for (const item of data || []) {
        counts[item.country_id] = (counts[item.country_id] || 0) + 1;
      }
      return counts;
    }
  });

  // Validate RSS feed
  const validateFeed = async () => {
    if (!newFeed.url) return;
    
    setIsValidating(true);
    setValidationResult(null);
    
    try {
      const result = await callEdgeFunction<{ valid: boolean; error?: string; itemCount?: number }>(
        'fetch-rss',
        { action: 'validate', feedUrl: newFeed.url }
      );
      setValidationResult(result);
    } catch (error) {
      setValidationResult({ valid: false, error: error instanceof Error ? error.message : 'Validation failed' });
    } finally {
      setIsValidating(false);
    }
  };

  // Add feed mutation
  const addFeedMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCountry || !newFeed.name || !newFeed.url) {
        throw new Error('Missing required fields');
      }
      
      const { error } = await supabase
        .from('news_rss_feeds')
        .insert({
          country_id: selectedCountry,
          name: newFeed.name,
          url: newFeed.url,
          category: newFeed.category
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news-rss-feeds'] });
      setNewFeed({ name: '', url: '', category: 'general' });
      setValidationResult(null);
      toast({ title: 'RSS канал додано' });
    },
    onError: (error) => {
      toast({
        title: 'Помилка',
        description: error instanceof Error ? error.message : 'Не вдалося додати канал',
        variant: 'destructive'
      });
    }
  });

  // Delete feed mutation
  const deleteFeedMutation = useMutation({
    mutationFn: async (feedId: string) => {
      const { error } = await supabase
        .from('news_rss_feeds')
        .delete()
        .eq('id', feedId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news-rss-feeds'] });
      queryClient.invalidateQueries({ queryKey: ['news-rss-items-count'] });
      toast({ title: 'RSS канал видалено' });
    }
  });

  // Fetch feed mutation
  const fetchFeedMutation = useMutation({
    mutationFn: async (feedId: string) => {
      return callEdgeFunction<{ success: boolean; itemsInserted?: number; error?: string }>(
        'fetch-rss',
        { action: 'fetch_feed', feedId }
      );
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['news-rss-feeds'] });
      queryClient.invalidateQueries({ queryKey: ['news-rss-items-count'] });
      if (result.success) {
        toast({ title: `Завантажено ${result.itemsInserted || 0} новин` });
      } else {
        toast({ title: 'Помилка', description: result.error, variant: 'destructive' });
      }
    }
  });

  // Fetch all feeds for country
  const fetchCountryMutation = useMutation({
    mutationFn: async (countryId: string) => {
      return callEdgeFunction<{ success: boolean; results?: Array<{ feedName: string; itemsInserted?: number }> }>(
        'fetch-rss',
        { action: 'fetch_country', countryId }
      );
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['news-rss-feeds'] });
      queryClient.invalidateQueries({ queryKey: ['news-rss-items-count'] });
      if (result.success && result.results) {
        const total = result.results.reduce((sum, r) => sum + (r.itemsInserted || 0), 0);
        toast({ title: `Завантажено ${total} новин з ${result.results.length} каналів` });
      }
    }
  });

  // Fetch ALL feeds globally
  const fetchAllMutation = useMutation({
    mutationFn: async () => {
      return callEdgeFunction<{ success: boolean; feedsProcessed?: number; results?: Array<{ feedName: string; success: boolean; itemsInserted?: number }> }>(
        'fetch-rss',
        { action: 'fetch_all' }
      );
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['news-rss-feeds'] });
      queryClient.invalidateQueries({ queryKey: ['news-rss-items-count'] });
      if (result.success && result.results) {
        const successCount = result.results.filter(r => r.success).length;
        const totalItems = result.results.reduce((sum, r) => sum + (r.itemsInserted || 0), 0);
        toast({ 
          title: `Оновлено ${successCount}/${result.feedsProcessed} каналів`,
          description: `Завантажено ${totalItems} новин`
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Помилка оновлення',
        description: error instanceof Error ? error.message : 'Не вдалося оновити канали',
        variant: 'destructive'
      });
    }
  });

  // Check feed status mutation
  const checkFeedMutation = useMutation({
    mutationFn: async (feedId: string) => {
      return callEdgeFunction<{ 
        success: boolean; 
        feedName: string;
        rssItemCount: number; 
        dbItemCount: number; 
        canFetch: boolean;
        error?: string;
      }>(
        'fetch-rss',
        { action: 'check_feed', feedId }
      );
    },
    onSuccess: (result, feedId) => {
      if (result.success) {
        setFeedCheckResult({
          feedId,
          feedName: result.feedName,
          rssItemCount: result.rssItemCount,
          dbItemCount: result.dbItemCount,
          canFetch: result.canFetch,
          error: result.error
        });
        setShowFetchDialog(true);
      } else {
        toast({
          title: 'Помилка перевірки',
          description: result.error,
          variant: 'destructive'
        });
      }
    }
  });

  // Fetch limited items mutation
  const fetchLimitedMutation = useMutation({
    mutationFn: async ({ feedId, limit }: { feedId: string; limit: number }) => {
      return callEdgeFunction<{ success: boolean; itemsInserted?: number; error?: string }>(
        'fetch-rss',
        { action: 'fetch_feed_limited', feedId, limit }
      );
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['news-rss-feeds'] });
      queryClient.invalidateQueries({ queryKey: ['news-rss-items-count'] });
      setShowFetchDialog(false);
      setFeedCheckResult(null);
      if (result.success) {
        toast({ title: `Завантажено ${result.itemsInserted || 0} новин` });
      } else {
        toast({ title: 'Помилка', description: result.error, variant: 'destructive' });
      }
    }
  });

  if (countriesLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card className="cosmic-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                Кротивина Новин — RSS Канали
              </CardTitle>
              <CardDescription>Управління RSS каналами по країнам</CardDescription>
            </div>
            <Button
              onClick={() => fetchAllMutation.mutate()}
              disabled={fetchAllMutation.isPending}
              className="gap-2"
            >
              {fetchAllMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Оновити всі RSS
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedCountry || undefined} onValueChange={setSelectedCountry}>
            <TabsList className="grid grid-cols-4 mb-6">
              {countries?.map(country => (
                <TabsTrigger key={country.id} value={country.id} className="gap-2">
                  <span>{country.flag}</span>
                  <span className="hidden sm:inline">{country.name}</span>
                  {itemCounts?.[country.id] && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {itemCounts[country.id]}
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {countries?.map(country => (
              <TabsContent key={country.id} value={country.id} className="space-y-6">
                {/* Add new feed form */}
                <Card className="border-dashed">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Додати RSS канал для {country.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Назва каналу</Label>
                        <Input
                          placeholder="BBC News"
                          value={newFeed.name}
                          onChange={(e) => setNewFeed(prev => ({ ...prev, name: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>URL RSS</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="https://example.com/rss.xml"
                            value={newFeed.url}
                            onChange={(e) => {
                              setNewFeed(prev => ({ ...prev, url: e.target.value }));
                              setValidationResult(null);
                            }}
                          />
                          <Button 
                            variant="outline" 
                            size="icon"
                            onClick={validateFeed}
                            disabled={!newFeed.url || isValidating}
                          >
                            {isValidating ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : validationResult?.valid ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            ) : validationResult ? (
                              <XCircle className="w-4 h-4 text-destructive" />
                            ) : (
                              <Rss className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                        {validationResult && (
                          <p className={`text-xs ${validationResult.valid ? 'text-green-500' : 'text-destructive'}`}>
                            {validationResult.valid 
                              ? `✓ Знайдено ${validationResult.itemCount} новин` 
                              : `✗ ${validationResult.error}`}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Категорія</Label>
                        <Select
                          value={newFeed.category}
                          onValueChange={(v) => setNewFeed(prev => ({ ...prev, category: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map(cat => (
                              <SelectItem key={cat.value} value={cat.value}>
                                {cat.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => addFeedMutation.mutate()}
                        disabled={!newFeed.name || !newFeed.url || !validationResult?.valid || addFeedMutation.isPending}
                      >
                        {addFeedMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                        Додати канал
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => fetchCountryMutation.mutate(country.id)}
                        disabled={fetchCountryMutation.isPending}
                      >
                        {fetchCountryMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                        Оновити всі канали
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Feeds list */}
                {feedsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : feeds?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Rss className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Ще немає RSS каналів для {country.name}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {feeds?.map(feed => (
                      <Card key={feed.id} className="cosmic-card">
                        <CardContent className="py-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-medium truncate">{feed.name}</h4>
                                <Badge variant="outline" className="text-xs">
                                  {CATEGORIES.find(c => c.value === feed.category)?.label || feed.category}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  <Download className="w-3 h-3 mr-1" />
                                  {feed.items_count || 0} новин
                                </Badge>
                                {feed.fetch_error && (
                                  <Badge variant="destructive" className="text-xs">
                                    <AlertCircle className="w-3 h-3 mr-1" />
                                    Помилка
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <a 
                                  href={feed.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs text-muted-foreground hover:text-primary truncate max-w-md"
                                >
                                  {feed.url}
                                </a>
                                <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                              </div>
                              {feed.last_fetched_at && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Оновлено: {new Date(feed.last_fetched_at).toLocaleString('uk-UA')}
                                </p>
                              )}
                              {feed.fetch_error && (
                                <p className="text-xs text-destructive mt-1">{feed.fetch_error}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setViewingFeed({ id: feed.id, name: feed.name })}
                                disabled={!feed.items_count}
                                title="Переглянути новини"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => {
                                  setCheckingFeedId(feed.id);
                                  checkFeedMutation.mutate(feed.id);
                                }}
                                disabled={checkFeedMutation.isPending && checkingFeedId === feed.id}
                                title="Перевірити та вигрузити"
                              >
                                {checkFeedMutation.isPending && checkingFeedId === feed.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Search className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => fetchFeedMutation.mutate(feed.id)}
                                disabled={fetchFeedMutation.isPending}
                                title="Оновити канал"
                              >
                                <RefreshCw className={`w-4 h-4 ${fetchFeedMutation.isPending ? 'animate-spin' : ''}`} />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="outline" size="icon" className="text-destructive hover:text-destructive">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Видалити канал?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Це видалить канал "{feed.name}" та всі завантажені з нього новини.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Скасувати</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteFeedMutation.mutate(feed.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Видалити
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Fetch Dialog */}
      <Dialog open={showFetchDialog} onOpenChange={setShowFetchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Вигрузка новин</DialogTitle>
            <DialogDescription>
              {feedCheckResult?.feedName && `Канал: ${feedCheckResult.feedName}`}
            </DialogDescription>
          </DialogHeader>
          
          {feedCheckResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-2xl font-bold text-primary">{feedCheckResult.rssItemCount}</p>
                  <p className="text-xs text-muted-foreground">Новин у RSS</p>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-2xl font-bold">{feedCheckResult.dbItemCount}</p>
                  <p className="text-xs text-muted-foreground">Вже завантажено</p>
                </div>
              </div>
              
              {feedCheckResult.canFetch ? (
                <div className="space-y-2">
                  <Label>Скільки новин завантажити?</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={fetchLimit}
                      onChange={(e) => setFetchLimit(Math.min(50, Math.max(1, parseInt(e.target.value) || 10)))}
                      className="w-24"
                    />
                    <Select
                      value={fetchLimit.toString()}
                      onValueChange={(v) => setFetchLimit(parseInt(v))}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 новин</SelectItem>
                        <SelectItem value="10">10 новин</SelectItem>
                        <SelectItem value="20">20 новин</SelectItem>
                        <SelectItem value="30">30 новин</SelectItem>
                        <SelectItem value="50">50 новин (макс)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
                  {feedCheckResult.error || 'Не вдалося підключитися до RSS'}
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFetchDialog(false)}>
              Скасувати
            </Button>
            {feedCheckResult?.canFetch && (
              <Button 
                onClick={() => {
                  if (feedCheckResult) {
                    fetchLimitedMutation.mutate({ 
                      feedId: feedCheckResult.feedId, 
                      limit: fetchLimit 
                    });
                  }
                }}
                disabled={fetchLimitedMutation.isPending}
              >
                {fetchLimitedMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Завантажити {fetchLimit} новин
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feed News Viewer */}
      <FeedNewsViewer
        feedId={viewingFeed?.id || ''}
        feedName={viewingFeed?.name || ''}
        isOpen={!!viewingFeed}
        onClose={() => setViewingFeed(null)}
      />
    </div>
  );
}
