import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Network, User, Building2, Eye, Newspaper, TrendingUp, X, Zap, Share2, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

interface Props {
  mainEntity: MainEntityInfo;
  relatedEntities: RelatedEntity[];
  secondaryConnections?: SecondaryConnection[];
  className?: string;
}

const MAX_ENTITIES = 32;

function getHexagonPath(cx: number, cy: number, r: number): string {
  const points: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + 'Z';
}

function getOctagonPath(cx: number, cy: number, r: number): string {
  const points: [number, number][] = [];
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI / 4) * i - Math.PI / 8;
    points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + 'Z';
}

export function EntityCyberpunkGraph({ mainEntity, relatedEntities, secondaryConnections = [], className }: Props) {
  const { language } = useLanguage();
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<RelatedEntity | MainEntityInfo | null>(null);
  const [isRootSelected, setIsRootSelected] = useState(false);

  const sortedEntities = useMemo(() =>
    [...relatedEntities].sort((a, b) => b.shared_news_count - a.shared_news_count).slice(0, MAX_ENTITIES),
    [relatedEntities]
  );

  // Distribute into 4 rings
  const rings = useMemo(() => {
    const r1 = Math.min(sortedEntities.length, 6);
    const r2 = Math.min(sortedEntities.length - r1, 8);
    const r3 = Math.min(sortedEntities.length - r1 - r2, 10);
    const r4 = Math.min(sortedEntities.length - r1 - r2 - r3, 8);
    return {
      ring1: sortedEntities.slice(0, r1),
      ring2: sortedEntities.slice(r1, r1 + r2),
      ring3: sortedEntities.slice(r1 + r2, r1 + r2 + r3),
      ring4: sortedEntities.slice(r1 + r2 + r3, r1 + r2 + r3 + r4),
    };
  }, [sortedEntities]);

  const size = 1000;
  const cx = size / 2;
  const cy = size / 2;
  const ringRadii = [190, 300, 400, 470];

  const getPositionsOnRing = (count: number, radius: number, offsetAngle = 0) =>
    Array.from({ length: count }, (_, i) => {
      const angle = (2 * Math.PI * i) / count + offsetAngle - Math.PI / 2;
      return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
    });

  const ring1Pos = useMemo(() => getPositionsOnRing(rings.ring1.length, ringRadii[0], 0), [rings.ring1.length]);
  const ring2Pos = useMemo(() => getPositionsOnRing(rings.ring2.length, ringRadii[1], Math.PI / (rings.ring2.length || 1)), [rings.ring2.length]);
  const ring3Pos = useMemo(() => getPositionsOnRing(rings.ring3.length, ringRadii[2], 0), [rings.ring3.length]);
  const ring4Pos = useMemo(() => getPositionsOnRing(rings.ring4.length, ringRadii[3], Math.PI / (rings.ring4.length || 1)), [rings.ring4.length]);

  const entityPositionMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number; ring: number }>();
    rings.ring1.forEach((e, i) => ring1Pos[i] && map.set(e.id, { ...ring1Pos[i], ring: 0 }));
    rings.ring2.forEach((e, i) => ring2Pos[i] && map.set(e.id, { ...ring2Pos[i], ring: 1 }));
    rings.ring3.forEach((e, i) => ring3Pos[i] && map.set(e.id, { ...ring3Pos[i], ring: 2 }));
    rings.ring4.forEach((e, i) => ring4Pos[i] && map.set(e.id, { ...ring4Pos[i], ring: 3 }));
    return map;
  }, [rings, ring1Pos, ring2Pos, ring3Pos, ring4Pos]);

  const maxCount = useMemo(() => Math.max(...sortedEntities.map(e => e.shared_news_count), 1), [sortedEntities]);
  const totalConnections = useMemo(() => sortedEntities.reduce((sum, e) => sum + e.shared_news_count, 0), [sortedEntities]);

  const displayedIds = useMemo(() => new Set(sortedEntities.map(e => e.id)), [sortedEntities]);
  const visibleSecondary = useMemo(() =>
    secondaryConnections.filter(c => displayedIds.has(c.from.id) && displayedIds.has(c.to.id)).slice(0, 25),
    [secondaryConnections, displayedIds]
  );

  if (relatedEntities.length === 0) return null;

  const mainName = language === 'en' && mainEntity.name_en ? mainEntity.name_en : mainEntity.name;

  const renderEntityNode = (entity: RelatedEntity, pos: { x: number; y: number }, ringIdx: number) => {
    const name = language === 'en' && entity.name_en ? entity.name_en : entity.name;
    const isHovered = hoveredNode === entity.id;
    const nodeSizes = [34, 28, 22, 18];
    const nodeR = nodeSizes[ringIdx] + (entity.shared_news_count / maxCount) * 10;

    return (
      <Link key={entity.id} to={`/wiki/${entity.slug || entity.id}`}>
        <g
          className="cursor-pointer"
          onMouseEnter={() => setHoveredNode(entity.id)}
          onMouseLeave={() => setHoveredNode(null)}
          style={{ transition: 'opacity 0.3s' }}
        >
          {/* Cyber scan line effect */}
          {isHovered && (
            <>
              <rect
                x={pos.x - nodeR - 6} y={pos.y - 1}
                width={(nodeR + 6) * 2} height={2}
                fill="hsl(var(--chart-4))"
                opacity={0.8}
                className="cyber-scanline"
              />
              <rect
                x={pos.x - 1} y={pos.y - nodeR - 6}
                width={2} height={(nodeR + 6) * 2}
                fill="hsl(var(--chart-4))"
                opacity={0.4}
              />
            </>
          )}

          {/* Glitch frame */}
          <path
            d={getOctagonPath(pos.x, pos.y, nodeR + (isHovered ? 8 : 4))}
            fill="none"
            stroke={isHovered ? "hsl(var(--chart-4))" : `hsl(var(--primary))`}
            strokeWidth={isHovered ? 2 : 0.8}
            opacity={isHovered ? 1 : 0.3}
            strokeDasharray={isHovered ? "none" : "4 8"}
            className="cyber-frame"
          />

          {/* Main hexagon */}
          <path
            d={getHexagonPath(pos.x, pos.y, nodeR)}
            fill={isHovered ? "url(#cyberHoverGrad)" : `url(#cyberRing${ringIdx}Grad)`}
            stroke={isHovered ? "hsl(var(--chart-4))" : "hsl(var(--primary))"}
            strokeWidth={isHovered ? 2.5 : ringIdx === 0 ? 2 : 1}
            strokeOpacity={isHovered ? 1 : [0.8, 0.6, 0.4, 0.3][ringIdx]}
            className="transition-all duration-200"
          />

          {entity.image_url ? (
            <>
              <clipPath id={`cyber-clip-${entity.id}`}>
                <path d={getHexagonPath(pos.x, pos.y, nodeR - 3)} />
              </clipPath>
              <image
                x={pos.x - (nodeR - 3)} y={pos.y - (nodeR - 3)}
                width={(nodeR - 3) * 2} height={(nodeR - 3) * 2}
                href={entity.image_url}
                clipPath={`url(#cyber-clip-${entity.id})`}
                preserveAspectRatio="xMidYMid slice"
                opacity={isHovered ? 1 : 0.85}
                filter={isHovered ? "url(#cyberGlitch)" : undefined}
              />
            </>
          ) : (
            <foreignObject x={pos.x - 12} y={pos.y - 12} width={24} height={24}>
              <div className={`w-full h-full flex items-center justify-center ${isHovered ? 'text-[hsl(var(--chart-4))]' : 'text-primary'}`}>
                {entity.entity_type === 'person' ? <User className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
              </div>
            </foreignObject>
          )}

          {/* Count badge - diamond shape */}
          <g transform={`translate(${pos.x + nodeR * 0.7}, ${pos.y - nodeR * 0.7}) rotate(45)`}>
            <rect
              x={-9} y={-9} width={18} height={18}
              fill={isHovered ? "hsl(var(--chart-4))" : "hsl(var(--primary))"}
              stroke="hsl(var(--background))"
              strokeWidth={2}
              rx={2}
            />
          </g>
          <text
            x={pos.x + nodeR * 0.7} y={pos.y - nodeR * 0.7 + 4}
            textAnchor="middle"
            fill="hsl(var(--primary-foreground))"
            fontSize={ringIdx === 0 ? "11" : "9"}
            fontWeight="bold"
            fontFamily="var(--font-mono)"
          >
            {entity.shared_news_count}
          </text>

          {/* Name label */}
          <text
            x={pos.x} y={pos.y + nodeR + 14}
            textAnchor="middle"
            fill={isHovered ? "hsl(var(--chart-4))" : "hsl(var(--foreground))"}
            fontSize={ringIdx <= 1 ? "11" : "9"}
            fontWeight={isHovered ? "600" : "normal"}
            fontFamily="var(--font-mono)"
            opacity={isHovered ? 1 : [0.9, 0.7, 0.5, 0.4][ringIdx]}
            className="pointer-events-none"
          >
            {name.length > 14 ? name.substring(0, 14) + '…' : name}
          </text>

          {/* Data readout on hover */}
          {isHovered && (
            <text
              x={pos.x} y={pos.y + nodeR + 26}
              textAnchor="middle"
              fill="hsl(var(--chart-4))"
              fontSize="8"
              fontFamily="var(--font-mono)"
              opacity={0.8}
            >
              [NODE:{entity.shared_news_count} | TYPE:{entity.entity_type.toUpperCase()}]
            </text>
          )}
        </g>
      </Link>
    );
  };

  return (
    <Card className={`overflow-hidden border-[hsl(var(--chart-4))]/30 bg-gradient-to-br from-[hsl(220,15%,5%)] via-card to-[hsl(160,30%,8%)] ${className || ''}`}>
      <CardHeader className="pb-4 border-b border-[hsl(var(--chart-4))]/20">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-3 text-lg">
            <div className="p-2.5 rounded-lg bg-[hsl(var(--chart-4))]/10 border border-[hsl(var(--chart-4))]/30 relative overflow-hidden">
              <Network className="w-5 h-5 text-[hsl(var(--chart-4))]" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[hsl(var(--chart-4))]/20 to-transparent cyber-sweep" />
            </div>
            <div>
              <span className="font-mono text-sm tracking-wider uppercase text-[hsl(var(--chart-4))]">
                {language === 'uk' ? '// NEURAL_GRAPH' : '// NEURAL_GRAPH'}
              </span>
              <span className="text-xs text-muted-foreground font-mono block tracking-wide">
                {language === 'uk' ? 'Cyberpunk Network Visualization' : 'Cyberpunk Network Visualization'}
              </span>
            </div>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5 bg-[hsl(var(--chart-4))]/10 border-[hsl(var(--chart-4))]/30 px-3 py-1 font-mono text-xs">
              <TrendingUp className="w-3.5 h-3.5 text-[hsl(var(--chart-4))]" />
              <span className="text-[hsl(var(--chart-4))]">{totalConnections}</span>
            </Badge>
            <Badge variant="outline" className="gap-1.5 bg-primary/10 border-primary/30 px-3 py-1 font-mono text-xs">
              <Newspaper className="w-3.5 h-3.5 text-primary" />
              <span>{sortedEntities.length}</span>
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6 relative">
        {/* Selected entity HUD panel */}
        {selectedEntity && (
          <div className="absolute top-4 right-4 z-20 bg-[hsl(220,15%,5%)]/95 backdrop-blur-md border border-[hsl(var(--chart-4))]/40 rounded-none p-4 shadow-2xl max-w-[240px] animate-in fade-in slide-in-from-right-3">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-[hsl(var(--chart-4))] via-primary to-transparent" />
            <Button
              variant="ghost" size="sm"
              className="absolute -top-2 -right-2 h-7 w-7 rounded-none p-0 bg-card border border-[hsl(var(--chart-4))]/30 hover:bg-destructive/10"
              onClick={() => { setSelectedEntity(null); setIsRootSelected(false); }}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
            <p className="text-[10px] font-mono text-[hsl(var(--chart-4))] mb-2 tracking-wider">
              {isRootSelected ? '// ROOT_NODE' : '// NODE_INFO'}
            </p>
            <div className="flex items-start gap-3">
              {selectedEntity.image_url ? (
                <img src={selectedEntity.image_url} alt="" className="w-14 h-14 object-cover border-2 border-[hsl(var(--chart-4))]/30" />
              ) : (
                <div className="w-14 h-14 bg-[hsl(var(--chart-4))]/10 flex items-center justify-center border-2 border-[hsl(var(--chart-4))]/30">
                  {selectedEntity.entity_type === 'person' ? <User className="w-7 h-7 text-[hsl(var(--chart-4))]" /> : <Building2 className="w-7 h-7 text-[hsl(var(--chart-4))]" />}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-mono font-semibold text-sm">{language === 'en' && selectedEntity.name_en ? selectedEntity.name_en : selectedEntity.name}</p>
                <Badge variant="outline" className="text-[10px] mt-1 capitalize font-mono border-[hsl(var(--chart-4))]/30">{selectedEntity.entity_type}</Badge>
              </div>
            </div>
            {selectedEntity.shared_news_count !== undefined && selectedEntity.shared_news_count > 0 && (
              <div className="mt-3 pt-2 border-t border-[hsl(var(--chart-4))]/20 flex items-center gap-2 text-xs font-mono">
                <Zap className="w-3.5 h-3.5 text-[hsl(var(--chart-4))]" />
                <span className="text-muted-foreground">{selectedEntity.shared_news_count} connections</span>
              </div>
            )}
            {(selectedEntity.slug || selectedEntity.id) && (
              <Link to={`/wiki/${selectedEntity.slug || selectedEntity.id}`} className="flex items-center gap-1.5 text-xs text-[hsl(var(--chart-4))] hover:text-primary font-mono mt-2 tracking-wide">
                <Eye className="w-3 h-3" />
                {language === 'uk' ? '> ACCESS_PROFILE' : '> ACCESS_PROFILE'}
              </Link>
            )}
          </div>
        )}

        <div className="relative w-full" style={{ maxWidth: `${size}px`, margin: '0 auto' }}>
          <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto" style={{ overflow: 'visible' }}>
            <defs>
              <style>{`
                @keyframes cyberScan {
                  0% { transform: translateY(-100%); }
                  100% { transform: translateY(100%); }
                }
                .cyber-scanline { animation: cyberScan 1.5s linear infinite; }
                
                @keyframes cyberPulse {
                  0%, 100% { opacity: 0.3; stroke-dashoffset: 0; }
                  50% { opacity: 0.8; stroke-dashoffset: 20; }
                }
                .cyber-ring { animation: cyberPulse 4s linear infinite; }
                
                @keyframes dataStream {
                  0% { stroke-dashoffset: 40; }
                  100% { stroke-dashoffset: 0; }
                }
                .data-stream { animation: dataStream 2s linear infinite; }
                
                @keyframes cyberGlow {
                  0%, 100% { filter: drop-shadow(0 0 4px hsl(var(--chart-4) / 0.4)); }
                  50% { filter: drop-shadow(0 0 16px hsl(var(--chart-4) / 0.8)); }
                }
                .cyber-root { animation: cyberGlow 2.5s ease-in-out infinite; }
                
                @keyframes hexRotate {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
                
                @keyframes dataFlow {
                  0% { offset-distance: 0%; opacity: 0; }
                  15% { opacity: 1; }
                  85% { opacity: 1; }
                  100% { offset-distance: 100%; opacity: 0; }
                }
                .data-packet {
                  offset-rotate: auto;
                  animation: dataFlow 3s ease-in-out infinite;
                }
                
                @keyframes gridPulse {
                  0%, 100% { opacity: 0.03; }
                  50% { opacity: 0.08; }
                }
                .grid-bg { animation: gridPulse 6s ease-in-out infinite; }
                
                @keyframes sweepLine {
                  0% { transform: translateX(-200%); }
                  100% { transform: translateX(200%); }
                }
                .cyber-sweep { animation: sweepLine 3s linear infinite; }
              `}</style>

              <radialGradient id="cyberRing0Grad" cx="50%" cy="30%" r="70%">
                <stop offset="0%" stopColor="hsl(var(--chart-4))" stopOpacity="0.4" />
                <stop offset="100%" stopColor="hsl(var(--card))" stopOpacity="0.95" />
              </radialGradient>
              <radialGradient id="cyberRing1Grad" cx="50%" cy="30%" r="70%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
                <stop offset="100%" stopColor="hsl(var(--card))" stopOpacity="0.9" />
              </radialGradient>
              <radialGradient id="cyberRing2Grad" cx="50%" cy="30%" r="70%">
                <stop offset="0%" stopColor="hsl(var(--chart-5))" stopOpacity="0.2" />
                <stop offset="100%" stopColor="hsl(var(--card))" stopOpacity="0.85" />
              </radialGradient>
              <radialGradient id="cyberRing3Grad" cx="50%" cy="30%" r="70%">
                <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.15" />
                <stop offset="100%" stopColor="hsl(var(--card))" stopOpacity="0.8" />
              </radialGradient>
              <radialGradient id="cyberHoverGrad" cx="50%" cy="30%" r="70%">
                <stop offset="0%" stopColor="hsl(var(--chart-4))" stopOpacity="0.6" />
                <stop offset="100%" stopColor="hsl(var(--card))" stopOpacity="0.95" />
              </radialGradient>
              <radialGradient id="cyberRootGrad" cx="30%" cy="30%" r="70%">
                <stop offset="0%" stopColor="hsl(var(--chart-4))" stopOpacity="1" />
                <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
                <stop offset="100%" stopColor="hsl(var(--chart-4))" stopOpacity="0.6" />
              </radialGradient>

              <filter id="cyberGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="cyberGlitch" x="-5%" y="-5%" width="110%" height="110%">
                <feGaussianBlur stdDeviation="0.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              
              {/* Grid pattern */}
              <pattern id="cyberGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(var(--chart-4))" strokeWidth="0.3" opacity="0.5" />
              </pattern>
            </defs>

            {/* Background grid */}
            <rect width={size} height={size} fill="url(#cyberGrid)" className="grid-bg" />

            {/* Ring circles with cyber styling */}
            {ringRadii.map((r, i) => (
              <g key={`ring-${i}`}>
                <path
                  d={getOctagonPath(cx, cy, r)}
                  fill="none"
                  stroke="hsl(var(--chart-4))"
                  strokeWidth={[1.5, 1, 0.8, 0.5][i]}
                  strokeDasharray={["12 6", "8 12", "4 16", "2 20"][i]}
                  opacity={0.15 - i * 0.03}
                  className="cyber-ring"
                  style={{ animationDelay: `${i * 1}s` }}
                />
                {/* Corner markers */}
                {[0, 90, 180, 270].map(angle => {
                  const rad = (angle * Math.PI) / 180;
                  const mx = cx + r * Math.cos(rad);
                  const my = cy + r * Math.sin(rad);
                  return (
                    <rect key={angle} x={mx - 3} y={my - 3} width={6} height={6}
                      fill="hsl(var(--chart-4))" opacity={0.2 - i * 0.04}
                      transform={`rotate(45, ${mx}, ${my})`}
                    />
                  );
                })}
              </g>
            ))}

            {/* Connection lines with data flow effect */}
            {sortedEntities.map((entity, index) => {
              const pos = entityPositionMap.get(entity.id);
              if (!pos) return null;
              const isHovered = hoveredNode === entity.id;
              const lineWidth = 1 + (entity.shared_news_count / maxCount) * 3;

              const pathStr = `M ${cx} ${cy} L ${pos.x} ${pos.y}`;

              return (
                <g key={`line-${entity.id}`}>
                  {/* Glow */}
                  <line x1={cx} y1={cy} x2={pos.x} y2={pos.y}
                    stroke={isHovered ? "hsl(var(--chart-4))" : "hsl(var(--primary))"}
                    strokeWidth={lineWidth + 4}
                    opacity={isHovered ? 0.2 : 0.04}
                  />
                  {/* Main line */}
                  <line x1={cx} y1={cy} x2={pos.x} y2={pos.y}
                    stroke={isHovered ? "hsl(var(--chart-4))" : "hsl(var(--primary))"}
                    strokeWidth={isHovered ? lineWidth + 1 : lineWidth}
                    opacity={isHovered ? 0.9 : 0.2 + (entity.shared_news_count / maxCount) * 0.4}
                    strokeDasharray={isHovered ? "none" : "6 4"}
                    className={isHovered ? "" : "data-stream"}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  />
                  {/* Data packet */}
                  {(index % 4 === 0 || isHovered) && (
                    <rect
                      width={isHovered ? 8 : 6} height={isHovered ? 4 : 3}
                      fill={isHovered ? "hsl(var(--chart-4))" : "hsl(var(--primary))"}
                      className="data-packet"
                      style={{
                        offsetPath: `path('${pathStr}')`,
                        animationDelay: `${index * 0.2}s`,
                        animationDuration: isHovered ? '1.5s' : '3s'
                      }}
                    />
                  )}
                </g>
              );
            })}

            {/* Secondary connections */}
            {visibleSecondary.map((conn, index) => {
              const fromPos = entityPositionMap.get(conn.from.id);
              const toPos = entityPositionMap.get(conn.to.id);
              if (!fromPos || !toPos) return null;
              const isH = hoveredNode === conn.from.id || hoveredNode === conn.to.id;
              return (
                <g key={`sec-${conn.from.id}-${conn.to.id}`}>
                  <line x1={fromPos.x} y1={fromPos.y} x2={toPos.x} y2={toPos.y}
                    stroke={isH ? "hsl(var(--chart-5))" : "hsl(var(--muted-foreground))"}
                    strokeWidth={isH ? 1.5 : 0.8}
                    strokeDasharray="3 6"
                    opacity={isH ? 0.7 : 0.15}
                    className="data-stream"
                    style={{ animationDelay: `${index * 0.2}s` }}
                  />
                </g>
              );
            })}

            {/* Root node */}
            <g
              className="cursor-pointer cyber-root"
              style={{ transformOrigin: `${cx}px ${cy}px` }}
              onClick={(e) => {
                e.preventDefault();
                setSelectedEntity(mainEntity);
                setIsRootSelected(true);
              }}
            >
              {/* Outer scan frame */}
              <path
                d={getOctagonPath(cx, cy, 68)}
                fill="none"
                stroke="hsl(var(--chart-4))"
                strokeWidth={2}
                opacity={0.6}
                strokeDasharray="16 8"
                className="cyber-ring"
              />
              {/* Inner frame */}
              <path
                d={getOctagonPath(cx, cy, 58)}
                fill="url(#cyberRootGrad)"
              />
              <path
                d={getOctagonPath(cx, cy, 58)}
                fill="none"
                stroke="hsl(var(--chart-4))"
                strokeWidth={2}
                opacity={0.8}
              />
              {/* Corner brackets */}
              {[0, 1, 2, 3].map(i => {
                const angle = (Math.PI / 2) * i;
                const bx = cx + 72 * Math.cos(angle);
                const by = cy + 72 * Math.sin(angle);
                return (
                  <g key={`bracket-${i}`}>
                    <line x1={bx - 6} y1={by} x2={bx + 6} y2={by}
                      stroke="hsl(var(--chart-4))" strokeWidth={2} opacity={0.8} />
                    <line x1={bx} y1={by - 6} x2={bx} y2={by + 6}
                      stroke="hsl(var(--chart-4))" strokeWidth={2} opacity={0.8} />
                  </g>
                );
              })}

              {mainEntity.image_url ? (
                <>
                  <clipPath id="cyber-root-clip">
                    <path d={getOctagonPath(cx, cy, 52)} />
                  </clipPath>
                  <image
                    x={cx - 52} y={cy - 52}
                    width={104} height={104}
                    href={mainEntity.image_url}
                    clipPath="url(#cyber-root-clip)"
                    preserveAspectRatio="xMidYMid slice"
                  />
                </>
              ) : (
                <foreignObject x={cx - 30} y={cy - 30} width={60} height={60}>
                  <div className="w-full h-full flex items-center justify-center text-[hsl(var(--chart-4))]">
                    {mainEntity.entity_type === 'person' ? <User className="w-12 h-12" /> : <Building2 className="w-12 h-12" />}
                  </div>
                </foreignObject>
              )}
            </g>

            {/* Root name */}
            <text x={cx} y={cy + 78} textAnchor="middle"
              fill="hsl(var(--chart-4))" fontSize="14" fontWeight="700" fontFamily="var(--font-mono)"
              className="uppercase tracking-wider"
            >
              {mainName}
            </text>
            <text x={cx} y={cy + 93} textAnchor="middle"
              fill="hsl(var(--muted-foreground))" fontSize="10" fontFamily="var(--font-mono)"
              className="uppercase tracking-widest"
            >
              [{mainEntity.entity_type.toUpperCase()}]
            </text>

            {/* Entity nodes */}
            {rings.ring1.map((e, i) => ring1Pos[i] && renderEntityNode(e, ring1Pos[i], 0))}
            {rings.ring2.map((e, i) => ring2Pos[i] && renderEntityNode(e, ring2Pos[i], 1))}
            {rings.ring3.map((e, i) => ring3Pos[i] && renderEntityNode(e, ring3Pos[i], 2))}
            {rings.ring4.map((e, i) => ring4Pos[i] && renderEntityNode(e, ring4Pos[i], 3))}
          </svg>
        </div>

        {/* Stats footer */}
        <TooltipProvider delayDuration={200}>
          <div className="mt-6 pt-4 border-t border-[hsl(var(--chart-4))]/20">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex flex-col items-center gap-1 p-2 rounded bg-[hsl(var(--chart-4))]/5 border border-[hsl(var(--chart-4))]/20 cursor-help">
                    <div className="flex items-center gap-1.5 text-[hsl(var(--chart-4))]">
                      <div className="w-2 h-2 bg-[hsl(var(--chart-4))]" />
                      <span className="uppercase tracking-wider text-[10px]">Nodes</span>
                    </div>
                    <span className="text-foreground font-bold text-lg">{sortedEntities.length}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="font-sans text-xs max-w-[200px]">
                  {language === 'uk' ? 'Кількість пов\'язаних сутностей у графі' : 'Number of related entities displayed in the graph'}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex flex-col items-center gap-1 p-2 rounded bg-primary/5 border border-primary/20 cursor-help">
                    <div className="flex items-center gap-1.5 text-primary">
                      <Zap className="w-3 h-3" />
                      <span className="uppercase tracking-wider text-[10px]">Links</span>
                    </div>
                    <span className="text-foreground font-bold text-lg">{totalConnections}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="font-sans text-xs max-w-[200px]">
                  {language === 'uk' ? 'Загальна кількість спільних згадок у новинах' : 'Total shared news mentions across all connected entities'}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex flex-col items-center gap-1 p-2 rounded bg-[hsl(var(--chart-5))]/5 border border-[hsl(var(--chart-5))]/20 cursor-help">
                    <div className="flex items-center gap-1.5 text-[hsl(var(--chart-5))]">
                      <Share2 className="w-3 h-3" />
                      <span className="uppercase tracking-wider text-[10px]">Cross</span>
                    </div>
                    <span className="text-foreground font-bold text-lg">{visibleSecondary.length}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="font-sans text-xs max-w-[200px]">
                  {language === 'uk' ? 'Кількість перехресних зв\'язків між вузлами (без кореневого)' : 'Cross-connections between nodes (excluding root entity)'}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex flex-col items-center gap-1 p-2 rounded bg-[hsl(var(--accent))]/5 border border-[hsl(var(--accent))]/20 cursor-help">
                    <div className="flex items-center gap-1.5 text-[hsl(var(--accent))]">
                      <TrendingUp className="w-3 h-3" />
                      <span className="uppercase tracking-wider text-[10px]">Avg</span>
                    </div>
                    <span className="text-foreground font-bold text-lg">{sortedEntities.length > 0 ? (totalConnections / sortedEntities.length).toFixed(1) : '0'}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="font-sans text-xs max-w-[200px]">
                  {language === 'uk' ? 'Середня кількість зв\'язків на вузол' : 'Average number of connections per node'}
                </TooltipContent>
              </Tooltip>
            </div>
            {/* Density bar */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="mt-3 flex items-center gap-2 cursor-help">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Density</span>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[hsl(var(--chart-4))] to-primary rounded-full transition-all"
                      style={{ width: `${Math.min(100, sortedEntities.length > 1 ? (visibleSecondary.length / (sortedEntities.length * (sortedEntities.length - 1) / 2)) * 100 : 0)}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {sortedEntities.length > 1 ? ((visibleSecondary.length / (sortedEntities.length * (sortedEntities.length - 1) / 2)) * 100).toFixed(1) : '0'}%
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="font-sans text-xs max-w-[220px]">
                {language === 'uk' ? 'Щільність графу — відсоток реалізованих зв\'язків від максимально можливих' : 'Graph density — percentage of actual connections vs maximum possible'}
              </TooltipContent>
            </Tooltip>
            {/* Top connected node */}
            {sortedEntities.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="mt-2 flex items-center gap-2 text-[10px] font-mono text-muted-foreground cursor-help">
                    <span className="uppercase tracking-widest">Top Node:</span>
                    <span className="text-[hsl(var(--chart-4))] font-semibold">
                      {language === 'en' && sortedEntities[0].name_en ? sortedEntities[0].name_en : sortedEntities[0].name}
                    </span>
                    <span>({sortedEntities[0].shared_news_count} links)</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="font-sans text-xs max-w-[220px]">
                  {language === 'uk' ? 'Найбільш пов\'язана сутність із найвищою кількістю спільних новин' : 'Most connected entity with the highest number of shared news articles'}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
