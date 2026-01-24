import { NARRATIVE_OPTIONS } from "@/types/database";
import { useMemo } from "react";

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

// Generate stable random values based on narrative values
function seededRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs((Math.sin(hash) * 10000) % 1);
}

export function NarrativeChart({
  narrativeSource,
  narrativeStructure,
  narrativePurpose,
  narrativePlot,
  narrativeSpecial,
}: NarrativeChartProps) {
  const hasAnyNarrative = narrativeSource || narrativeStructure || narrativePurpose || narrativePlot || narrativeSpecial;
  
  if (!hasAnyNarrative) return null;

  const narratives = useMemo(() => {
    const items = [
      { 
        key: 'source', 
        value: narrativeSource, 
        label: NARRATIVE_OPTIONS.source[narrativeSource as keyof typeof NARRATIVE_OPTIONS.source]?.label || narrativeSource,
        color: narrativeColors.source,
        icon: '📖',
        category: 'Джерело'
      },
      { 
        key: 'structure', 
        value: narrativeStructure, 
        label: NARRATIVE_OPTIONS.structure[narrativeStructure as keyof typeof NARRATIVE_OPTIONS.structure]?.label || narrativeStructure,
        color: narrativeColors.structure,
        icon: '🏗️',
        category: 'Структура'
      },
      { 
        key: 'purpose', 
        value: narrativePurpose, 
        label: NARRATIVE_OPTIONS.purpose[narrativePurpose as keyof typeof NARRATIVE_OPTIONS.purpose]?.label || narrativePurpose,
        color: narrativeColors.purpose,
        icon: '🎯',
        category: 'Мета'
      },
      { 
        key: 'plot', 
        value: narrativePlot, 
        label: NARRATIVE_OPTIONS.plot[narrativePlot as keyof typeof NARRATIVE_OPTIONS.plot]?.label || narrativePlot,
        color: narrativeColors.plot,
        icon: '📜',
        category: 'Сюжет'
      },
      { 
        key: 'special', 
        value: narrativeSpecial, 
        label: NARRATIVE_OPTIONS.special[narrativeSpecial as keyof typeof NARRATIVE_OPTIONS.special]?.label || narrativeSpecial,
        color: narrativeColors.special,
        icon: '✨',
        category: 'Особливість'
      },
    ].filter(n => n.value);

    // Generate stable percentages based on the narrative values
    const seed = `${narrativeSource}-${narrativeStructure}-${narrativePurpose}-${narrativePlot}-${narrativeSpecial}`;
    
    return items.map((item, idx) => {
      const basePercentage = 45 + seededRandom(seed + item.key) * 50; // 45-95%
      return {
        ...item,
        percentage: Math.round(basePercentage),
      };
    });
  }, [narrativeSource, narrativeStructure, narrativePurpose, narrativePlot, narrativeSpecial]);

  // Calculate total for pie chart effect
  const total = narratives.reduce((sum, n) => sum + n.percentage, 0);

  return (
    <div className="mt-6 md:mt-8 pt-4 md:pt-6 border-t border-border">
      <h4 className="text-xs font-mono text-muted-foreground mb-4 flex items-center gap-2">
        <span className="text-base">📊</span>
        НАРАТИВНА СТРУКТУРА
      </h4>
      
      {/* Main chart area */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Bar chart */}
        <div className="space-y-3">
          {narratives.map((narrative) => (
            <div key={narrative.key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span>{narrative.icon}</span>
                  <span className="font-medium">{narrative.category}</span>
                </span>
                <span className="font-mono text-foreground">{narrative.percentage}%</span>
              </div>
              <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${narrative.percentage}%`,
                    backgroundColor: narrative.color,
                  }}
                />
              </div>
              <div className="text-[10px] text-muted-foreground/70 pl-5">
                {narrative.label}
              </div>
            </div>
          ))}
        </div>

        {/* Radial/Pie visualization */}
        <div className="flex items-center justify-center">
          <div className="relative w-32 h-32 md:w-40 md:h-40">
            {/* Background circle */}
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="8"
                opacity="0.3"
              />
              {/* Segments */}
              {narratives.map((narrative, idx) => {
                const circumference = 2 * Math.PI * 40;
                const segmentSize = (narrative.percentage / total) * 100;
                const offset = narratives
                  .slice(0, idx)
                  .reduce((sum, n) => sum + (n.percentage / total) * 100, 0);
                
                return (
                  <circle
                    key={narrative.key}
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke={narrative.color}
                    strokeWidth="8"
                    strokeDasharray={`${(segmentSize / 100) * circumference} ${circumference}`}
                    strokeDashoffset={`${-(offset / 100) * circumference}`}
                    className="transition-all duration-500"
                  />
                );
              })}
            </svg>
            
            {/* Center text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl md:text-3xl font-bold text-foreground">
                {narratives.length}
              </span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                елементів
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Legend chips */}
      <div className="mt-4 flex flex-wrap gap-2">
        {narratives.map((narrative) => (
          <span 
            key={narrative.key}
            className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/30 text-[10px] md:text-xs text-muted-foreground border border-border/50"
          >
            <span 
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: narrative.color }}
            />
            <span>{narrative.icon}</span>
            <span className="font-medium">{narrative.label}</span>
            <span className="font-mono text-foreground/70">{narrative.percentage}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}