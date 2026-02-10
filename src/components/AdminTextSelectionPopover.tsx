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
  /** Source entity ID for entity-to-entity linking (optional) */
  entityId?: string;
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
  wiki_id?: string;
  name_en?: string;
  description_en?: string;
  wiki_url_en?: string;
  extract?: string;
  extract_en?: string;
  raw_data?: Record<string, unknown>;
}

export function AdminTextSelectionPopover({ children, newsId, entityId, onEntityAdded }: AdminTextSelectionPopoverProps) {
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
      const entities = result.results || [];
      
      // Check which already exist in DB
      if (entities.length > 0) {
        const { supabase } = await import("@/integrations/supabase/client");
        const wikiIds = entities.map((e: any) => e.wiki_id).filter(Boolean);
        const { data: existing } = await supabase
          .from('wiki_entities')
          .select('id, wiki_id, slug')
          .in('wiki_id', wikiIds);
        
        const existingMap = new Map((existing || []).map(e => [e.wiki_id, e]));
        entities.forEach((e: any) => {
          const found = existingMap.get(e.wiki_id);
          if (found) {
            e.exists_in_db = true;
            e.id = found.id;
            e.slug = found.slug;
          }
        });
      }
      
      setResults(entities);
      if (!entities.length) {
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
      // Use edge function for everything (service role has write access)
      const saveResult = await callEdgeFunction<any>('search-wiki', {
        action: 'save_entity',
        entity: {
          wiki_id: item.wiki_id || `manual_${Date.now()}`,
          name: item.name,
          name_en: item.name_en,
          description: item.description,
          description_en: item.description_en,
          entity_type: item.entity_type || 'other',
          image_url: item.image_url,
          wiki_url: item.wiki_url || '',
          wiki_url_en: item.wiki_url_en,
          extract: item.extract,
          extract_en: item.extract_en,
          raw_data: item.raw_data || {},
        },
        newsId: newsId || undefined,
        sourceEntityId: entityId || undefined,
        matchTerm: selectedText,
        language: language === 'uk' ? 'uk' : language === 'pl' ? 'pl' : 'en',
      });

      if (!saveResult.success) {
        throw new Error(saveResult.error);
      }

      toast.success(language === 'uk' ? 'Сутність додано та пов\'язано' : 'Entity added & linked');
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
