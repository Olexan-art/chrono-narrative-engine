import React from 'react';
import { ShieldAlert, ShieldCheck, ShieldOff, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SourceScoring {
    scores?: {
        overall?: number;
        reliability?: number;
        importance?: number;
        corroboration?: number;
    };
    verification_status?: string;
    confidence?: number;
}

interface NewsScoreBadgeProps {
    scoring?: SourceScoring | null;
    className?: string;
}

export const NewsScoreBadge: React.FC<NewsScoreBadgeProps> = ({ scoring: rawScoring, className }) => {
    const scoring = rawScoring && typeof rawScoring === 'object' && 'json' in rawScoring
        ? rawScoring.json as SourceScoring
        : rawScoring as SourceScoring;

    if (!scoring || typeof scoring !== 'object' || !scoring.scores?.overall) return null;

    const score = scoring.scores.overall;

    // Determine color and icon based on thresholds
    let ColorClass = 'bg-gray-500/80 text-white';
    let BorderClass = 'border-gray-400/50';
    let Icon = Shield;

    if (score > 70) {
        ColorClass = 'bg-green-500/90 text-white';
        BorderClass = 'border-green-400/50';
        Icon = ShieldCheck;
    } else if (score >= 40) {
        ColorClass = 'bg-orange-500/90 text-white';
        BorderClass = 'border-orange-400/50';
        Icon = ShieldAlert;
    } else {
        ColorClass = 'bg-red-500/90 text-white';
        BorderClass = 'border-red-400/50';
        Icon = ShieldOff;
    }

    return (
        <div
            className={cn(
                "absolute bottom-2 right-2 flex items-center gap-2 px-3 py-1.5 rounded-md backdrop-blur-sm border shadow-md",
                ColorClass,
                BorderClass,
                className
            )}
            title={`Source Trust Score: ${score}/100`}
        >
            <Icon className="w-5 h-5" />
            <span className="text-[20px] font-bold tracking-tighter tabular-nums leading-none">
                {score}
            </span>
        </div>
    );
};
