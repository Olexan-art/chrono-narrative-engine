import { cn } from "@/lib/utils";
import { Heart, ThumbsUp } from "lucide-react";
import { useState } from "react";

interface CharacterLike {
  characterId: string;
  name: string;
  avatar: string;
}

interface ChatMessage {
  character: string;
  name: string;
  avatar: string;
  message: string;
  likes?: number;
  characterLikes?: CharacterLike[];
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
  narrator: "border-purple-500/30 bg-purple-950/20",
  observer: "border-blue-500/30 bg-blue-950/20",
  stranger: "border-green-500/30 bg-green-950/20",
};

function formatNumber(num: number): string {
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

export function CharacterChat({ messages }: CharacterChatProps) {
  const [likedMessages, setLikedMessages] = useState<Set<number>>(new Set());
  const [localLikes, setLocalLikes] = useState<Record<number, number>>({});

  if (!messages || messages.length === 0) return null;

  const handleLike = (index: number) => {
    if (likedMessages.has(index)) {
      // Unlike
      setLikedMessages(prev => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
      setLocalLikes(prev => ({
        ...prev,
        [index]: (prev[index] || 0) - 1
      }));
    } else {
      // Like
      setLikedMessages(prev => new Set(prev).add(index));
      setLocalLikes(prev => ({
        ...prev,
        [index]: (prev[index] || 0) + 1
      }));
    }
  };

  return (
    <div className="mt-8 md:mt-12 pt-4 md:pt-8 border-t border-border">
      <h3 className="text-xs md:text-sm font-mono text-muted-foreground mb-4 md:mb-6 flex items-center gap-2">
        <span className="text-lg md:text-xl">💬</span>
        РЕАКЦІЯ ПЕРСОНАЖІВ
      </h3>
      
      <div className="space-y-3 md:space-y-4 max-w-2xl">
        {messages.map((msg, i) => {
          const baseLikes = msg.likes ?? Math.floor(Math.random() * 1908);
          const totalLikes = baseLikes + (localLikes[i] || 0);
          const isLiked = likedMessages.has(i);
          const characterLikes = msg.characterLikes || [];

          return (
            <div
              key={i}
              className={cn(
                "flex gap-2 md:gap-3 p-3 md:p-4 rounded-lg border transition-all hover:scale-[1.01]",
                characterColors[msg.character] || "border-border bg-card/50"
              )}
            >
              <div className="text-2xl md:text-3xl shrink-0">{msg.avatar}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-xs md:text-sm">{msg.name}</span>
                </div>
                <p className="text-sm md:text-base text-foreground/90 font-serif leading-relaxed mb-2">
                  {msg.message}
                </p>
                
                {/* Likes section */}
                <div className="flex items-center gap-3 mt-2">
                  <button
                    onClick={() => handleLike(i)}
                    className={cn(
                      "flex items-center gap-1.5 text-xs transition-all",
                      isLiked 
                        ? "text-red-500" 
                        : "text-muted-foreground hover:text-red-400"
                    )}
                  >
                    <Heart 
                      className={cn(
                        "w-4 h-4 transition-all",
                        isLiked && "fill-current scale-110"
                      )} 
                    />
                    <span>{formatNumber(totalLikes)}</span>
                  </button>

                  {/* Character likes */}
                  {characterLikes.length > 0 && (
                    <div className="flex items-center gap-1">
                      <ThumbsUp className="w-3 h-3 text-muted-foreground" />
                      <div className="flex -space-x-1">
                        {characterLikes.map((cl, j) => (
                          <span 
                            key={j} 
                            className="text-sm cursor-default"
                            title={cl.name}
                          >
                            {cl.avatar}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
