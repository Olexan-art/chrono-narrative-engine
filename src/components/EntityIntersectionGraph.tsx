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

// Tree layout configuration - expanded for more entities
const MAX_DISPLAYED_ENTITIES = 24;
const INITIAL_DISPLAYED = 18;

// Generate hexagon path for SVG
function getHexagonPath(cx: number, cy: number, r: number): string {
  const points: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + 'Z';
}

// Calculate tree positions - hierarchical layout with more levels
function calculateTreePositions(entityCount: number, containerWidth: number, containerHeight: number) {
  const positions: { x: number; y: number; level: number }[] = [];
  
  if (entityCount === 0) return positions;
  
  // Define levels based on entity count - expanded for more nodes
  const levels: number[] = [];
  let remaining = entityCount;
  let currentLevel = 0;
  
  // First level has fewer items, then expand more aggressively
  const levelSizes = [3, 5, 6, 7, 8]; // Max items per level - increased
  
  while (remaining > 0) {
    const maxForLevel = levelSizes[Math.min(currentLevel, levelSizes.length - 1)];
    const countForLevel = Math.min(remaining, maxForLevel);
    levels.push(countForLevel);
    remaining -= countForLevel;
    currentLevel++;
  }
  
  // Calculate vertical spacing
  const levelCount = levels.length;
  const startY = 100; // Start below the root
  const endY = containerHeight - 50;
  const levelHeight = levelCount > 1 ? (endY - startY) / (levelCount - 1) : 0;
  
  // Position entities on each level with stagger for visual interest
  let entityIndex = 0;
  levels.forEach((count, levelIdx) => {
    const y = startY + levelIdx * levelHeight;
    const levelWidth = containerWidth - 80;
    const spacing = count > 1 ? levelWidth / (count - 1) : 0;
    const startX = count > 1 ? 40 : containerWidth / 2;
    
    for (let i = 0; i < count; i++) {
      // Add slight vertical stagger for alternating items
      const staggerY = (i % 2 === 0) ? 0 : (levelIdx > 0 ? 8 : 0);
      const x = count > 1 ? startX + i * spacing : startX;
      positions.push({ x, y: y + staggerY, level: levelIdx });
      entityIndex++;
    }
  });
  
  return positions;
}

// Generate curved path for tree connections
function getTreeConnectionPath(
  fromX: number, fromY: number, 
  toX: number, toY: number,
  curveStrength: number = 0.5
): string {
  const midY = fromY + (toY - fromY) * curveStrength;
  return `M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`;
}

