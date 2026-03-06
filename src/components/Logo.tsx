import React from "react";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
    return (
        <div className={cn("flex flex-col select-none relative group", className)}>
            {/* Holographic glow background */}
            <div className="absolute -inset-3 bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-pink-500/20 rounded-lg blur-xl opacity-0 group-hover:opacity-100 transition-all duration-500 group-hover:animate-rainbow-pulse"></div>
            
            <div className="flex items-center gap-1 leading-none relative z-10">
                <span className="font-sans font-black text-2xl tracking-tighter relative group-hover:animate-wave-text">
                    <span className="relative inline-block bg-gradient-to-br from-foreground via-foreground to-foreground group-hover:from-cyan-400 group-hover:via-purple-400 group-hover:to-pink-400 bg-clip-text text-transparent transition-all duration-700 drop-shadow-[0_0_8px_rgba(139,92,246,0)] group-hover:drop-shadow-[0_0_8px_rgba(139,92,246,0.5)]">
                        Braven
                    </span>
                </span>
                <span className="font-sans font-black text-2xl tracking-tighter relative">
                    {/* Main holographic text */}
                    <span className="relative inline-block bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] group-hover:animate-shimmer-rainbow bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(var(--primary-rgb),0.3)] group-hover:drop-shadow-[0_0_15px_rgba(var(--primary-rgb),0.8)] transition-all duration-300 group-hover:scale-110">
                        Now
                    </span>
                    {/* Neon glow effect */}
                    <span className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent opacity-0 group-hover:opacity-50 group-hover:animate-neon-flicker blur-[1px]" aria-hidden="true">
                        Now
                    </span>
                </span>
            </div>
            <span className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground uppercase opacity-80 pl-[2px] relative z-10 transition-all duration-500 group-hover:opacity-100 group-hover:tracking-[0.35em] group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-cyan-400/80 group-hover:via-purple-400/80 group-hover:to-pink-400/80 group-hover:bg-clip-text">
                Brave New World
            </span>
            
            <style>{`
                @keyframes rainbow-pulse {
                    0%, 100% {
                        background-position: 0% 50%;
                        opacity: 0.6;
                    }
                    50% {
                        background-position: 100% 50%;
                        opacity: 1;
                    }
                }
                
                @keyframes shimmer-rainbow {
                    0% {
                        background-position: 0% center;
                        filter: hue-rotate(0deg);
                    }
                    50% {
                        background-position: 100% center;
                        filter: hue-rotate(20deg);
                    }
                    100% {
                        background-position: 200% center;
                        filter: hue-rotate(0deg);
                    }
                }
                
                @keyframes neon-flicker {
                    0%, 100% { opacity: 0.3; }
                    10% { opacity: 0.5; }
                    20% { opacity: 0.3; }
                    30% { opacity: 0.6; }
                    40% { opacity: 0.4; }
                    50% { opacity: 0.7; }
                    60% { opacity: 0.3; }
                    70% { opacity: 0.5; }
                    80% { opacity: 0.4; }
                    90% { opacity: 0.6; }
                }
                
                @keyframes wave-text {
                    0%, 100% { transform: translateY(0); }
                    25% { transform: translateY(-2px); }
                    75% { transform: translateY(2px); }
                }
                
                .animate-rainbow-pulse {
                    animation: rainbow-pulse 3s ease-in-out infinite;
                    background-size: 200% 200%;
                }
                
                .animate-shimmer-rainbow {
                    animation: shimmer-rainbow 4s linear infinite;
                }
                
                .animate-neon-flicker {
                    animation: neon-flicker 1.5s ease-in-out infinite;
                }
                
                .animate-wave-text {
                    animation: wave-text 2s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
}
