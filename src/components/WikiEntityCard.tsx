import { Link } from "react-router-dom";
import { ExternalLink, Building2, User, Globe, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

export interface WikiEntityCardProps {
  entity: WikiEntity;
  compact?: boolean;
  showLink?: boolean;
}

export function WikiEntityCard({ entity, compact = false, showLink = false }: WikiEntityCardProps) {
  const { language } = useLanguage();
  
  const name = (language === 'en' && entity.name_en) ? entity.name_en : entity.name;
  const description = (language === 'en' && entity.description_en) ? entity.description_en : entity.description;
  const extract = (language === 'en' && entity.extract_en) ? entity.extract_en : entity.extract;
  const wikiUrl = (language === 'en' && entity.wiki_url_en) ? entity.wiki_url_en : entity.wiki_url;

  const getEntityIcon = () => {
    switch (entity.entity_type) {
      case 'person': return <User className="w-4 h-4" />;
      case 'company': return <Building2 className="w-4 h-4" />;
      default: return <Globe className="w-4 h-4" />;
    }
  };

  const getEntityLabel = () => {
    switch (entity.entity_type) {
      case 'person': return language === 'uk' ? 'Персона' : language === 'pl' ? 'Osoba' : 'Person';
      case 'company': return language === 'uk' ? 'Компанія' : language === 'pl' ? 'Firma' : 'Company';
      case 'organization': return language === 'uk' ? 'Організація' : language === 'pl' ? 'Organizacja' : 'Organization';
      default: return language === 'uk' ? 'Сутність' : language === 'pl' ? 'Podmiot' : 'Entity';
    }
  };

  // Extract key facts from the extract text
  const getKeyFacts = (): string[] => {
    if (!extract) return [];
    
    // Split by sentences and take first 2-3 meaningful ones
    const sentences = extract
      .split(/(?<=[.!?])\s+/)
      .filter(s => s.length > 20 && s.length < 200)
      .slice(0, 2);
    
    return sentences;
  };

  if (compact) {
    return (
      <a 
        href={wikiUrl} 
        target="_blank" 
        rel="noopener noreferrer"
        className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
      >
        {entity.image_url ? (
          <img 
            src={entity.image_url} 
            alt={name}
            className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
            {getEntityIcon()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-medium truncate">{name}</p>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-0.5 flex-shrink-0">
              {getEntityIcon()}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{description || extract?.slice(0, 100)}</p>
        </div>
        <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      </a>
    );
  }

  const keyFacts = getKeyFacts();

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Larger image */}
          {entity.image_url ? (
            <img 
              src={entity.image_url} 
              alt={name}
              className="w-24 h-24 rounded-lg object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              {entity.entity_type === 'person' ? (
                <User className="w-10 h-10 text-muted-foreground" />
              ) : entity.entity_type === 'company' ? (
                <Building2 className="w-10 h-10 text-muted-foreground" />
              ) : (
                <Globe className="w-10 h-10 text-muted-foreground" />
              )}
            </div>
          )}
          
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-[10px] gap-1">
                {getEntityIcon()}
                {getEntityLabel()}
              </Badge>
            </div>
            <h4 className="font-semibold text-base mb-1">{name}</h4>
            {description && (
              <p className="text-sm text-muted-foreground mb-2">{description}</p>
            )}
            <a 
              href={wikiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Wikipedia <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Key Facts Section */}
        {keyFacts.length > 0 && (
          <div className="mt-4 pt-3 border-t space-y-2">
            <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {language === 'uk' ? 'Ключові факти' : language === 'pl' ? 'Kluczowe fakty' : 'Key Facts'}
            </h5>
            <ul className="space-y-1.5">
              {keyFacts.map((fact, i) => (
                <li key={i} className="text-xs text-muted-foreground leading-relaxed flex gap-2">
                  <span className="text-primary">•</span>
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Full extract as fallback if no key facts parsed */}
        {keyFacts.length === 0 && extract && (
          <p className="text-xs text-muted-foreground mt-3 line-clamp-3 border-t pt-3">
            {extract}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
