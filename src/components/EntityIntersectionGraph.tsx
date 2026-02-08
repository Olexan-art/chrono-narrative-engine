import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Network, User, Building2, Sparkles, ChevronDown, ChevronUp, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

interface SecondaryConnection {
  from: RelatedEntity;
  to: RelatedEntity;
  weight: number;
}

interface EntityIntersectionGraphProps {
  mainEntity: {
    name: string;
    name_en?: string | null;
    image_url?: string | null;
    entity_type: string;
  };
  relatedEntities: RelatedEntity[];
  secondaryConnections?: SecondaryConnection[];
}

// Optimized: increased display limits for better visualization
const MAX_DISPLAYED_ENTITIES = 12;
const INITIAL_DISPLAYED = 10;

// Generate hexagon path for SVG
function getHexagonPath(cx: number, cy: number, r: number): string {
  const points: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2; // Start from top
    points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + 'Z';
}

export function EntityIntersectionGraph({ mainEntity, relatedEntities, secondaryConnections = [] }: EntityIntersectionGraphProps) {
  const { language } = useLanguage();
  const [showAll, setShowAll] = useState(false);
  const [showSecondary, setShowSecondary] = useState(true);

  // Limit entities for performance - sort by relevance first
  const sortedEntities = useMemo(() => 
    [...relatedEntities].sort((a, b) => b.shared_news_count - a.shared_news_count),
    [relatedEntities]
  );

  const displayedEntities = useMemo(() => {
    const limit = showAll ? MAX_DISPLAYED_ENTITIES : INITIAL_DISPLAYED;
    return sortedEntities.slice(0, limit);
  }, [sortedEntities, showAll]);

  const hasMore = sortedEntities.length > INITIAL_DISPLAYED;
  const remainingCount = Math.min(sortedEntities.length, MAX_DISPLAYED_ENTITIES) - INITIAL_DISPLAYED;

  // Calculate positions for entities in a circular layout - memoized
  const positions = useMemo(() => {
    const centerX = 220;
    const centerY = 220;
    const radius = 160;
    
    return displayedEntities.map((_, index) => {
      const angle = (2 * Math.PI * index) / displayedEntities.length - Math.PI / 2;
      return {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      };
    });
  }, [displayedEntities.length]);

  // Create entity position map for secondary connections
  const entityPositionMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    displayedEntities.forEach((entity, index) => {
      map.set(entity.id, positions[index]);
    });
    return map;
  }, [displayedEntities, positions]);

  // Filter secondary connections to only include displayed entities
  const visibleSecondaryConnections = useMemo(() => {
    if (!showSecondary) return [];
    const displayedIds = new Set(displayedEntities.map(e => e.id));
    return secondaryConnections.filter(
      conn => displayedIds.has(conn.from.id) && displayedIds.has(conn.to.id)
    );
  }, [secondaryConnections, displayedEntities, showSecondary]);

  // Calculate line thickness based on shared news count
  const maxCount = useMemo(() => 
    Math.max(...displayedEntities.map(e => e.shared_news_count), 1),
    [displayedEntities]
  );
  
  const getLineWidth = (count: number) => {
    const min = 2;
    const max = 6;
    return min + ((count / maxCount) * (max - min));
  };

  const getOpacity = (count: number) => {
    const min = 0.4;
    const max = 1;
    return min + ((count / maxCount) * (max - min));
  };

  // Assign pulse animation delay based on index
  const getPulseDelay = (index: number) => `${index * 0.3}s`;

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
        {/* Secondary connections toggle */}
        {secondaryConnections.length > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <Button
              variant={showSecondary ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setShowSecondary(!showSecondary)}
              className="gap-2 text-xs"
            >
              <Share2 className="w-3 h-3" />
              {language === 'uk' 
                ? `Вторинні зв'язки (${secondaryConnections.length})` 
                : `Secondary connections (${secondaryConnections.length})`
              }
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-6">
        <div className="relative w-full aspect-square max-w-[500px] mx-auto">
          <svg 
            viewBox="0 0 440 440" 
            className="w-full h-full"
            style={{ overflow: 'visible' }}
          >
            {/* Definitions for gradients, filters, and animations */}
            <defs>
              {/* Pulsing animation for lines */}
              <style>
                {`
                  @keyframes pulseOpacity {
                    0%, 100% { opacity: 0.4; }
                    50% { opacity: 1; }
                  }
                  @keyframes pulseWidth {
                    0%, 100% { stroke-width: var(--base-width); }
                    50% { stroke-width: calc(var(--base-width) + 2); }
                  }
                  .pulse-line {
                    animation: pulseOpacity 2s ease-in-out infinite, pulseWidth 2s ease-in-out infinite;
                  }
                  @keyframes dashMove {
                    0% { stroke-dashoffset: 20; }
                    100% { stroke-dashoffset: 0; }
                  }
                  .secondary-line {
                    animation: dashMove 1s linear infinite;
                  }
                `}
              </style>
              
              <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.9" />
                <stop offset="50%" stopColor="hsl(var(--secondary))" stopOpacity="0.7" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
              </linearGradient>
              
              <linearGradient id="lineGradientPulse" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="1">
                  <animate attributeName="stopOpacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />
                </stop>
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.3">
                  <animate attributeName="stopOpacity" values="0.3;0.8;0.3" dur="2s" repeatCount="indefinite" />
                </stop>
              </linearGradient>

              <linearGradient id="secondaryGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.6" />
                <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.3" />
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
              
              <filter id="lineGlow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="4" result="glow"/>
                <feMerge>
                  <feMergeNode in="glow"/>
                  <feMergeNode in="glow"/>
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

            {/* Background decorative hexagon */}
            <path
              d={getHexagonPath(220, 220, 180)}
              fill="none"
              stroke="hsl(var(--border))"
              strokeWidth={1}
              strokeDasharray="4 8"
              opacity={0.3}
            />
            <path
              d={getHexagonPath(220, 220, 110)}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth={1}
              strokeDasharray="2 6"
              opacity={0.2}
            />

            {/* Secondary connections (entity-to-entity, not through main) */}
            {visibleSecondaryConnections.map((conn, index) => {
              const fromPos = entityPositionMap.get(conn.from.id);
              const toPos = entityPositionMap.get(conn.to.id);
              if (!fromPos || !toPos) return null;

              return (
                <g key={`secondary-${conn.from.id}-${conn.to.id}`}>
                  {/* Dashed secondary connection line */}
                  <line
                    x1={fromPos.x}
                    y1={fromPos.y}
                    x2={toPos.x}
                    y2={toPos.y}
                    stroke="url(#secondaryGradient)"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    strokeLinecap="round"
                    className="secondary-line"
                    style={{ animationDelay: `${index * 0.2}s` }}
                    opacity={0.5}
                  />
                  {/* Connection weight indicator in the middle */}
                  {conn.weight > 1 && (
                    <g>
                      <circle
                        cx={(fromPos.x + toPos.x) / 2}
                        cy={(fromPos.y + toPos.y) / 2}
                        r={8}
                        fill="hsl(var(--muted))"
                        stroke="hsl(var(--border))"
                        strokeWidth={1}
                      />
                      <text
                        x={(fromPos.x + toPos.x) / 2}
                        y={(fromPos.y + toPos.y) / 2 + 3}
                        textAnchor="middle"
                        fill="hsl(var(--muted-foreground))"
                        fontSize="8"
                        fontWeight="bold"
                      >
                        {conn.weight}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Primary connection lines with pulsing animation */}
            {displayedEntities.map((entity, index) => {
              const lineWidth = getLineWidth(entity.shared_news_count);
              const opacity = getOpacity(entity.shared_news_count);
              
              return (
                <g key={`line-${entity.id}`}>
                  {/* Outer glow effect line */}
                  <line
                    x1={220}
                    y1={220}
                    x2={positions[index].x}
                    y2={positions[index].y}
                    stroke="hsl(var(--primary))"
                    strokeWidth={lineWidth + 6}
                    strokeOpacity={0.15}
                    strokeLinecap="round"
                    filter="url(#lineGlow)"
                  />
                  {/* Pulsing background line */}
                  <line
                    x1={220}
                    y1={220}
                    x2={positions[index].x}
                    y2={positions[index].y}
                    stroke="hsl(var(--primary))"
                    strokeWidth={lineWidth + 3}
                    strokeLinecap="round"
                    className="pulse-line"
                    style={{ 
                      '--base-width': `${lineWidth + 3}px`,
                      animationDelay: getPulseDelay(index),
                    } as React.CSSProperties}
                    opacity={opacity * 0.3}
                  />
                  {/* Main line with gradient */}
                  <line
                    x1={220}
                    y1={220}
                    x2={positions[index].x}
                    y2={positions[index].y}
                    stroke="url(#lineGradientPulse)"
                    strokeWidth={lineWidth}
                    strokeOpacity={opacity}
                    strokeLinecap="round"
                    className="transition-all duration-300"
                    style={{ animationDelay: getPulseDelay(index) }}
                  />
                </g>
              );
            })}

            {/* Center entity (main) - Hexagon */}
            <g className="cursor-default" filter="url(#glow)">
              {/* Pulsing outer hexagon ring */}
              <path
                d={getHexagonPath(220, 220, 54)}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                opacity={0.4}
              >
                <animate 
                  attributeName="opacity" 
                  values="0.4;0.7;0.4" 
                  dur="2s" 
                  repeatCount="indefinite" 
                />
              </path>
              {/* Main hexagon */}
              <path
                d={getHexagonPath(220, 220, 48)}
                fill="url(#centerGradient)"
                className="drop-shadow-lg"
              />
              {/* Inner highlight */}
              <path
                d={getHexagonPath(220, 210, 35)}
                fill="hsl(var(--primary))"
                opacity={0.1}
              />
              {mainEntity.image_url ? (
                <clipPath id="center-clip">
                  <path d={getHexagonPath(220, 220, 44)} />
                </clipPath>
              ) : null}
              {mainEntity.image_url ? (
                <image
                  x={220 - 44}
                  y={220 - 44}
                  width={88}
                  height={88}
                  href={mainEntity.image_url}
                  clipPath="url(#center-clip)"
                  preserveAspectRatio="xMidYMid slice"
                />
              ) : (
                <foreignObject x={220 - 22} y={220 - 22} width={44} height={44}>
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

            {/* Related entities - optimized rendering */}
            {displayedEntities.map((entity, index) => {
              const pos = positions[index];
              const name = language === 'en' && entity.name_en ? entity.name_en : entity.name;
              const entityRadius = 28 + (entity.shared_news_count / maxCount) * 10;
              
              return (
                <g key={entity.id} className="cursor-pointer" filter="url(#softGlow)">
                  <Link to={`/wiki/${entity.slug || entity.id}`}>
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
                        x={pos.x - 14} 
                        y={pos.y - 14} 
                        width={28} 
                        height={28}
                      >
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground hover:text-primary transition-colors">
                          {entity.entity_type === 'person' ? (
                            <User className="w-4 h-4" />
                          ) : (
                            <Building2 className="w-4 h-4" />
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
                      stroke="hsl(var(--background))"
                      strokeWidth={2}
                      className="drop-shadow-md"
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

          {/* Legend with expand option */}
          <div className="absolute -bottom-2 left-0 right-0 flex flex-wrap justify-center gap-2 text-xs">
            {displayedEntities.slice(0, 4).map((entity) => {
              const name = language === 'en' && entity.name_en ? entity.name_en : entity.name;
              return (
                <Link
                  key={entity.id}
                  to={`/wiki/${entity.slug || entity.id}`}
                  className="max-w-[80px] truncate px-2 py-1 rounded-full bg-muted/50 text-muted-foreground hover:bg-primary/20 hover:text-primary transition-all duration-200"
                  title={name}
                >
                  {name}
                </Link>
              );
            })}
            {displayedEntities.length > 4 && (
              <span className="px-2 py-1 rounded-full bg-muted/30 text-muted-foreground/60">
                +{displayedEntities.length - 4}
              </span>
            )}
          </div>
        </div>

        {/* Expand/collapse button for many entities */}
        {hasMore && (
          <div className="mt-8 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAll(!showAll)}
              className="gap-2"
            >
              {showAll ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  {language === 'uk' ? 'Показати менше' : 'Show less'}
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  {language === 'uk' ? `Показати ще ${remainingCount}` : `Show ${remainingCount} more`}
                </>
              )}
            </Button>
          </div>
        )}

        {/* Stats */}
        <div className="mt-6 pt-4 border-t border-border/50">
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span>
                {language === 'uk' 
                  ? `${relatedEntities.length} пов'язаних сутностей`
                  : `${relatedEntities.length} related entities`
                }
              </span>
            </div>
            {secondaryConnections.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 border-t-2 border-dashed border-muted-foreground/50" />
                <span>
                  {language === 'uk' 
                    ? `${secondaryConnections.length} вторинних зв'язків`
                    : `${secondaryConnections.length} secondary connections`
                  }
                </span>
              </div>
            )}
          </div>
          {relatedEntities.length > MAX_DISPLAYED_ENTITIES && (
            <p className="text-center text-xs text-muted-foreground/60 mt-1">
              {language === 'uk' 
                ? `Показано топ-${MAX_DISPLAYED_ENTITIES} за релевантністю`
                : `Showing top ${MAX_DISPLAYED_ENTITIES} by relevance`
              }
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
