import React from "react";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
    return (
        <div className={cn("flex flex-col select-none", className)}>
            <div className="flex items-center gap-1 leading-none">
                <span className="font-sans font-black text-2xl tracking-tighter text-foreground">
                    Braven
                </span>
                <span className="font-sans font-black text-2xl tracking-tighter text-primary bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                    Now
                </span>
            </div>
            <span className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground uppercase opacity-80 pl-[2px]">
                Brave New World
            </span>
        </div>
    );
}
