import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Globe, Clock, FileText, ExternalLink, CheckCircle, AlertCircle, Bell, Send } from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { uk } from "date-fns/locale";

interface SitemapMetadata {
  id: string;
  sitemap_type: string;
  country_code: string | null;
  url_count: number;
  last_generated_at: string | null;
  generation_time_ms: number | null;
  file_size_bytes: number | null;
  last_ping_at: string | null;
  google_ping_success: boolean | null;
  bing_ping_success: boolean | null;
  updated_at: string;
}

interface CountryInfo {
  id: string;
  code: string;
  name: string;
  flag: string;
  retell_ratio: number;
}

interface CachedSitemap {
  path: string;
  html_size_bytes: number | null;
  updated_at: string;
  expires_at: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export function SitemapManagementPanel() {
  const queryClient = useQueryClient();
  const [regeneratingCountry, setRegeneratingCountry] = useState<string | null>(null);
  const [regeneratingType, setRegeneratingType] = useState<string | null>(null);

  // Fetch sitemap metadata
  const { data: sitemapData = [], isLoading: isLoadingMeta } = useQuery({
    queryKey: ['sitemap-metadata'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sitemap_metadata')
        .select('*')
        .order('sitemap_type');
      if (error) throw error;
      return data as SitemapMetadata[];
    },
    refetchInterval: 60000,
  });

  // Fetch cached sitemap files
  const { data: cachedSitemaps = [] } = useQuery({
    queryKey: ['cached-sitemaps'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cached_pages')
        .select('path, html_size_bytes, updated_at, expires_at')
        .or('path.like.%sitemap%,path.like.%llms%')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as CachedSitemap[];
    },
    refetchInterval: 60000,
  });

  // Fetch countries
  const { data: countries = [] } = useQuery({
    queryKey: ['sitemap-countries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news_countries')
        .select('id, code, name, flag, retell_ratio')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data as CountryInfo[];
    },
  });

