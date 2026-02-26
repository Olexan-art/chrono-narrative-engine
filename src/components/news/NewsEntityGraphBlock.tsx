import React from 'react';
import { Network, Users, Building2, Globe } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { Link } from 'react-router-dom';

interface EntityNode {
  id: number;
  name: string;
  type: 'person' | 'organization' | 'location' | 'event' | 'other';
  relevance?: number;
}

interface EntityRelation {
  source: number;
  target: number;
  type: string;
  strength?: number;
}

interface NewsEntityGraphBlockProps {
  entities?: EntityNode[];
  relations?: EntityRelation[];
  mainEntityId?: number;
  className?: string;
}

export function NewsEntityGraphBlock({ 
  entities = [], 
  relations = [],
  mainEntityId,
  className = '' 
}: NewsEntityGraphBlockProps) {
  const { language } = useLanguage();

  const hasData = entities.length > 0;

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'person': return <Users className="w-3 h-3" />;
      case 'organization': return <Building2 className="w-3 h-3" />;
      case 'location': return <Globe className="w-3 h-3" />;
      default: return <Network className="w-3 h-3" />;
    }
  };

  const getEntityTypeLabel = (type: string) => {
    const labels: Record<string, Record<string, string>> = {
      person: { en: 'Person', uk: 'Особа', pl: 'Osoba' },
      organization: { en: 'Organization', uk: 'Організація', pl: 'Organizacja' },
      location: { en: 'Location', uk: 'Локація', pl: 'Lokalizacja' },
      event: { en: 'Event', uk: 'Подія', pl: 'Wydarzenie' },
      other: { en: 'Other', uk: 'Інше', pl: 'Inne' }
    };
    return labels[type]?.[language] || labels[type]?.['en'] || type;
  };

  // Group entities by type
  const groupedEntities = entities.reduce((acc, entity) => {
    if (!acc[entity.type]) acc[entity.type] = [];
    acc[entity.type].push(entity);
    return acc;
  }, {} as Record<string, EntityNode[]>);

  // Sort entities by relevance
  Object.values(groupedEntities).forEach(group => {
    group.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));
  });

  return (
    <Card className={`${className}`} data-section="entity-graph">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Network className="w-4 h-4" />
          {language === 'uk' ? 'Граф сутностей' : language === 'pl' ? 'Graf podmiotów' : 'Entity Graph'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="space-y-4">
            {Object.entries(groupedEntities).map(([type, typeEntities]) => (
              <div key={type} className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                  {getEntityIcon(type)}
                  {getEntityTypeLabel(type)}
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {typeEntities.length}
                  </Badge>
                </h4>
                <div className="flex flex-wrap gap-2">
                  {typeEntities.slice(0, 8).map(entity => {
                    const isMain = entity.id === mainEntityId;
                    return (
                      <Link
                        key={entity.id}
                        to={`/entities/${entity.id}`}
                        className="inline-block"
                      >
                        <Badge 
                          variant={isMain ? "default" : "outline"}
                          className="hover:scale-105 transition-transform cursor-pointer"
                        >
                          {entity.name}
                          {entity.relevance && entity.relevance > 0.7 && (
                            <span className="ml-1 text-xs opacity-60">★</span>
                          )}
                        </Badge>
                      </Link>
                    );
                  })}
                  {typeEntities.length > 8 && (
                    <Badge variant="ghost" className="text-xs">
                      +{typeEntities.length - 8}
                    </Badge>
                  )}
                </div>
              </div>
            ))}

            {relations && relations.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-2">
                  {language === 'uk' 
                    ? `${relations.length} зв'язків між сутностями`
                    : language === 'pl'
                      ? `${relations.length} relacji między podmiotami`
                      : `${relations.length} entity relationships`}
                </p>
              </div>
            )}

            <Link to="/entities/graph" className="block">
              <Button variant="outline" className="w-full text-sm">
                <Network className="w-4 h-4 mr-2" />
                {language === 'uk' 
                  ? 'Переглянути повний граф' 
                  : language === 'pl' 
                    ? 'Zobacz pełny graf' 
                    : 'View full graph'}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="text-center py-4">
            <Network className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground mb-3">
              {language === 'uk' 
                ? 'Граф сутностей недоступний' 
                : language === 'pl' 
                  ? 'Graf podmiotów niedostępny' 
                  : 'Entity graph not available'}
            </p>
            <Link to="/entities">
              <Button variant="outline" size="sm">
                {language === 'uk' ? 'Переглянути всі сутності' : language === 'pl' ? 'Zobacz wszystkie podmioty' : 'Browse all entities'}
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}