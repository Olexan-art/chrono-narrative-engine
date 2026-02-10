import { useState } from "react";
import { Link } from "react-router-dom";
import { BrainCircuit, ChevronDown, ChevronUp, Newspaper, User, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useLanguage } from "@/contexts/LanguageContext";

interface NarrativeAnalysisBlockProps {
  analysis: any;
  yearMonth: string;
  newsCount: number;
  isRegenerated?: boolean;
  compact?: boolean;
  showHeader?: boolean;
  animated?: boolean;
  className?: string;
}

const getSentimentStyle = (sentiment: string, language: string) => {
  switch (sentiment) {
    case 'positive': return { bg: 'bg-emerald-500/15', border: 'border-emerald-500/40', text: 'text-emerald-400', icon: '🟢', label: language === 'uk' ? 'Позитивний' : 'Positive' };
    case 'negative': return { bg: 'bg-red-500/15', border: 'border-red-500/40', text: 'text-red-400', icon: '🔴', label: language === 'uk' ? 'Негативний' : 'Negative' };
    case 'mixed': return { bg: 'bg-amber-500/15', border: 'border-amber-500/40', text: 'text-amber-400', icon: '🟡', label: language === 'uk' ? 'Змішаний' : 'Mixed' };
    default: return { bg: 'bg-blue-500/15', border: 'border-blue-500/40', text: 'text-blue-400', icon: '⚪', label: language === 'uk' ? 'Нейтральний' : 'Neutral' };
  }
};

export function NarrativeAnalysisBlock({
  analysis,
  yearMonth,
  newsCount,
  isRegenerated,
  compact = false,
  showHeader = true,
  animated = false,
  className = "",
}: NarrativeAnalysisBlockProps) {
  const { language } = useLanguage();
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

  if (!analysis) return null;

  const sentimentStyle = getSentimentStyle(analysis.sentiment || 'neutral', language);

  return (
    <div className={`space-y-2 ${animated ? 'animate-in fade-in slide-in-from-bottom-2 duration-500' : ''} ${className}`}>
      {showHeader && (
        <div className="flex items-center gap-2 flex-wrap">
          <BrainCircuit className={`w-4 h-4 text-primary ${animated ? 'animate-pulse' : ''}`} />
          <Badge variant="outline" className="font-mono text-[10px] gap-1 bg-primary/10 border-primary/30">
            {yearMonth} • {newsCount} {language === 'uk' ? 'новин' : 'news'}
          </Badge>
          {isRegenerated && (
            <Badge variant="secondary" className="text-[10px] gap-1 bg-amber-500/10 text-amber-400 border-amber-500/30">
              <RefreshCw className="w-2.5 h-2.5" />
              {language === 'uk' ? 'Оновлено' : 'Updated'}
            </Badge>
          )}
        </div>
      )}

      {/* Sentiment Badge */}
      {analysis.sentiment && (
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${sentimentStyle.bg} ${sentimentStyle.border} border transition-all duration-500 ${animated ? 'animate-in fade-in slide-in-from-right-2' : ''}`}>
          <span className={`text-sm ${animated ? 'animate-pulse' : ''}`}>{sentimentStyle.icon}</span>
          <span className={`text-xs font-semibold uppercase tracking-wide ${sentimentStyle.text}`}>
            {sentimentStyle.label}
          </span>
        </div>
      )}

      {/* Summary - always visible */}
      {analysis.narrative_summary && (
        <p className={`text-sm text-muted-foreground italic border-l-2 border-primary/30 pl-3 ${compact ? 'line-clamp-3' : ''}`}>
          {analysis.narrative_summary}
        </p>
      )}

      {/* Read more - collapsible details */}
      <Collapsible open={isDetailsExpanded} onOpenChange={setIsDetailsExpanded}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-center text-xs gap-1.5 text-primary hover:text-primary">
            {isDetailsExpanded ? (
              <><ChevronUp className="w-3.5 h-3.5" />{language === 'uk' ? 'Згорнути' : 'Show less'}</>
            ) : (
              <><ChevronDown className="w-3.5 h-3.5" />{language === 'uk' ? 'Читати більше' : 'Read more'}</>
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          {/* Key Takeaways */}
          {analysis.key_takeaways?.length > 0 && (
            <ul className="space-y-2">
              {analysis.key_takeaways.map((kt: any, i: number) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <span className="text-foreground/90 leading-relaxed">{kt.point}</span>
                    {kt.newsLinks?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {kt.newsLinks.map((nl: any, j: number) => (
                          <Link
                            key={j}
                            to={nl.url}
                            className="text-[10px] text-primary hover:underline truncate max-w-[180px] inline-flex items-center gap-0.5"
                          >
                            <Newspaper className="w-2.5 h-2.5 flex-shrink-0" />
                            {nl.title}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Related entity roles */}
          {analysis.related_entity_roles?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/30">
              {analysis.related_entity_roles.map((r: any, i: number) => (
                <Badge key={i} variant="outline" className="text-[10px] gap-1">
                  <User className="w-2.5 h-2.5" />
                  {r.name}: {r.role}
                </Badge>
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
