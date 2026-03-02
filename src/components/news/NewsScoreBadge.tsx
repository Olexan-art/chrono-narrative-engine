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

export const NewsScoreBadge: React.FC<NewsScoreBadgeProps> = ({ scoring, className }) => {
    if (!scoring || typeof scoring !== 'object' || !scoring.scores?.overall) return null;

    const score = scoring.scores.overall;

    // Determine color and icon based on thresholds
    let ColorClass = 'bg-gray-500/80 text-white';
    let BorderClass = 'border-gray-400/50';
    let Icon = Shield;

    if (score >= 90) {
        ColorClass = 'bg-green-500/90 text-white';
        BorderClass = 'border-green-400/50';
        Icon = ShieldCheck;
    } else if (score >= 70) {
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
                "absolute bottom-1 right-1 flex items-center gap-1 px-1.5 py-0.5 rounded-sm backdrop-blur-sm border shadow-sm",
                ColorClass,
                BorderClass,
                className
            )}
            title={`Source Trust Score: ${score}/100`}
        >
            <Icon className="w-2.5 h-2.5" />
            <span className="text-[10px] font-bold tracking-tighter tabular-nums leading-none">
                {score}
            </span>
        </div>
    );
};
