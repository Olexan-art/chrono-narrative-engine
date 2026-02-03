import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, ExternalLink, Calendar, Loader2, FileText, Edit, Save, X, Tag } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface NewsItem {
  id: string;
  title: string;
  title_en: string | null;
  description: string | null;
  description_en: string | null;
  keywords: string[] | null;
  slug: string | null;
  published_at: string | null;
  created_at: string;
  country: {
    code: string;
    name: string;
    flag: string;
  };
}

export function NewsSearchPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchId, setSearchId] = useState("");
  const [searchText, setSearchText] = useState("");
  const [activeSearch, setActiveSearch] = useState<{ type: 'id' | 'text'; value: string } | null>(null);
  const [editingItem, setEditingItem] = useState<NewsItem | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    title_en: "",
    description: "",
    description_en: "",
    keywords: ""
  });

  const { data: results, isLoading, error } = useQuery({
    queryKey: ['admin-news-search', activeSearch],
    queryFn: async () => {
      if (!activeSearch || !activeSearch.value.trim()) return [];

      const searchValue = activeSearch.value.trim();

      if (activeSearch.type === 'id') {
        // Try exact ID match first (works for UUID)
        const { data: exactMatch, error: exactError } = await supabase
          .from('news_rss_items')
          .select(`
            id, title, title_en, description, description_en, keywords, slug, published_at, created_at,
            country:news_countries(code, name, flag)
          `)
          .eq('id', searchValue)
          .limit(1);

        if (!exactError && exactMatch && exactMatch.length > 0) {
          return exactMatch as unknown as NewsItem[];
        }

        // If no exact match, try partial ID search using text search
        const { data: partialMatch, error: partialError } = await supabase
          .from('news_rss_items')
          .select(`
            id, title, title_en, description, description_en, keywords, slug, published_at, created_at,
            country:news_countries(code, name, flag)
          `)
          .ilike('id', `%${searchValue}%`)
          .order('created_at', { ascending: false })
          .limit(50);

        if (partialError) throw partialError;
        return (partialMatch || []) as unknown as NewsItem[];
      } else {
        // Text search in title
        const { data, error } = await supabase
          .from('news_rss_items')
          .select(`
            id, title, title_en, description, description_en, keywords, slug, published_at, created_at,
            country:news_countries(code, name, flag)
          `)
          .or(`title.ilike.%${searchValue}%,title_en.ilike.%${searchValue}%`)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        return (data || []) as unknown as NewsItem[];
      }
    },
    enabled: !!activeSearch?.value.trim(),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<NewsItem> }) => {
      const { error } = await supabase
        .from('news_rss_items')
        .update(data.updates)
        .eq('id', data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Новину оновлено" });
      queryClient.invalidateQueries({ queryKey: ['admin-news-search'] });
      setEditingItem(null);
    },
    onError: (error) => {
      toast({ 
        title: "Помилка", 
        description: (error as Error).message,
        variant: "destructive" 
      });
    }
  });

  const handleSearchById = () => {
    if (searchId.trim()) {
      setActiveSearch({ type: 'id', value: searchId.trim() });
    }
  };

  const handleSearchByText = () => {
    if (searchText.trim()) {
      setActiveSearch({ type: 'text', value: searchText.trim() });
    }
  };

  const openEditDialog = (item: NewsItem) => {
    setEditingItem(item);
    setEditForm({
      title: item.title || "",
      title_en: item.title_en || "",
      description: item.description || "",
      description_en: item.description_en || "",
      keywords: item.keywords?.join(", ") || ""
    });
  };

  const handleSave = () => {
    if (!editingItem) return;
    
    const keywords = editForm.keywords
      .split(",")
      .map(k => k.trim())
      .filter(k => k.length > 0);

    updateMutation.mutate({
      id: editingItem.id,
      updates: {
        title: editForm.title,
        title_en: editForm.title_en || null,
        description: editForm.description || null,
        description_en: editForm.description_en || null,
        keywords: keywords.length > 0 ? keywords : null
      }
    });
  };

  return (
    <Card className="cosmic-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="w-5 h-5 text-primary" />
          Пошук новин
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Search by ID */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Пошук по ID (повний або частковий UUID)</label>
          <div className="flex gap-2">
            <Input
              placeholder="UUID або частина UUID..."
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchById()}
              className="font-mono text-sm"
            />
            <Button onClick={handleSearchById} disabled={isLoading}>
              {isLoading && activeSearch?.type === 'id' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Search by text */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Пошук по тексту</label>
          <div className="flex gap-2">
            <Input
              placeholder="Заголовок новини..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchByText()}
            />
            <Button onClick={handleSearchByText} disabled={isLoading}>
              {isLoading && activeSearch?.type === 'text' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-destructive">
            Помилка: {(error as Error).message}
          </p>
        )}

        {/* Results */}
        {results && results.length > 0 && (
          <div className="space-y-3 mt-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              Знайдено: {results.length}
            </h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {results.map((item) => (
                <Card key={item.id} className="p-3 hover:bg-accent/50 transition-colors">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-2">{item.title}</p>
                        {item.title_en && (
                          <p className="text-xs text-muted-foreground line-clamp-1">{item.title_en}</p>
                        )}
                      </div>
                      {item.country && (
                        <Badge variant="secondary" className="shrink-0">
                          {item.country.flag} {item.country.code}
                        </Badge>
                      )}
                    </div>
                    
                    {/* Keywords */}
                    {item.keywords && item.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {item.keywords.slice(0, 5).map((kw, i) => (
                          <Badge key={i} variant="outline" className="text-[10px]">
                            {kw}
                          </Badge>
                        ))}
                        {item.keywords.length > 5 && (
                          <Badge variant="outline" className="text-[10px]">
                            +{item.keywords.length - 5}
                          </Badge>
                        )}
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {item.published_at 
                        ? format(new Date(item.published_at), 'dd.MM.yyyy HH:mm')
                        : format(new Date(item.created_at), 'dd.MM.yyyy HH:mm')
                      }
                      <code className="text-[10px] bg-muted px-1 rounded truncate max-w-[200px]">
                        {item.id}
                      </code>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        variant="default" 
                        size="sm"
                        onClick={() => openEditDialog(item)}
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Редагувати
                      </Button>
                      {item.slug && item.country && (
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/news/${item.country.code.toLowerCase()}/${item.slug}`}>
                            <ExternalLink className="w-3 h-3 mr-1" />
                            Відкрити
                          </Link>
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(item.id);
                          toast({ title: "ID скопійовано" });
                        }}
                      >
                        <FileText className="w-3 h-3 mr-1" />
                        ID
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {results && results.length === 0 && activeSearch && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Нічого не знайдено
          </p>
        )}
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5" />
              Редагування новини
            </DialogTitle>
          </DialogHeader>
          
          {editingItem && (
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground font-mono">
                ID: {editingItem.id}
              </div>

              <div className="space-y-2">
                <Label>Заголовок (UA)</Label>
                <Textarea
                  value={editForm.title}
                  onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Заголовок (EN)</Label>
                <Textarea
                  value={editForm.title_en}
                  onChange={(e) => setEditForm(prev => ({ ...prev, title_en: e.target.value }))}
                  rows={2}
                  placeholder="English title..."
                />
              </div>

              <div className="space-y-2">
                <Label>Опис (UA)</Label>
                <Textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  placeholder="Короткий опис новини..."
                />
              </div>

              <div className="space-y-2">
                <Label>Опис (EN)</Label>
                <Textarea
                  value={editForm.description_en}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description_en: e.target.value }))}
                  rows={3}
                  placeholder="Short description..."
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  Ключові слова (через кому)
                </Label>
                <Input
                  value={editForm.keywords}
                  onChange={(e) => setEditForm(prev => ({ ...prev, keywords: e.target.value }))}
                  placeholder="слово1, слово2, слово3..."
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>
              <X className="w-4 h-4 mr-2" />
              Скасувати
            </Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Зберегти
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
