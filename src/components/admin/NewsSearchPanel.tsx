import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, ExternalLink, Calendar, Loader2, FileText, Edit, Save, X, Tag, Trash2, Filter } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
  url?: string;
  external_id?: string | null;
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
  const [searchUrl, setSearchUrl] = useState("");
  const [searchExternalId, setSearchExternalId] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [activeSearch, setActiveSearch] = useState<{ type: 'id' | 'text' | 'url' | 'external_id'; value: string } | null>(null);
  const [editingItem, setEditingItem] = useState<NewsItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<NewsItem | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    title_en: "",
    description: "",
    description_en: "",
    keywords: ""
  });

  // Fetch countries for filter
  const { data: countries } = useQuery({
    queryKey: ['admin-news-countries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news_countries')
        .select('id, code, name, flag')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data;
    }
  });

  // Get unique categories
  const { data: categories } = useQuery({
    queryKey: ['admin-news-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news_rss_items')
        .select('category')
        .not('category', 'is', null)
        .limit(1000);
      if (error) throw error;
      const uniqueCategories = [...new Set(data.map(d => d.category).filter(Boolean))];
      return uniqueCategories.sort();
    }
  });

  const { data: results, isLoading, error } = useQuery({
    queryKey: ['admin-news-search', activeSearch, selectedCountry, selectedCategory],
    queryFn: async () => {
      if (!activeSearch || !activeSearch.value.trim()) return [];

      const searchValue = activeSearch.value.trim();
      const baseSelect = `
        id, title, title_en, description, description_en, keywords, slug, published_at, created_at, category, url, external_id,
        country:news_countries(code, name, flag)
      `;

      if (activeSearch.type === 'id') {
        // Try exact ID match first (works for UUID)
        let query = supabase
          .from('news_rss_items')
          .select(baseSelect)
          .eq('id', searchValue)
          .limit(1);

        const { data: exactMatch, error: exactError } = await query;

        if (!exactError && exactMatch && exactMatch.length > 0) {
          return exactMatch as unknown as NewsItem[];
        }

        // If no exact match, try partial ID search
        let partialQuery = supabase
          .from('news_rss_items')
          .select(baseSelect)
          .ilike('id', `%${searchValue}%`);

        if (selectedCountry !== 'all') {
          partialQuery = partialQuery.eq('country_id', selectedCountry);
        }
        if (selectedCategory !== 'all') {
          partialQuery = partialQuery.eq('category', selectedCategory);
        }

        const { data: partialMatch, error: partialError } = await partialQuery
          .order('created_at', { ascending: false })
          .limit(50);

        if (partialError) throw partialError;
        return (partialMatch || []) as unknown as NewsItem[];
      } else if (activeSearch.type === 'url') {
        // Search by URL
        let query = supabase
          .from('news_rss_items')
          .select(baseSelect)
          .ilike('url', `%${searchValue}%`);

        if (selectedCountry !== 'all') {
          query = query.eq('country_id', selectedCountry);
        }
        if (selectedCategory !== 'all') {
          query = query.eq('category', selectedCategory);
        }

        const { data, error } = await query
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        return (data || []) as unknown as NewsItem[];
      } else if (activeSearch.type === 'external_id') {
        // Search by external_id (Source ID)
        let query = supabase
          .from('news_rss_items')
          .select(baseSelect)
          .ilike('external_id', `%${searchValue}%`);

        if (selectedCountry !== 'all') {
          query = query.eq('country_id', selectedCountry);
        }
        if (selectedCategory !== 'all') {
          query = query.eq('category', selectedCategory);
        }

        const { data, error } = await query
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        return (data || []) as unknown as NewsItem[];
      } else {
        // Text search in title
        let query = supabase
          .from('news_rss_items')
          .select(baseSelect)
          .or(`title.ilike.%${searchValue}%,title_en.ilike.%${searchValue}%`);

        if (selectedCountry !== 'all') {
          query = query.eq('country_id', selectedCountry);
        }
        if (selectedCategory !== 'all') {
          query = query.eq('category', selectedCategory);
        }

        const { data, error } = await query
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Delete related records first
      await supabase.from('news_wiki_entities').delete().eq('news_item_id', id);
      
      // Check if there are outrage_ink records
      const { data: outrageInk } = await supabase
        .from('outrage_ink')
        .select('id')
        .eq('news_item_id', id);
      
      if (outrageInk && outrageInk.length > 0) {
        const inkIds = outrageInk.map(i => i.id);
        await supabase.from('outrage_ink_votes').delete().in('outrage_ink_id', inkIds);
        await supabase.from('outrage_ink_entities').delete().in('outrage_ink_id', inkIds);
        await supabase.from('outrage_ink').delete().eq('news_item_id', id);
      }
      
      // Delete the news item
      const { error } = await supabase
        .from('news_rss_items')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Новину видалено" });
      queryClient.invalidateQueries({ queryKey: ['admin-news-search'] });
      setDeleteItem(null);
    },
    onError: (error) => {
      toast({ 
        title: "Помилка видалення", 
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

  const handleSearchByUrl = () => {
    if (searchUrl.trim()) {
      setActiveSearch({ type: 'url', value: searchUrl.trim() });
    }
  };

  const handleSearchByExternalId = () => {
    if (searchExternalId.trim()) {
      setActiveSearch({ type: 'external_id', value: searchExternalId.trim() });
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

        {/* Search by URL */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Пошук по URL</label>
          <div className="flex gap-2">
            <Input
              placeholder="Посилання на новину..."
              value={searchUrl}
              onChange={(e) => setSearchUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchByUrl()}
              className="text-sm"
            />
            <Button onClick={handleSearchByUrl} disabled={isLoading}>
              {isLoading && activeSearch?.type === 'url' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Search by External ID (Source ID) */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Пошук по Source ID (external_id)</label>
          <div className="flex gap-2">
            <Input
              placeholder="ID з блоку Source..."
              value={searchExternalId}
              onChange={(e) => setSearchExternalId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchByExternalId()}
              className="font-mono text-sm"
            />
            <Button onClick={handleSearchByExternalId} disabled={isLoading}>
              {isLoading && activeSearch?.type === 'external_id' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Країна
            </label>
            <Select value={selectedCountry} onValueChange={setSelectedCountry}>
              <SelectTrigger>
                <SelectValue placeholder="Всі країни" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Всі країни</SelectItem>
                {countries?.map((country) => (
                  <SelectItem key={country.id} value={country.id}>
                    {country.flag} {country.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Категорія
            </label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Всі категорії" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Всі категорії</SelectItem>
                {categories?.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

                    <div className="flex flex-wrap gap-2">
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
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => setDeleteItem(item)}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Видалити
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Видалити новину?</AlertDialogTitle>
            <AlertDialogDescription>
              Ця дія незворотна. Новину та всі пов'язані дані (картинки, голоси) буде видалено назавжди.
              <div className="mt-2 p-2 bg-muted rounded text-sm">
                <strong>{deleteItem?.title}</strong>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteItem && deleteMutation.mutate(deleteItem.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Видалити
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
