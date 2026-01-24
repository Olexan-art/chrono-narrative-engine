import { cn } from "@/lib/utils";
import { Heart, ThumbsUp } from "lucide-react";
import { useState, useCallback } from "react";

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

interface ConfettiParticle {
  id: number;
  x: number;
  y: number;
  emoji: string;
  rotation: number;
  scale: number;
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

const confettiEmojis = ['❤️', '💖', '💕', '✨', '🌟', '💫', '⭐', '🎉'];

function formatNumber(num: number): string {
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

function ConfettiEffect({ particles }: { particles: ConfettiParticle[] }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible">
      {particles.map((particle) => (
        <span
          key={particle.id}
          className="absolute animate-confetti text-sm"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            transform: `rotate(${particle.rotation}deg) scale(${particle.scale})`,
            '--confetti-x': `${(Math.random() - 0.5) * 100}px`,
            '--confetti-y': `${-50 - Math.random() * 50}px`,
          } as React.CSSProperties}
        >
          {particle.emoji}
        </span>
      ))}
    </div>
  );
}

export function CharacterChat({ messages }: CharacterChatProps) {
  const [likedMessages, setLikedMessages] = useState<Set<number>>(new Set());
  const [localLikes, setLocalLikes] = useState<Record<number, number>>({});
  const [animatingLikes, setAnimatingLikes] = useState<Set<number>>(new Set());
  const [confettiMap, setConfettiMap] = useState<Record<number, ConfettiParticle[]>>({});

  const generateConfetti = useCallback((index: number) => {
    const particles: ConfettiParticle[] = Array.from({ length: 8 }, (_, i) => ({
      id: Date.now() + i,
      x: 10 + Math.random() * 30,
      y: 70 + Math.random() * 20,
      emoji: confettiEmojis[Math.floor(Math.random() * confettiEmojis.length)],
      rotation: Math.random() * 360,
      scale: 0.6 + Math.random() * 0.6,
    }));

    setConfettiMap(prev => ({ ...prev, [index]: particles }));

    // Clear confetti after animation
    setTimeout(() => {
      setConfettiMap(prev => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }, 1000);
  }, []);

  if (!messages || messages.length === 0) return null;

  const handleLike = (index: number) => {
    const wasLiked = likedMessages.has(index);
    
    if (wasLiked) {
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
      // Like with animation
      setLikedMessages(prev => new Set(prev).add(index));
      setLocalLikes(prev => ({
        ...prev,
        [index]: (prev[index] || 0) + 1
      }));
      
      // Trigger heart animation
      setAnimatingLikes(prev => new Set(prev).add(index));
      setTimeout(() => {
        setAnimatingLikes(prev => {
          const next = new Set(prev);
          next.delete(index);
          return next;
        });
      }, 600);

      // Generate confetti
      generateConfetti(index);
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
          const isAnimating = animatingLikes.has(i);
          const characterLikes = msg.characterLikes || [];
          const confettiParticles = confettiMap[i] || [];

          return (
            <div
              key={i}
              className={cn(
                "relative flex gap-2 md:gap-3 p-3 md:p-4 rounded-lg border transition-all duration-300",
                "hover:scale-[1.01] hover:shadow-lg hover:shadow-primary/5",
                characterColors[msg.character] || "border-border bg-card/50",
                "animate-fade-in"
              )}
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <ConfettiEffect particles={confettiParticles} />
              
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
                      "relative flex items-center gap-1.5 text-xs transition-all group",
                      isLiked 
                        ? "text-red-500" 
                        : "text-muted-foreground hover:text-red-400"
                    )}
                  >
                    <div className="relative">
                      <Heart 
                        className={cn(
                          "w-4 h-4 transition-all duration-300",
                          isLiked && "fill-current",
                          isAnimating && "animate-like-bounce"
                        )} 
                      />
                      {/* Pulse ring effect on like */}
                      {isAnimating && (
                        <span className="absolute inset-0 rounded-full animate-like-ring border-2 border-red-500/50" />
                      )}
                    </div>
                    <span className={cn(
                      "transition-all duration-300",
                      isAnimating && "animate-like-count"
                    )}>
                      {formatNumber(totalLikes)}
                    </span>
                  </button>

                  {/* Character likes */}
                  {characterLikes.length > 0 && (
                    <div className="flex items-center gap-1 animate-fade-in" style={{ animationDelay: '200ms' }}>
                      <ThumbsUp className="w-3 h-3 text-muted-foreground" />
                      <div className="flex -space-x-1">
                        {characterLikes.map((cl, j) => (
                          <span 
                            key={j} 
                            className="text-sm cursor-default transition-transform hover:scale-125 hover:z-10"
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

      {/* Inline styles for animations */}
      <style>{`
        @keyframes like-bounce {
          0%, 100% { transform: scale(1); }
          25% { transform: scale(1.4); }
          50% { transform: scale(0.9); }
          75% { transform: scale(1.2); }
        }
        
        @keyframes like-ring {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        
        @keyframes like-count {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        
        @keyframes confetti {
          0% { 
            opacity: 1; 
            transform: translate(0, 0) rotate(0deg) scale(var(--scale, 1)); 
          }
          100% { 
            opacity: 0; 
            transform: translate(var(--confetti-x, 0), var(--confetti-y, -50px)) rotate(360deg) scale(0); 
          }
        }
        
        .animate-like-bounce {
          animation: like-bounce 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }
        
        .animate-like-ring {
          animation: like-ring 0.6s ease-out forwards;
        }
        
        .animate-like-count {
          animation: like-count 0.3s ease-out;
        }
        
        .animate-confetti {
          animation: confetti 1s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
