import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Network, User, Building2, Sparkles, ChevronDown, ChevronUp, Share2, TrendingUp, Eye, Newspaper, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  className?: string;
}

// Tree layout configuration
const MAX_DISPLAYED_ENTITIES = 24;
const INITIAL_DISPLAYED = 18;

// Node size configuration
const NODE_SIZES = {
  root: { base: 80, outer: 96 },
  first: { base: 36, min: 30 },
  second: { base: 26, min: 22 },
  third: { base: 20, min: 18 },
};

function getHexagonPath(cx: number, cy: number, r: number): string {
  const points: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + 'Z';
}

function getRoundedSquarePath(cx: number, cy: number, size: number, radius: number = 14): string {
  const half = size / 2;
  const x = cx - half;
  const y = cy - half;
  return `M ${x + radius} ${y}
    L ${x + size - radius} ${y}
    Q ${x + size} ${y} ${x + size} ${y + radius}
    L ${x + size} ${y + size - radius}
    Q ${x + size} ${y + size} ${x + size - radius} ${y + size}
    L ${x + radius} ${y + size}
    Q ${x} ${y + size} ${x} ${y + size - radius}
    L ${x} ${y + radius}
    Q ${x} ${y} ${x + radius} ${y}
    Z`;
}

function calculateTreePositions(entityCount: number, containerWidth: number, containerHeight: number) {
  const positions: { x: number; y: number; level: number }[] = [];
  
  if (entityCount === 0) return positions;
  
  const levels: number[] = [];
  let remaining = entityCount;
  let currentLevel = 0;
  
  const levelSizes = [3, 5, 6, 7, 8];
  
  while (remaining > 0) {
    const maxForLevel = levelSizes[Math.min(currentLevel, levelSizes.length - 1)];
    const countForLevel = Math.min(remaining, maxForLevel);
    levels.push(countForLevel);
    remaining -= countForLevel;
    currentLevel++;
  }
  
  const levelCount = levels.length;
  const startY = 130;
  const endY = containerHeight - 50;
  const levelHeight = levelCount > 1 ? (endY - startY) / (levelCount - 1) : 0;
  
  let entityIndex = 0;
  levels.forEach((count, levelIdx) => {
    const y = startY + levelIdx * levelHeight;
    const levelWidth = containerWidth - 80;
    const spacing = count > 1 ? levelWidth / (count - 1) : 0;
    const startX = count > 1 ? 40 : containerWidth / 2;
    
    for (let i = 0; i < count; i++) {
      const staggerY = (i % 2 === 0) ? 0 : (levelIdx > 0 ? 10 : 0);
      const x = count > 1 ? startX + i * spacing : startX;
      positions.push({ x, y: y + staggerY, level: levelIdx });
      entityIndex++;
    }
  });
  
  return positions;
}

function getTreeConnectionPath(
  fromX: number, fromY: number, 
  toX: number, toY: number,
  curveStrength: number = 0.5
): string {
  const midY = fromY + (toY - fromY) * curveStrength;
  return `M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`;
}

