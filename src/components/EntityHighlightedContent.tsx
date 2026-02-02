import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, User, Building2, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

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
  match_term: string | null;
  wiki_entity: WikiEntity;
}

interface EntityHighlightedContentProps {
  newsId: string;
  content: string;
  className?: string;
}

export function EntityHighlightedContent({ newsId, content, className }: EntityHighlightedContentProps) {
  const { language } = useLanguage();

  // Fetch linked entities for this news
  const { data: entityLinks } = useQuery({
    queryKey: ['news-entities-for-highlight', newsId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news_wiki_entities')
        .select(`
          match_term,
          wiki_entity:wiki_entities(
            id, wiki_id, entity_type, name, name_en,
            description, description_en, image_url,
            wiki_url, wiki_url_en, extract, extract_en
          )
        `)
        .eq('news_item_id', newsId);

      if (error) {
        console.error('Error fetching entities for highlight:', error);
        return [];
      }

      return data
        .filter(d => d.wiki_entity)
        .map(d => ({
          match_term: d.match_term,
          wiki_entity: d.wiki_entity as WikiEntity
        })) as NewsWikiLink[];
    },
    enabled: !!newsId && !!content,
    staleTime: 1000 * 60 * 10,
  });

  // Build highlighted content with tooltips
  const highlightedContent = useMemo(() => {
    if (!entityLinks || entityLinks.length === 0 || !content) {
      return null;
    }

    // Build search terms from entities (name + name_en + match_term)
    const searchTerms: { term: string; entity: WikiEntity }[] = [];
    
    for (const link of entityLinks) {
      const entity = link.wiki_entity;
      // Add main name
      if (entity.name) {
        searchTerms.push({ term: entity.name, entity });
      }
      // Add English name if different
      if (entity.name_en && entity.name_en !== entity.name) {
        searchTerms.push({ term: entity.name_en, entity });
      }
      // Add match term if provided and different
      if (link.match_term && link.match_term !== entity.name && link.match_term !== entity.name_en) {
        searchTerms.push({ term: link.match_term, entity });
      }
    }

    // Sort by term length (longer first) to avoid partial matches
    searchTerms.sort((a, b) => b.term.length - a.term.length);

    // Build regex pattern for all terms
    const escapedTerms = searchTerms.map(t => 
      t.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    
    if (escapedTerms.length === 0) return null;

    const pattern = new RegExp(`(${escapedTerms.join('|')})`, 'gi');
    
    // Split content by matches
    const parts = content.split(pattern);
    
    return parts.map((part, index) => {
      // Check if this part matches any entity
      const matchedTerm = searchTerms.find(
        t => t.term.toLowerCase() === part.toLowerCase()
      );

      if (matchedTerm) {
        const entity = matchedTerm.entity;
        const name = language === 'en' && entity.name_en ? entity.name_en : entity.name;
        const description = language === 'en' && entity.description_en ? entity.description_en : entity.description;
        const wikiUrl = language === 'en' && entity.wiki_url_en ? entity.wiki_url_en : entity.wiki_url;
        const extract = language === 'en' && entity.extract_en ? entity.extract_en : entity.extract;

        const getEntityIcon = () => {
          switch (entity.entity_type) {
            case 'person': return <User className="w-3 h-3" />;
            case 'company': return <Building2 className="w-3 h-3" />;
            default: return <Globe className="w-3 h-3" />;
          }
        };

        return (
          <TooltipProvider key={index} delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="border-b border-dotted border-primary/50 text-primary cursor-help hover:border-primary hover:text-primary/80 transition-colors">
                  {part}
                </span>
              </TooltipTrigger>
              <TooltipContent 
                side="top" 
                align="center" 
                className="max-w-sm p-0 overflow-hidden"
              >
                <div className="p-3 space-y-2">
                  <div className="flex gap-3">
                    {entity.image_url && (
                      <img 
                        src={entity.image_url} 
                        alt="" 
                        className="w-12 h-12 rounded object-cover flex-shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 gap-0.5">
                          {getEntityIcon()}
                        </Badge>
                        <span className="font-semibold text-sm">{name}</span>
                      </div>
                      {description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
                      )}
                    </div>
                  </div>
                  {extract && (
                    <p className="text-xs text-muted-foreground line-clamp-3 border-t pt-2">
                      {extract.slice(0, 200)}...
                    </p>
                  )}
                  <a 
                    href={wikiUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Wikipedia <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }

      return part;
    });
  }, [content, entityLinks, language]);

  // If no entities to highlight, return plain content
  if (!highlightedContent) {
    return <div className={className}>{content}</div>;
  }

  return <div className={className}>{highlightedContent}</div>;
}
