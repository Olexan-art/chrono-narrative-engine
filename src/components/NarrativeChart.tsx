import { NARRATIVE_OPTIONS } from "@/types/database";

interface NarrativeChartProps {
  narrativeSource?: string | null;
  narrativeStructure?: string | null;
  narrativePurpose?: string | null;
  narrativePlot?: string | null;
  narrativeSpecial?: string | null;
}

const narrativeColors = {
  source: "hsl(var(--primary))",
  structure: "hsl(var(--chart-1))",
  purpose: "hsl(var(--chart-2))",
  plot: "hsl(var(--chart-3))",
  special: "hsl(var(--chart-4))",
};

export function NarrativeChart({
  narrativeSource,
  narrativeStructure,
  narrativePurpose,
  narrativePlot,
  narrativeSpecial,
}: NarrativeChartProps) {
  const hasAnyNarrative = narrativeSource || narrativeStructure || narrativePurpose || narrativePlot || narrativeSpecial;
  
  if (!hasAnyNarrative) return null;

  const narratives = [
    { 
      key: 'source', 
      value: narrativeSource, 
      label: NARRATIVE_OPTIONS.source[narrativeSource as keyof typeof NARRATIVE_OPTIONS.source]?.label || narrativeSource,
      color: narrativeColors.source,
      icon: '📖'
    },
    { 
      key: 'structure', 
      value: narrativeStructure, 
      label: NARRATIVE_OPTIONS.structure[narrativeStructure as keyof typeof NARRATIVE_OPTIONS.structure]?.label || narrativeStructure,
      color: narrativeColors.structure,
      icon: '🏗️'
    },
    { 
      key: 'purpose', 
      value: narrativePurpose, 
      label: NARRATIVE_OPTIONS.purpose[narrativePurpose as keyof typeof NARRATIVE_OPTIONS.purpose]?.label || narrativePurpose,
      color: narrativeColors.purpose,
      icon: '🎯'
    },
    { 
      key: 'plot', 
      value: narrativePlot, 
      label: NARRATIVE_OPTIONS.plot[narrativePlot as keyof typeof NARRATIVE_OPTIONS.plot]?.label || narrativePlot,
      color: narrativeColors.plot,
      icon: '📜'
    },
    { 
      key: 'special', 
      value: narrativeSpecial, 
      label: NARRATIVE_OPTIONS.special[narrativeSpecial as keyof typeof NARRATIVE_OPTIONS.special]?.label || narrativeSpecial,
      color: narrativeColors.special,
      icon: '✨'
    },
  ].filter(n => n.value);

  // Calculate bar heights based on position (visual representation without numbers)
  const barHeights = narratives.map((_, idx) => {
    // Create a wave-like pattern for visual interest
    const base = 40;
    const variation = Math.sin((idx / narratives.length) * Math.PI) * 30;
    return base + variation + (Math.random() * 20);
  });

  return (
    <div className="mt-6 md:mt-8 pt-4 md:pt-6 border-t border-border">
      <h4 className="text-xs font-mono text-muted-foreground mb-4 flex items-center gap-2">
        <span className="text-base">📊</span>
        НАРАТИВНА СТРУКТУРА
      </h4>
      
      <div className="flex items-end gap-2 h-20 md:h-24">
        {narratives.map((narrative, idx) => (
          <div
            key={narrative.key}
            className="flex-1 flex flex-col items-center group"
          >
            {/* Bar */}
            <div
              className="w-full rounded-t-sm transition-all duration-300 group-hover:opacity-80"
              style={{
                height: `${barHeights[idx]}%`,
                backgroundColor: narrative.color,
                minHeight: '20%',
              }}
            />
            
            {/* Icon label */}
            <div 
              className="mt-2 text-base md:text-lg cursor-default"
              title={narrative.label || undefined}
            >
              {narrative.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-2 text-[10px] md:text-xs text-muted-foreground">
        {narratives.map((narrative) => (
          <span 
            key={narrative.key}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/30"
          >
            <span 
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: narrative.color }}
            />
            {narrative.label}
          </span>
        ))}
      </div>
    </div>
  );
}
