import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2, Calendar, Image as ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface NewsItem {
  id: string;
  title: string;
  description: string | null;
  url: string;
  image_url: string | null;
  published_at: string | null;
  fetched_at: string;
  category: string | null;
}

interface FeedNewsViewerProps {
  feedId: string;
  feedName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function FeedNewsViewer({ feedId, feedName, isOpen, onClose }: FeedNewsViewerProps) {
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['feed-news-items', feedId, page],
    queryFn: async () => {
      const { data: items, error, count } = await supabase
        .from('news_rss_items')
        .select('id, title, description, url, image_url, published_at, fetched_at, category', { count: 'exact' })
        .eq('feed_id', feedId)
        .order('published_at', { ascending: false, nullsFirst: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (error) throw error;
      return { items: items as NewsItem[], totalCount: count || 0 };
    },
    enabled: isOpen && !!feedId
  });

  const totalPages = Math.ceil((data?.totalCount || 0) / pageSize);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return null;
      return date.toLocaleString('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Новини з каналу: {feedName}
          </DialogTitle>
          <DialogDescription>
            Всього {data?.totalCount || 0} новин
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : !data?.items?.length ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>Ще немає завантажених новин з цього каналу</p>
          </div>
        ) : (
          <>
            <ScrollArea className="h-[60vh] pr-4">
              <div className="space-y-3">
                {data.items.map((item) => (
                  <div 
                    key={item.id} 
                    className="flex gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    {item.image_url ? (
                      <img 
                        src={item.image_url} 
                        alt="" 
                        className="w-20 h-20 object-cover rounded-md flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-20 h-20 bg-muted rounded-md flex items-center justify-center flex-shrink-0">
                        <ImageIcon className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium text-sm line-clamp-2">{item.title}</h4>
                        <a 
                          href={item.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary flex-shrink-0"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                      {item.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {item.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.category && (
                          <Badge variant="outline" className="text-xs">
                            {item.category}
                          </Badge>
                        )}
                        {item.published_at && formatDate(item.published_at) && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(item.published_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t">
                <span className="text-sm text-muted-foreground">
                  Сторінка {page + 1} з {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0 || isFetching}
                  >
                    Назад
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1 || isFetching}
                  >
                    Далі
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
