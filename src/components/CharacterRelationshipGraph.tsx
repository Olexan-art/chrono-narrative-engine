import { useMemo, useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Network } from "lucide-react";

interface Character {
  id: string;
  character_id: string;
  name: string;
  avatar: string;
  is_active: boolean;
  dialogue_count: number;
  total_likes: number;
}

interface Relationship {
  id: string;
  character_id: string;
  related_character_id: string;
  relationship_type: "friendly" | "hostile" | "neutral";
  strength: number;
}

interface CharacterRelationshipGraphProps {
  characters: Character[];
  relationships: Relationship[];
}

interface Node {
  id: string;
  x: number;
  y: number;
  name: string;
  avatar: string;
  isActive: boolean;
  dialogueCount: number;
}

interface Edge {
  source: string;
  target: string;
  type: "friendly" | "hostile" | "neutral";
  strength: number;
}

export function CharacterRelationshipGraph({ characters, relationships }: CharacterRelationshipGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  useEffect(() => {
    const updateDimensions = () => {
      if (svgRef.current?.parentElement) {
        const rect = svgRef.current.parentElement.getBoundingClientRect();
        setDimensions({ width: rect.width || 600, height: Math.max(400, rect.width * 0.6) });
      }
    };
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  const { nodes, edges, stats } = useMemo(() => {
    const activeChars = characters.filter(c => c.is_active);
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const radius = Math.min(centerX, centerY) - 60;

    // Position nodes in a circle
    const nodes: Node[] = activeChars.map((char, i) => {
      const angle = (2 * Math.PI * i) / activeChars.length - Math.PI / 2;
      return {
        id: char.id,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        name: char.name,
        avatar: char.avatar,
        isActive: char.is_active,
        dialogueCount: char.dialogue_count
      };
    });

    const edges: Edge[] = relationships.map(rel => ({
      source: rel.character_id,
      target: rel.related_character_id,
      type: rel.relationship_type,
      strength: rel.strength
    }));

    const friendlyCount = edges.filter(e => e.type === "friendly").length;
    const hostileCount = edges.filter(e => e.type === "hostile").length;
    const neutralCount = edges.filter(e => e.type === "neutral").length;

    return { nodes, edges, stats: { friendly: friendlyCount, hostile: hostileCount, neutral: neutralCount } };
  }, [characters, relationships, dimensions]);

  const getEdgeColor = (type: "friendly" | "hostile" | "neutral") => {
    switch (type) {
      case "friendly": return "hsl(var(--chart-2))"; // green
      case "hostile": return "hsl(var(--destructive))"; // red
      default: return "hsl(var(--muted-foreground))"; // gray
    }
  };

  const getNodeById = (id: string) => nodes.find(n => n.id === id);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Network className="h-5 w-5" />
            Мережа зв'язків
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
              ❤️ {stats.friendly}
            </Badge>
            <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30">
              ⚔️ {stats.hostile}
            </Badge>
            <Badge variant="outline" className="bg-muted text-muted-foreground">
              ○ {stats.neutral}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {nodes.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            Немає активних персонажів для відображення
          </div>
        ) : (
          <svg
            ref={svgRef}
            width="100%"
            height={dimensions.height}
            viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
            className="overflow-visible"
          >
            {/* Edges */}
            <g>
              {edges.map((edge, i) => {
                const source = getNodeById(edge.source);
                const target = getNodeById(edge.target);
                if (!source || !target) return null;

                const isHighlighted = hoveredNode === edge.source || hoveredNode === edge.target;
                const strokeWidth = isHighlighted ? 3 : Math.max(1, edge.strength / 30);
                const opacity = hoveredNode ? (isHighlighted ? 1 : 0.2) : 0.6;

                return (
                  <line
                    key={i}
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    stroke={getEdgeColor(edge.type)}
                    strokeWidth={strokeWidth}
                    opacity={opacity}
                    strokeDasharray={edge.type === "neutral" ? "5,5" : undefined}
                    className="transition-all duration-200"
                  />
                );
              })}
            </g>

            {/* Nodes */}
            <g>
              {nodes.map((node) => {
                const isHovered = hoveredNode === node.id;
                const connectedEdges = edges.filter(e => e.source === node.id || e.target === node.id);
                const isConnected = hoveredNode ? connectedEdges.some(e => e.source === hoveredNode || e.target === hoveredNode) : false;
                const opacity = hoveredNode ? (isHovered || isConnected ? 1 : 0.3) : 1;

                // Node size based on dialogue count
                const baseSize = 24;
                const size = baseSize + Math.min(12, node.dialogueCount / 5);

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    className="cursor-pointer transition-opacity duration-200"
                    style={{ opacity }}
                  >
                    {/* Background circle */}
                    <circle
                      r={size}
                      fill="hsl(var(--background))"
                      stroke={isHovered ? "hsl(var(--primary))" : "hsl(var(--border))"}
                      strokeWidth={isHovered ? 3 : 2}
                      className="transition-all duration-200"
                    />
                    {/* Avatar */}
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={size * 0.9}
                      className="select-none pointer-events-none"
                    >
                      {node.avatar}
                    </text>
                    {/* Name label */}
                    <text
                      y={size + 14}
                      textAnchor="middle"
                      fontSize="11"
                      fill="hsl(var(--foreground))"
                      className="font-medium select-none pointer-events-none"
                    >
                      {node.name}
                    </text>
                    {/* Dialogue count badge */}
                    {node.dialogueCount > 0 && (
                      <g transform={`translate(${size - 4}, ${-size + 4})`}>
                        <circle r="10" fill="hsl(var(--primary))" />
                        <text
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize="9"
                          fill="hsl(var(--primary-foreground))"
                          className="font-bold select-none pointer-events-none"
                        >
                          {node.dialogueCount > 99 ? "99+" : node.dialogueCount}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>

            {/* Legend */}
            <g transform={`translate(10, ${dimensions.height - 50})`}>
              <line x1="0" y1="0" x2="20" y2="0" stroke="hsl(var(--chart-2))" strokeWidth="2" />
              <text x="25" y="4" fontSize="10" fill="hsl(var(--muted-foreground))">Дружній</text>
              
              <line x1="0" y1="15" x2="20" y2="15" stroke="hsl(var(--destructive))" strokeWidth="2" />
              <text x="25" y="19" fontSize="10" fill="hsl(var(--muted-foreground))">Ворожий</text>
              
              <line x1="0" y1="30" x2="20" y2="30" stroke="hsl(var(--muted-foreground))" strokeWidth="2" strokeDasharray="5,5" />
              <text x="25" y="34" fontSize="10" fill="hsl(var(--muted-foreground))">Нейтральний</text>
            </g>
          </svg>
        )}
      </CardContent>
    </Card>
  );
}
