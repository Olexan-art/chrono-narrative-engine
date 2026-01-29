import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Trash2, ExternalLink, Building2, User, Globe, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface WikiEntity {
  id: string;
  wiki_id: string;
  entity_type: string;
  name: string;
  name_en: string | null;
  description: string | null;
  image_url: string | null;
  wiki_url: string;
  search_count: number;
  last_searched_at: string | null;
  created_at: string;
}

export function WikiEntitiesPanel() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch all entities
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
        <CardHeader>
          <CardTitle className="text-lg">Wikipedia сутності</CardTitle>
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
                    <TableHead className="w-24"></TableHead>
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
                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                          >
                            <a href={entity.wiki_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(entity.id)}
                            disabled={deleteMutation.isPending}
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
