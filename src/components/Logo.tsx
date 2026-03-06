import React from "react";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
    return (
        <div className={cn("flex flex-col select-none relative group", className)}>
            <div className="flex items-center gap-1 leading-none relative">
                <span className="font-sans font-black text-2xl tracking-tighter text-foreground transition-all duration-300 group-hover:animate-glitch-1">
                    Braven
                </span>
                <span className="font-sans font-black text-2xl tracking-tighter relative">
                    {/* Main text */}
                    <span className="relative inline-block text-primary group-hover:animate-glitch-2">
                        Now
                    </span>
                    {/* Glitch layers */}
                    <span className="absolute top-0 left-0 text-cyan-500 opacity-0 group-hover:opacity-70 group-hover:animate-glitch-layer-1" aria-hidden="true">
                        Now
                    </span>
                    <span className="absolute top-0 left-0 text-orange-500 opacity-0 group-hover:opacity-70 group-hover:animate-glitch-layer-2" aria-hidden="true">
                        Now
                    </span>
                </span>
            </div>
            <span className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground uppercase opacity-80 pl-[2px] relative transition-all duration-300 group-hover:opacity-100 group-hover:tracking-[0.3em] group-hover:animate-flicker">
                Brave New World
            </span>
            
            <style>{`
                @keyframes glitch-1 {
                    0%, 100% { transform: translate(0); }
                    20% { transform: translate(-2px, 1px); }
                    40% { transform: translate(2px, -1px); }
                    60% { transform: translate(-1px, 2px); }
                    80% { transform: translate(1px, -2px); }
                }
                
                @keyframes glitch-2 {
                    0%, 100% { transform: translate(0); opacity: 1; }
                    10% { transform: translate(-3px, 0); }
                    20% { transform: translate(3px, 0); }
                    30% { transform: translate(0, 2px); }
                    40% { transform: translate(0, -2px); }
                    50% { transform: translate(-2px, 1px); opacity: 0.9; }
                    60% { transform: translate(2px, -1px); opacity: 0.95; }
                    70% { transform: translate(-1px, 2px); }
                    80% { transform: translate(1px, -2px); }
                    90% { transform: translate(0); opacity: 1; }
                }
                
                @keyframes glitch-layer-1 {
                    0%, 100% { transform: translate(0); clip-path: inset(0 0 0 0); }
                    10% { transform: translate(-3px, 2px); clip-path: inset(10% 0 60% 0); }
                    20% { transform: translate(2px, -1px); clip-path: inset(40% 0 20% 0); }
                    30% { transform: translate(-2px, 3px); clip-path: inset(70% 0 5% 0); }
                    40% { transform: translate(3px, -2px); clip-path: inset(5% 0 80% 0); }
                    50% { transform: translate(-1px, 1px); clip-path: inset(60% 0 30% 0); }
                    60% { transform: translate(2px, 2px); clip-path: inset(20% 0 65% 0); }
                    70% { transform: translate(-3px, -1px); clip-path: inset(50% 0 40% 0); }
                    80% { transform: translate(1px, 3px); clip-path: inset(15% 0 75% 0); }
                    90% { transform: translate(0); clip-path: inset(0 0 0 0); }
                }
                
                @keyframes glitch-layer-2 {
                    0%, 100% { transform: translate(0); clip-path: inset(0 0 0 0); }
                    15% { transform: translate(3px, -2px); clip-path: inset(30% 0 40% 0); }
                    25% { transform: translate(-2px, 2px); clip-path: inset(60% 0 10% 0); }
                    35% { transform: translate(2px, 1px); clip-path: inset(5% 0 70% 0); }
                    45% { transform: translate(-3px, -2px); clip-path: inset(80% 0 5% 0); }
                    55% { transform: translate(1px, -1px); clip-path: inset(25% 0 55% 0); }
                    65% { transform: translate(-2px, 2px); clip-path: inset(45% 0 35% 0); }
                    75% { transform: translate(3px, 1px); clip-path: inset(65% 0 15% 0); }
                    85% { transform: translate(-1px, -2px); clip-path: inset(10% 0 85% 0); }
                    95% { transform: translate(0); clip-path: inset(0 0 0 0); }
                }
                
                @keyframes flicker {
                    0%, 100% { opacity: 1; }
                    10% { opacity: 0.8; }
                    20% { opacity: 1; }
                    30% { opacity: 0.9; }
                    40% { opacity: 1; }
                    50% { opacity: 0.85; }
                    60% { opacity: 1; }
                    70% { opacity: 0.95; }
                    80% { opacity: 1; }
                    90% { opacity: 0.9; }
                }
                
                .animate-glitch-1 {
                    animation: glitch-1 0.8s ease-in-out infinite;
                }
                
                .animate-glitch-2 {
                    animation: glitch-2 0.6s ease-in-out infinite;
                }
                
                .animate-glitch-layer-1 {
                    animation: glitch-layer-1 0.5s steps(2) infinite;
                }
                
                .animate-glitch-layer-2 {
                    animation: glitch-layer-2 0.4s steps(2) infinite;
                }
                
                .animate-flicker {
                    animation: flicker 2s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
}
