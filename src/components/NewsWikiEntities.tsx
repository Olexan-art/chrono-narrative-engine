import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WikiEntityCard } from "@/components/WikiEntityCard";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { callEdgeFunction } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAdminStore } from "@/stores/adminStore";

interface WikiEntity {
  id: string;
  wiki_id: string;
  entity_type: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  image_url: string | null;
  wiki_url: string;
  wiki_url_en: string | null;
  extract: string | null;
  extract_en: string | null;
}

interface NewsWikiEntitiesProps {
  newsId: string;
  title?: string;
  keywords?: string[];
  showSearchButton?: boolean;
}

export function NewsWikiEntities({ newsId, title, keywords, showSearchButton = false }: NewsWikiEntitiesProps) {
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const { isAuthenticated: isAdmin } = useAdminStore();

  // Fetch linked entities for this news
  const { data: entities, isLoading } = useQuery({
    queryKey: ['news-wiki-entities', newsId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news_wiki_entities')
        .select(`
          id,
          match_term,
          match_source,
          wiki_entity:wiki_entities(
            id, wiki_id, entity_type, name, name_en,
            description, description_en, image_url,
            wiki_url, wiki_url_en, extract, extract_en
          )
        `)
        .eq('news_item_id', newsId);

      if (error) {
        console.error('Error fetching wiki entities:', error);
        return [];
      }

      return data
        .filter(d => d.wiki_entity)
        .map(d => d.wiki_entity as WikiEntity);
    },
    enabled: !!newsId,
  });

  // Search for entities mutation
  const searchMutation = useMutation({
    mutationFn: async () => {
      const result = await callEdgeFunction<{
        success: boolean;
        entities: WikiEntity[];
        error?: string;
      }>('search-wiki', {
        newsId,
        title,
        keywords,
        language: language === 'uk' ? 'uk' : language === 'pl' ? 'pl' : 'en',
      });

      if (!result.success) {
        throw new Error(result.error || 'Search failed');
      }

      return result.entities;
    },
    onSuccess: (newEntities) => {
      if (newEntities.length > 0) {
        toast.success(
          language === 'uk' 
            ? `Знайдено ${newEntities.length} сутностей` 
            : language === 'pl'
            ? `Znaleziono ${newEntities.length} podmiotów`
            : `Found ${newEntities.length} entities`
        );
      } else {
        toast.info(
          language === 'uk' 
            ? 'Сутності не знайдено' 
            : language === 'pl'
            ? 'Nie znaleziono podmiotów'
            : 'No entities found'
        );
      }
      queryClient.invalidateQueries({ queryKey: ['news-wiki-entities', newsId] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Search error');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasEntities = entities && entities.length > 0;

  // Don't render anything if no entities and not admin
  if (!hasEntities && !isAdmin) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          {language === 'uk' ? 'Згадані сутності' : language === 'pl' ? 'Wspomniane podmioty' : 'Mentioned Entities'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {hasEntities ? (
          entities.map((entity) => (
            <WikiEntityCard key={entity.id} entity={entity} compact={entities.length > 2} />
          ))
        ) : (
          <p className="text-xs text-muted-foreground">
            {language === 'uk' 
              ? 'Сутності ще не визначені' 
              : language === 'pl' 
              ? 'Podmioty jeszcze nie zdefiniowane' 
              : 'No entities identified yet'}
          </p>
        )}

        {showSearchButton && isAdmin && (
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full mt-2"
            onClick={() => searchMutation.mutate()}
            disabled={searchMutation.isPending}
          >
            {searchMutation.isPending ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <Search className="w-3 h-3 mr-1" />
            )}
            {language === 'uk' ? 'Пошук у Wikipedia' : language === 'pl' ? 'Szukaj w Wikipedii' : 'Search Wikipedia'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
