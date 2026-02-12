import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, ExternalLink, Calendar } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface NewsItem {
  id: string;
  title: string;
  url: string;
  published_at: string;
  source: string;
  country: string;
}

export function NewsSearchPanel() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");

  const { data: news, isLoading } = useQuery({
    queryKey: ["news-search", activeSearch],
    queryFn: async () => {
      if (!activeSearch) return [];

      const { data, error } = await supabase
        .from("news_items")
        .select("id, title, url, published_at, source, country")
        .or(`title.ilike.%${activeSearch}%,source.ilike.%${activeSearch}%`)
        .order("published_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as NewsItem[];
    },
    enabled: !!activeSearch
  });

  const handleSearch = () => {
    setActiveSearch(searchQuery);
  };

  return (
    <Card className="cosmic-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="w-5 h-5" />
          Пошук новин
        </CardTitle>
        <CardDescription>
          Швидкий пошук по заголовках та джерелах новин
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Введіть пошуковий запит..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <Button onClick={handleSearch}>
            <Search className="w-4 h-4 mr-2" />
            Шукати
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Пошук...
          </div>
        ) : news && news.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Знайдено: {news.length} новин
            </p>
            {news.map((item) => (
              <div
                key={item.id}
                className="p-4 border border-primary/20 rounded-lg hover:bg-primary/5 transition-colors"
              >
                <div className="space-y-2">
                  <h3 className="font-medium">{item.title}</h3>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(item.published_at).toLocaleDateString('uk-UA')}
                    </span>
                    <span>{item.source}</span>
                    <span className="uppercase">{item.country}</span>
                  </div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1 text-sm"
                  >
                    Відкрити <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : activeSearch ? (
          <div className="text-center py-8 text-muted-foreground">
            Нічого не знайдено
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Введіть запит для пошуку
          </div>
        )}
      </CardContent>
    </Card>
  );
}
