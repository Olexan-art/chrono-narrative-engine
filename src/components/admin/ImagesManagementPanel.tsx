import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Image, Trash2, ExternalLink, Search, RefreshCw, ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

interface OutrageInkItem {
  id: string;
  image_url: string;
  image_prompt: string | null;
  title: string | null;
  likes: number;
  dislikes: number;
  created_at: string;
  news_item: {
    id: string;
    title: string;
    slug: string;
    country: {
      code: string;
      name: string;
      flag: string;
    };
  } | null;
}

export function ImagesManagementPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<'created_at' | 'likes' | 'dislikes'>('created_at');
  const [deleteDialog, setDeleteDialog] = useState<OutrageInkItem | null>(null);
  const [viewImage, setViewImage] = useState<OutrageInkItem | null>(null);

  const { data: images = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-outrage-ink', sortBy],
    queryFn: async () => {
      let query = supabase
        .from('outrage_ink')
        .select(`
          id, image_url, image_prompt, title, likes, dislikes, created_at,
          news_item:news_rss_items(id, title, slug, country:news_countries(code, name, flag))
        `)
        .order(sortBy, { ascending: sortBy === 'created_at' ? false : false })
        .limit(100);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as OutrageInkItem[];
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Delete related entities first
      await supabase.from('outrage_ink_entities').delete().eq('outrage_ink_id', id);
      await supabase.from('outrage_ink_votes').delete().eq('outrage_ink_id', id);
      
      const { error } = await supabase.from('outrage_ink').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Зображення видалено" });
      queryClient.invalidateQueries({ queryKey: ['admin-outrage-ink'] });
      setDeleteDialog(null);
    },
    onError: (error) => {
      toast({ 
        title: "Помилка видалення", 
        description: (error as Error).message,
        variant: "destructive" 
      });
    }
  });

  const filteredImages = images.filter(img => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      img.title?.toLowerCase().includes(searchLower) ||
      img.image_prompt?.toLowerCase().includes(searchLower) ||
      img.news_item?.title?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Image className="w-5 h-5" />
          Керування картинками ({images.length})
        </h2>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Оновити
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Пошук по заголовку, промпту або новині..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Сортування" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at">За датою</SelectItem>
            <SelectItem value="likes">За лайками</SelectItem>
            <SelectItem value="dislikes">За дизлайками</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Завантаження...</div>
      ) : filteredImages.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {search ? "Нічого не знайдено" : "Немає картинок"}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredImages.map(img => {
            const newsLink = img.news_item?.slug && (img.news_item?.country as any)?.code
              ? `/news/${(img.news_item.country as any).code.toLowerCase()}/${img.news_item.slug}`
              : null;

            return (
              <Card key={img.id} className="overflow-hidden group">
                <div className="relative aspect-square">
                  <img 
                    src={img.image_url} 
                    alt={img.title || 'Satirical image'}
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => setViewImage(img)}
                  />
                  
                  {/* Stats overlay */}
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Badge variant="secondary" className="bg-background/80">
                      <ThumbsUp className="w-3 h-3 mr-1 text-green-500" />
                      {img.likes}
                    </Badge>
                    <Badge variant="secondary" className="bg-background/80">
                      <ThumbsDown className="w-3 h-3 mr-1 text-red-500" />
                      {img.dislikes}
                    </Badge>
                  </div>

                  {/* Actions overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    {newsLink && (
                      <Link to={newsLink}>
                        <Button size="sm" variant="secondary">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </Link>
                    )}
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => setDeleteDialog(img)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <CardContent className="p-2">
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(img.created_at), 'dd.MM.yyyy HH:mm')}
                  </p>
                  {img.news_item && (
                    <p className="text-xs truncate mt-1">
                      {(img.news_item.country as any)?.flag} {img.news_item.title}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* View Image Dialog */}
      <Dialog open={!!viewImage} onOpenChange={() => setViewImage(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{viewImage?.title || 'Satirical Image'}</DialogTitle>
          </DialogHeader>
          {viewImage && (
            <div className="space-y-4">
              <img 
                src={viewImage.image_url} 
                alt={viewImage.title || 'Image'}
                className="w-full max-h-[70vh] object-contain rounded-lg"
              />
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Дата створення</p>
                  <p>{format(new Date(viewImage.created_at), 'dd.MM.yyyy HH:mm')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Статистика</p>
                  <p className="flex gap-2">
                    <span className="text-green-500">👍 {viewImage.likes}</span>
                    <span className="text-red-500">👎 {viewImage.dislikes}</span>
                  </p>
                </div>
              </div>

              {viewImage.image_prompt && (
                <div>
                  <p className="text-muted-foreground text-sm">Промпт</p>
                  <p className="text-sm bg-muted p-2 rounded">{viewImage.image_prompt}</p>
                </div>
              )}

              {viewImage.news_item && (
                <div>
                  <p className="text-muted-foreground text-sm">Пов'язана новина</p>
                  <p className="text-sm">
                    {(viewImage.news_item.country as any)?.flag} {viewImage.news_item.title}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Видалити зображення?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Цю дію неможливо скасувати. Зображення та всі пов'язані дані будуть видалені назавжди.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>
              Скасувати
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteDialog && deleteMutation.mutate(deleteDialog.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Видалення..." : "Видалити"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
