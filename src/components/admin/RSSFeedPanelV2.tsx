import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Rss, Plus, Trash2, RefreshCw, ExternalLink, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { adminAction } from "@/lib/api";

interface RSSFeed {
  id: string;
  url: string;
  name: string;
  category: string;
  country_id: string;
  is_active: boolean;
  last_fetched_at: string | null;
  created_at: string;
  sample_ratio: number;
}

const CATEGORIES = [
  "politics",
  "technology",
  "business",
  "science",
  "health",
  "entertainment",
  "sports",
  "world",
  "local"
];

const COUNTRIES = [
  { code: "us", name: "США", flag: "🇺🇸" },
  { code: "ua", name: "Україна", flag: "🇺🇦" },
  { code: "gb", name: "Велика Британія", flag: "🇬🇧" },
  { code: "pl", name: "Польща", flag: "🇵🇱" },
  { code: "in", name: "Індія", flag: "🇮🇳" },
];

export function RSSFeedPanel({ password }: { password: string }) {
  console.log("RSS Feed Panel v2.0 - Loaded");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newFeed, setNewFeed] = useState({
    url: "",
    name: "",
    category: "world",
    country: "us"
  });

  // Fetch RSS feeds
  const { data: feeds, isLoading } = useQuery({
    queryKey: ["rss-feeds"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news_rss_feeds")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as RSSFeed[];
    }
  });

  // Add RSS feed mutation
  const addFeedMutation = useMutation({
    mutationFn: async (feed: typeof newFeed) => {
      // Use adminAction to bypass RLS issues
      const result = await adminAction<{ success: boolean; feed: RSSFeed }>(
        "createRSSFeed",
        password,
        {
          url: feed.url,
          name: feed.name,
          category: feed.category,
          country_id: feed.country,
          is_active: true
        }
      );

      return result.feed;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rss-feeds"] });
      setNewFeed({ url: "", name: "", category: "world", country: "us" });
      toast({ title: "RSS фід додано успішно" });
    },
    onError: (error: Error) => {
      toast({
        title: "Помилка додавання фіду",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Delete RSS feed mutation
  const deleteFeedMutation = useMutation({
    mutationFn: async (feedId: string) => {
      // Use adminAction to bypass RLS issues
      await adminAction("deleteRSSFeed", password, { id: feedId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rss-feeds"] });
      toast({ title: "RSS фід видалено" });
    },
    onError: (error: Error) => {
      toast({
        title: "Помилка видалення фіду",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Fetch RSS feed mutation
  const fetchFeedMutation = useMutation({
    mutationFn: async (feedId: string) => {
      return await adminAction("fetch-rss-feed", password, { feedId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rss-feeds"] });
      toast({ title: "RSS фід оновлено успішно" });
    },
    onError: (error: Error) => {
      toast({
        title: "Помилка оновлення фіду",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleAddFeed = () => {
    if (!newFeed.url || !newFeed.name) {
      toast({
        title: "Помилка",
        description: "Заповніть всі поля",
        variant: "destructive"
      });
      return;
    }

    // Validate URL
    try {
      new URL(newFeed.url);
    } catch {
      toast({
        title: "Помилка",
        description: "Невірний формат URL",
        variant: "destructive"
      });
      return;
    }

    addFeedMutation.mutate(newFeed);
  };

  return (
    <div className="space-y-6">
      <Card className="cosmic-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rss className="w-5 h-5" />
            RSS Feed — Новини з фідів
          </CardTitle>
          <CardDescription>
            Автоматичний імпорт новин з RSS/Atom фідів
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Add New Feed Form */}
          <div className="space-y-4 p-4 border border-primary/20 rounded-lg">
            <h3 className="font-semibold">Додати новий RSS фід</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="feed-url">URL фіду</Label>
                <Input
                  id="feed-url"
                  type="url"
                  placeholder="https://example.com/rss.xml"
                  value={newFeed.url}
                  onChange={(e) => setNewFeed({ ...newFeed, url: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="feed-name">Назва джерела</Label>
                <Input
                  id="feed-name"
                  placeholder="The Guardian"
                  value={newFeed.name}
                  onChange={(e) => setNewFeed({ ...newFeed, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="feed-category">Категорія</Label>
                <Select
                  value={newFeed.category}
                  onValueChange={(value) => setNewFeed({ ...newFeed, category: value })}
                >
                  <SelectTrigger id="feed-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="feed-country">Країна</Label>
                <Select
                  value={newFeed.country}
                  onValueChange={(value) => setNewFeed({ ...newFeed, country: value })}
                >
                  <SelectTrigger id="feed-country">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.flag} {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={handleAddFeed}
              disabled={addFeedMutation.isPending}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              {addFeedMutation.isPending ? "Додавання..." : "Додати фід"}
            </Button>
          </div>

          {/* Feeds List */}
          <div className="space-y-4">
            <h3 className="font-semibold">Активні фіди ({feeds?.length || 0})</h3>

            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Завантаження...
              </div>
            ) : feeds && feeds.length > 0 ? (
              <div className="space-y-2">
                {feeds.map((feed) => (
                  <div
                    key={feed.id}
                    className="flex items-center justify-between p-4 border border-primary/20 rounded-lg hover:bg-primary/5 transition-colors"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{feed.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {COUNTRIES.find(c => c.code === feed.country_id)?.flag}
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-primary/10 rounded">
                          {feed.category}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {feed.url}
                      </div>
                      {feed.last_fetched_at && (
                        <div className="text-xs text-muted-foreground">
                          Останнє оновлення: {new Date(feed.last_fetched_at).toLocaleString('uk-UA')}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(feed.url, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fetchFeedMutation.mutate(feed.id)}
                        disabled={fetchFeedMutation.isPending}
                      >
                        <RefreshCw className={`w-4 h-4 ${fetchFeedMutation.isPending ? 'animate-spin' : ''}`} />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteFeedMutation.mutate(feed.id)}
                        disabled={deleteFeedMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Немає доданих RSS фідів</p>
                <p className="text-sm">Додайте перший фід використовуючи форму вище</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
