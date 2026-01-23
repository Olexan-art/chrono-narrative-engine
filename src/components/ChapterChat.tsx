import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types/database";

interface ChapterChatProps {
  messages: ChatMessage[];
}

const characterColors: Record<string, string> = {
  stranger: "border-primary/40 bg-primary/5",
  narrator_ai: "border-secondary/40 bg-secondary/10",
  time_keeper: "border-amber-500/30 bg-amber-950/20",
  echo: "border-purple-500/30 bg-purple-950/20",
  observer: "border-cyan-500/30 bg-cyan-950/20",
  prophet: "border-yellow-500/30 bg-yellow-950/20",
};

export function ChapterChat({ messages }: ChapterChatProps) {
  if (!messages || messages.length === 0) return null;

  return (
    <section className="my-16">
      <h3 className="text-sm font-mono text-muted-foreground mb-6 flex items-center gap-2">
        <span className="text-xl">💬</span>
        ДІАЛОГ СПОСТЕРІГАЧІВ
      </h3>
      
      <div className="space-y-4 max-w-3xl">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "flex gap-4 p-4 rounded-lg border transition-all hover:scale-[1.01]",
              characterColors[msg.character] || "border-border bg-card/50"
            )}
          >
            <div className="text-3xl shrink-0">{msg.avatar}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold text-sm">{msg.name}</span>
                <span className="text-xs text-muted-foreground font-mono">
                  #{String(i + 1).padStart(2, '0')}
                </span>
              </div>
              <p className="text-foreground/90 font-serif leading-relaxed">
                {msg.message}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
