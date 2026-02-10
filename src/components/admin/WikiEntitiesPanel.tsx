import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, Globe, User, Building2, ExternalLink, Newspaper, Trash2, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import { callEdgeFunction } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";

interface WikiEntity {
  id: string;
  wiki_id: string;
  entity_type: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  image_url: string | null;
  wiki_url: string;
  wiki_url_en: string | null;
  extract: string | null;
  extract_en: string | null;
  search_count: number;
  created_at: string;
  last_searched_at: string | null;
}

interface NewsLink {
  id: string;
  slug: string | null;
  title: string;
  title_en: string | null;
  country_id: string;
  published_at: string | null;
}

interface NewsLinkWithCountry extends NewsLink {
  country: {
    code: string;
    flag: string;
    name: string;
  };
}

// Component to show linked news for an entity
function EntityNewsDialog({ entity }: { entity: WikiEntity }) {
  const { data: linkedNews, isLoading } = useQuery({
    queryKey: ['entity-news-links', entity.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news_wiki_entities')
        .select(`
          id,
          news_item:news_rss_items(
            id, slug, title, title_en, country_id, published_at,
            country:news_countries(code, flag, name)
          )
        `)
        .eq('wiki_entity_id', entity.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      return data
        .filter(d => d.news_item)
        .map(d => {
          const item = d.news_item as any;
          return {
            ...item,
            country: item.country
          } as NewsLinkWithCountry;
        });
    },
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Переглянути згадки в новинах">
          <Newspaper className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {entity.image_url ? (
              <img src={entity.image_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                {entity.entity_type === 'person' ? <User className="w-6 h-6" /> : <Building2 className="w-6 h-6" />}
              </div>
            )}
            <div>
              <span>{entity.name}</span>
              <p className="text-sm font-normal text-muted-foreground">{entity.description}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Newspaper className="w-4 h-4" />
            Згадки в новинах ({linkedNews?.length || 0})
          </h4>
          
          <ScrollArea className="h-[300px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : linkedNews && linkedNews.length > 0 ? (
              <div className="space-y-2">
                {linkedNews.map((news) => (
                  <Link
                    key={news.id}
                    to={news.slug ? `/news/${news.country?.code?.toLowerCase()}/${news.slug}` : '#'}
                    className="block p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-lg">{news.country?.flag}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-2">{news.title_en || news.title}</p>
                        {news.published_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(news.published_at), 'dd.MM.yyyy HH:mm')}
                          </p>
                        )}
                      </div>
                      <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Ця сутність ще не згадується в новинах
              </p>
            )}
          </ScrollArea>
        </div>

        {/* Entity Details */}
        {entity.extract && (
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-sm font-medium mb-2">Про сутність (Wikipedia)</h4>
            <p className="text-sm text-muted-foreground line-clamp-4">{entity.extract_en || entity.extract}</p>
            <a 
              href={entity.wiki_url_en || entity.wiki_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-2"
            >
              Читати на Wikipedia <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function WikiEntitiesPanel() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch entities with search and filter
  const { data: entities, isLoading } = useQuery({
    queryKey: ['admin-wiki-entities', searchTerm, filterType],
    queryFn: async () => {
      let query = supabase
        .from('wiki_entities')
        .select('*')
        .order('search_count', { ascending: false })
        .limit(100);

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,name_en.ilike.%${searchTerm}%`);
      }

      if (filterType) {
        query = query.eq('entity_type', filterType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as WikiEntity[];
    },
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['admin-wiki-stats'],
    queryFn: async () => {
      const { count: total } = await supabase
        .from('wiki_entities')
        .select('*', { count: 'exact', head: true });

      const { count: persons } = await supabase
        .from('wiki_entities')
        .select('*', { count: 'exact', head: true })
        .eq('entity_type', 'person');

      const { count: companies } = await supabase
        .from('wiki_entities')
        .select('*', { count: 'exact', head: true })
        .eq('entity_type', 'company');

      const { count: links } = await supabase
        .from('news_wiki_entities')
        .select('*', { count: 'exact', head: true });

      return {
        total: total || 0,
        persons: persons || 0,
        companies: companies || 0,
        links: links || 0,
      };
    },
  });

  // Delete entity mutation
  const deleteMutation = useMutation({
    mutationFn: async (entityId: string) => {
      const { error } = await supabase
        .from('wiki_entities')
        .delete()
        .eq('id', entityId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Сутність видалено');
      queryClient.invalidateQueries({ queryKey: ['admin-wiki-entities'] });
      queryClient.invalidateQueries({ queryKey: ['admin-wiki-stats'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Помилка видалення');
    },
  });

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'person': return <User className="w-4 h-4" />;
      case 'company': return <Building2 className="w-4 h-4" />;
      default: return <Globe className="w-4 h-4" />;
    }
  };

  const getEntityBadge = (type: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      person: 'default',
      company: 'secondary',
      organization: 'outline',
    };
    return variants[type] || 'outline';
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">Всього сутностей</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold flex items-center gap-1">
              <User className="w-5 h-5" />
              {stats?.persons || 0}
            </div>
            <p className="text-xs text-muted-foreground">Персони</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold flex items-center gap-1">
              <Building2 className="w-5 h-5" />
              {stats?.companies || 0}
            </div>
            <p className="text-xs text-muted-foreground">Компанії</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats?.links || 0}</div>
            <p className="text-xs text-muted-foreground">Зв'язків з новинами</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Wikipedia сутності</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link to="/wiki">
              <ExternalLink className="w-4 h-4 mr-2" />
              Публічний каталог
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Пошук за назвою..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="flex gap-1">
              <Button 
                variant={filterType === null ? "default" : "outline"} 
                size="sm"
                onClick={() => setFilterType(null)}
              >
                Всі
              </Button>
              <Button 
                variant={filterType === 'person' ? "default" : "outline"} 
                size="sm"
                onClick={() => setFilterType('person')}
              >
                <User className="w-3 h-3 mr-1" />
                Персони
              </Button>
              <Button 
                variant={filterType === 'company' ? "default" : "outline"} 
                size="sm"
                onClick={() => setFilterType('company')}
              >
                <Building2 className="w-3 h-3 mr-1" />
                Компанії
              </Button>
              <Button 
                variant={filterType === 'organization' ? "default" : "outline"} 
                size="sm"
                onClick={() => setFilterType('organization')}
              >
                <Globe className="w-3 h-3 mr-1" />
                Організації
              </Button>
            </div>
          </div>

          <ScrollArea className="h-[500px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : entities && entities.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Назва</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead className="text-center">Згадок</TableHead>
                    <TableHead>Останній пошук</TableHead>
                    <TableHead className="w-32"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entities.map((entity) => (
                    <TableRow key={entity.id}>
                      <TableCell>
                        {entity.image_url ? (
                          <img 
                            src={entity.image_url} 
                            alt="" 
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                            {getEntityIcon(entity.entity_type)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{entity.name}</p>
                          {entity.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {entity.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getEntityBadge(entity.entity_type)}>
                          {getEntityIcon(entity.entity_type)}
                          <span className="ml-1">{entity.entity_type}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{entity.search_count}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {entity.last_searched_at 
                          ? format(new Date(entity.last_searched_at), 'dd.MM.yyyy HH:mm')
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <EntityNewsDialog entity={entity} />
                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                            title="Сторінка сутності"
                          >
                            <Link to={`/wiki/${entity.id}`}>
                              <ExternalLink className="w-4 h-4 text-primary" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                            title="Wikipedia"
                          >
                            <a href={entity.wiki_url} target="_blank" rel="noopener noreferrer">
                              <Globe className="w-4 h-4" />
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(entity.id)}
                            disabled={deleteMutation.isPending}
                            title="Видалити"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm || filterType ? 'Нічого не знайдено' : 'Сутності ще не додані'}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
