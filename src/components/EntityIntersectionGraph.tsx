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
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-card via-card to-primary/5">
      <CardHeader className="pb-3 border-b border-border/50">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="p-2 rounded-lg bg-primary/10">
            <Network className="w-5 h-5 text-primary" />
          </div>
          <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            {language === 'uk' ? 'Граф пересічень' : 'Entity Intersection Graph'}
          </span>
          <Sparkles className="w-4 h-4 text-primary/50 ml-auto" />
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="relative w-full aspect-square max-w-[450px] mx-auto">
          <svg 
            viewBox="0 0 400 400" 
            className="w-full h-full"
            style={{ overflow: 'visible' }}
          >
            {/* Definitions for gradients and filters */}
            <defs>
              <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
                <stop offset="50%" stopColor="hsl(var(--secondary))" stopOpacity="0.6" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
              </linearGradient>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2" result="blur"/>
                <feMerge>
                  <feMergeNode in="blur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              <radialGradient id="centerGradient" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="hsl(var(--primary))" />
                <stop offset="70%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
                <stop offset="100%" stopColor="hsl(var(--secondary))" stopOpacity="0.6" />
              </radialGradient>
              <radialGradient id="nodeGradient" cx="50%" cy="30%" r="70%">
                <stop offset="0%" stopColor="hsl(var(--muted))" stopOpacity="1" />
                <stop offset="100%" stopColor="hsl(var(--card))" stopOpacity="0.9" />
              </radialGradient>
            </defs>

            {/* Background decorative circles */}
            <circle
              cx={200}
              cy={200}
              r={160}
              fill="none"
              stroke="hsl(var(--border))"
              strokeWidth={1}
              strokeDasharray="4 8"
              opacity={0.3}
            />
            <circle
              cx={200}
              cy={200}
              r={100}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth={1}
              strokeDasharray="2 6"
              opacity={0.2}
            />

            {/* Connection lines with gradient */}
            {relatedEntities.map((entity, index) => (
              <g key={`line-${entity.id}`}>
                {/* Glow effect line */}
                <line
                  x1={200}
                  y1={200}
                  x2={positions[index].x}
                  y2={positions[index].y}
                  stroke="hsl(var(--primary))"
                  strokeWidth={getLineWidth(entity.shared_news_count) + 4}
                  strokeOpacity={getOpacity(entity.shared_news_count) * 0.2}
                  strokeLinecap="round"
                />
                {/* Main line */}
                <line
                  x1={200}
                  y1={200}
                  x2={positions[index].x}
                  y2={positions[index].y}
                  stroke="url(#lineGradient)"
                  strokeWidth={getLineWidth(entity.shared_news_count)}
                  strokeOpacity={getOpacity(entity.shared_news_count)}
                  strokeLinecap="round"
                  className="transition-all duration-500"
                />
              </g>
            ))}

            {/* Center entity (main) */}
            <g className="cursor-default" filter="url(#glow)">
              {/* Outer glow ring */}
              <circle
                cx={200}
                cy={200}
                r={52}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                opacity={0.4}
              />
              {/* Main circle */}
              <circle
                cx={200}
                cy={200}
                r={48}
                fill="url(#centerGradient)"
                className="drop-shadow-lg"
              />
              {/* Inner highlight */}
              <circle
                cx={200}
                cy={190}
                r={35}
                fill="hsl(var(--primary))"
                opacity={0.1}
              />
              {mainEntity.image_url ? (
                <clipPath id="center-clip">
                  <circle cx={200} cy={200} r={44} />
                </clipPath>
              ) : null}
              {mainEntity.image_url ? (
                <image
                  x={200 - 44}
                  y={200 - 44}
                  width={88}
                  height={88}
                  href={mainEntity.image_url}
                  clipPath="url(#center-clip)"
                  preserveAspectRatio="xMidYMid slice"
                />
              ) : (
                <foreignObject x={200 - 22} y={200 - 22} width={44} height={44}>
                  <div className="w-full h-full flex items-center justify-center text-primary-foreground">
                    {mainEntity.entity_type === 'person' ? (
                      <User className="w-7 h-7" />
                    ) : (
                      <Building2 className="w-7 h-7" />
                    )}
                  </div>
                </foreignObject>
              )}
            </g>

            {/* Related entities */}
            {relatedEntities.map((entity, index) => {
              const pos = positions[index];
              const name = language === 'en' && entity.name_en ? entity.name_en : entity.name;
              const entityRadius = 32 + (entity.shared_news_count / maxCount) * 12;
              
              return (
                <g key={entity.id} className="cursor-pointer" filter="url(#softGlow)">
                  <Link to={`/wiki/${entity.slug || entity.id}`}>
                    {/* Hover glow ring */}
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={entityRadius + 4}
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      opacity={0}
                      className="transition-all duration-300 group-hover:opacity-50"
                    />
                    {/* Main node circle */}
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={entityRadius}
                      fill="url(#nodeGradient)"
                      stroke="hsl(var(--border))"
                      strokeWidth={2}
                      className="transition-all duration-300 hover:stroke-primary hover:stroke-[3px]"
                    />
                    {/* Inner highlight */}
                    <circle
                      cx={pos.x}
                      cy={pos.y - entityRadius * 0.2}
                      r={entityRadius * 0.6}
                      fill="hsl(var(--foreground))"
                      opacity={0.03}
                    />
                    
                    {entity.image_url ? (
                      <>
                        <clipPath id={`clip-${entity.id}`}>
                          <circle cx={pos.x} cy={pos.y} r={entityRadius - 3} />
                        </clipPath>
                        <image
                          x={pos.x - (entityRadius - 3)}
                          y={pos.y - (entityRadius - 3)}
                          width={(entityRadius - 3) * 2}
                          height={(entityRadius - 3) * 2}
                          href={entity.image_url}
                          clipPath={`url(#clip-${entity.id})`}
                          preserveAspectRatio="xMidYMid slice"
                          className="transition-opacity hover:opacity-90"
                        />
                      </>
                    ) : (
                      <foreignObject 
                        x={pos.x - 16} 
                        y={pos.y - 16} 
                        width={32} 
                        height={32}
                      >
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground hover:text-primary transition-colors">
                          {entity.entity_type === 'person' ? (
                            <User className="w-5 h-5" />
                          ) : (
                            <Building2 className="w-5 h-5" />
                          )}
                        </div>
                      </foreignObject>
                    )}

                    {/* Count badge with gradient */}
                    <circle
                      cx={pos.x + entityRadius * 0.75}
                      cy={pos.y - entityRadius * 0.75}
                      r={14}
                      fill="hsl(var(--primary))"
                      stroke="hsl(var(--background))"
                      strokeWidth={2}
                      className="drop-shadow-md"
                    />
                    <text
                      x={pos.x + entityRadius * 0.75}
                      y={pos.y - entityRadius * 0.75 + 4}
                      textAnchor="middle"
                      fill="hsl(var(--primary-foreground))"
                      fontSize="11"
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
