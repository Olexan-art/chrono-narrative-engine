import { cn } from "@/lib/utils";

interface ChatMessage {
  character: string;
  name: string;
  avatar: string;
  message: string;
}

interface CharacterChatProps {
  messages: ChatMessage[];
}

const characterColors: Record<string, string> = {
  darth_vader: "border-red-500/30 bg-red-950/20",
  kratos: "border-orange-500/30 bg-orange-950/20",
  deadpool: "border-red-400/30 bg-red-900/20",
  geralt: "border-amber-500/30 bg-amber-950/20",
  jon_snow: "border-slate-400/30 bg-slate-900/20",
  cartman: "border-yellow-500/30 bg-yellow-950/20",
  scorpion: "border-yellow-400/30 bg-yellow-900/20",
};

export function CharacterChat({ messages }: CharacterChatProps) {
  if (!messages || messages.length === 0) return null;

  return (
    <div className="mt-12 pt-8 border-t border-border">
      <h3 className="text-sm font-mono text-muted-foreground mb-6 flex items-center gap-2">
        <span className="text-xl">💬</span>
        РЕАКЦІЯ ПЕРСОНАЖІВ
      </h3>
      
      <div className="space-y-4 max-w-2xl">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "flex gap-3 p-4 rounded-lg border transition-all hover:scale-[1.01]",
              characterColors[msg.character] || "border-border bg-card/50"
            )}
          >
            <div className="text-3xl shrink-0">{msg.avatar}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-sm">{msg.name}</span>
              </div>
              <p className="text-foreground/90 font-serif leading-relaxed">
                {msg.message}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
