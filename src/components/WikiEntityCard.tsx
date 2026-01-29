import { ExternalLink, Building2, User, Globe } from "lucide-react";
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

interface WikiEntityCardProps {
  entity: WikiEntity;
  compact?: boolean;
}

export function WikiEntityCard({ entity, compact = false }: WikiEntityCardProps) {
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

  if (compact) {
    return (
      <a 
        href={wikiUrl} 
        target="_blank" 
        rel="noopener noreferrer"
        className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors"
      >
        {entity.image_url ? (
          <img 
            src={entity.image_url} 
            alt={name}
            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
            {getEntityIcon()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{name}</p>
          <p className="text-xs text-muted-foreground truncate">{description}</p>
        </div>
        <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" />
      </a>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex gap-3">
          {entity.image_url ? (
            <img 
              src={entity.image_url} 
              alt={name}
              className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              {getEntityIcon()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-[10px] gap-1">
                {getEntityIcon()}
                {getEntityLabel()}
              </Badge>
            </div>
            <h4 className="font-semibold text-sm mb-1 truncate">{name}</h4>
            {description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{description}</p>
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
        {extract && !compact && (
          <p className="text-xs text-muted-foreground mt-3 line-clamp-3 border-t pt-3">
            {extract}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
