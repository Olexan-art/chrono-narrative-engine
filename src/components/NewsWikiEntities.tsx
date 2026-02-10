import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Loader2, Search, Sparkles, X, Pencil, Plus, Check, Link2, BrainCircuit } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface NewsWikiLink {
  id: string;
  match_term: string | null;
  match_source: string;
  wiki_entity: WikiEntity;
}

interface NewsWikiEntitiesProps {
  newsId: string;
  title?: string;
  keywords?: string[];
  showSearchButton?: boolean;
  entityNarratives?: Record<string, any>;
}

export function NewsWikiEntities({ newsId, title, keywords, showSearchButton = false, entityNarratives = {} }: NewsWikiEntitiesProps) {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const { isAuthenticated: isAdmin } = useAdminStore();
  
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newWikiUrl, setNewWikiUrl] = useState("");

  // Fetch linked entities for this news
  const { data: entityLinks, isLoading } = useQuery({
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
        .map(d => ({
          id: d.id,
          match_term: d.match_term,
          match_source: d.match_source,
          wiki_entity: d.wiki_entity as WikiEntity
        })) as NewsWikiLink[];
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

  // Update entity URL mutation
  const updateUrlMutation = useMutation({
    mutationFn: async ({ entityId, newUrl, isEnglish }: { entityId: string; newUrl: string; isEnglish: boolean }) => {
      const updateData = isEnglish 
        ? { wiki_url_en: newUrl }
        : { wiki_url: newUrl };
      
      const { error } = await supabase
        .from('wiki_entities')
        .update(updateData)
        .eq('id', entityId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(
        language === 'uk' 
          ? 'URL оновлено' 
          : language === 'pl'
          ? 'URL zaktualizowany'
          : 'URL updated'
      );
      setEditingEntityId(null);
      setEditUrl("");
      queryClient.invalidateQueries({ queryKey: ['news-wiki-entities', newsId] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Update error');
    },
  });

  // Add entity by URL mutation
  const addByUrlMutation = useMutation({
    mutationFn: async (wikiUrl: string) => {
      // Call edge function to fetch wiki data and create entity
      const result = await callEdgeFunction<{
        success: boolean;
        entity?: WikiEntity;
        error?: string;
      }>('search-wiki', {
        newsId,
        wikiUrl,
        language: language === 'uk' ? 'uk' : language === 'pl' ? 'pl' : 'en',
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to add entity');
      }

      return result.entity;
    },
    onSuccess: () => {
      toast.success(
        language === 'uk' 
          ? 'Сутність додано' 
          : language === 'pl'
          ? 'Dodano podmiot'
          : 'Entity added'
      );
      setShowAddForm(false);
      setNewWikiUrl("");
      queryClient.invalidateQueries({ queryKey: ['news-wiki-entities', newsId] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Add error');
    },
  });

  // Delete entity link mutation
  const deleteMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase
        .from('news_wiki_entities')
        .delete()
        .eq('id', linkId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(
        language === 'uk' 
          ? 'Сутність видалено' 
          : language === 'pl'
          ? 'Podmiot usunięty'
          : 'Entity removed'
      );
      queryClient.invalidateQueries({ queryKey: ['news-wiki-entities', newsId] });
      queryClient.invalidateQueries({ queryKey: ['news-with-entities'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Delete error');
    },
  });

  const handleStartEdit = (entity: WikiEntity) => {
    setEditingEntityId(entity.id);
    setEditUrl(language === 'en' && entity.wiki_url_en ? entity.wiki_url_en : entity.wiki_url);
  };

  const handleSaveUrl = (entityId: string) => {
    if (!editUrl.trim()) return;
    updateUrlMutation.mutate({ 
      entityId, 
      newUrl: editUrl.trim(),
      isEnglish: language === 'en'
    });
  };

  const handleAddByUrl = () => {
    if (!newWikiUrl.trim()) return;
    if (!newWikiUrl.includes('wikipedia.org')) {
      toast.error(
        language === 'uk' 
          ? 'Введіть коректний URL Wikipedia' 
          : language === 'pl'
          ? 'Wprowadź poprawny URL Wikipedii'
          : 'Enter a valid Wikipedia URL'
      );
      return;
    }
    addByUrlMutation.mutate(newWikiUrl.trim());
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasEntities = entityLinks && entityLinks.length > 0;

  // Don't render anything if no entities and not admin
  if (!hasEntities && !isAdmin) {
    return null;
  }

  const t_edit_url = language === 'uk' ? 'Редагувати URL' : language === 'pl' ? 'Edytuj URL' : 'Edit URL';
  const t_add_wiki = language === 'uk' ? 'Додати з Wikipedia' : language === 'pl' ? 'Dodaj z Wikipedii' : 'Add from Wikipedia';
  const t_paste_url = language === 'uk' ? 'Вставте URL Wikipedia...' : language === 'pl' ? 'Wklej URL Wikipedii...' : 'Paste Wikipedia URL...';

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
          entityLinks.map((link) => (
            <div key={link.id} className="relative group">
              {editingEntityId === link.wiki_entity.id ? (
                <div className="flex gap-2 p-2 bg-muted rounded-lg">
                  <Input
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    placeholder="Wikipedia URL"
                    className="h-8 text-xs"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-primary"
                    onClick={() => handleSaveUrl(link.wiki_entity.id)}
                    disabled={updateUrlMutation.isPending}
                  >
                    {updateUrlMutation.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Check className="w-3 h-3" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => { setEditingEntityId(null); setEditUrl(""); }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <>
                  <WikiEntityCard 
                    entity={link.wiki_entity} 
                    compact={entityLinks.length > 2} 
                    showLink={true}
                  />
                  {/* Narrative indicator */}
                  {entityNarratives[link.wiki_entity.id] && (
                    <Link
                      to={`/wiki/${link.wiki_entity.slug || link.wiki_entity.id}`}
                      className="flex items-center gap-1.5 mt-1 px-2 py-1 rounded bg-primary/5 border border-primary/15 hover:bg-primary/10 transition-colors"
                    >
                      <BrainCircuit className="w-3 h-3 text-primary animate-pulse" />
                      <span className="text-[10px] text-primary font-mono">
                        {language === 'uk' ? 'Є наратив' : 'Has narrative'}
                      </span>
                    </Link>
                  )}
                  {isAdmin && (
                    <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 bg-primary/10 hover:bg-primary/20 text-primary"
                        onClick={() => handleStartEdit(link.wiki_entity)}
                        title={t_edit_url}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 bg-destructive/10 hover:bg-destructive/20 text-destructive"
                        onClick={() => deleteMutation.mutate(link.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
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

        {/* Add by URL form */}
        {isAdmin && showAddForm && (
          <div className="flex gap-2 pt-2 border-t">
            <Input
              value={newWikiUrl}
              onChange={(e) => setNewWikiUrl(e.target.value)}
              placeholder={t_paste_url}
              className="h-8 text-xs"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-primary"
              onClick={handleAddByUrl}
              disabled={addByUrlMutation.isPending}
            >
              {addByUrlMutation.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3 h-3" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => { setShowAddForm(false); setNewWikiUrl(""); }}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}

        {/* Admin buttons */}
        {isAdmin && (
          <div className="flex gap-2 pt-2">
            {!showAddForm && (
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={() => setShowAddForm(true)}
              >
                <Link2 className="w-3 h-3 mr-1" />
                {t_add_wiki}
              </Button>
            )}
            {showSearchButton && (
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={() => searchMutation.mutate()}
                disabled={searchMutation.isPending}
              >
                {searchMutation.isPending ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Search className="w-3 h-3 mr-1" />
                )}
                {language === 'uk' ? 'Авто-пошук' : language === 'pl' ? 'Auto-wyszukiwanie' : 'Auto-search'}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
