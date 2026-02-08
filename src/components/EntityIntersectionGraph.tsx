import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Network, User, Building2, Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface RelatedEntity {
  id: string;
  name: string;
  name_en: string | null;
  image_url: string | null;
  entity_type: string;
  slug: string | null;
  shared_news_count: number;
}

interface EntityIntersectionGraphProps {
  mainEntity: {
    name: string;
    name_en?: string | null;
    image_url?: string | null;
    entity_type: string;
  };
  relatedEntities: RelatedEntity[];
}

export function EntityIntersectionGraph({ mainEntity, relatedEntities }: EntityIntersectionGraphProps) {
  const { language } = useLanguage();

  // Calculate positions for entities in a circular layout
  const positions = useMemo(() => {
    const centerX = 200;
    const centerY = 200;
    const radius = 150;
    
    return relatedEntities.map((_, index) => {
      const angle = (2 * Math.PI * index) / relatedEntities.length - Math.PI / 2;
      return {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      };
    });
  }, [relatedEntities.length]);

  // Calculate line thickness based on shared news count
  const maxCount = Math.max(...relatedEntities.map(e => e.shared_news_count), 1);
  
  const getLineWidth = (count: number) => {
    const min = 1;
    const max = 6;
    return min + ((count / maxCount) * (max - min));
  };

  const getOpacity = (count: number) => {
    const min = 0.3;
    const max = 1;
    return min + ((count / maxCount) * (max - min));
  };

  if (relatedEntities.length === 0) return null;

  const mainName = language === 'en' && mainEntity.name_en ? mainEntity.name_en : mainEntity.name;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Network className="w-5 h-5 text-primary" />
          {language === 'uk' ? 'Граф пересічень' : 'Entity Intersection Graph'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative w-full aspect-square max-w-[400px] mx-auto">
          <svg 
            viewBox="0 0 400 400" 
            className="w-full h-full"
            style={{ overflow: 'visible' }}
          >
            {/* Connection lines */}
            {relatedEntities.map((entity, index) => (
              <line
                key={`line-${entity.id}`}
                x1={200}
                y1={200}
                x2={positions[index].x}
                y2={positions[index].y}
                stroke="hsl(var(--primary))"
                strokeWidth={getLineWidth(entity.shared_news_count)}
                strokeOpacity={getOpacity(entity.shared_news_count)}
                className="transition-all duration-300"
              />
            ))}

            {/* Center entity (main) */}
            <g className="cursor-default">
              <circle
                cx={200}
                cy={200}
                r={45}
                fill="hsl(var(--primary))"
                className="drop-shadow-lg"
              />
              {mainEntity.image_url ? (
                <clipPath id="center-clip">
                  <circle cx={200} cy={200} r={42} />
                </clipPath>
              ) : null}
              {mainEntity.image_url ? (
                <image
                  x={200 - 42}
                  y={200 - 42}
                  width={84}
                  height={84}
                  href={mainEntity.image_url}
                  clipPath="url(#center-clip)"
                  preserveAspectRatio="xMidYMid slice"
                />
              ) : (
                <foreignObject x={200 - 20} y={200 - 20} width={40} height={40}>
                  <div className="w-full h-full flex items-center justify-center text-primary-foreground">
                    {mainEntity.entity_type === 'person' ? (
                      <User className="w-6 h-6" />
                    ) : (
                      <Building2 className="w-6 h-6" />
                    )}
                  </div>
                </foreignObject>
              )}
            </g>

            {/* Related entities */}
            {relatedEntities.map((entity, index) => {
              const pos = positions[index];
              const name = language === 'en' && entity.name_en ? entity.name_en : entity.name;
              const entityRadius = 30 + (entity.shared_news_count / maxCount) * 10;
              
              return (
                <g key={entity.id} className="cursor-pointer group">
                  <Link to={`/wiki/${entity.slug || entity.id}`}>
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={entityRadius}
                      fill="hsl(var(--muted))"
                      stroke="hsl(var(--border))"
                      strokeWidth={2}
                      className="transition-all duration-300 group-hover:fill-primary/20 group-hover:stroke-primary"
                    />
                    
                    {entity.image_url ? (
                      <>
                        <clipPath id={`clip-${entity.id}`}>
                          <circle cx={pos.x} cy={pos.y} r={entityRadius - 2} />
                        </clipPath>
                        <image
                          x={pos.x - (entityRadius - 2)}
                          y={pos.y - (entityRadius - 2)}
                          width={(entityRadius - 2) * 2}
                          height={(entityRadius - 2) * 2}
                          href={entity.image_url}
                          clipPath={`url(#clip-${entity.id})`}
                          preserveAspectRatio="xMidYMid slice"
                          className="transition-opacity group-hover:opacity-90"
                        />
                      </>
                    ) : (
                      <foreignObject 
                        x={pos.x - 15} 
                        y={pos.y - 15} 
                        width={30} 
                        height={30}
                      >
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                          {entity.entity_type === 'person' ? (
                            <User className="w-5 h-5" />
                          ) : (
                            <Building2 className="w-5 h-5" />
                          )}
                        </div>
                      </foreignObject>
                    )}

                    {/* Count badge */}
                    <circle
                      cx={pos.x + entityRadius * 0.7}
                      cy={pos.y - entityRadius * 0.7}
                      r={12}
                      fill="hsl(var(--primary))"
                      className="drop-shadow"
                    />
                    <text
                      x={pos.x + entityRadius * 0.7}
                      y={pos.y - entityRadius * 0.7 + 4}
                      textAnchor="middle"
                      fill="hsl(var(--primary-foreground))"
                      fontSize="10"
                      fontWeight="bold"
                    >
                      {entity.shared_news_count}
                    </text>
                  </Link>
                </g>
              );
            })}
          </svg>

          {/* Legend */}
          <div className="absolute bottom-0 left-0 right-0 flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
            {relatedEntities.slice(0, 5).map((entity) => {
              const name = language === 'en' && entity.name_en ? entity.name_en : entity.name;
              return (
                <Link
                  key={entity.id}
                  to={`/wiki/${entity.slug || entity.id}`}
                  className="max-w-[80px] truncate hover:text-primary transition-colors"
                  title={name}
                >
                  {name}
                </Link>
              );
            })}
            {relatedEntities.length > 5 && (
              <span className="text-muted-foreground/50">
                +{relatedEntities.length - 5}
              </span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-sm text-center text-muted-foreground">
            {language === 'uk' 
              ? `${relatedEntities.length} пов'язаних сутностей у спільних новинах`
              : `${relatedEntities.length} related entities in shared news`
            }
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
