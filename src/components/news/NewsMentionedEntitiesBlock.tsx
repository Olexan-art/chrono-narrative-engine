import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Building2, User, Newspaper } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';

interface MentionedEntity {
  id: number;
  name: string;
  name_en?: string | null;
  entity_type: string;
  image_url?: string | null;
  wiki_url?: string | null;
}

interface Feed {
  name?: string;
  category?: string;
}

interface NewsMentionedEntitiesBlockProps {
  entities?: MentionedEntity[];
  feed?: Feed;
  className?: string;
}

export function NewsMentionedEntitiesBlock({ 
  entities = [],
  feed,
  className = ''
}: NewsMentionedEntitiesBlockProps) {
  const { language } = useLanguage();

  // Show block if there are entities OR if there's a feed source
  if ((!entities || entities.length === 0) && !feed) return null;

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
          {entities.filter(entity => entity && entity.id).map(entity => (
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
          
          {/* Source badge with different color */}
          {feed && feed.name && (
            <Badge 
              variant="outline" 
              className="gap-1.5 bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
            >
              <Newspaper className="w-3 h-3" />
              {language === 'uk' ? 'Джерело' : language === 'pl' ? 'Źródło' : 'Source'}: {feed.name}
            </Badge>
          )}
        </div>
        {entities.length > 0 && (
          <p className="text-xs text-muted-foreground mt-3">
            {language === 'uk' 
              ? `${entities.length} ${entities.length === 1 ? 'сутність' : 'сутностей'} згадано в цій статті`
              : language === 'pl' 
                ? `${entities.length} ${entities.length === 1 ? 'podmiot' : 'podmiotów'} wymienionych w tym artykule`
                : `${entities.length} ${entities.length === 1 ? 'entity' : 'entities'} mentioned in this article`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}