import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Network, User, Building2, Globe, Eye, Newspaper, TrendingUp, X, Zap, Share2 } from "lucide-react";
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

interface EntityGhostlyGraphProps {
  mainEntity: MainEntityInfo;
  relatedEntities: RelatedEntity[];
  secondaryConnections?: SecondaryConnection[];
  wikiLinkedIds?: Set<string>;
  className?: string;
}

const MAX_ENTITIES = 24;

function getHexagonPath(cx: number, cy: number, r: number): string {
  const points: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + 'Z';
}

export function EntityGhostlyGraph({ mainEntity, relatedEntities, secondaryConnections = [], wikiLinkedIds, className }: EntityGhostlyGraphProps) {
  const { language } = useLanguage();
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<RelatedEntity | MainEntityInfo | null>(null);
  const [isRootSelected, setIsRootSelected] = useState(false);

  const sortedEntities = useMemo(() =>
    [...relatedEntities].sort((a, b) => b.shared_news_count - a.shared_news_count).slice(0, MAX_ENTITIES),
    [relatedEntities]
  );

  // Split into 3 rings
  const rings = useMemo(() => {
    const r1Count = Math.min(sortedEntities.length, 6);
    const r2Count = Math.min(sortedEntities.length - r1Count, 8);
    const r3Count = Math.min(sortedEntities.length - r1Count - r2Count, 10);
    return {
      ring1: sortedEntities.slice(0, r1Count),
      ring2: sortedEntities.slice(r1Count, r1Count + r2Count),
      ring3: sortedEntities.slice(r1Count + r2Count, r1Count + r2Count + r3Count),
    };
  }, [sortedEntities]);

  const size = 720;
  const cx = size / 2;
  const cy = size / 2;
  const ringRadii = [140, 230, 310];

  const getPositionsOnRing = (count: number, radius: number, offsetAngle = 0) => {
    return Array.from({ length: count }, (_, i) => {
      const angle = (2 * Math.PI * i) / count + offsetAngle - Math.PI / 2;
      return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
    });
  };

  const ring1Pos = useMemo(() => getPositionsOnRing(rings.ring1.length, ringRadii[0], 0), [rings.ring1.length]);
  const ring2Pos = useMemo(() => getPositionsOnRing(rings.ring2.length, ringRadii[1], Math.PI / rings.ring2.length), [rings.ring2.length]);
  const ring3Pos = useMemo(() => getPositionsOnRing(rings.ring3.length, ringRadii[2], 0), [rings.ring3.length]);

  // Build position map for all entities
  const entityPositionMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number; ring: number }>();
    rings.ring1.forEach((e, i) => ring1Pos[i] && map.set(e.id, { ...ring1Pos[i], ring: 0 }));
    rings.ring2.forEach((e, i) => ring2Pos[i] && map.set(e.id, { ...ring2Pos[i], ring: 1 }));
    rings.ring3.forEach((e, i) => ring3Pos[i] && map.set(e.id, { ...ring3Pos[i], ring: 2 }));
    return map;
  }, [rings, ring1Pos, ring2Pos, ring3Pos]);

  const maxCount = useMemo(() => Math.max(...sortedEntities.map(e => e.shared_news_count), 1), [sortedEntities]);

  const totalConnections = useMemo(() =>
    sortedEntities.reduce((sum, e) => sum + e.shared_news_count, 0),
    [sortedEntities]
  );

  // Filter secondary connections to displayed entities
  const displayedIds = useMemo(() => new Set(sortedEntities.map(e => e.id)), [sortedEntities]);
  const visibleSecondary = useMemo(() =>
    secondaryConnections.filter(c => displayedIds.has(c.from.id) && displayedIds.has(c.to.id)).slice(0, 20),
    [secondaryConnections, displayedIds]
  );

  if (relatedEntities.length === 0) return null;

  const mainName = language === 'en' && mainEntity.name_en ? mainEntity.name_en : mainEntity.name;

  const renderEntityNode = (entity: RelatedEntity, pos: { x: number; y: number }, ringIdx: number) => {
    const name = language === 'en' && entity.name_en ? entity.name_en : entity.name;
    const isHovered = hoveredNode === entity.id;
    const nodeSizes = [32, 26, 20];
    const nodeR = nodeSizes[ringIdx] + (entity.shared_news_count / maxCount) * 8;
    const ghostOpacity = [0.9, 0.65, 0.4];
    const baseOpacity = isHovered ? 1 : ghostOpacity[ringIdx];

    return (
      <Link key={entity.id} to={`/wiki/${entity.slug || entity.id}`}>
        <g
          className="cursor-pointer"
          onMouseEnter={() => setHoveredNode(entity.id)}
          onMouseLeave={() => setHoveredNode(null)}
          opacity={baseOpacity}
          style={{ transition: 'opacity 0.3s' }}
        >
          {/* Ghost aura */}
          <circle
            cx={pos.x} cy={pos.y} r={nodeR + (isHovered ? 14 : 8)}
            fill="none"
            stroke={isHovered ? "hsl(var(--accent))" : `hsl(var(--primary))`}
            strokeWidth={isHovered ? 2 : 1}
            opacity={isHovered ? 0.7 : 0.2}
            className={isHovered ? '' : 'ghostly-aura'}
            style={{ animationDelay: `${Math.random() * 3}s` }}
          />

          {/* Main hexagon */}
          <path
            d={getHexagonPath(pos.x, pos.y, nodeR)}
            fill={isHovered ? "url(#ghostHoveredGrad)" : `url(#ghostRing${ringIdx}Grad)`}
            stroke={isHovered ? "hsl(var(--accent))" : "hsl(var(--primary))"}
            strokeWidth={isHovered ? 2.5 : ringIdx === 0 ? 2 : 1}
            strokeOpacity={isHovered ? 0.9 : ghostOpacity[ringIdx]}
            className="transition-all duration-300"
          />

          {entity.image_url ? (
            <>
              <clipPath id={`ghost-clip-${entity.id}`}>
                <path d={getHexagonPath(pos.x, pos.y, nodeR - 3)} />
              </clipPath>
              <image
                x={pos.x - (nodeR - 3)} y={pos.y - (nodeR - 3)}
                width={(nodeR - 3) * 2} height={(nodeR - 3) * 2}
                href={entity.image_url}
                clipPath={`url(#ghost-clip-${entity.id})`}
                preserveAspectRatio="xMidYMid slice"
                opacity={isHovered ? 1 : 0.85}
              />
            </>
          ) : (
            <foreignObject x={pos.x - 12} y={pos.y - 12} width={24} height={24}>
              <div className={`w-full h-full flex items-center justify-center ${isHovered ? 'text-accent' : 'text-primary'}`}>
                {entity.entity_type === 'person' ? <User className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
              </div>
            </foreignObject>
          )}

          {/* Count badge */}
          <circle
            cx={pos.x + nodeR * 0.7} cy={pos.y - nodeR * 0.7}
            r={ringIdx === 0 ? 12 : 10}
            fill={isHovered ? "hsl(var(--accent))" : "hsl(var(--primary))"}
            stroke="hsl(var(--background))"
            strokeWidth={2}
          />
          <text
            x={pos.x + nodeR * 0.7} y={pos.y - nodeR * 0.7 + 4}
            textAnchor="middle"
            fill="hsl(var(--primary-foreground))"
            fontSize={ringIdx === 0 ? "11" : "9"}
            fontWeight="bold"
          >
            {entity.shared_news_count}
          </text>

          {/* Name label */}
          <text
            x={pos.x} y={pos.y + nodeR + 14}
            textAnchor="middle"
            fill={isHovered ? "hsl(var(--accent))" : "hsl(var(--foreground))"}
            fontSize={ringIdx === 0 ? "11" : ringIdx === 1 ? "10" : "9"}
            fontWeight={isHovered ? "600" : "normal"}
            opacity={isHovered ? 1 : ghostOpacity[ringIdx]}
            className="pointer-events-none"
          >
            {name.length > 14 ? name.substring(0, 14) + '…' : name}
          </text>
        </g>
      </Link>
    );
  };

  return (
    <Card className={`overflow-hidden border-secondary/20 bg-gradient-to-br from-card via-card to-secondary/5 ${className || ''}`}>
      <CardHeader className="pb-4 border-b border-border/50">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-3 text-lg">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-secondary/20 to-primary/20 border border-secondary/20">
              <Share2 className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text block">
                {language === 'uk' ? 'Примарні зв\'язки' : 'Ghostly Connections'}
              </span>
              <span className="text-xs text-muted-foreground font-normal">
                {language === 'uk' ? '3 кола впливу' : '3 circles of influence'}
              </span>
            </div>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5 bg-primary/10 border-primary/30 px-3 py-1">
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
              <span className="font-semibold">{totalConnections}</span>
            </Badge>
            <Badge variant="outline" className="gap-1.5 bg-secondary/10 border-secondary/30 px-3 py-1">
              <Newspaper className="w-3.5 h-3.5 text-secondary" />
              <span className="font-semibold">{sortedEntities.length}</span>
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6 relative">
        {/* Selected entity panel */}
        {selectedEntity && (
          <div className="absolute top-4 right-4 z-20 bg-card/98 backdrop-blur-md border border-secondary/30 rounded-xl p-4 shadow-2xl max-w-[220px] animate-in fade-in slide-in-from-right-3 duration-300">
            <Button
              variant="ghost" size="sm"
              className="absolute -top-2 -right-2 h-7 w-7 rounded-full p-0 bg-card border border-border hover:bg-destructive/10"
              onClick={() => { setSelectedEntity(null); setIsRootSelected(false); }}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
            <div className="flex items-start gap-3">
              {selectedEntity.image_url ? (
                <img src={selectedEntity.image_url} alt="" className="w-12 h-12 rounded-xl object-cover border-2 border-secondary/30" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-secondary/20 to-primary/20 flex items-center justify-center border-2 border-secondary/30">
                  {selectedEntity.entity_type === 'person' ? <User className="w-6 h-6 text-secondary" /> : <Building2 className="w-6 h-6 text-secondary" />}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{language === 'en' && selectedEntity.name_en ? selectedEntity.name_en : selectedEntity.name}</p>
                <Badge variant="secondary" className="text-[10px] mt-1 capitalize">{selectedEntity.entity_type}</Badge>
              </div>
            </div>
            {selectedEntity.shared_news_count !== undefined && selectedEntity.shared_news_count > 0 && (
              <div className="mt-3 pt-2 border-t border-border/50 flex items-center gap-2 text-xs">
                <Zap className="w-3.5 h-3.5 text-primary" />
                <span className="text-muted-foreground">{selectedEntity.shared_news_count} {language === 'uk' ? 'спільних' : 'shared'}</span>
              </div>
            )}
            {(selectedEntity.slug || selectedEntity.id) && (
              <Link to={`/wiki/${selectedEntity.slug || selectedEntity.id}`} className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium mt-2">
                <Eye className="w-3 h-3" />
                {language === 'uk' ? 'Профіль →' : 'Profile →'}
              </Link>
            )}
          </div>
        )}

        <div className="relative w-full" style={{ maxWidth: `${size}px`, margin: '0 auto' }}>
          <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto" style={{ overflow: 'visible' }}>
            <defs>
              <style>{`
                @keyframes ghostlyAura {
                  0%, 100% { opacity: 0.15; stroke-width: 1; }
                  50% { opacity: 0.35; stroke-width: 1.5; }
                }
                .ghostly-aura { animation: ghostlyAura 4s ease-in-out infinite; }
                
                @keyframes ghostFloat {
                  0%, 100% { transform: translateY(0); }
                  50% { transform: translateY(-4px); }
                }
                
                @keyframes ghostPulse {
                  0%, 100% { opacity: 0.08; }
                  50% { opacity: 0.18; }
                }
                .ghost-ring-pulse { animation: ghostPulse 5s ease-in-out infinite; }
                
                @keyframes ghostLine {
                  0% { stroke-dashoffset: 30; }
                  100% { stroke-dashoffset: 0; }
                }
                .ghost-line { animation: ghostLine 3s linear infinite; }
                
                @keyframes ghostOrbit {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
                
                @keyframes spectralGlow {
                  0%, 100% { filter: drop-shadow(0 0 4px hsl(var(--secondary) / 0.3)); }
                  50% { filter: drop-shadow(0 0 12px hsl(var(--secondary) / 0.6)); }
                }
                .spectral-root { animation: spectralGlow 3s ease-in-out infinite; }

                @keyframes ghostWisp {
                  0% { opacity: 0; offset-distance: 0%; }
                  20% { opacity: 0.6; }
                  80% { opacity: 0.6; }
                  100% { opacity: 0; offset-distance: 100%; }
                }
                .ghost-wisp {
                  offset-rotate: auto;
                  animation: ghostWisp 4s ease-in-out infinite;
                }
              `}</style>

              <radialGradient id="ghostRing0Grad" cx="50%" cy="30%" r="70%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
                <stop offset="100%" stopColor="hsl(var(--card))" stopOpacity="0.95" />
              </radialGradient>
              <radialGradient id="ghostRing1Grad" cx="50%" cy="30%" r="70%">
                <stop offset="0%" stopColor="hsl(var(--secondary))" stopOpacity="0.2" />
                <stop offset="100%" stopColor="hsl(var(--card))" stopOpacity="0.9" />
              </radialGradient>
              <radialGradient id="ghostRing2Grad" cx="50%" cy="30%" r="70%">
                <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.15" />
                <stop offset="100%" stopColor="hsl(var(--card))" stopOpacity="0.85" />
              </radialGradient>
              <radialGradient id="ghostHoveredGrad" cx="50%" cy="30%" r="70%">
                <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.5" />
                <stop offset="100%" stopColor="hsl(var(--card))" stopOpacity="0.95" />
              </radialGradient>
              <radialGradient id="ghostRootGrad" cx="30%" cy="30%" r="70%">
                <stop offset="0%" stopColor="hsl(var(--secondary))" stopOpacity="1" />
                <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.9" />
                <stop offset="100%" stopColor="hsl(var(--secondary))" stopOpacity="0.7" />
              </radialGradient>

              <filter id="ghostGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="ghostRootGlow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Orbital ring circles — ghostly */}
            {ringRadii.map((r, i) => (
              <g key={`ring-${i}`}>
                <circle
                  cx={cx} cy={cy} r={r}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth={1}
                  strokeDasharray={i === 0 ? "8 8" : i === 1 ? "4 12" : "2 16"}
                  opacity={0.12 - i * 0.03}
                  className="ghost-ring-pulse"
                  style={{ animationDelay: `${i * 1.5}s` }}
                />
                {/* Second ghost ring */}
                <circle
                  cx={cx} cy={cy} r={r}
                  fill="none"
                  stroke="hsl(var(--secondary))"
                  strokeWidth={0.5}
                  strokeDasharray={i === 0 ? "12 6" : "6 18"}
                  opacity={0.06}
                  style={{ transformOrigin: `${cx}px ${cy}px`, animation: `ghostOrbit ${40 + i * 20}s linear infinite ${i % 2 === 0 ? '' : 'reverse'}` }}
                />
              </g>
            ))}

            {/* Ring 3 ghostly connections to root */}
            {rings.ring3.map((entity, i) => {
              const pos = ring3Pos[i];
              if (!pos) return null;
              const isHovered = hoveredNode === entity.id;
              const path = `M ${cx} ${cy} Q ${(cx + pos.x) / 2 + (i % 2 === 0 ? 20 : -20)} ${(cy + pos.y) / 2 + (i % 2 === 0 ? -15 : 15)}, ${pos.x} ${pos.y}`;
              return (
                <g key={`ghost3-line-${entity.id}`}>
                  <path d={path} fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth={isHovered ? 1.5 : 0.5} strokeDasharray="3 9" opacity={isHovered ? 0.5 : 0.1} className="ghost-line" style={{ animationDelay: `${i * 0.4}s` }} />
                </g>
              );
            })}

            {/* Ring 2 connections to root */}
            {rings.ring2.map((entity, i) => {
              const pos = ring2Pos[i];
              if (!pos) return null;
              const isHovered = hoveredNode === entity.id;
              const path = `M ${cx} ${cy} Q ${(cx + pos.x) / 2 + (i % 2 === 0 ? 15 : -15)} ${(cy + pos.y) / 2}, ${pos.x} ${pos.y}`;
              return (
                <g key={`ghost2-line-${entity.id}`}>
                  <path d={path} fill="none" stroke="hsl(var(--secondary))" strokeWidth={isHovered ? 2 : 1} strokeDasharray="6 6" opacity={isHovered ? 0.7 : 0.2} className="ghost-line" style={{ animationDelay: `${i * 0.3}s` }} />
                  {isHovered && (
                    <circle r={3} fill="hsl(var(--secondary))" className="ghost-wisp" style={{ offsetPath: `path('${path}')`, animationDuration: '3s' }} />
                  )}
                </g>
              );
            })}

            {/* Ring 1 connections to root — strongest */}
            {rings.ring1.map((entity, i) => {
              const pos = ring1Pos[i];
              if (!pos) return null;
              const isHovered = hoveredNode === entity.id;
              const importance = entity.shared_news_count / maxCount;
              const lineWidth = 1.5 + importance * 3;
              const path = `M ${cx} ${cy} Q ${(cx + pos.x) / 2} ${(cy + pos.y) / 2 + (i % 2 === 0 ? -10 : 10)}, ${pos.x} ${pos.y}`;
              return (
                <g key={`ghost1-line-${entity.id}`}>
                  <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth={lineWidth + 4} opacity={isHovered ? 0.15 : 0.05} strokeLinecap="round" />
                  <path d={path} fill="none" stroke={isHovered ? "hsl(var(--accent))" : "hsl(var(--primary))"} strokeWidth={isHovered ? lineWidth + 1 : lineWidth} strokeDasharray="8 4" opacity={isHovered ? 0.85 : 0.5} className="ghost-line" style={{ animationDelay: `${i * 0.2}s` }} strokeLinecap="round" />
                  {/* Wisp particle */}
                  <circle r={isHovered ? 4 : 3} fill={isHovered ? "hsl(var(--accent))" : "hsl(var(--primary))"} className="ghost-wisp" style={{ offsetPath: `path('${path}')`, animationDelay: `${i * 0.5}s`, animationDuration: isHovered ? '2.5s' : '4s' }} />
                </g>
              );
            })}

            {/* Secondary (inter-entity) connections — ghostly wisps */}
            {visibleSecondary.map((conn, i) => {
              const fromPos = entityPositionMap.get(conn.from.id);
              const toPos = entityPositionMap.get(conn.to.id);
              if (!fromPos || !toPos) return null;
              const isHL = hoveredNode === conn.from.id || hoveredNode === conn.to.id;
              return (
                <line
                  key={`sec-${i}`}
                  x1={fromPos.x} y1={fromPos.y}
                  x2={toPos.x} y2={toPos.y}
                  stroke={isHL ? "hsl(var(--accent))" : "hsl(var(--muted-foreground))"}
                  strokeWidth={isHL ? 1.5 : 0.8}
                  strokeDasharray="3 6"
                  opacity={isHL ? 0.6 : 0.12}
                  className="transition-all duration-200"
                />
              );
            })}

            {/* Root entity */}
            <g
              className="cursor-pointer spectral-root"
              filter="url(#ghostRootGlow)"
              onClick={() => { setSelectedEntity(mainEntity); setIsRootSelected(true); }}
            >
              {/* Outer spectral rings */}
              <circle cx={cx} cy={cy} r={58} fill="none" stroke="hsl(var(--secondary))" strokeWidth={1.5} strokeDasharray="6 10" opacity={0.4} className="ghostly-aura" />
              <circle cx={cx} cy={cy} r={65} fill="none" stroke="hsl(var(--primary))" strokeWidth={1} strokeDasharray="4 14" opacity={0.25} />
              {/* Main node */}
              <circle cx={cx} cy={cy} r={48} fill="url(#ghostRootGrad)" />
              <circle cx={cx} cy={cy} r={48} fill="none" stroke="hsl(var(--background))" strokeWidth={3} opacity={0.15} />
              {mainEntity.image_url ? (
                <>
                  <clipPath id="ghost-root-clip"><circle cx={cx} cy={cy} r={44} /></clipPath>
                  <image x={cx - 44} y={cy - 44} width={88} height={88} href={mainEntity.image_url} clipPath="url(#ghost-root-clip)" preserveAspectRatio="xMidYMid slice" />
                </>
              ) : (
                <foreignObject x={cx - 28} y={cy - 28} width={56} height={56}>
                  <div className="w-full h-full flex items-center justify-center text-primary-foreground">
                    {mainEntity.entity_type === 'person' ? <User className="w-10 h-10" /> : <Building2 className="w-10 h-10" />}
                  </div>
                </foreignObject>
              )}
            </g>

            {/* Root label */}
            <text x={cx} y={cy + 68} textAnchor="middle" fill="hsl(var(--foreground))" fontSize="15" fontWeight="700">{mainName}</text>
            <text x={cx} y={cy + 83} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="10" className="uppercase tracking-widest">{mainEntity.entity_type}</text>

            {/* Ring 1 nodes */}
            {rings.ring1.map((e, i) => ring1Pos[i] && renderEntityNode(e, ring1Pos[i], 0))}
            {/* Ring 2 nodes */}
            {rings.ring2.map((e, i) => ring2Pos[i] && renderEntityNode(e, ring2Pos[i], 1))}
            {/* Ring 3 nodes — ghostly */}
            {rings.ring3.map((e, i) => ring3Pos[i] && renderEntityNode(e, ring3Pos[i], 2))}
          </svg>
        </div>

        {/* Stats footer */}
        <div className="mt-6 pt-4 border-t border-border/50">
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span className="font-semibold text-foreground">{rings.ring1.length}</span>
              <span>{language === 'uk' ? '1-ше коло' : '1st circle'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-secondary opacity-70" />
              <span className="font-semibold text-foreground">{rings.ring2.length}</span>
              <span>{language === 'uk' ? '2-ге коло' : '2nd circle'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-muted-foreground opacity-40" />
              <span className="font-semibold text-foreground">{rings.ring3.length}</span>
              <span>{language === 'uk' ? '3-тє коло' : '3rd circle'}</span>
            </div>
            {visibleSecondary.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 border-t border-dashed border-muted-foreground/40" />
                <span className="font-semibold text-foreground">{visibleSecondary.length}</span>
                <span>{language === 'uk' ? 'зв\'язків' : 'links'}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
