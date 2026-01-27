import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Globe, Clock, FileText, ExternalLink, CheckCircle, AlertCircle } from "lucide-react";
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
  updated_at: string;
}

interface CountryInfo {
  id: string;
  code: string;
  name: string;
  flag: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export function SitemapManagementPanel() {
  const queryClient = useQueryClient();
  const [regeneratingCountry, setRegeneratingCountry] = useState<string | null>(null);

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
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch countries
  const { data: countries = [] } = useQuery({
    queryKey: ['sitemap-countries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news_countries')
        .select('id, code, name, flag')
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
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to regenerate sitemap');
      }
      
      return response.text();
    },
    onSuccess: (_, countryCode) => {
      toast.success(`Сайтмап для ${countryCode.toUpperCase()} оновлено`);
      queryClient.invalidateQueries({ queryKey: ['sitemap-metadata'] });
    },
    onError: (error) => {
      toast.error(`Помилка: ${error.message}`);
    },
    onSettled: () => {
      setRegeneratingCountry(null);
    },
  });

  // Regenerate all sitemaps
  const regenerateAllMutation = useMutation({
    mutationFn: async () => {
      const results = [];
      for (const country of countries) {
        setRegeneratingCountry(country.code.toLowerCase());
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/news-sitemap?country=${country.code.toLowerCase()}&action=generate`,
          {
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
          }
        );
        results.push({ country: country.code, success: response.ok });
      }
      return results;
    },
    onSuccess: () => {
      toast.success('Всі сайтмапи оновлено');
      queryClient.invalidateQueries({ queryKey: ['sitemap-metadata'] });
    },
    onError: (error) => {
      toast.error(`Помилка: ${error.message}`);
    },
    onSettled: () => {
      setRegeneratingCountry(null);
    },
  });

  // Get metadata for a specific country
  const getCountryMeta = (countryCode: string): SitemapMetadata | undefined => {
    return sitemapData.find(m => m.sitemap_type === `news-${countryCode.toLowerCase()}`);
  };

  // Format file size
  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Calculate stats
  const totalUrls = sitemapData.reduce((sum, m) => sum + (m.url_count || 0), 0);
  const lastUpdated = sitemapData
    .filter(m => m.last_generated_at)
    .map(m => new Date(m.last_generated_at!))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
          <CardContent className="pt-4 flex items-center justify-center h-full">
            <Button 
              onClick={() => regenerateAllMutation.mutate()}
              disabled={regenerateAllMutation.isPending}
              className="w-full"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${regenerateAllMutation.isPending ? 'animate-spin' : ''}`} />
              Оновити всі
            </Button>
          </CardContent>
        </Card>
      </div>

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
                <TableHead className="text-center">URL</TableHead>
                <TableHead className="text-center">Розмір</TableHead>
                <TableHead className="text-center">Час генерації</TableHead>
                <TableHead>Оновлено</TableHead>
                <TableHead className="text-center">Статус</TableHead>
                <TableHead className="text-right">Дії</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {countries.map((country) => {
                const meta = getCountryMeta(country.code);
                const isStale = meta?.last_generated_at 
                  ? (Date.now() - new Date(meta.last_generated_at).getTime()) > 24 * 60 * 60 * 1000
                  : true;
                const isRegenerating = regeneratingCountry === country.code.toLowerCase();

                return (
                  <TableRow key={country.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{country.flag}</span>
                        <span className="font-medium">{country.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {country.code}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">
                        {meta?.url_count?.toLocaleString() || 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {formatFileSize(meta?.file_size_bytes || null)}
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {meta?.generation_time_ms ? `${meta.generation_time_ms}ms` : '—'}
                    </TableCell>
                    <TableCell>
                      {meta?.last_generated_at ? (
                        <div className="text-sm">
                          <div>{format(new Date(meta.last_generated_at), 'dd.MM.yyyy HH:mm')}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(meta.last_generated_at), { addSuffix: true, locale: uk })}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Не генерувався</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {isStale ? (
                        <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Застарів
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-green-600 border-green-300">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Актуальний
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => regenerateMutation.mutate(country.code.toLowerCase())}
                          disabled={isRegenerating}
                        >
                          <RefreshCw className={`w-3 h-3 mr-1 ${isRegenerating ? 'animate-spin' : ''}`} />
                          Оновити
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <a 
                            href={`${SUPABASE_URL}/functions/v1/news-sitemap?country=${country.code.toLowerCase()}`}
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

      {/* Main Sitemap Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Основний сайтмап</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                Індексний файл всіх сайтмапів
              </p>
              <a 
                href={`${SUPABASE_URL}/functions/v1/news-sitemap`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary text-sm hover:underline flex items-center gap-1"
              >
                Відкрити sitemap index
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>Головний сайтмап сайту:</p>
              <a 
                href="https://echoes2.com/sitemap.xml"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1 justify-end"
              >
                echoes2.com/sitemap.xml
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
