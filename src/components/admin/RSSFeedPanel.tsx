import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Rss, ExternalLink, RefreshCw, Loader2, CheckCircle2, XCircle, Eye, Settings, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { callEdgeFunction } from "@/lib/api";

interface Props {
  password: string;
}

export function RSSFeedPanel({ password }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch RSS feed settings from cached_pages (rss cache info)
  const { data: cacheInfo } = useQuery({
    queryKey: ['rss-feed-cache'],
    queryFn: async () => {
      const { data } = await supabase
        .from('cached_pages')
        .select('*')
        .eq('path', '/api/rss-feed')
        .single();
      return data;
    }
  });

  // Fetch US retold news count
  const { data: feedStats } = useQuery({
    queryKey: ['rss-feed-stats'],
    queryFn: async () => {
      const { data: usCountry } = await supabase
        .from('news_countries')
        .select('id')
        .eq('code', 'us')
        .single();

      if (!usCountry) return { total: 0, retold: 0 };

      const { count: total } = await supabase
        .from('news_rss_items')
        .select('*', { count: 'exact', head: true })
        .eq('country_id', usCountry.id)
        .eq('is_archived', false);

      const { data: retoldItems } = await supabase
        .from('news_rss_items')
        .select('id, content_en')
        .eq('country_id', usCountry.id)
        .eq('is_archived', false)
        .not('content_en', 'is', null);

      const retold = (retoldItems || []).filter(i => (i.content_en || '').length >= 300).length;

      return { total: total || 0, retold };
    }
  });

  // Refresh RSS feed
  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rss-feed?refresh=true`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          }
        }
      );
      if (!res.ok) throw new Error('Failed to refresh');
      return res.text();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rss-feed-cache'] });
      toast({ title: 'RSS фід оновлено' });
    },
    onError: () => {
      toast({ title: 'Помилка оновлення', variant: 'destructive' });
    }
  });

  return (
    <div className="space-y-6">
      <Card className="cosmic-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Rss className="w-5 h-5 text-orange-500" />
                RSS Feed — US News
              </CardTitle>
              <CardDescription>
                Автоматичний XML-фід повністю переказаних новин США
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <a
                href="/api/rss-feed"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" className="gap-2">
                  <Eye className="w-4 h-4" />
                  Переглянути
                </Button>
              </a>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refreshMutation.mutate()}
                disabled={refreshMutation.isPending}
                className="gap-2"
              >
                {refreshMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Оновити кеш
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <p className="text-2xl font-bold text-primary">{feedStats?.total || 0}</p>
              <p className="text-xs text-muted-foreground">Всього новин US</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <p className="text-2xl font-bold text-green-500">{feedStats?.retold || 0}</p>
              <p className="text-xs text-muted-foreground">Переказано (≥300 символів)</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <p className="text-2xl font-bold">50</p>
              <p className="text-xs text-muted-foreground">У фіді (ліміт)</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              {cacheInfo ? (
                <>
                  <p className="text-2xl font-bold text-amber-500">
                    {Math.round((cacheInfo.html_size_bytes || 0) / 1024)} KB
                  </p>
                  <p className="text-xs text-muted-foreground">Розмір кешу</p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-muted-foreground">—</p>
                  <p className="text-xs text-muted-foreground">Не кешовано</p>
                </>
              )}
            </div>
          </div>

          {/* Cache info */}
          {cacheInfo && (
            <div className="p-4 rounded-lg border border-border/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Останнє оновлення:</span>
                <span className="text-sm font-mono">
                  {new Date(cacheInfo.updated_at).toLocaleString('uk-UA')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Закінчення кешу:</span>
                <span className="text-sm font-mono">
                  {new Date(cacheInfo.expires_at).toLocaleString('uk-UA')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Canonical URL:</span>
                <a
                  href={cacheInfo.canonical_url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  {cacheInfo.canonical_url}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          {/* Configuration info */}
          <div className="p-4 rounded-lg border border-border/50">
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Конфігурація
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Endpoint:</span>{" "}
                <code className="text-xs bg-muted px-2 py-1 rounded">/api/rss-feed</code>
              </div>
              <div>
                <span className="text-muted-foreground">Формат:</span>{" "}
                <code className="text-xs bg-muted px-2 py-1 rounded">RSS 2.0 + Media RSS</code>
              </div>
              <div>
                <span className="text-muted-foreground">Час кешу:</span>{" "}
                <code className="text-xs bg-muted px-2 py-1 rounded">1 година</code>
              </div>
              <div>
                <span className="text-muted-foreground">Фільтр:</span>{" "}
                <code className="text-xs bg-muted px-2 py-1 rounded">content_en ≥ 300 символів</code>
              </div>
              <div>
                <span className="text-muted-foreground">Параметр ліміту:</span>{" "}
                <code className="text-xs bg-muted px-2 py-1 rounded">?limit=50</code>
              </div>
              <div>
                <span className="text-muted-foreground">Примусове оновлення:</span>{" "}
                <code className="text-xs bg-muted px-2 py-1 rounded">?refresh=true</code>
              </div>
            </div>
          </div>

          {/* Integration links */}
          <div className="p-4 rounded-lg border border-border/50">
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <LinkIcon className="w-4 h-4" />
              Інтеграції
            </h4>
            <div className="flex flex-wrap gap-2">
              <a href="https://validator.w3.org/feed/check.cgi?url=https%3A%2F%2Fbravennow.com%2Fapi%2Frss-feed" target="_blank" rel="noopener noreferrer">
                <Badge variant="outline" className="cursor-pointer hover:bg-accent gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  W3C Validator
                </Badge>
              </a>
              <a href="https://www.google.com/search?q=site:bravennow.com+rss" target="_blank" rel="noopener noreferrer">
                <Badge variant="outline" className="cursor-pointer hover:bg-accent gap-1">
                  Google Index
                </Badge>
              </a>
              <a href="https://feedly.com/i/subscription/feed%2Fhttps%3A%2F%2Fbravennow.com%2Fapi%2Frss-feed" target="_blank" rel="noopener noreferrer">
                <Badge variant="outline" className="cursor-pointer hover:bg-accent gap-1">
                  Feedly Preview
                </Badge>
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
