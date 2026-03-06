import React from "react";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
    return (
        <div className={cn("flex flex-col select-none relative", className)}>
            {/* Animated glow effect */}
            <div className="absolute -inset-2 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 rounded-lg blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-pulse"></div>
            
            <div className="flex items-center gap-1 leading-none relative">
                <span className="font-sans font-black text-2xl tracking-tighter text-foreground transition-all duration-300 group-hover:scale-105">
                    Braven
                </span>
                <span className="font-sans font-black text-2xl tracking-tighter text-primary bg-clip-text text-transparent bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] animate-gradient">
                    Now
                </span>
            </div>
            <span className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground uppercase opacity-80 pl-[2px] relative transition-all duration-300 group-hover:opacity-100 group-hover:tracking-[0.25em]">
                Brave New World
            </span>
            
            <style>{`
                @keyframes gradient {
                    0%, 100% {
                        background-position: 0% center;
                    }
                    50% {
                        background-position: 100% center;
                    }
                }
                .animate-gradient {
                    animation: gradient 3s ease infinite;
                }
            `}</style>
        </div>
    );
}