export function EntityIntersectionGraph({ mainEntity, relatedEntities, secondaryConnections = [] }: EntityIntersectionGraphProps) {
  const { language } = useLanguage();
  const [showAll, setShowAll] = useState(false);
  const [showSecondary, setShowSecondary] = useState(true);

  // Sort by relevance
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

  // Container dimensions - increased for more entities
  const containerWidth = 600;
  const containerHeight = 600;
  const rootX = containerWidth / 2;
  const rootY = 45;

  // Calculate tree positions
  const positions = useMemo(() => 
    calculateTreePositions(displayedEntities.length, containerWidth, containerHeight),
    [displayedEntities.length]
  );

  // Create entity position map for secondary connections
  const entityPositionMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    displayedEntities.forEach((entity, index) => {
      if (positions[index]) {
        map.set(entity.id, { x: positions[index].x, y: positions[index].y });
      }
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
    const min = 1.5;
    const max = 4;
    return min + ((count / maxCount) * (max - min));
  };

  const getOpacity = (count: number) => {
    const min = 0.5;
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
        <div className="relative w-full" style={{ maxWidth: `${containerWidth}px`, margin: '0 auto' }}>
          <svg 
            viewBox={`0 0 ${containerWidth} ${containerHeight}`}
            className="w-full h-auto"
            style={{ overflow: 'visible' }}
          >
            {/* Definitions for gradients, filters, and animations */}
            <defs>
              <style>
                {`
                  @keyframes flowDown {
                    0% { stroke-dashoffset: 30; }
                    100% { stroke-dashoffset: 0; }
                  }
                  .tree-line {
                    animation: flowDown 3s linear infinite;
                  }
                  @keyframes dashMove {
                    0% { stroke-dashoffset: 24; }
                    100% { stroke-dashoffset: 0; }
                  }
                  .secondary-line {
                    animation: dashMove 1.5s linear infinite;
                  }
                  @keyframes pulse {
                    0%, 100% { opacity: 0.5; transform: scale(1); }
                    50% { opacity: 1; transform: scale(1.05); }
                  }
                  .pulse-node {
                    animation: pulse 2.5s ease-in-out infinite;
                  }
                  @keyframes glow {
                    0%, 100% { filter: drop-shadow(0 0 2px hsl(var(--primary) / 0.3)); }
                    50% { filter: drop-shadow(0 0 6px hsl(var(--primary) / 0.6)); }
                  }
                  .glow-node {
                    animation: glow 3s ease-in-out infinite;
                  }
                  @keyframes nodeFloat {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-3px); }
                  }
                `}
              </style>
              
              <linearGradient id="treeLineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.9" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
              </linearGradient>

              <linearGradient id="secondaryGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.5" />
                <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.2" />
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
              
              <radialGradient id="rootGradient" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="hsl(var(--primary))" />
                <stop offset="70%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
                <stop offset="100%" stopColor="hsl(var(--secondary))" stopOpacity="0.6" />
              </radialGradient>
              
              <radialGradient id="nodeGradient" cx="50%" cy="30%" r="70%">
                <stop offset="0%" stopColor="hsl(var(--muted))" stopOpacity="1" />
                <stop offset="100%" stopColor="hsl(var(--card))" stopOpacity="0.9" />
              </radialGradient>
            </defs>

            {/* Background tree structure lines (decorative) */}
            <g opacity={0.1}>
              {positions.map((pos, idx) => (
                <line 
                  key={`bg-${idx}`}
                  x1={rootX} y1={rootY + 30}
                  x2={pos.x} y2={pos.y}
                  stroke="hsl(var(--border))"
                  strokeWidth={1}
                  strokeDasharray="4 8"
                />
              ))}
            </g>

            {/* Secondary connections (entity-to-entity, not through main) */}
            {visibleSecondaryConnections.map((conn, index) => {
              const fromPos = entityPositionMap.get(conn.from.id);
              const toPos = entityPositionMap.get(conn.to.id);
              if (!fromPos || !toPos) return null;

              return (
                <g key={`secondary-${conn.from.id}-${conn.to.id}`}>
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
                    opacity={0.4}
                  />
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

            {/* Tree connection lines from root to entities */}
            {displayedEntities.map((entity, index) => {
              const pos = positions[index];
              if (!pos) return null;
              
              const lineWidth = getLineWidth(entity.shared_news_count);
              const opacity = getOpacity(entity.shared_news_count);
              
              return (
                <g key={`line-${entity.id}`}>
                  {/* Glow effect */}
                  <path
                    d={getTreeConnectionPath(rootX, rootY + 30, pos.x, pos.y - 20, 0.4)}
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth={lineWidth + 4}
                    strokeOpacity={0.1}
                    strokeLinecap="round"
                  />
                  {/* Main curved connection */}
                  <path
                    d={getTreeConnectionPath(rootX, rootY + 30, pos.x, pos.y - 20, 0.4)}
                    fill="none"
                    stroke="url(#treeLineGradient)"
                    strokeWidth={lineWidth}
                    strokeOpacity={opacity}
                    strokeLinecap="round"
                    strokeDasharray="8 4"
                    className="tree-line"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  />
                </g>
              );
            })}

            {/* Root entity (main) - Hexagon at top */}
            <g className="cursor-default" filter="url(#glow)">
              {/* Pulsing outer ring */}
              <path
                d={getHexagonPath(rootX, rootY, 42)}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                className="pulse-node"
              />
              {/* Main hexagon */}
              <path
                d={getHexagonPath(rootX, rootY, 36)}
                fill="url(#rootGradient)"
                className="drop-shadow-lg"
              />
              {mainEntity.image_url ? (
                <>
                  <clipPath id="root-clip">
                    <path d={getHexagonPath(rootX, rootY, 32)} />
                  </clipPath>
                  <image
                    x={rootX - 32}
                    y={rootY - 32}
                    width={64}
                    height={64}
                    href={mainEntity.image_url}
                    clipPath="url(#root-clip)"
                    preserveAspectRatio="xMidYMid slice"
                  />
                </>
              ) : (
                <foreignObject x={rootX - 16} y={rootY - 16} width={32} height={32}>
                  <div className="w-full h-full flex items-center justify-center text-primary-foreground">
                    {mainEntity.entity_type === 'person' ? (
                      <User className="w-5 h-5" />
                    ) : (
                      <Building2 className="w-5 h-5" />
                    )}
                  </div>
                </foreignObject>
              )}
            </g>

            {/* Entity nodes - hexagons */}
            {displayedEntities.map((entity, index) => {
              const pos = positions[index];
              if (!pos) return null;
              
              const name = language === 'en' && entity.name_en ? entity.name_en : entity.name;
              const nodeRadius = 22 + (entity.shared_news_count / maxCount) * 6;
              
              return (
                <g key={entity.id} className="cursor-pointer" filter="url(#softGlow)">
                  <Link to={`/wiki/${entity.slug || entity.id}`}>
                    {/* Main node hexagon */}
                    <path
                      d={getHexagonPath(pos.x, pos.y, nodeRadius)}
                      fill="url(#nodeGradient)"
                      stroke="hsl(var(--border))"
                      strokeWidth={2}
                      className="transition-all duration-300 hover:stroke-primary hover:stroke-[3px]"
                    />
                    
                    {entity.image_url ? (
                      <>
                        <clipPath id={`clip-${entity.id}`}>
                          <path d={getHexagonPath(pos.x, pos.y, nodeRadius - 3)} />
                        </clipPath>
                        <image
                          x={pos.x - (nodeRadius - 3)}
                          y={pos.y - (nodeRadius - 3)}
                          width={(nodeRadius - 3) * 2}
                          height={(nodeRadius - 3) * 2}
                          href={entity.image_url}
                          clipPath={`url(#clip-${entity.id})`}
                          preserveAspectRatio="xMidYMid slice"
                          className="transition-opacity hover:opacity-90"
                        />
                      </>
                    ) : (
                      <foreignObject 
                        x={pos.x - 12} 
                        y={pos.y - 12} 
                        width={24} 
                        height={24}
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
                    <path
                      d={getHexagonPath(pos.x + nodeRadius * 0.7, pos.y - nodeRadius * 0.7, 10)}
                      fill="hsl(var(--primary))"
                      stroke="hsl(var(--background))"
                      strokeWidth={2}
                      className="drop-shadow-md"
                    />
                    <text
                      x={pos.x + nodeRadius * 0.7}
                      y={pos.y - nodeRadius * 0.7 + 3}
                      textAnchor="middle"
                      fill="hsl(var(--primary-foreground))"
                      fontSize="9"
                      fontWeight="bold"
                    >
                      {entity.shared_news_count}
                    </text>

                    {/* Entity name label below node */}
                    <text
                      x={pos.x}
                      y={pos.y + nodeRadius + 14}
                      textAnchor="middle"
                      fill="hsl(var(--muted-foreground))"
                      fontSize="9"
                      className="pointer-events-none"
                    >
                      {name.length > 12 ? name.substring(0, 12) + '...' : name}
                    </text>
                  </Link>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Expand/collapse button for many entities */}
        {hasMore && (
          <div className="mt-4 flex justify-center">
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
        <div className="mt-4 pt-4 border-t border-border/50">
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
