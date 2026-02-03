import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, ExternalLink, Calendar, Globe, Loader2, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface NewsItem {
  id: string;
  title: string;
  title_en: string | null;
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
  const [searchId, setSearchId] = useState("");
  const [searchText, setSearchText] = useState("");
  const [activeSearch, setActiveSearch] = useState<{ type: 'id' | 'text'; value: string } | null>(null);

  const { data: results, isLoading } = useQuery({
    queryKey: ['admin-news-search', activeSearch],
    queryFn: async () => {
      if (!activeSearch || !activeSearch.value.trim()) return [];

      let query = supabase
        .from('news_rss_items')
        .select(`
          id, title, title_en, slug, published_at, created_at,
          country:news_countries(code, name, flag)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (activeSearch.type === 'id') {
        query = query.eq('id', activeSearch.value.trim());
      } else {
        query = query.or(`title.ilike.%${activeSearch.value}%,title_en.ilike.%${activeSearch.value}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as NewsItem[];
    },
    enabled: !!activeSearch?.value.trim(),
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
          <label className="text-sm font-medium">Пошук по ID</label>
          <div className="flex gap-2">
            <Input
              placeholder="UUID новини..."
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
                        onClick={() => navigator.clipboard.writeText(item.id)}
                      >
                        <FileText className="w-3 h-3 mr-1" />
                        Копіювати ID
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
    </Card>
  );
}
