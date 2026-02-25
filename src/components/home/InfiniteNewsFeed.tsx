import { memo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { uk, enUS, pl } from "date-fns/locale";
import { Link } from "react-router-dom";
import { Newspaper, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { OptimizedImage } from "@/components/OptimizedImage";
import { NewsVoteCompact } from "@/components/NewsVoteBlock";
import { NewsLogoMosaic } from "@/components/NewsLogoMosaic";

const PAGE_SIZE = 28;

interface NewsItem {
  id: string;
  title: string;
  title_en: string | null;
  description: string | null;
  description_en: string | null;
  image_url: string | null;
  url: string;
  published_at: string | null;
  slug: string | null;
  category: string | null;
  likes: number;
  dislikes: number;
  news_rss_feeds?: { name: string };
  country: { id: string; code: string; name: string; name_en: string | null; flag: string };
}

export const InfiniteNewsFeed = memo(function InfiniteNewsFeed() {
  const { t, language } = useLanguage();
  const dateLocale = language === "en" ? enUS : language === "pl" ? pl : uk;
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (page === 1) return;
    const el = document.getElementById("latest-news-section");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [page]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["paginated-news-feed", language, page],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data: items, count } = await supabase
        .from("news_rss_items")
        .select(`id, title, title_en, description, description_en, image_url, url, published_at, slug, category, likes, dislikes, news_rss_feeds(name), country:news_countries(id, code, name, name_en, flag)`, { count: "exact" })
        .not("slug", "is", null)
        .order("published_at", { ascending: false })
        .range(from, to);
      return { items: (items || []) as NewsItem[], totalCount: count || 0 };
    },
    staleTime: 1000 * 60 * 2,
  });

  const news = data?.items || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const getPageNumbers = (): (number | "...")[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [1];
    if (page > 3) pages.push("...");
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  };

  if (isLoading) {
    return (
      <section className="py-8 md:py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2 mb-6">
            <Newspaper className="w-5 h-5 text-primary" />
            <h2 className="text-lg md:text-xl font-bold">{t("rss_news.latest")}</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
          </div>
        </div>
      </section>
    );
  }

  if (isError || news.length === 0) return null;

  return (
    <section id="latest-news-section" className="py-8 md:py-12 border-t border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-primary" />
            {t("rss_news.latest")}
          </h2>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              {totalCount.toLocaleString()} {language === "en" ? "news" : "?????"}
            </Badge>
            {totalPages > 1 && (
              <span className="text-xs text-muted-foreground font-mono">
                {language === "en" ? `p. ${page}/${totalPages}` : `????. ${page}/${totalPages}`}
              </span>
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {news.map((item) => {
            const country = item.country;
            if (!country) return null;
            const localizedTitle = language === "en" ? (item.title_en || item.title) : item.title;
            const localizedDesc = language === "en" ? (item.description_en || item.description) : item.description;
            return (
              <Link key={item.id} to={`/news/${country.code.toLowerCase()}/${item.slug}`} className="group block">
                <article className="cosmic-card h-full border border-border/50 hover:border-primary/50 transition-all duration-200 overflow-hidden hover:shadow-lg hover:-translate-y-1">
                  <div className="relative h-32 overflow-hidden">
                    {item.image_url ? (
                      <OptimizedImage src={item.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={() => {}} fallbackSrc="" />
                    ) : (
                      <NewsLogoMosaic feedName={item.news_rss_feeds?.name} sourceUrl={item.url} className="w-full h-full" logoSize="md" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                    <div className="absolute top-2 left-2 flex items-center gap-1">
                      <span className="text-base">{country.flag}</span>
                      <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-background/80 backdrop-blur-sm">
                        {item.category || "news"}
                      </Badge>
                    </div>
                  </div>
                  <div className="p-3">
                    <h4 className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors mb-2">{localizedTitle}</h4>
                    {localizedDesc && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{localizedDesc}</p>}
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      {item.published_at && <span>{format(new Date(item.published_at), "d MMM, HH:mm", { locale: dateLocale })}</span>}
                      <ArrowRight className="w-3 h-3 group-hover:translate-x-1 group-hover:text-primary transition-all" />
                    </div>
                    <div className="mt-2 pt-2 border-t border-border/30" onClick={(e) => e.preventDefault()}>
                      <NewsVoteCompact newsId={item.id} likes={item.likes || 0} dislikes={item.dislikes || 0} />
                    </div>
                  </div>
                </article>
              </Link>
            );
          })}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1 mt-10 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="h-8 w-8 p-0">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {getPageNumbers().map((num, i) =>
              num === "..." ? (
                <span key={`e${i}`} className="px-1 text-muted-foreground text-sm">…</span>
              ) : (
                <Button key={num} variant={page === num ? "default" : "outline"} size="sm" onClick={() => setPage(num as number)} className="h-8 w-8 p-0 text-xs font-mono">
                  {num}
                </Button>
              )
            )}
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-8 w-8 p-0">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </section>
  );
});
