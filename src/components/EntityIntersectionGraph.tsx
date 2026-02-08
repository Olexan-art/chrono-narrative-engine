import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Network, User, Building2, Sparkles, ChevronDown, ChevronUp, Share2, TrendingUp, Eye, Newspaper, X, Zap } from "lucide-react";
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

interface MainEntityInfo {
  id?: string;
  slug?: string | null;
  name: string;
  name_en?: string | null;
  description?: string | null;
  description_en?: string | null;
  image_url?: string | null;
  entity_type: string;
  shared_news_count?: number;
}

interface EntityIntersectionGraphProps {
  mainEntity: MainEntityInfo;
  relatedEntities: RelatedEntity[];
  secondaryConnections?: SecondaryConnection[];
  className?: string;
}

// Tree layout configuration
const MAX_DISPLAYED_ENTITIES = 24;
const INITIAL_DISPLAYED = 18;

// Node size configuration
const NODE_SIZES = {
  root: { base: 72, outer: 88 },
  first: { base: 38, min: 32 },
  second: { base: 28, min: 24 },
  third: { base: 22, min: 18 },
};

function getHexagonPath(cx: number, cy: number, r: number): string {
  const points: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + 'Z';
}

function getRoundedSquarePath(cx: number, cy: number, size: number, radius: number = 16): string {
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
  
  const levelSizes = [4, 6, 7, 8, 9];
  
  while (remaining > 0) {
    const maxForLevel = levelSizes[Math.min(currentLevel, levelSizes.length - 1)];
    const countForLevel = Math.min(remaining, maxForLevel);
    levels.push(countForLevel);
    remaining -= countForLevel;
    currentLevel++;
  }
  
  const levelCount = levels.length;
  const startY = 210; // Increased to avoid overlap with root node
  const endY = containerHeight - 60;
  const levelHeight = levelCount > 1 ? (endY - startY) / (levelCount - 1) : 0;
  
  let entityIndex = 0;
  levels.forEach((count, levelIdx) => {
    const y = startY + levelIdx * levelHeight;
    const levelWidth = containerWidth - 100;
    const spacing = count > 1 ? levelWidth / (count - 1) : 0;
    const startX = count > 1 ? 50 : containerWidth / 2;
    
    for (let i = 0; i < count; i++) {
      const staggerY = (i % 2 === 0) ? 0 : (levelIdx > 0 ? 12 : 0);
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
  const [selectedEntity, setSelectedEntity] = useState<RelatedEntity | MainEntityInfo | null>(null);
  const [isRootSelected, setIsRootSelected] = useState(false);

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

  const containerWidth = 720;
  const containerHeight = 780;
  const rootX = containerWidth / 2;
  const rootY = 55;

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
    const min = 2;
    const max = 6;
    return min + ((count / maxCount) * (max - min));
  };

  const getOpacity = (count: number, isHovered: boolean) => {
    if (isHovered) return 1;
    const min = 0.5;
    const max = 0.95;
    return min + ((count / maxCount) * (max - min));
  };

  if (relatedEntities.length === 0) return null;

  const mainName = language === 'en' && mainEntity.name_en ? mainEntity.name_en : mainEntity.name;

  return (
    <Card className={`overflow-hidden border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 ${className || ''}`}>
      <CardHeader className="pb-4 border-b border-border/50">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-3 text-lg">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/20">
              <Network className="w-5 h-5 text-primary" />
            </div>
            <div>
              <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text block">
                {language === 'uk' ? 'Граф пересічень' : 'Entity Intersection Graph'}
              </span>
              <span className="text-xs text-muted-foreground font-normal">
                {language === 'uk' ? 'Інтерактивна візуалізація' : 'Interactive visualization'}
              </span>
            </div>
          </CardTitle>
          
          {/* Quick stats */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5 bg-primary/10 border-primary/30 px-3 py-1">
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
              <span className="font-semibold">{totalConnections}</span>
            </Badge>
            <Badge variant="outline" className="gap-1.5 bg-secondary/10 border-secondary/30 px-3 py-1">
              <Newspaper className="w-3.5 h-3.5 text-secondary" />
              <span className="font-semibold">{relatedEntities.length}</span>
            </Badge>
          </div>
        </div>
        
        {/* Secondary connections toggle */}
        {secondaryConnections.length > 0 && (
          <div className="flex items-center gap-2 mt-3">
            <Button
              variant={showSecondary ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setShowSecondary(!showSecondary)}
              className="gap-2 text-xs"
            >
              <Share2 className="w-3.5 h-3.5" />
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
          <div className="absolute top-4 right-4 z-20 bg-card/98 backdrop-blur-md border border-primary/30 rounded-xl p-4 shadow-2xl max-w-[240px] animate-in fade-in slide-in-from-right-3 duration-300">
            <Button 
              variant="ghost" 
              size="sm" 
              className="absolute -top-2 -right-2 h-7 w-7 rounded-full p-0 bg-card border border-border hover:bg-destructive/10"
              onClick={() => { setSelectedEntity(null); setIsRootSelected(false); }}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
            
            {/* Root indicator badge */}
            {isRootSelected && (
              <Badge variant="default" className="absolute -top-2 left-3 text-[10px] bg-primary">
                {language === 'uk' ? 'Головна' : 'Root'}
              </Badge>
            )}
            
            <div className="flex items-start gap-3">
              {selectedEntity.image_url ? (
                <img 
                  src={selectedEntity.image_url} 
                  alt={selectedEntity.name}
                  className="w-14 h-14 rounded-xl object-cover border-2 border-primary/30"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center border-2 border-primary/30">
                  {selectedEntity.entity_type === 'person' ? (
                    <User className="w-7 h-7 text-primary" />
                  ) : (
                    <Building2 className="w-7 h-7 text-primary" />
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm leading-tight">
                  {language === 'en' && selectedEntity.name_en ? selectedEntity.name_en : selectedEntity.name}
                </p>
                <Badge variant="secondary" className="text-[10px] mt-1.5 capitalize">
                  {selectedEntity.entity_type}
                </Badge>
              </div>
            </div>
            
            {/* Description for root entity */}
            {isRootSelected && 'description' in selectedEntity && selectedEntity.description && (
              <p className="text-xs text-muted-foreground mt-3 line-clamp-2">
                {language === 'en' && 'description_en' in selectedEntity && selectedEntity.description_en 
                  ? selectedEntity.description_en 
                  : selectedEntity.description}
              </p>
            )}
            
            <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
              {selectedEntity.shared_news_count !== undefined && selectedEntity.shared_news_count > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <Zap className="w-3.5 h-3.5 text-primary" />
                  <span className="text-muted-foreground">
                    {selectedEntity.shared_news_count} {language === 'uk' ? 'спільних новин' : 'shared news'}
                  </span>
                </div>
              )}
              {(selectedEntity.slug || selectedEntity.id) && (
                <Link 
                  to={`/wiki/${selectedEntity.slug || selectedEntity.id}`}
                  className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  <Eye className="w-3 h-3" />
                  {language === 'uk' ? 'Переглянути профіль →' : 'View profile →'}
                </Link>
              )}
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
                    0% { stroke-dashoffset: 40; }
                    100% { stroke-dashoffset: 0; }
                  }
                  .tree-line {
                    animation: flowDown 2.5s linear infinite;
                  }
                  
                  @keyframes arrowRun {
                    0% { offset-distance: 0%; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { offset-distance: 100%; opacity: 0; }
                  }
                  .running-arrow {
                    offset-rotate: auto;
                    animation: arrowRun 2.5s ease-in-out infinite;
                  }
                  
                  @keyframes dashMove {
                    0% { stroke-dashoffset: 24; }
                    100% { stroke-dashoffset: 0; }
                  }
                  .secondary-line {
                    animation: dashMove 1.5s linear infinite;
                  }
                  
                  @keyframes rootPulse {
                    0%, 100% { 
                      transform: scale(1);
                      filter: drop-shadow(0 0 8px hsl(var(--primary) / 0.4));
                    }
                    50% { 
                      transform: scale(1.02);
                      filter: drop-shadow(0 0 20px hsl(var(--primary) / 0.7));
                    }
                  }
                  .root-pulse {
                    transform-origin: center;
                    animation: rootPulse 3s ease-in-out infinite;
                  }
                  
                  @keyframes rootOrbit {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                  .root-orbit {
                    transform-origin: center;
                    animation: rootOrbit 20s linear infinite;
                  }
                  
                  @keyframes rootRing {
                    0%, 100% { 
                      opacity: 0.3;
                      stroke-dashoffset: 0;
                    }
                    50% { 
                      opacity: 0.7;
                      stroke-dashoffset: 50;
                    }
                  }
                  .root-ring {
                    animation: rootRing 4s ease-in-out infinite;
                  }
                  
                  @keyframes energyWave {
                    0% { 
                      r: 60;
                      opacity: 0.6;
                    }
                    100% { 
                      r: 120;
                      opacity: 0;
                    }
                  }
                  .energy-wave {
                    animation: energyWave 3s ease-out infinite;
                  }
                  .energy-wave-2 {
                    animation: energyWave 3s ease-out infinite 1s;
                  }
                  .energy-wave-3 {
                    animation: energyWave 3s ease-out infinite 2s;
                  }
                  
                  @keyframes particleFloat {
                    0%, 100% { 
                      transform: translate(0, 0);
                      opacity: 0.6;
                    }
                    25% { 
                      transform: translate(5px, -8px);
                      opacity: 1;
                    }
                    50% { 
                      transform: translate(-3px, -15px);
                      opacity: 0.8;
                    }
                    75% { 
                      transform: translate(-8px, -5px);
                      opacity: 0.4;
                    }
                  }
                  .particle {
                    animation: particleFloat 4s ease-in-out infinite;
                  }
                  
                  @keyframes nodeHover {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                  }
                  .node-hover { animation: nodeHover 0.5s ease-out; }
                  
                  @keyframes glowPulse {
                    0%, 100% { opacity: 0.4; }
                    50% { opacity: 0.8; }
                  }
                  .glow-pulse {
                    animation: glowPulse 2s ease-in-out infinite;
                  }
                `}
              </style>
              
              <linearGradient id="treeLineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.95" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.15" />
              </linearGradient>
              
              <linearGradient id="treeLineGradientHover" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="1" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
              </linearGradient>

              <linearGradient id="secondaryGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.5" />
                <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.2" />
              </linearGradient>
              
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="5" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              
              <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2.5" result="blur"/>
                <feMerge>
                  <feMergeNode in="blur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              
              <filter id="rootGlow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="12" result="blur"/>
                <feMerge>
                  <feMergeNode in="blur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              
              <radialGradient id="rootGradient" cx="30%" cy="30%" r="70%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="1" />
                <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.9" />
                <stop offset="100%" stopColor="hsl(var(--secondary))" stopOpacity="0.8" />
              </radialGradient>
              
              <radialGradient id="nodeGradient" cx="50%" cy="30%" r="70%">
                <stop offset="0%" stopColor="hsl(var(--muted))" stopOpacity="1" />
                <stop offset="100%" stopColor="hsl(var(--card))" stopOpacity="0.9" />
              </radialGradient>

              <radialGradient id="firstLevelGradient" cx="50%" cy="30%" r="70%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
                <stop offset="50%" stopColor="hsl(var(--muted))" stopOpacity="0.95" />
                <stop offset="100%" stopColor="hsl(var(--card))" stopOpacity="0.9" />
              </radialGradient>
              
              <radialGradient id="hoveredGradient" cx="50%" cy="30%" r="70%">
                <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.5" />
                <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
                <stop offset="100%" stopColor="hsl(var(--card))" stopOpacity="0.95" />
              </radialGradient>
              
              <radialGradient id="energyGradient" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
              </radialGradient>
              
              {/* Arrow marker for running arrows */}
              <marker 
                id="arrowHead" 
                markerWidth="8" 
                markerHeight="8" 
                refX="4" 
                refY="4" 
                orient="auto"
              >
                <path 
                  d="M0,1 L6,4 L0,7 L1.5,4 Z" 
                  fill="hsl(var(--primary))"
                />
              </marker>
              
              <marker 
                id="arrowHeadAccent" 
                markerWidth="10" 
                markerHeight="10" 
                refX="5" 
                refY="5" 
                orient="auto"
              >
                <path 
                  d="M0,1 L8,5 L0,9 L2,5 Z" 
                  fill="hsl(var(--accent))"
                />
              </marker>
            </defs>

            {/* Background decorative pattern */}
            <g opacity={0.04}>
              {positions.map((pos, idx) => (
                <line 
                  key={`bg-${idx}`}
                  x1={rootX} y1={rootY + 50}
                  x2={pos.x} y2={pos.y}
                  stroke="hsl(var(--foreground))"
                  strokeWidth={1}
                  strokeDasharray="2 6"
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
                    strokeDasharray="5 5"
                    strokeLinecap="round"
                    className="secondary-line transition-all duration-200"
                    style={{ animationDelay: `${index * 0.15}s` }}
                    opacity={isHighlighted ? 0.85 : 0.4}
                  />
                  {conn.weight > 1 && (
                    <g opacity={isHighlighted ? 1 : 0.75}>
                      <circle
                        cx={(fromPos.x + toPos.x) / 2}
                        cy={(fromPos.y + toPos.y) / 2}
                        r={10}
                        fill="hsl(var(--muted))"
                        stroke={isHighlighted ? "hsl(var(--accent))" : "hsl(var(--border))"}
                        strokeWidth={1.5}
                      />
                      <text
                        x={(fromPos.x + toPos.x) / 2}
                        y={(fromPos.y + toPos.y) / 2 + 3.5}
                        textAnchor="middle"
                        fill="hsl(var(--muted-foreground))"
                        fontSize="10"
                        fontWeight="bold"
                      >
                        {conn.weight}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Tree connection lines with running arrows */}
            {displayedEntities.map((entity, index) => {
              const pos = positions[index];
              if (!pos) return null;
              
              const isHovered = hoveredNode === entity.id;
              const lineWidth = getLineWidth(entity.shared_news_count);
              const opacity = getOpacity(entity.shared_news_count, isHovered);
              const pathId = `path-${entity.id}`;
              const path = getTreeConnectionPath(rootX, rootY + 55, pos.x, pos.y - 22, 0.45);
              
              // Show running arrow on some connections
              const showArrow = index % 3 === 0 || isHovered;
              
              return (
                <g key={`line-${entity.id}`}>
                  {/* Glow effect */}
                  <path
                    d={path}
                    fill="none"
                    stroke={isHovered ? "hsl(var(--accent))" : "hsl(var(--primary))"}
                    strokeWidth={lineWidth + (isHovered ? 10 : 5)}
                    strokeOpacity={isHovered ? 0.3 : 0.08}
                    strokeLinecap="round"
                    className="transition-all duration-200"
                  />
                  {/* Main curved connection */}
                  <path
                    id={pathId}
                    d={path}
                    fill="none"
                    stroke={isHovered ? "url(#treeLineGradientHover)" : "url(#treeLineGradient)"}
                    strokeWidth={isHovered ? lineWidth + 2 : lineWidth}
                    strokeOpacity={opacity}
                    strokeLinecap="round"
                    strokeDasharray={isHovered ? "none" : "10 5"}
                    className={`transition-all duration-200 ${!isHovered ? 'tree-line' : ''}`}
                    style={{ animationDelay: `${index * 0.08}s` }}
                  />
                  
                  {/* Running arrow */}
                  {showArrow && (
                    <g>
                      <circle
                        r={isHovered ? 5 : 4}
                        fill={isHovered ? "hsl(var(--accent))" : "hsl(var(--primary))"}
                        className="running-arrow"
                        style={{ 
                          offsetPath: `path('${path}')`,
                          animationDelay: `${index * 0.3}s`,
                          animationDuration: isHovered ? '1.8s' : '2.5s'
                        }}
                      />
                      <circle
                        r={isHovered ? 3 : 2}
                        fill="hsl(var(--background))"
                        className="running-arrow"
                        style={{ 
                          offsetPath: `path('${path}')`,
                          animationDelay: `${index * 0.3}s`,
                          animationDuration: isHovered ? '1.8s' : '2.5s'
                        }}
                      />
                    </g>
                  )}
                </g>
              );
            })}

            {/* Root entity energy waves */}
            <g>
              <circle
                cx={rootX}
                cy={rootY}
                r={60}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                className="energy-wave"
              />
              <circle
                cx={rootX}
                cy={rootY}
                r={60}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth={1.5}
                className="energy-wave-2"
              />
              <circle
                cx={rootX}
                cy={rootY}
                r={60}
                fill="none"
                stroke="hsl(var(--secondary))"
                strokeWidth={1}
                className="energy-wave-3"
              />
            </g>

            {/* Root orbiting ring */}
            <g className="root-orbit" style={{ transformOrigin: `${rootX}px ${rootY}px` }}>
              <ellipse
                cx={rootX}
                cy={rootY}
                rx={NODE_SIZES.root.outer + 25}
                ry={NODE_SIZES.root.outer + 15}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth={1.5}
                strokeDasharray="8 16 4 16"
                opacity={0.4}
                className="root-ring"
              />
              {/* Orbiting particles */}
              <circle cx={rootX + NODE_SIZES.root.outer + 25} cy={rootY} r={4} fill="hsl(var(--primary))" opacity={0.8} />
              <circle cx={rootX - NODE_SIZES.root.outer - 25} cy={rootY} r={3} fill="hsl(var(--secondary))" opacity={0.6} />
            </g>

            {/* Floating particles around root */}
            {[0, 1, 2, 3, 4].map((i) => (
              <circle
                key={`particle-${i}`}
                cx={rootX + Math.cos(i * 1.25) * 65}
                cy={rootY + Math.sin(i * 1.25) * 45}
                r={2.5}
                fill="hsl(var(--primary))"
                className="particle"
                style={{ animationDelay: `${i * 0.8}s` }}
                opacity={0.7}
              />
            ))}

            {/* Root entity node - CLICKABLE */}
            <g 
              className="cursor-pointer root-pulse" 
              filter="url(#rootGlow)" 
              style={{ transformOrigin: `${rootX}px ${rootY}px` }}
              onClick={(e) => {
                e.preventDefault();
                setSelectedEntity(mainEntity);
                setIsRootSelected(true);
              }}
            >
              {/* Outer glow ring */}
              <path
                d={getRoundedSquarePath(rootX, rootY, NODE_SIZES.root.outer * 2.3, 20)}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                opacity={0.5}
                className="glow-pulse"
              />
              {/* Secondary ring */}
              <path
                d={getRoundedSquarePath(rootX, rootY, NODE_SIZES.root.outer * 2.5, 22)}
                fill="none"
                stroke="hsl(var(--secondary))"
                strokeWidth={1}
                opacity={0.3}
                strokeDasharray="6 12"
              />
              {/* Main square */}
              <path
                d={getRoundedSquarePath(rootX, rootY, NODE_SIZES.root.base * 2.2, 18)}
                fill="url(#rootGradient)"
                className="drop-shadow-xl"
              />
              {/* Inner border */}
              <path
                d={getRoundedSquarePath(rootX, rootY, NODE_SIZES.root.base * 2.2, 18)}
                fill="none"
                stroke="hsl(var(--background))"
                strokeWidth={3}
                opacity={0.2}
              />
              {mainEntity.image_url ? (
                <>
                  <clipPath id="root-clip">
                    <path d={getRoundedSquarePath(rootX, rootY, (NODE_SIZES.root.base - 6) * 2.2, 16)} />
                  </clipPath>
                  <image
                    x={rootX - (NODE_SIZES.root.base - 6) * 1.1}
                    y={rootY - (NODE_SIZES.root.base - 6) * 1.1}
                    width={(NODE_SIZES.root.base - 6) * 2.2}
                    height={(NODE_SIZES.root.base - 6) * 2.2}
                    href={mainEntity.image_url}
                    clipPath="url(#root-clip)"
                    preserveAspectRatio="xMidYMid slice"
                  />
                </>
              ) : (
                <foreignObject x={rootX - 38} y={rootY - 38} width={76} height={76}>
                  <div className="w-full h-full flex items-center justify-center text-primary-foreground">
                    {mainEntity.entity_type === 'person' ? (
                      <User className="w-14 h-14" />
                    ) : (
                      <Building2 className="w-14 h-14" />
                    )}
                  </div>
                </foreignObject>
              )}
            </g>
            
            {/* Entity name below root */}
            <g>
              <text
                x={rootX}
                y={rootY + NODE_SIZES.root.base * 1.1 + 55}
                textAnchor="middle"
                fill="hsl(var(--foreground))"
                fontSize="17"
                fontWeight="700"
                className="drop-shadow-lg"
              >
                {mainName}
              </text>
              <text
                x={rootX}
                y={rootY + NODE_SIZES.root.base * 1.1 + 72}
                textAnchor="middle"
                fill="hsl(var(--muted-foreground))"
                fontSize="11"
                className="uppercase tracking-widest"
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
                <Link 
                  key={entity.id} 
                  to={`/wiki/${entity.slug || entity.id}`}
                  className={`${isHovered ? 'node-hover' : ''}`}
                >
                <g 
                  className="cursor-pointer"
                  filter={isFirstLevel || isHovered ? "url(#glow)" : "url(#softGlow)"}
                  onMouseEnter={() => setHoveredNode(entity.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  {/* Outer glow for first-level or hovered */}
                  {(isFirstLevel || isHovered) && (
                    <path
                      d={getHexagonPath(pos.x, pos.y, nodeRadius + (isHovered ? 12 : 8))}
                      fill="none"
                      stroke={isHovered ? "hsl(var(--accent))" : "hsl(var(--primary))"}
                      strokeWidth={isHovered ? 2.5 : 2}
                      strokeOpacity={isHovered ? 0.85 : 0.45}
                      className={isHovered ? "" : "glow-pulse"}
                    />
                  )}
                  {/* Main node hexagon */}
                  <path
                    d={getHexagonPath(pos.x, pos.y, nodeRadius)}
                    fill={isHovered ? "url(#hoveredGradient)" : (isFirstLevel ? "url(#firstLevelGradient)" : "url(#nodeGradient)")}
                    stroke={isHovered ? "hsl(var(--accent))" : (isFirstLevel ? "hsl(var(--primary))" : "hsl(var(--border))")}
                    strokeWidth={isHovered ? 3 : (isFirstLevel ? 2.5 : 1.5)}
                    strokeOpacity={isFirstLevel || isHovered ? 0.85 : 1}
                    className="transition-all duration-200"
                  />
                  
                  {entity.image_url ? (
                    <>
                      <clipPath id={`clip-${entity.id}`}>
                        <path d={getHexagonPath(pos.x, pos.y, nodeRadius - 4)} />
                      </clipPath>
                      <image
                        x={pos.x - (nodeRadius - 4)}
                        y={pos.y - (nodeRadius - 4)}
                        width={(nodeRadius - 4) * 2}
                        height={(nodeRadius - 4) * 2}
                        href={entity.image_url}
                        clipPath={`url(#clip-${entity.id})`}
                        preserveAspectRatio="xMidYMid slice"
                        className="transition-opacity"
                        style={{ opacity: isHovered ? 1 : 0.95 }}
                      />
                    </>
                  ) : (
                    <foreignObject 
                      x={pos.x - (isFirstLevel ? 16 : 12)} 
                      y={pos.y - (isFirstLevel ? 16 : 12)} 
                      width={isFirstLevel ? 32 : 24} 
                      height={isFirstLevel ? 32 : 24}
                    >
                      <div className={`w-full h-full flex items-center justify-center transition-colors ${isHovered ? 'text-accent' : (isFirstLevel ? 'text-primary' : 'text-muted-foreground')}`}>
                        {entity.entity_type === 'person' ? (
                          <User className={isFirstLevel ? "w-6 h-6" : "w-4 h-4"} />
                        ) : (
                          <Building2 className={isFirstLevel ? "w-6 h-6" : "w-4 h-4"} />
                        )}
                      </div>
                    </foreignObject>
                  )}

                  {/* Count badge */}
                  <path
                    d={getHexagonPath(pos.x + nodeRadius * 0.75, pos.y - nodeRadius * 0.75, isFirstLevel ? 14 : 11)}
                    fill={isHovered ? "hsl(var(--accent))" : "hsl(var(--primary))"}
                    stroke="hsl(var(--background))"
                    strokeWidth={isFirstLevel ? 2.5 : 2}
                    className="drop-shadow-lg transition-colors duration-200"
                  />
                  <text
                    x={pos.x + nodeRadius * 0.75}
                    y={pos.y - nodeRadius * 0.75 + (isFirstLevel ? 4.5 : 4)}
                    textAnchor="middle"
                    fill="hsl(var(--primary-foreground))"
                    fontSize={isFirstLevel ? "12" : "10"}
                    fontWeight="bold"
                  >
                    {entity.shared_news_count}
                  </text>

                  {/* Entity name label */}
                  <text
                    x={pos.x}
                    y={pos.y + nodeRadius + (isFirstLevel ? 18 : 15)}
                    textAnchor="middle"
                    fill={isHovered ? "hsl(var(--accent))" : (isFirstLevel ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))")}
                    fontSize={isFirstLevel ? "12" : "10"}
                    fontWeight={isFirstLevel || isHovered ? "600" : "normal"}
                    className="pointer-events-none transition-colors duration-200"
                  >
                    {name.length > (isFirstLevel ? 16 : 12) ? name.substring(0, isFirstLevel ? 16 : 12) + '…' : name}
                  </text>
                  
                  {/* Hover indicator */}
                  {isHovered && (
                    <g>
                      <circle
                        cx={pos.x}
                        cy={pos.y + nodeRadius + 30}
                        r={3.5}
                        fill="hsl(var(--accent))"
                        className="animate-pulse"
                      />
                    </g>
                  )}
                </g>
                </Link>
              );
            })}
          </svg>
        </div>

        {/* Expand/collapse button */}
        {hasMore && (
          <div className="mt-6 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAll(!showAll)}
              className="gap-2 border-primary/30 hover:bg-primary/10"
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
        <div className="mt-6 pt-4 border-t border-border/50">
          <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
              <span className="font-semibold text-foreground">{relatedEntities.length}</span>
              <span>{language === 'uk' ? "пов'язаних" : 'related'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              <span className="font-semibold text-foreground">{totalConnections}</span>
              <span>{language === 'uk' ? 'згадок' : 'mentions'}</span>
            </div>
            {secondaryConnections.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 border-t-2 border-dashed border-muted-foreground/50" />
                <span className="font-semibold text-foreground">{secondaryConnections.length}</span>
                <span>{language === 'uk' ? 'зв\'язків' : 'links'}</span>
              </div>
            )}
          </div>
          {relatedEntities.length > MAX_DISPLAYED_ENTITIES && (
            <p className="text-center text-xs text-muted-foreground/60 mt-3">
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