export function EntityIntersectionGraph({ mainEntity, relatedEntities, secondaryConnections = [], className }: EntityIntersectionGraphProps) {
  const { language } = useLanguage();
  const [showAll, setShowAll] = useState(false);
  const [showSecondary, setShowSecondary] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<RelatedEntity | null>(null);

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

  const containerWidth = 700;
  const containerHeight = 720;
  const rootX = containerWidth / 2;
  const rootY = -55;

  const positions = useMemo(() => 
    calculateTreePositions(displayedEntities.length, containerWidth, containerHeight),
    [displayedEntities.length]
  );

  const getNodeSize = (level: number, sharedCount: number, maxCount: number) => {
    const importance = sharedCount / maxCount;
    if (level === 0) {
      return NODE_SIZES.first.min + (NODE_SIZES.first.base - NODE_SIZES.first.min) * importance;
    } else if (level === 1) {
      return NODE_SIZES.second.min + (NODE_SIZES.second.base - NODE_SIZES.second.min) * importance;
    } else {
      return NODE_SIZES.third.min + (NODE_SIZES.third.base - NODE_SIZES.third.min) * importance;
    }
  };

  const entityPositionMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    displayedEntities.forEach((entity, index) => {
      if (positions[index]) {
        map.set(entity.id, { x: positions[index].x, y: positions[index].y });
      }
    });
    return map;
  }, [displayedEntities, positions]);

  const visibleSecondaryConnections = useMemo(() => {
    if (!showSecondary) return [];
    const displayedIds = new Set(displayedEntities.map(e => e.id));
    return secondaryConnections.filter(
      conn => displayedIds.has(conn.from.id) && displayedIds.has(conn.to.id)
    );
  }, [secondaryConnections, displayedEntities, showSecondary]);

  const maxCount = useMemo(() => 
    Math.max(...displayedEntities.map(e => e.shared_news_count), 1),
    [displayedEntities]
  );

  const totalConnections = useMemo(() => 
    displayedEntities.reduce((sum, e) => sum + e.shared_news_count, 0),
    [displayedEntities]
  );
  
  const getLineWidth = (count: number) => {
    const min = 1.5;
    const max = 5;
    return min + ((count / maxCount) * (max - min));
  };

  const getOpacity = (count: number, isHovered: boolean) => {
    if (isHovered) return 1;
    const min = 0.4;
    const max = 0.9;
    return min + ((count / maxCount) * (max - min));
  };

  if (relatedEntities.length === 0) return null;

  const mainName = language === 'en' && mainEntity.name_en ? mainEntity.name_en : mainEntity.name;

  return (
    <Card className={`overflow-hidden border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 ${className || ''}`}>
      <CardHeader className="pb-3 border-b border-border/50">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="p-2 rounded-lg bg-primary/10">
              <Network className="w-5 h-5 text-primary" />
            </div>
            <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              {language === 'uk' ? 'Граф пересічень' : 'Entity Intersection Graph'}
            </span>
          </CardTitle>
          
          {/* Quick stats */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5 bg-primary/5">
              <TrendingUp className="w-3 h-3" />
              {totalConnections}
            </Badge>
            <Badge variant="outline" className="gap-1.5 bg-secondary/5">
              <Newspaper className="w-3 h-3" />
              {relatedEntities.length}
            </Badge>
            <Sparkles className="w-4 h-4 text-primary/50" />
          </div>
        </div>
        
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
      
      <CardContent className="pt-6 relative">
        {/* Selected entity panel */}
        {selectedEntity && (
          <div className="absolute top-2 right-2 z-20 bg-card/95 backdrop-blur-sm border border-primary/30 rounded-lg p-3 shadow-xl max-w-[200px] animate-in fade-in slide-in-from-right-2 duration-200">
            <Button 
              variant="ghost" 
              size="sm" 
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 bg-card border"
              onClick={() => setSelectedEntity(null)}
            >
              <X className="w-3 h-3" />
            </Button>
            <div className="flex items-start gap-2">
              {selectedEntity.image_url ? (
                <img 
                  src={selectedEntity.image_url} 
                  alt={selectedEntity.name}
                  className="w-10 h-10 rounded-lg object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  {selectedEntity.entity_type === 'person' ? (
                    <User className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <Building2 className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {language === 'en' && selectedEntity.name_en ? selectedEntity.name_en : selectedEntity.name}
                </p>
                <p className="text-xs text-muted-foreground capitalize">{selectedEntity.entity_type}</p>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-border/50">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Newspaper className="w-3 h-3 text-primary" />
                <span>{selectedEntity.shared_news_count} {language === 'uk' ? 'спільних' : 'shared'}</span>
              </div>
              <Link 
                to={`/wiki/${selectedEntity.slug || selectedEntity.id}`}
                className="mt-2 block text-xs text-primary hover:underline"
              >
                {language === 'uk' ? 'Переглянути профіль →' : 'View profile →'}
              </Link>
            </div>
          </div>
        )}
        
        <div className="relative w-full" style={{ maxWidth: `${containerWidth}px`, margin: '0 auto' }}>
          <svg 
            viewBox={`0 0 ${containerWidth} ${containerHeight}`}
            className="w-full h-auto"
            style={{ overflow: 'visible' }}
          >
            {/* Definitions */}
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
                    50% { opacity: 1; transform: scale(1.03); }
                  }
                  .pulse-node {
                    animation: pulse 2.5s ease-in-out infinite;
                  }
                  @keyframes glow {
                    0%, 100% { filter: drop-shadow(0 0 3px hsl(var(--primary) / 0.3)); }
                    50% { filter: drop-shadow(0 0 12px hsl(var(--primary) / 0.7)); }
                  }
                  .glow-node {
                    animation: glow 3s ease-in-out infinite;
                  }
                  @keyframes fogDrift {
                    0% { opacity: 0.25; transform: translate(0, 0) scale(1); }
                    25% { opacity: 0.45; transform: translate(-8px, 5px) scale(1.08); }
                    50% { opacity: 0.35; transform: translate(5px, -3px) scale(1.15); }
                    75% { opacity: 0.55; transform: translate(-5px, -6px) scale(1.05); }
                    100% { opacity: 0.25; transform: translate(0, 0) scale(1); }
                  }
                  @keyframes fogPulse {
                    0%, 100% { opacity: 0.2; filter: blur(30px); }
                    50% { opacity: 0.45; filter: blur(40px); }
                  }
                  .fog-layer-1 { animation: fogDrift 10s ease-in-out infinite; }
                  .fog-layer-2 { animation: fogDrift 14s ease-in-out infinite reverse; }
                  .fog-layer-3 { animation: fogPulse 8s ease-in-out infinite; }
                  
                  @keyframes nodeHover {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-4px); }
                  }
                  .node-hover { animation: nodeHover 0.6s ease-out; }
                `}
              </style>
              
              <linearGradient id="treeLineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.95" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
              </linearGradient>
              
              <linearGradient id="treeLineGradientHover" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="1" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.5" />
              </linearGradient>

              <linearGradient id="secondaryGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.5" />
                <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.2" />
              </linearGradient>
              
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
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

              <filter id="fogBlur" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="25" result="blur"/>
                <feMerge><feMergeNode in="blur"/></feMerge>
              </filter>
              
              <radialGradient id="rootGradient" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="hsl(var(--primary))" />
                <stop offset="60%" stopColor="hsl(var(--primary))" stopOpacity="0.85" />
                <stop offset="100%" stopColor="hsl(var(--secondary))" stopOpacity="0.7" />
              </radialGradient>
              
              <radialGradient id="nodeGradient" cx="50%" cy="30%" r="70%">
                <stop offset="0%" stopColor="hsl(var(--muted))" stopOpacity="1" />
                <stop offset="100%" stopColor="hsl(var(--card))" stopOpacity="0.9" />
              </radialGradient>

              <radialGradient id="firstLevelGradient" cx="50%" cy="30%" r="70%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
                <stop offset="50%" stopColor="hsl(var(--muted))" stopOpacity="0.95" />
                <stop offset="100%" stopColor="hsl(var(--card))" stopOpacity="0.9" />
              </radialGradient>
              
              <radialGradient id="hoveredGradient" cx="50%" cy="30%" r="70%">
                <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.4" />
                <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
                <stop offset="100%" stopColor="hsl(var(--card))" stopOpacity="0.95" />
              </radialGradient>

              <radialGradient id="fogGradient1" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.5" />
                <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
              </radialGradient>

              <radialGradient id="fogGradient2" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="hsl(var(--secondary))" stopOpacity="0.4" />
                <stop offset="60%" stopColor="hsl(var(--secondary))" stopOpacity="0.15" />
                <stop offset="100%" stopColor="hsl(var(--secondary))" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Background decorative lines */}
            <g opacity={0.08}>
              {positions.map((pos, idx) => (
                <line 
                  key={`bg-${idx}`}
                  x1={rootX} y1={rootY + 40}
                  x2={pos.x} y2={pos.y}
                  stroke="hsl(var(--border))"
                  strokeWidth={1}
                  strokeDasharray="4 8"
                />
              ))}
            </g>

            {/* Secondary connections */}
            {visibleSecondaryConnections.map((conn, index) => {
              const fromPos = entityPositionMap.get(conn.from.id);
              const toPos = entityPositionMap.get(conn.to.id);
              if (!fromPos || !toPos) return null;
              const isHighlighted = hoveredNode === conn.from.id || hoveredNode === conn.to.id;

              return (
                <g key={`secondary-${conn.from.id}-${conn.to.id}`}>
                  <line
                    x1={fromPos.x}
                    y1={fromPos.y}
                    x2={toPos.x}
                    y2={toPos.y}
                    stroke={isHighlighted ? "hsl(var(--accent))" : "url(#secondaryGradient)"}
                    strokeWidth={isHighlighted ? 2.5 : 1.5}
                    strokeDasharray="4 4"
                    strokeLinecap="round"
                    className="secondary-line transition-all duration-200"
                    style={{ animationDelay: `${index * 0.2}s` }}
                    opacity={isHighlighted ? 0.8 : 0.35}
                  />
                  {conn.weight > 1 && (
                    <g opacity={isHighlighted ? 1 : 0.7}>
                      <circle
                        cx={(fromPos.x + toPos.x) / 2}
                        cy={(fromPos.y + toPos.y) / 2}
                        r={9}
                        fill="hsl(var(--muted))"
                        stroke={isHighlighted ? "hsl(var(--accent))" : "hsl(var(--border))"}
                        strokeWidth={1.5}
                      />
                      <text
                        x={(fromPos.x + toPos.x) / 2}
                        y={(fromPos.y + toPos.y) / 2 + 3}
                        textAnchor="middle"
                        fill="hsl(var(--muted-foreground))"
                        fontSize="9"
                        fontWeight="bold"
                      >
                        {conn.weight}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Tree connection lines */}
            {displayedEntities.map((entity, index) => {
              const pos = positions[index];
              if (!pos) return null;
              
              const isHovered = hoveredNode === entity.id;
              const lineWidth = getLineWidth(entity.shared_news_count);
              const opacity = getOpacity(entity.shared_news_count, isHovered);
              
              return (
                <g key={`line-${entity.id}`}>
                  {/* Glow effect */}
                  <path
                    d={getTreeConnectionPath(rootX, rootY + 40, pos.x, pos.y - 20, 0.4)}
                    fill="none"
                    stroke={isHovered ? "hsl(var(--accent))" : "hsl(var(--primary))"}
                    strokeWidth={lineWidth + (isHovered ? 8 : 4)}
                    strokeOpacity={isHovered ? 0.25 : 0.1}
                    strokeLinecap="round"
                    className="transition-all duration-200"
                  />
                  {/* Main curved connection */}
                  <path
                    d={getTreeConnectionPath(rootX, rootY + 40, pos.x, pos.y - 20, 0.4)}
                    fill="none"
                    stroke={isHovered ? "url(#treeLineGradientHover)" : "url(#treeLineGradient)"}
                    strokeWidth={isHovered ? lineWidth + 1.5 : lineWidth}
                    strokeOpacity={opacity}
                    strokeLinecap="round"
                    strokeDasharray={isHovered ? "none" : "8 4"}
                    className={`transition-all duration-200 ${!isHovered ? 'tree-line' : ''}`}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  />
                </g>
              );
            })}

            {/* Fog layers */}
            <g>
              <ellipse
                cx={rootX - 40}
                cy={rootY + 25}
                rx={100}
                ry={60}
                fill="url(#fogGradient1)"
                filter="url(#fogBlur)"
                className="fog-layer-1"
              />
              <ellipse
                cx={rootX + 50}
                cy={rootY - 15}
                rx={90}
                ry={55}
                fill="url(#fogGradient2)"
                filter="url(#fogBlur)"
                className="fog-layer-2"
              />
              <circle
                cx={rootX}
                cy={rootY}
                r={120}
                fill="url(#fogGradient1)"
                filter="url(#fogBlur)"
                className="fog-layer-3"
              />
            </g>

            {/* Root entity node */}
            <g className="cursor-default" filter="url(#glow)">
              {/* Pulsing outer ring */}
              <path
                d={getRoundedSquarePath(rootX, rootY, NODE_SIZES.root.outer * 2.2, 18)}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                className="pulse-node"
              />
              {/* Secondary outer glow */}
              <path
                d={getRoundedSquarePath(rootX, rootY, NODE_SIZES.root.outer * 2.2 + 20, 22)}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth={1.5}
                strokeOpacity={0.25}
                className="glow-node"
              />
              {/* Main square */}
              <path
                d={getRoundedSquarePath(rootX, rootY, NODE_SIZES.root.base * 2.2, 16)}
                fill="url(#rootGradient)"
                className="drop-shadow-lg"
              />
              {mainEntity.image_url ? (
                <>
                  <clipPath id="root-clip">
                    <path d={getRoundedSquarePath(rootX, rootY, (NODE_SIZES.root.base - 4) * 2.2, 14)} />
                  </clipPath>
                  <image
                    x={rootX - (NODE_SIZES.root.base - 4) * 1.1}
                    y={rootY - (NODE_SIZES.root.base - 4) * 1.1}
                    width={(NODE_SIZES.root.base - 4) * 2.2}
                    height={(NODE_SIZES.root.base - 4) * 2.2}
                    href={mainEntity.image_url}
                    clipPath="url(#root-clip)"
                    preserveAspectRatio="xMidYMid slice"
                  />
                </>
              ) : (
                <foreignObject x={rootX - 35} y={rootY - 35} width={70} height={70}>
                  <div className="w-full h-full flex items-center justify-center text-primary-foreground">
                    {mainEntity.entity_type === 'person' ? (
                      <User className="w-12 h-12" />
                    ) : (
                      <Building2 className="w-12 h-12" />
                    )}
                  </div>
                </foreignObject>
              )}
              {/* Entity name label */}
              <text
                x={rootX + NODE_SIZES.root.outer * 1.1 + 25}
                y={rootY + 8}
                textAnchor="start"
                fill="hsl(var(--foreground))"
                fontSize="18"
                fontWeight="700"
                className="drop-shadow-lg"
              >
                {mainName}
              </text>
              {/* Entity type badge */}
              <text
                x={rootX + NODE_SIZES.root.outer * 1.1 + 25}
                y={rootY + 28}
                textAnchor="start"
                fill="hsl(var(--muted-foreground))"
                fontSize="11"
                className="uppercase tracking-wider"
              >
                {mainEntity.entity_type}
              </text>
            </g>

            {/* Entity nodes */}
            {displayedEntities.map((entity, index) => {
              const pos = positions[index];
              if (!pos) return null;
              
              const name = language === 'en' && entity.name_en ? entity.name_en : entity.name;
              const nodeRadius = getNodeSize(pos.level, entity.shared_news_count, maxCount);
              const isFirstLevel = pos.level === 0;
              const isHovered = hoveredNode === entity.id;
              
              return (
                <g 
                  key={entity.id} 
                  className={`cursor-pointer ${isHovered ? 'node-hover' : ''}`}
                  filter={isFirstLevel || isHovered ? "url(#glow)" : "url(#softGlow)"}
                  onMouseEnter={() => setHoveredNode(entity.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={(e) => {
                    e.preventDefault();
                    setSelectedEntity(entity);
                  }}
                >
                  {/* Outer glow for first-level or hovered */}
                  {(isFirstLevel || isHovered) && (
                    <path
                      d={getHexagonPath(pos.x, pos.y, nodeRadius + (isHovered ? 10 : 6))}
                      fill="none"
                      stroke={isHovered ? "hsl(var(--accent))" : "hsl(var(--primary))"}
                      strokeWidth={isHovered ? 2.5 : 1.5}
                      strokeOpacity={isHovered ? 0.8 : 0.4}
                      className={isHovered ? "" : "glow-node"}
                    />
                  )}
                  {/* Main node hexagon */}
                  <path
                    d={getHexagonPath(pos.x, pos.y, nodeRadius)}
                    fill={isHovered ? "url(#hoveredGradient)" : (isFirstLevel ? "url(#firstLevelGradient)" : "url(#nodeGradient)")}
                    stroke={isHovered ? "hsl(var(--accent))" : (isFirstLevel ? "hsl(var(--primary))" : "hsl(var(--border))")}
                    strokeWidth={isHovered ? 3 : (isFirstLevel ? 2.5 : 1.5)}
                    strokeOpacity={isFirstLevel || isHovered ? 0.8 : 1}
                    className="transition-all duration-200"
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
                        className="transition-opacity"
                        style={{ opacity: isHovered ? 1 : 0.95 }}
                      />
                    </>
                  ) : (
                    <foreignObject 
                      x={pos.x - (isFirstLevel ? 14 : 10)} 
                      y={pos.y - (isFirstLevel ? 14 : 10)} 
                      width={isFirstLevel ? 28 : 20} 
                      height={isFirstLevel ? 28 : 20}
                    >
                      <div className={`w-full h-full flex items-center justify-center transition-colors ${isHovered ? 'text-accent' : (isFirstLevel ? 'text-primary' : 'text-muted-foreground')}`}>
                        {entity.entity_type === 'person' ? (
                          <User className={isFirstLevel ? "w-5 h-5" : "w-3.5 h-3.5"} />
                        ) : (
                          <Building2 className={isFirstLevel ? "w-5 h-5" : "w-3.5 h-3.5"} />
                        )}
                      </div>
                    </foreignObject>
                  )}

                  {/* Count badge */}
                  <path
                    d={getHexagonPath(pos.x + nodeRadius * 0.7, pos.y - nodeRadius * 0.7, isFirstLevel ? 13 : 10)}
                    fill={isHovered ? "hsl(var(--accent))" : "hsl(var(--primary))"}
                    stroke="hsl(var(--background))"
                    strokeWidth={isFirstLevel ? 2.5 : 2}
                    className="drop-shadow-md transition-colors duration-200"
                  />
                  <text
                    x={pos.x + nodeRadius * 0.7}
                    y={pos.y - nodeRadius * 0.7 + (isFirstLevel ? 4 : 3.5)}
                    textAnchor="middle"
                    fill="hsl(var(--primary-foreground))"
                    fontSize={isFirstLevel ? "11" : "9"}
                    fontWeight="bold"
                  >
                    {entity.shared_news_count}
                  </text>

                  {/* Entity name label */}
                  <text
                    x={pos.x}
                    y={pos.y + nodeRadius + (isFirstLevel ? 16 : 13)}
                    textAnchor="middle"
                    fill={isHovered ? "hsl(var(--accent))" : (isFirstLevel ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))")}
                    fontSize={isFirstLevel ? "11" : "9"}
                    fontWeight={isFirstLevel || isHovered ? "600" : "normal"}
                    className="pointer-events-none transition-colors duration-200"
                  >
                    {name.length > (isFirstLevel ? 18 : 12) ? name.substring(0, isFirstLevel ? 18 : 12) + '...' : name}
                  </text>
                  
                  {/* Hover indicator */}
                  {isHovered && (
                    <circle
                      cx={pos.x}
                      cy={pos.y + nodeRadius + 28}
                      r={3}
                      fill="hsl(var(--accent))"
                      className="animate-pulse"
                    />
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Expand/collapse button */}
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

        {/* Stats footer */}
        <div className="mt-4 pt-4 border-t border-border/50">
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
              <span className="font-medium">{relatedEntities.length}</span>
              <span>{language === 'uk' ? "пов'язаних" : 'related'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Eye className="w-3.5 h-3.5 text-primary" />
              <span className="font-medium">{totalConnections}</span>
              <span>{language === 'uk' ? 'згадок' : 'mentions'}</span>
            </div>
            {secondaryConnections.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-5 h-0.5 border-t-2 border-dashed border-muted-foreground/50" />
                <span className="font-medium">{secondaryConnections.length}</span>
                <span>{language === 'uk' ? 'зв\'язків' : 'links'}</span>
              </div>
            )}
          </div>
          {relatedEntities.length > MAX_DISPLAYED_ENTITIES && (
            <p className="text-center text-xs text-muted-foreground/60 mt-2">
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
