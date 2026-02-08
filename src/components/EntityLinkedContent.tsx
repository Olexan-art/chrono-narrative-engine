import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { User, Building2, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { MarkdownContent } from "@/components/MarkdownContent";

interface WikiEntity {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  image_url: string | null;
  entity_type: string;
  slug: string | null;
}

interface EntityLinkedContentProps {
  content: string;
  excludeEntityId?: string;
  className?: string;
}

/**
 * Renders markdown content with automatic highlighting of entity names
 * that exist in our wiki_entities database. Each match becomes a tooltip
 * link to the entity's profile page.
 */
export function EntityLinkedContent({ content, excludeEntityId, className }: EntityLinkedContentProps) {
  const { language } = useLanguage();

  // Fetch all entities for matching
  const { data: entities = [] } = useQuery({
    queryKey: ['all-wiki-entities-for-linking'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wiki_entities')
        .select('id, name, name_en, description, description_en, image_url, entity_type, slug')
        .order('search_count', { ascending: false })
        .limit(500);

      if (error) {
        console.error('Error fetching entities for linking:', error);
        return [];
      }

      return (data || []).filter(e => e.id !== excludeEntityId) as WikiEntity[];
    },
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
  });

  // Build highlighted content with tooltips
  const highlightedContent = useMemo(() => {
    if (!entities.length || !content) {
      return null;
    }

    // Build search terms from entities (name + name_en)
    const searchTerms: { term: string; entity: WikiEntity }[] = [];
    
    for (const entity of entities) {
      // Add main name (must be at least 3 characters to avoid false matches)
      if (entity.name && entity.name.length >= 3) {
        searchTerms.push({ term: entity.name, entity });
      }
      // Add English name if different
      if (entity.name_en && entity.name_en !== entity.name && entity.name_en.length >= 3) {
        searchTerms.push({ term: entity.name_en, entity });
      }
    }

    // Sort by term length (longer first) to avoid partial matches
    searchTerms.sort((a, b) => b.term.length - a.term.length);

    // Take only top 50 to avoid regex explosion
    const topTerms = searchTerms.slice(0, 50);

    // Build regex pattern for all terms (word boundaries)
    const escapedTerms = topTerms.map(t => 
      t.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    
    if (escapedTerms.length === 0) return null;

    // Use word boundaries to match whole words only
    const pattern = new RegExp(`\\b(${escapedTerms.join('|')})\\b`, 'gi');
    
    // Split content by matches
    const parts = content.split(pattern);
    
    // Track which entities we've already linked (avoid duplicate tooltips)
    const linkedEntities = new Set<string>();
    
    return parts.map((part, index) => {
      // Check if this part matches any entity
      const matchedTerm = topTerms.find(
        t => t.term.toLowerCase() === part.toLowerCase()
      );

      if (matchedTerm && !linkedEntities.has(matchedTerm.entity.id)) {
        linkedEntities.add(matchedTerm.entity.id);
        
        const entity = matchedTerm.entity;
        const name = language === 'en' && entity.name_en ? entity.name_en : entity.name;
        const description = language === 'en' && entity.description_en ? entity.description_en : entity.description;

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
                <Link 
                  to={`/wiki/${entity.slug || entity.id}`}
                  className="border-b border-dotted border-primary/50 text-primary hover:border-primary hover:text-primary/80 transition-colors"
                >
                  {part}
                </Link>
              </TooltipTrigger>
              <TooltipContent 
                side="top" 
                align="center" 
                className="max-w-xs p-0 overflow-hidden"
              >
                <div className="p-3 space-y-2">
                  <div className="flex gap-3">
                    {entity.image_url && (
                      <img 
                        src={entity.image_url} 
                        alt="" 
                        className="w-10 h-10 rounded object-cover flex-shrink-0"
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
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }

      // For subsequent matches of the same entity, just show plain text
      if (matchedTerm && linkedEntities.has(matchedTerm.entity.id)) {
        return part;
      }

      return part;
    });
  }, [content, entities, language]);

  // If no entities to highlight, return plain markdown
  if (!highlightedContent) {
    return <MarkdownContent content={content} className={className} />;
  }

  return <div className={className}>{highlightedContent}</div>;
}
