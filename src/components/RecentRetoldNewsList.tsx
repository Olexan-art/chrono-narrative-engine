import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, FileText, MessageSquare, Twitter, ListChecks, Database, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { uk } from "date-fns/locale";

interface RecentRetoldNewsItem {
  id: string;
  title: string;
  slug: string | null;
  country_code: string;
  country_flag: string;
  fetched_at: string;
  // Content indicators
  hasRetold: boolean;
  hasKeyPoints: boolean;
  hasDialogue: boolean;
  hasTweets: boolean;
  isCached: boolean;
}

export function RecentRetoldNewsList() {
  const { data: recentNews = [], isLoading } = useQuery({
    queryKey: ['recent-retold-news'],
    queryFn: async () => {
      // Fetch news items that have been retold (content_en > 300 chars for US, content > 500 for others)
      const { data: newsItems, error } = await supabase
        .from('news_rss_items')
        .select(`
          id, 
          title, 
          slug,
          fetched_at,
          content,
          content_en,
          content_hi,
          key_points,
          key_points_en,
          chat_dialogue,
          tweets,
          country:news_countries!inner(code, flag)
        `)
        .eq('is_archived', false)
        .order('fetched_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Get cached pages for matching
      const { data: cachedPages } = await supabase
        .from('cached_pages')
        .select('path')
        .like('path', '/news/%');

      const cachedPaths = new Set(cachedPages?.map(p => p.path) || []);

      // Filter to only retold items and map
      const retoldItems: RecentRetoldNewsItem[] = [];

      for (const item of newsItems || []) {
        const country = item.country as unknown as { code: string; flag: string };
        const countryCode = country?.code || 'US';
        
        // Check if retold based on country config
        let hasRetold = false;
        if (countryCode === 'US') {
          hasRetold = (item.content_en?.length || 0) > 300;
        } else if (countryCode === 'IN') {
          hasRetold = (item.content_hi?.length || 0) > 300;
        } else {
          // PL, UA - check native content
          hasRetold = (item.content?.length || 0) > 500;
        }

        // Skip non-retold items
        if (!hasRetold) continue;

        // Check key points
        const keyPoints = item.key_points as unknown;
        const keyPointsEn = item.key_points_en as unknown;
        const hasKeyPoints = 
          (Array.isArray(keyPoints) && keyPoints.length > 0) ||
          (Array.isArray(keyPointsEn) && keyPointsEn.length > 0);

        // Check dialogue
        const dialogue = item.chat_dialogue as unknown;
        const hasDialogue = Array.isArray(dialogue) && dialogue.length > 0;

        // Check tweets
        const tweets = item.tweets as unknown;
        const hasTweets = Array.isArray(tweets) && tweets.length > 0;

        // Check cache
        const newsPath = `/news/${countryCode.toLowerCase()}/${item.slug}`;
        const isCached = cachedPaths.has(newsPath);

        retoldItems.push({
          id: item.id,
          title: item.title,
          slug: item.slug,
          country_code: countryCode,
          country_flag: country?.flag || '🌍',
          fetched_at: item.fetched_at,
          hasRetold,
          hasKeyPoints,
          hasDialogue,
          hasTweets,
          isCached,
        });
      }

      return retoldItems.slice(0, 30); // Return top 30
    },
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <Card className="cosmic-card">
        <CardContent className="pt-6 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="cosmic-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="w-4 h-4 text-primary" />
          Останні переказані новини
        </CardTitle>
        <CardDescription>Новини з AI-контентом (показано {recentNews.length})</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-2">
            {recentNews.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Немає переказаних новин</p>
            ) : (
              recentNews.map((news) => (
                <div 
                  key={news.id} 
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  {/* Country flag */}
                  <span className="text-lg shrink-0">{news.country_flag}</span>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Title */}
                    <p className="text-sm font-medium line-clamp-2 leading-tight">
                      {news.title}
                    </p>
                    
                    {/* Badges row */}
                    <div className="flex flex-wrap gap-1.5">
                      {/* Retold */}
                      <Badge 
                        variant="outline" 
                        className="text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border-blue-500/30"
                      >
                        <FileText className="w-2.5 h-2.5 mr-0.5" />
                        Переказ
                      </Badge>
                      
                      {/* Key points */}
                      {news.hasKeyPoints && (
                        <Badge 
                          variant="outline" 
                          className="text-[10px] px-1.5 py-0.5 bg-purple-500/10 text-purple-400 border-purple-500/30"
                        >
                          <ListChecks className="w-2.5 h-2.5 mr-0.5" />
                          Тези
                        </Badge>
                      )}
                      
                      {/* Dialogue */}
                      {news.hasDialogue && (
                        <Badge 
                          variant="outline" 
                          className="text-[10px] px-1.5 py-0.5 bg-green-500/10 text-green-400 border-green-500/30"
                        >
                          <MessageSquare className="w-2.5 h-2.5 mr-0.5" />
                          Діалоги
                        </Badge>
                      )}
                      
                      {/* Tweets */}
                      {news.hasTweets && (
                        <Badge 
                          variant="outline" 
                          className="text-[10px] px-1.5 py-0.5 bg-sky-500/10 text-sky-400 border-sky-500/30"
                        >
                          <Twitter className="w-2.5 h-2.5 mr-0.5" />
                          Твіти
                        </Badge>
                      )}
                      
                      {/* Cached */}
                      {news.isCached && (
                        <Badge 
                          variant="outline" 
                          className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border-amber-500/30"
                        >
                          <Database className="w-2.5 h-2.5 mr-0.5" />
                          Кеш
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {/* Time + Link */}
                  <div className="shrink-0 text-right space-y-1">
                    <span className="text-[10px] text-muted-foreground block">
                      {formatDistanceToNow(new Date(news.fetched_at), { addSuffix: true, locale: uk })}
                    </span>
                    {news.slug && (
                      <a 
                        href={`/news/${news.country_code.toLowerCase()}/${news.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-[10px] text-primary hover:underline"
                      >
                        <ExternalLink className="w-2.5 h-2.5 mr-0.5" />
                        Відкрити
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