  // Regenerate sitemap mutation
  const regenerateMutation = useMutation({
    mutationFn: async (countryCode: string) => {
      setRegeneratingCountry(countryCode);
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/news-sitemap?country=${countryCode}&action=generate`,
        { headers: { 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` } }
      );
      if (!response.ok) throw new Error('Failed to regenerate sitemap');
      return response.text();
    },
    onSuccess: (_, countryCode) => {
      toast.success(`Сайтмап для ${countryCode.toUpperCase()} оновлено`);
      queryClient.invalidateQueries({ queryKey: ['sitemap-metadata'] });
      queryClient.invalidateQueries({ queryKey: ['cached-sitemaps'] });
    },
    onError: (error) => toast.error(`Помилка: ${error.message}`),
    onSettled: () => setRegeneratingCountry(null),
  });

  // Regenerate all sitemaps
  const regenerateAllMutation = useMutation({
    mutationFn: async () => {
      // Generate news sitemaps for all countries
      for (const country of countries) {
        setRegeneratingCountry(country.code.toLowerCase());
        await fetch(
          `${SUPABASE_URL}/functions/v1/news-sitemap?country=${country.code.toLowerCase()}&action=generate`,
          { headers: { 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` } }
        );
      }
      // Generate wiki sitemap
      setRegeneratingType('wiki');
      await fetch(
        `${SUPABASE_URL}/functions/v1/wiki-sitemap?refresh=true`,
        { headers: { 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` } }
      );
      // Generate main sitemap
      setRegeneratingType('main');
      await fetch(
        `${SUPABASE_URL}/functions/v1/sitemap?refresh=true`,
        { headers: { 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` } }
      );
    },
    onSuccess: () => {
      toast.success('Всі сайтмапи оновлено та закешовано');
      queryClient.invalidateQueries({ queryKey: ['sitemap-metadata'] });
      queryClient.invalidateQueries({ queryKey: ['cached-sitemaps'] });
    },
    onError: (error) => toast.error(`Помилка: ${error.message}`),
    onSettled: () => { setRegeneratingCountry(null); setRegeneratingType(null); },
  });

  // Regenerate specific type
  const regenerateTypeMutation = useMutation({
    mutationFn: async (type: 'wiki' | 'main') => {
      setRegeneratingType(type);
      const endpoint = type === 'wiki' ? 'wiki-sitemap' : 'sitemap';
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/${endpoint}?refresh=true`,
        { headers: { 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` } }
      );
      if (!response.ok) throw new Error(`Failed to regenerate ${type} sitemap`);
      return response.text();
    },
    onSuccess: (_, type) => {
      toast.success(`${type === 'wiki' ? 'Wiki' : 'Головний'} сайтмап оновлено`);
      queryClient.invalidateQueries({ queryKey: ['cached-sitemaps'] });
    },
    onError: (error) => toast.error(`Помилка: ${error.message}`),
    onSettled: () => setRegeneratingType(null),
  });

  // Ping search engines mutation
  const pingMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/ping-sitemap`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error('Failed to ping search engines');
      return response.json();
    },
    onSuccess: (result) => {
      const google = result.results?.find((r: any) => r.service === 'Google');
      const bing = result.results?.find((r: any) => r.service === 'Bing');
      toast.success(`Пінг: Google ${google?.success ? '✓' : '✗'}, Bing ${bing?.success ? '✓' : '✗'}`);
      queryClient.invalidateQueries({ queryKey: ['sitemap-metadata'] });
    },
    onError: (error) => toast.error(`Помилка пінгу: ${error.message}`),
  });

  const getCountryMeta = (countryCode: string): SitemapMetadata | undefined => {
    return sitemapData.find(m => m.sitemap_type === `news-${countryCode.toLowerCase()}`);
  };

  const mainSitemapMeta = sitemapData.find(m => m.sitemap_type === 'main');

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const totalUrls = sitemapData.reduce((sum, m) => sum + (m.url_count || 0), 0);
  const lastUpdated = sitemapData
    .filter(m => m.last_generated_at)
    .map(m => new Date(m.last_generated_at!))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">Країн</span>
            </div>
            <p className="text-2xl font-bold">{countries.length}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">Всього URL</span>
            </div>
            <p className="text-2xl font-bold">{totalUrls.toLocaleString()}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">Останнє оновлення</span>
            </div>
            <p className="text-lg font-medium">
              {lastUpdated 
                ? formatDistanceToNow(lastUpdated, { addSuffix: true, locale: uk })
                : 'Ніколи'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">Останній пінг</span>
            </div>
            {mainSitemapMeta?.last_ping_at ? (
              <div>
                <p className="text-sm font-medium">
                  {formatDistanceToNow(new Date(mainSitemapMeta.last_ping_at), { addSuffix: true, locale: uk })}
                </p>
                <div className="flex gap-2 mt-1">
                  <Badge variant={mainSitemapMeta.google_ping_success ? "default" : "destructive"} className="text-xs">
                    G {mainSitemapMeta.google_ping_success ? '✓' : '✗'}
                  </Badge>
                  <Badge variant={mainSitemapMeta.bing_ping_success ? "default" : "destructive"} className="text-xs">
                    B {mainSitemapMeta.bing_ping_success ? '✓' : '✗'}
                  </Badge>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Ніколи</p>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4 flex flex-col gap-2 h-full justify-center">
            <Button 
              onClick={() => regenerateAllMutation.mutate()}
              disabled={regenerateAllMutation.isPending}
              size="sm"
              className="w-full"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${regenerateAllMutation.isPending ? 'animate-spin' : ''}`} />
              Оновити всі
            </Button>
            <Button 
              onClick={() => pingMutation.mutate()}
              disabled={pingMutation.isPending}
              variant="outline"
              size="sm"
              className="w-full"
            >
              <Send className={`w-4 h-4 mr-2 ${pingMutation.isPending ? 'animate-pulse' : ''}`} />
              Пінг Google/Bing
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Cached XML Files Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <FileText className="w-4 h-4" />
            Закешовані XML файли (джерело для echoes2.com/api/*)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Main sitemap */}
            <div className="border border-border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">Головний sitemap</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => regenerateTypeMutation.mutate('main')}
                  disabled={regeneratingType === 'main'}
                >
                  <RefreshCw className={`w-3 h-3 mr-1 ${regeneratingType === 'main' ? 'animate-spin' : ''}`} />
                  Генерувати
                </Button>
              </div>
              {(() => {
                const cached = cachedSitemaps.find(c => c.path === '/api/sitemap');
                if (!cached) return <p className="text-xs text-muted-foreground">Не закешовано</p>;
                const isExpired = new Date(cached.expires_at) < new Date();
                return (
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Розмір:</span>
                      <span>{formatFileSize(cached.html_size_bytes)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Оновлено:</span>
                      <span>{formatDistanceToNow(new Date(cached.updated_at), { addSuffix: true, locale: uk })}</span>
                    </div>
                    <Badge variant={isExpired ? "destructive" : "outline"} className="text-xs">
                      {isExpired ? 'Протермінований' : 'Актуальний'}
                    </Badge>
                  </div>
                );
              })()}
            </div>

            {/* Wiki sitemap */}
            <div className="border border-border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">Wiki sitemap</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => regenerateTypeMutation.mutate('wiki')}
                  disabled={regeneratingType === 'wiki'}
                >
                  <RefreshCw className={`w-3 h-3 mr-1 ${regeneratingType === 'wiki' ? 'animate-spin' : ''}`} />
                  Генерувати
                </Button>
              </div>
              {(() => {
                const cached = cachedSitemaps.find(c => c.path === '/api/wiki-sitemap');
                if (!cached) return <p className="text-xs text-muted-foreground">Не закешовано</p>;
                const isExpired = new Date(cached.expires_at) < new Date();
                return (
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Розмір:</span>
                      <span>{formatFileSize(cached.html_size_bytes)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Оновлено:</span>
                      <span>{formatDistanceToNow(new Date(cached.updated_at), { addSuffix: true, locale: uk })}</span>
                    </div>
                    <Badge variant={isExpired ? "destructive" : "outline"} className="text-xs">
                      {isExpired ? 'Протермінований' : 'Актуальний'}
                    </Badge>
                  </div>
                );
              })()}
            </div>

            {/* Sitemap index link */}
            <div className="border border-border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">Перевірка</span>
              </div>
              <div className="text-xs space-y-2">
                <a href="https://echoes2.com/api/sitemap" target="_blank" rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1">
                  /api/sitemap <ExternalLink className="w-3 h-3" />
                </a>
                <a href="https://echoes2.com/api/wiki-sitemap" target="_blank" rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1">
                  /api/wiki-sitemap <ExternalLink className="w-3 h-3" />
                </a>
                <a href="https://echoes2.com/api/news-sitemap?country=us" target="_blank" rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1">
                  /api/news-sitemap?country=us <ExternalLink className="w-3 h-3" />
                </a>
                <a href="https://echoes2.com/sitemap.xml" target="_blank" rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1">
                  /sitemap.xml <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sitemaps Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Сайтмапи новин по країнам
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Країна</TableHead>
                <TableHead className="text-center">Retell %</TableHead>
                <TableHead className="text-center">URL</TableHead>
                <TableHead className="text-center">Розмір</TableHead>
                <TableHead>Оновлено</TableHead>
                <TableHead className="text-center">Кеш</TableHead>
                <TableHead className="text-center">Пінг</TableHead>
                <TableHead className="text-right">Дії</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {countries.map((country) => {
                const meta = getCountryMeta(country.code);
                const countryLower = country.code.toLowerCase();
                const cached = cachedSitemaps.find(c => c.path === `/news-sitemap?country=${countryLower}`);
                const isCacheExpired = cached ? new Date(cached.expires_at) < new Date() : true;
                const isRegenerating = regeneratingCountry === countryLower;

                return (
                  <TableRow key={country.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{country.flag}</span>
                        <span className="font-medium">{country.name}</span>
                        <Badge variant="outline" className="text-xs">{country.code}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={country.retell_ratio === 100 ? "default" : "secondary"} className="text-xs">
                        {country.retell_ratio}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{meta?.url_count?.toLocaleString() || 0}</Badge>
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {formatFileSize(cached?.html_size_bytes || meta?.file_size_bytes || null)}
                    </TableCell>
                    <TableCell>
                      {cached ? (
                        <div className="text-sm">
                          <div>{format(new Date(cached.updated_at), 'dd.MM HH:mm')}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(cached.updated_at), { addSuffix: true, locale: uk })}
                          </div>
                        </div>
                      ) : meta?.last_generated_at ? (
                        <div className="text-sm">
                          <div>{format(new Date(meta.last_generated_at), 'dd.MM HH:mm')}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {cached ? (
                        <Badge variant={isCacheExpired ? "destructive" : "outline"} className="text-xs">
                          {isCacheExpired ? '✗' : '✓'}
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">—</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {meta?.last_ping_at ? (
                        <div className="flex gap-1 justify-center">
                          <Badge variant={meta.google_ping_success ? "outline" : "destructive"} className="text-xs px-1">G</Badge>
                          <Badge variant={meta.bing_ping_success ? "outline" : "destructive"} className="text-xs px-1">B</Badge>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => regenerateMutation.mutate(countryLower)}
                          disabled={isRegenerating}
                        >
                          <RefreshCw className={`w-3 h-3 mr-1 ${isRegenerating ? 'animate-spin' : ''}`} />
                          Оновити
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <a
                            href={`https://echoes2.com/api/news-sitemap?country=${countryLower}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Footer */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>XML кешуються в базі та віддаються через Netlify Edge Function з echoes2.com/api/*</p>
            <a 
              href="https://echoes2.com/sitemap.xml"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline flex items-center gap-1"
            >
              sitemap.xml <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
