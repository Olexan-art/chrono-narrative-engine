import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Building2, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/hooks/useLanguage';

interface MentionedEntity {
  id: number;
  name: string;
  name_en?: string | null;
  entity_type: string;
  image_url?: string | null;
  wiki_url?: string | null;
}

interface NewsMentionedEntitiesBlockProps {
  entities?: MentionedEntity[];
  className?: string;
}

export function NewsMentionedEntitiesBlock({ 
  entities = [], 
  className = ''
}: NewsMentionedEntitiesBlockProps) {
  const { language } = useLanguage();

  if (!entities || entities.length === 0) return null;

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'person':
        return <User className="w-3 h-3" />;
      case 'organization':
        return <Building2 className="w-3 h-3" />;
      default:
        return <Users className="w-3 h-3" />;
    }
  };

  const getEntityName = (entity: MentionedEntity) => {
    if (language === 'en' && entity.name_en) {
      return entity.name_en;
    }
    return entity.name;
  };

  return (
    <Card className={`${className}`} data-section="entities">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-4 h-4" />
          {language === 'uk' ? 'Згадані сутності' : language === 'pl' ? 'Wymienione podmioty' : 'Mentioned Entities'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {entities.map(entity => (
            <Link
              key={entity.id}
              to={`/wiki/${entity.id}`}
              className="group"
            >
              <Badge 
                variant="outline" 
                className="gap-1.5 hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                {getEntityIcon(entity.entity_type)}
                {getEntityName(entity)}
              </Badge>
            </Link>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          {language === 'uk' 
            ? `${entities.length} ${entities.length === 1 ? 'сутність' : 'сутностей'} згадано в цій статті`
            : language === 'pl' 
              ? `${entities.length} ${entities.length === 1 ? 'podmiot' : 'podmiotów'} wymienionych w tym artykule`
              : `${entities.length} ${entities.length === 1 ? 'entity' : 'entities'} mentioned in this article`}
        </p>
      </CardContent>
    </Card>
  );
}