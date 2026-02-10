import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Plus, Loader2, Globe, User, Building2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAdminStore } from "@/stores/adminStore";
import { useLanguage } from "@/contexts/LanguageContext";
import { callEdgeFunction } from "@/lib/api";
import { toast } from "sonner";
import { Link as RouterLink } from "react-router-dom";

interface AdminTextSelectionPopoverProps {
  children: React.ReactNode;
  /** News item ID to link the entity to (optional) */
  newsId?: string;
  /** Callback after entity is added/linked */
  onEntityAdded?: () => void;
}

interface SearchResult {
  id?: string;
  name: string;
  description?: string;
  image_url?: string;
  entity_type?: string;
  wiki_url?: string;
  slug?: string;
  exists_in_db?: boolean;
}

export function AdminTextSelectionPopover({ children, newsId, onEntityAdded }: AdminTextSelectionPopoverProps) {
  const { isAuthenticated: isAdmin } = useAdminStore();
  const { language } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const [selectedText, setSelectedText] = useState("");
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const closePopover = useCallback(() => {
    setPopoverPos(null);
    setSelectedText("");
    setResults([]);
    setShowResults(false);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    const handleMouseUp = (e: MouseEvent) => {
      // Ignore clicks inside the popover itself
      if (popoverRef.current?.contains(e.target as Node)) return;

      const selection = window.getSelection();
      const text = selection?.toString().trim();

      if (text && text.length >= 2 && text.length <= 100 && containerRef.current?.contains(selection?.anchorNode as Node)) {
        const range = selection!.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const containerRect = containerRef.current!.getBoundingClientRect();

        setSelectedText(text);
        setPopoverPos({
          x: rect.left - containerRect.left + rect.width / 2,
          y: rect.top - containerRect.top - 8,
        });
        setResults([]);
        setShowResults(false);
      } else if (!popoverRef.current?.contains(e.target as Node)) {
        closePopover();
      }
    };

    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, [isAdmin, closePopover]);

  const searchWikipedia = async () => {
    if (!selectedText) return;
    setSearching(true);
    setShowResults(true);
    try {
      const result = await callEdgeFunction<any>('search-wiki', {
        action: 'search_multiple',
        query: selectedText,
        language: language === 'uk' ? 'uk' : language === 'pl' ? 'pl' : 'en',
      });
      setResults(result.results || []);
      if (!result.results?.length) {
        toast.info(language === 'uk' ? 'Нічого не знайдено' : 'No results found');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSearching(false);
    }
  };

  const saveAndLink = async (item: SearchResult) => {
    const key = item.wiki_url || item.name;
    setSaving(key);
    try {
      let entityId = item.id;

      // Save entity to DB if not exists
      if (!item.exists_in_db) {
        const saveResult = await callEdgeFunction<any>('search-wiki', {
          action: 'save_entity',
          entity: {
            wiki_id: (item as any).wiki_id || `manual_${Date.now()}`,
            name: item.name,
            name_en: (item as any).name_en,
            description: item.description,
            description_en: (item as any).description_en,
            entity_type: item.entity_type || 'other',
            image_url: item.image_url,
            wiki_url: item.wiki_url || '',
            wiki_url_en: (item as any).wiki_url_en,
            extract: (item as any).extract,
            extract_en: (item as any).extract_en,
            raw_data: (item as any).raw_data || {},
          },
          language: language === 'uk' ? 'uk' : language === 'pl' ? 'pl' : 'en',
        });
        if (!saveResult.success) {
          // If entity exists, use existing ID
          if (saveResult.existingId) {
            entityId = saveResult.existingId;
          } else {
            throw new Error(saveResult.error);
          }
        } else {
          entityId = saveResult.id;
        }
      }

      // Link to news if newsId provided
      if (newsId && entityId) {
        const { supabase } = await import("@/integrations/supabase/client");
        const { error } = await supabase
          .from('news_wiki_entities')
          .upsert({
            news_item_id: newsId,
            wiki_entity_id: item.id,
            match_term: selectedText,
            match_source: 'manual',
          }, { onConflict: 'news_item_id,wiki_entity_id' });
        
        if (error && !error.message.includes('duplicate')) {
          console.error('Link error:', error);
        }
      }

      toast.success(language === 'uk' ? 'Сутність додано' : 'Entity added');
      closePopover();
      onEntityAdded?.();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(null);
    }
  };

  if (!isAdmin) return <>{children}</>;

  return (
    <div ref={containerRef} className="relative">
      {children}
      {popoverPos && (
        <div
          ref={popoverRef}
          className="absolute z-50 bg-popover border border-border rounded-lg shadow-lg p-2 min-w-[200px] max-w-[360px]"
          style={{
            left: `${popoverPos.x}px`,
            top: `${popoverPos.y}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          {/* Header with selected text */}
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="text-xs truncate max-w-[200px]">
              «{selectedText}»
            </Badge>
            <Button
              variant="default"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={searchWikipedia}
              disabled={searching}
            >
              {searching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
              Wiki
            </Button>
          </div>

          {/* Results */}
          {showResults && (
            <div className="max-h-[250px] overflow-y-auto space-y-1">
              {searching && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              )}
              {!searching && results.map((item, i) => (
                <div
                  key={item.wiki_url || i}
                  className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors"
                >
                  {item.image_url ? (
                    <img src={item.image_url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                      {item.entity_type === 'person' ? <User className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{item.name}</p>
                    {item.description && (
                      <p className="text-[10px] text-muted-foreground line-clamp-1">{item.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {item.exists_in_db && item.slug && (
                      <RouterLink to={`/wiki/${item.slug}`} className="text-primary">
                        <Link2 className="w-3 h-3" />
                      </RouterLink>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => saveAndLink(item)}
                      disabled={saving === (item.wiki_url || item.name)}
                    >
                      {saving === (item.wiki_url || item.name) ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Plus className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
              {!searching && results.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  {language === 'uk' ? 'Результатів не знайдено' : 'No results'}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
