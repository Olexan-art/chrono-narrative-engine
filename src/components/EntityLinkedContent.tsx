import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { User, Building2, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

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
 * Renders markdown content with automatic highlighting of entity names.
 * Parses markdown syntax (headers, bold, italic, lists) AND links entity mentions.
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
    staleTime: 1000 * 60 * 10,
  });

  // Build entity lookup map
  const entityMap = useMemo(() => {
    const map = new Map<string, WikiEntity>();
    for (const entity of entities) {
      if (entity.name && entity.name.length >= 3) {
        map.set(entity.name.toLowerCase(), entity);
      }
      if (entity.name_en && entity.name_en !== entity.name && entity.name_en.length >= 3) {
        map.set(entity.name_en.toLowerCase(), entity);
      }
    }
    return map;
  }, [entities]);

  // Helper to get entity icon
  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case 'person': return <User className="w-3 h-3" />;
      case 'company': return <Building2 className="w-3 h-3" />;
      default: return <Globe className="w-3 h-3" />;
    }
  };

  // Parse inline text with entity linking
  const parseInlineWithEntities = (text: string, keyPrefix: string): (string | JSX.Element)[] => {
    if (!text || !entityMap.size) return [text];

    // Build regex from entity names
    const terms = Array.from(entityMap.keys()).sort((a, b) => b.length - a.length).slice(0, 50);
    if (terms.length === 0) return [text];

    const escapedTerms = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp(`\\b(${escapedTerms.join('|')})\\b`, 'gi');

    const parts = text.split(pattern);
    const linkedIds = new Set<string>();

    return parts.map((part, idx) => {
      const matchedEntity = entityMap.get(part.toLowerCase());

      if (matchedEntity && !linkedIds.has(matchedEntity.id)) {
        linkedIds.add(matchedEntity.id);
        const name = language === 'en' && matchedEntity.name_en ? matchedEntity.name_en : matchedEntity.name;
        const description = language === 'en' && matchedEntity.description_en ? matchedEntity.description_en : matchedEntity.description;

        return (
          <TooltipProvider key={`${keyPrefix}-${idx}`} delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link 
                  to={`/wiki/${matchedEntity.slug || matchedEntity.id}`}
                  className="border-b border-dotted border-primary/50 text-primary hover:border-primary hover:text-primary/80 transition-colors"
                >
                  {part}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="top" align="center" className="max-w-xs p-0 overflow-hidden">
                <div className="p-3 space-y-2">
                  <div className="flex gap-3">
                    {matchedEntity.image_url && (
                      <img src={matchedEntity.image_url} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 gap-0.5">
                          {getEntityIcon(matchedEntity.entity_type)}
                        </Badge>
                        <span className="font-semibold text-sm">{name}</span>
                      </div>
                      {description && <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>}
                    </div>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }

      return part;
    });
  };

  // Render text that may contain <ITALIC> tags + entity links
  const renderWithItalicAndEntities = (text: string, keyPrefix: string): JSX.Element => {
    const italicParts = text.split(/(<ITALIC>.*?<\/ITALIC>)/g);
    return (
      <span>
        {italicParts.map((part, idx) => {
          if (part.startsWith('<ITALIC>')) {
            const innerText = part.replace(/<\/?ITALIC>/g, '');
            return <em key={idx} className="italic">{parseInlineWithEntities(innerText, `${keyPrefix}-i${idx}`)}</em>;
          }
          return <span key={idx}>{parseInlineWithEntities(part, `${keyPrefix}-t${idx}`)}</span>;
        })}
      </span>
    );
  };

  // Parse inline markdown (bold, italic) with entity linking
  const parseInlineMarkdown = (text: string, keyPrefix: string): JSX.Element => {
    // Process bold first **text**
    let processed = text.replace(/\*\*(.*?)\*\*/g, '<BOLD>$1</BOLD>');
    // Process italic *text*
    processed = processed.replace(/(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/g, '<ITALIC>$1</ITALIC>');

    const parts = processed.split(/(<BOLD>.*?<\/BOLD>)/g);

    return (
      <span>
        {parts.map((part, idx) => {
          if (part.startsWith('<BOLD>')) {
            const innerText = part.replace(/<\/?BOLD>/g, '');
            return <strong key={idx} className="font-semibold text-foreground">{renderWithItalicAndEntities(innerText, `${keyPrefix}-b${idx}`)}</strong>;
          }
          return <span key={idx}>{renderWithItalicAndEntities(part, `${keyPrefix}-p${idx}`)}</span>;
        })}
      </span>
    );
  };

  // Build rendered content with markdown + entity linking
  const renderedContent = useMemo(() => {
    if (!content) return null;

    const lines = content.split('\n');
    const elements: JSX.Element[] = [];
    let listItems: string[] = [];
    let listType: 'ul' | 'ol' | null = null;

    const flushList = () => {
      if (listItems.length > 0 && listType) {
        const ListTag = listType;
        elements.push(
          <ListTag key={`list-${elements.length}`} className={listType === 'ul' ? "list-disc list-inside space-y-1 mb-4 text-muted-foreground" : "list-decimal list-inside space-y-1 mb-4 text-muted-foreground"}>
            {listItems.map((item, i) => <li key={i}>{parseInlineMarkdown(item, `li-${elements.length}-${i}`)}</li>)}
          </ListTag>
        );
        listItems = [];
        listType = null;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (!line) { flushList(); continue; }

      // Headers
      if (line.startsWith('####')) {
        flushList();
        elements.push(<h4 key={`h4-${i}`} className="text-base font-semibold text-foreground mt-4 mb-2">{parseInlineMarkdown(line.replace(/^####\s*/, ''), `h4-${i}`)}</h4>);
        continue;
      }
      if (line.startsWith('###')) {
        flushList();
        elements.push(<h3 key={`h3-${i}`} className="text-lg font-semibold text-foreground mt-5 mb-2">{parseInlineMarkdown(line.replace(/^###\s*/, ''), `h3-${i}`)}</h3>);
        continue;
      }
      if (line.startsWith('##')) {
        flushList();
        elements.push(<h2 key={`h2-${i}`} className="text-xl font-bold text-foreground mt-6 mb-3 border-b border-border pb-2">{parseInlineMarkdown(line.replace(/^##\s*/, ''), `h2-${i}`)}</h2>);
        continue;
      }
      if (line.startsWith('#')) {
        flushList();
        elements.push(<h1 key={`h1-${i}`} className="text-2xl font-bold text-foreground mt-6 mb-4">{parseInlineMarkdown(line.replace(/^#\s*/, ''), `h1-${i}`)}</h1>);
        continue;
      }

      // Unordered list
      if (line.startsWith('- ') || line.startsWith('* ')) {
        if (listType !== 'ul') { flushList(); listType = 'ul'; }
        listItems.push(line.substring(2));
        continue;
      }

      // Ordered list
      const orderedMatch = line.match(/^(\d+)\.\s+(.+)$/);
      if (orderedMatch) {
        if (listType !== 'ol') { flushList(); listType = 'ol'; }
        listItems.push(orderedMatch[2]);
        continue;
      }

      // Horizontal rule
      if (line === '---' || line === '***' || line === '___') {
        flushList();
        elements.push(<hr key={`hr-${i}`} className="my-6 border-border" />);
        continue;
      }

      // Blockquote
      if (line.startsWith('>')) {
        flushList();
        elements.push(
          <blockquote key={`bq-${i}`} className="border-l-4 border-primary/30 pl-4 py-2 my-4 text-muted-foreground italic bg-muted/30 rounded-r">
            {parseInlineMarkdown(line.replace(/^>\s*/, ''), `bq-${i}`)}
          </blockquote>
        );
        continue;
      }

      // Regular paragraph
      flushList();
      elements.push(<p key={`p-${i}`} className="text-muted-foreground leading-relaxed mb-3">{parseInlineMarkdown(line, `p-${i}`)}</p>);
    }

    flushList();
    return elements;
  }, [content, entityMap, language]);

  return (
    <div className={`prose prose-sm max-w-none dark:prose-invert ${className || ''}`}>
      {renderedContent}
    </div>
  );
}
