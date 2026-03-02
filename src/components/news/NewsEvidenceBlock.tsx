import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertTriangle, CheckCircle2, Shield, FileSearch, Link as LinkIcon, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SourceScoring } from './NewsScoreBadge';

export interface ExtendedSourceScoring extends SourceScoring {
    key_claims?: Array<{
        claim: string;
        verdict: 'confirmed' | 'partial' | 'unclear' | 'contradicted';
        notes?: string;
    }>;
    evidence?: Array<{
        source_name: string;
        url?: string;
        strength: 'primary' | 'high' | 'medium' | 'low';
    }>;
    caveats?: string[];
}

interface NewsEvidenceBlockProps {
    scoring?: ExtendedSourceScoring | null;
    className?: string;
}

export const NewsEvidenceBlock: React.FC<NewsEvidenceBlockProps> = ({ scoring: rawScoring, className }) => {
    const { language } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);

    const scoring = (rawScoring as any)?.json
        ? (rawScoring as any).json as ExtendedSourceScoring
        : rawScoring as ExtendedSourceScoring;

    if (!scoring || !scoring.scores) {
        return null; // Return nothing if no scoring data exists
    }

    const overallScore = scoring.scores.overall || 0;

    // Get color scale
    let ScoreColor = 'text-gray-400';
    if (overallScore > 70) ScoreColor = 'text-green-500';
    else if (overallScore >= 40) ScoreColor = 'text-orange-500';
    else ScoreColor = 'text-red-500';

    const tTitle = language === 'en' ? 'Supporting Evidence & Claims' : language === 'pl' ? 'Dowody i twierdzenia' : 'Оцінка джерела та докази';
    const tOverall = language === 'en' ? 'Overall Score' : language === 'pl' ? 'Ogólny wynik' : 'Загальний рейтинг';
    const tClaims = language === 'en' ? 'Key Claims Evaluated' : language === 'pl' ? 'Ocenione twierdzenia' : 'Оцінка ключових тверджень';
    const tEvidence = language === 'en' ? 'Evidence Sources' : language === 'pl' ? 'Źródła dowodów' : 'Джерела доказів';
    const tCaveats = language === 'en' ? 'Caveats & Notes' : language === 'pl' ? 'Zastrzeżenia i uwagi' : 'Зауваження та нюанси';
    const tReadMore = language === 'en' ? 'Read more' : language === 'pl' ? 'Czytaj więcej' : 'Детальніше';
    const tHide = language === 'en' ? 'Hide' : language === 'pl' ? 'Ukryj' : 'Сховати';

    const renderVerdictIcon = (verdict: string) => {
        switch (verdict.toLowerCase()) {
            case 'confirmed':
                return <CheckCircle2 className="w-4 h-4 text-green-500" />;
            case 'partial':
                return <AlertTriangle className="w-4 h-4 text-orange-500" />;
            case 'contradicted':
                return <AlertCircle className="w-4 h-4 text-red-500" />;
            default:
                return <Shield className="w-4 h-4 text-gray-400" />;
        }
    };

    return (
        <Card className={cn("overflow-hidden bg-muted/20 border-border/50", className)}>
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CardHeader className={cn("bg-muted/10 transition-colors cursor-pointer hover:bg-muted/30", isOpen ? "pb-4 border-b border-border/10" : "pb-4")} onClick={() => setIsOpen(!isOpen)}>
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-1">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <FileSearch className="w-5 h-5 text-primary" />
                                {tTitle}
                            </CardTitle>
                            <CollapsibleTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="link" size="sm" className="px-0 h-auto text-muted-foreground hover:text-primary justify-start gap-1">
                                    {isOpen ? tHide : tReadMore}
                                    {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                </Button>
                            </CollapsibleTrigger>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className={cn("text-2xl font-black tabular-nums tracking-tighter leading-none", ScoreColor)}>
                                {overallScore}
                            </span>
                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
                                {tOverall}
                            </span>
                        </div>
                    </div>
                </CardHeader>

                <CollapsibleContent>
                    <CardContent className="p-0">
                        <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/20">

                            {/* Claims Section */}
                            <div className="p-4 space-y-4">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                    <Shield className="w-3.5 h-3.5" />
                                    {tClaims}
                                </h4>

                                {(scoring.key_claims && scoring.key_claims.length > 0) ? (
                                    <ul className="space-y-3">
                                        {scoring.key_claims.map((claim, idx) => (
                                            <li key={idx} className="flex gap-3 text-sm">
                                                <div className="mt-0.5 shrink-0">
                                                    {renderVerdictIcon(claim.verdict)}
                                                </div>
                                                <div>
                                                    <p className="font-medium leading-snug">{claim.claim}</p>
                                                    {claim.notes && (
                                                        <p className="text-xs text-muted-foreground mt-1 italic">{claim.notes}</p>
                                                    )}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm text-muted-foreground italic">No specific claims evaluated.</p>
                                )}
                            </div>

                            {/* Evidence & Caveats Section */}
                            <div className="p-4 space-y-5 bg-black/5 dark:bg-white/5">
                                {/* Evidence Sources */}
                                <div className="space-y-3">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                        <LinkIcon className="w-3.5 h-3.5" />
                                        {tEvidence}
                                    </h4>

                                    {(scoring.evidence && scoring.evidence.length > 0) ? (
                                        <div className="space-y-2">
                                            {scoring.evidence.map((ev, idx) => (
                                                <div key={idx} className="flex items-start justify-between gap-2 text-sm">
                                                    <div className="min-w-0 flex-1">
                                                        {ev.url ? (
                                                            <a href={ev.url} target="_blank" rel="noopener noreferrer" className="hover:underline text-primary font-medium truncate block">
                                                                {ev.source_name}
                                                            </a>
                                                        ) : (
                                                            <span className="font-medium truncate block">{ev.source_name}</span>
                                                        )}
                                                    </div>
                                                    <span className={cn(
                                                        "text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm shrink-0 border",
                                                        ev.strength === 'primary' || ev.strength === 'high' ? 'bg-green-500/10 text-green-600 border-green-500/20' :
                                                            ev.strength === 'medium' ? 'bg-orange-500/10 text-orange-600 border-orange-500/20' :
                                                                'bg-gray-500/10 text-gray-500 border-gray-500/20'
                                                    )}>
                                                        {ev.strength}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground italic">No specific evidence linked.</p>
                                    )}
                                </div>

                                {/* Caveats */}
                                {(scoring.caveats && scoring.caveats.length > 0) && (
                                    <div className="space-y-2 pt-4 border-t border-border/10">
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {tCaveats}
                                        </h4>
                                        <ul className="space-y-1.5 text-sm">
                                            {scoring.caveats.map((caveat, idx) => (
                                                <li key={idx} className="flex gap-2 text-muted-foreground">
                                                    <span className="text-orange-500/50">•</span>
                                                    <span>{caveat}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                            </div>

                        </div>
                    </CardContent>
                </CollapsibleContent>
            </Collapsible>
        </Card>
    );
};
