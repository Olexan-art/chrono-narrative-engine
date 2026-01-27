import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Loader2, Settings, Play, Trash2, Calendar, Globe, RefreshCw, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { callEdgeFunction } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, format } from "date-fns";
import { uk } from "date-fns/locale";

interface ArchiveStats {
  totalNews: number;
  archivedNews: number;
  activeNews: number;
  eligibleForArchive: number;
  archiveDays: number;
  autoArchiveEnabled: boolean;
}

interface ArchivedNewsItem {
  id: string;
  title: string;
  slug: string | null;
  image_url: string | null;
  category: string | null;
  fetched_at: string;
  archived_at: string;
  country_id: string;
  news_countries: {
    code: string;
    name: string;
    flag: string;
  };
}

interface Props {
  password: string;
}

export function NewsArchivePanel({ password }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [page, setPage] = useState(0);

  // Fetch archive stats
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['archive-stats'],
    queryFn: async () => {
      const result = await callEdgeFunction<{ success: boolean; stats: ArchiveStats }>(
        'archive-news',
        { action: 'get_stats' }
      );
      return result.stats;
    }
  });

  // Fetch countries
  const { data: countries } = useQuery({
    queryKey: ['news-countries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news_countries')
        .select('id, code, name, flag')
        .order('sort_order');
      if (error) throw error;
      return data;
    }
  });

  // Fetch archived news
  const { data: archivedNews, isLoading: newsLoading, refetch: refetchNews } = useQuery({
    queryKey: ['archived-news', selectedCountry, page],
    queryFn: async () => {
      const result = await callEdgeFunction<{ success: boolean; news: ArchivedNewsItem[] }>(
        'archive-news',
        { 
          action: 'get_archived', 
          data: { 
            page, 
            limit: 20,
            countryId: selectedCountry !== 'all' ? selectedCountry : undefined 
          } 
        }
      );
      return result.news || [];
    }
  });

  // Run archive mutation
  const runArchiveMutation = useMutation({
    mutationFn: async () => {
      return callEdgeFunction<{ success: boolean; archivedCount: number }>(
        'archive-news',
        { action: 'run_archive', password }
      );
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['archive-stats'] });
      queryClient.invalidateQueries({ queryKey: ['archived-news'] });
      queryClient.invalidateQueries({ queryKey: ['news-rss-items-stats'] });
      toast({ 
        title: 'Архівування завершено',
        description: `Архівовано ${result.archivedCount} новин`
      });
    },
    onError: (error) => {
      toast({
        title: 'Помилка',
        description: error instanceof Error ? error.message : 'Не вдалося архівувати',
        variant: 'destructive'
      });
    }
  });

  // Unarchive mutation
  const unarchiveMutation = useMutation({
    mutationFn: async (newsIds: string[]) => {
      return callEdgeFunction<{ success: boolean }>(
        'archive-news',
        { action: 'unarchive', password, data: { newsIds } }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archive-stats'] });
      queryClient.invalidateQueries({ queryKey: ['archived-news'] });
      queryClient.invalidateQueries({ queryKey: ['news-rss-items-stats'] });
      setSelectedItems([]);
      toast({ title: 'Новини відновлено' });
    },
    onError: (error) => {
      toast({
        title: 'Помилка',
        description: error instanceof Error ? error.message : 'Не вдалося відновити',
        variant: 'destructive'
      });
    }
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: { archiveDays?: number; autoArchiveEnabled?: boolean }) => {
      return callEdgeFunction<{ success: boolean }>(
        'archive-news',
        { action: 'update_settings', password, data }
      );
    },
    onSuccess: () => {
      refetchStats();
      toast({ title: 'Налаштування збережено' });
    },
    onError: (error) => {
      toast({
        title: 'Помилка',
        description: error instanceof Error ? error.message : 'Не вдалося зберегти',
        variant: 'destructive'
      });
    }
  });

  const toggleSelectAll = () => {
    if (selectedItems.length === (archivedNews?.length || 0)) {
      setSelectedItems([]);
    } else {
      setSelectedItems(archivedNews?.map(n => n.id) || []);
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItems(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id) 
        : [...prev, id]
    );
  };

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats & Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Stats Card */}
        <Card className="cosmic-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Archive className="w-5 h-5 text-primary" />
              Статистика Архіву
            </CardTitle>
            <CardDescription>
              Новини архівуються через {stats?.archiveDays || 14} днів
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Всього новин</p>
                <p className="text-2xl font-bold">{stats?.totalNews || 0}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Активних</p>
                <p className="text-2xl font-bold text-green-500">{stats?.activeNews || 0}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">В архіві</p>
                <p className="text-2xl font-bold text-muted-foreground">{stats?.archivedNews || 0}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Готові до архіву</p>
                <p className="text-2xl font-bold text-amber-500">{stats?.eligibleForArchive || 0}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={() => runArchiveMutation.mutate()}
                disabled={runArchiveMutation.isPending || (stats?.eligibleForArchive || 0) === 0}
                className="gap-2 flex-1"
              >
                {runArchiveMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Архівувати зараз ({stats?.eligibleForArchive || 0})
              </Button>
              <Button variant="outline" size="icon" onClick={() => refetchStats()}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Settings Card */}
        <Card className="cosmic-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              Налаштування Архівування
            </CardTitle>
            <CardDescription>
              Керування автоматичним архівуванням
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Автоматичне архівування</Label>
                <p className="text-sm text-muted-foreground">
                  Архівувати новини автоматично
                </p>
              </div>
              <Switch
                checked={stats?.autoArchiveEnabled ?? true}
                onCheckedChange={(checked) => 
                  updateSettingsMutation.mutate({ autoArchiveEnabled: checked })
                }
                disabled={updateSettingsMutation.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label>Період до архівування</Label>
              <Select
                value={String(stats?.archiveDays || 14)}
                onValueChange={(value) => 
                  updateSettingsMutation.mutate({ archiveDays: parseInt(value) })
                }
                disabled={updateSettingsMutation.isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 днів</SelectItem>
                  <SelectItem value="14">14 днів</SelectItem>
                  <SelectItem value="21">21 день</SelectItem>
                  <SelectItem value="30">30 днів</SelectItem>
                  <SelectItem value="60">60 днів</SelectItem>
                  <SelectItem value="90">90 днів</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Новини старші за цей період будуть архівовані
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Archived News List */}
      <Card className="cosmic-card">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Archive className="w-5 h-5 text-muted-foreground" />
                Архівовані Новини
              </CardTitle>
              <CardDescription>
                Перегляд та відновлення архівованих новин
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedCountry} onValueChange={(v) => { setSelectedCountry(v); setPage(0); }}>
                <SelectTrigger className="w-[180px]">
                  <Globe className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Усі країни" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Усі країни</SelectItem>
                  {countries?.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.flag} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedItems.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => unarchiveMutation.mutate(selectedItems)}
                  disabled={unarchiveMutation.isPending}
                  className="gap-2"
                >
                  {unarchiveMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArchiveRestore className="w-4 h-4" />
                  )}
                  Відновити ({selectedItems.length})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {newsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : archivedNews?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Archive className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Архів порожній</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={selectedItems.length === (archivedNews?.length || 0) && archivedNews?.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Новина</TableHead>
                    <TableHead className="w-[100px]">Країна</TableHead>
                    <TableHead className="w-[140px]">Архівовано</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {archivedNews?.map(item => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedItems.includes(item.id)}
                          onCheckedChange={() => toggleSelectItem(item.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium line-clamp-1">{item.title}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {item.category && (
                              <Badge variant="outline" className="text-xs">
                                {item.category}
                              </Badge>
                            )}
                            <span>
                              <Calendar className="w-3 h-3 inline mr-1" />
                              {format(new Date(item.fetched_at), 'dd.MM.yyyy', { locale: uk })}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-lg">{item.news_countries?.flag}</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(item.archived_at), { addSuffix: true, locale: uk })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Сторінка {page + 1}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    Попередня
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={(archivedNews?.length || 0) < 20}
                  >
                    Наступна
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
