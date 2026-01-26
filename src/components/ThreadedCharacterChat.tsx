import { cn } from "@/lib/utils";
import { Heart, ThumbsUp, Reply, CornerDownRight } from "lucide-react";
import { useState, useCallback, useMemo, useEffect, useRef, memo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

interface CharacterLike {
  characterId: string;
  name: string;
  avatar: string;
}

interface ChatMessage {
  id?: string;
  character: string;
  name: string;
  avatar: string;
  message: string;
  likes?: number;
  characterLikes?: CharacterLike[];
  replyTo?: string;
  threadId?: string;
}

interface ThreadedCharacterChatProps {
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

const CHARACTER_COLORS: Readonly<Record<string, string>> = {
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
} as const;

const CONFETTI_EMOJIS = ['❤️', '💖', '💕', '✨', '🌟', '💫', '⭐', '🎉'] as const;
const ANIMATION_DURATION = 600;
const CONFETTI_DURATION = 1000;
const MAX_CONFETTI_PARTICLES = 8;

function formatNumber(num: number): string {
  if (!Number.isFinite(num) || num < 0) return '0';
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return Math.floor(num).toString();
}

function getRandomEmoji(): string {
  return CONFETTI_EMOJIS[Math.floor(Math.random() * CONFETTI_EMOJIS.length)];
}

const ConfettiEffect = memo(function ConfettiEffect({ particles }: { particles: ConfettiParticle[] }) {
  if (particles.length === 0) return null;
  
  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible" aria-hidden="true">
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
});

interface MessageCardProps {
  msg: ChatMessage;
  index: number;
  isReply?: boolean;
  replyToMessage?: ChatMessage | null;
  isLiked: boolean;
  totalLikes: number;
  isAnimating: boolean;
  confettiParticles: ConfettiParticle[];
  onLike: (index: number) => void;
}

const MessageCard = memo(function MessageCard({
  msg,
  index,
  isReply = false,
  replyToMessage,
  isLiked,
  totalLikes,
  isAnimating,
  confettiParticles,
  onLike,
}: MessageCardProps) {
  const characterLikes = msg.characterLikes ?? [];
  const characterColor = CHARACTER_COLORS[msg.character] ?? "border-border bg-card/50";

  const handleLikeClick = useCallback(() => {
    onLike(index);
  }, [onLike, index]);

  // Sanitize message content
  const sanitizedMessage = typeof msg.message === 'string' ? msg.message : '';
  const sanitizedName = typeof msg.name === 'string' ? msg.name : 'Unknown';
  const sanitizedAvatar = typeof msg.avatar === 'string' ? msg.avatar : '👤';

  return (
    <div
      className={cn(
        "relative flex gap-2 md:gap-3 p-3 md:p-4 rounded-lg border transition-all duration-300",
        "hover:scale-[1.01] hover:shadow-lg hover:shadow-primary/5",
        characterColor,
        "animate-fade-in",
        isReply && "ml-6 md:ml-10 border-l-2 border-l-primary/30"
      )}
      style={{ animationDelay: `${Math.min(index * 100, 1000)}ms` }}
      role="article"
      aria-label={`Message from ${sanitizedName}`}
    >
      <ConfettiEffect particles={confettiParticles} />
      
      <div className="text-2xl md:text-3xl shrink-0" aria-hidden="true">{sanitizedAvatar}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-xs md:text-sm">{sanitizedName}</span>
          {isReply && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Reply className="h-3 w-3" aria-hidden="true" />
              <span>відповідь</span>
            </span>
          )}
        </div>
        
        {/* Reply context */}
        {replyToMessage && (
          <div className="mb-2 pl-2 border-l-2 border-muted-foreground/30 text-xs text-muted-foreground">
            <span className="font-medium">{replyToMessage.avatar} {replyToMessage.name}:</span>
            <span className="ml-1 line-clamp-1">{replyToMessage.message}</span>
          </div>
        )}
        
        <p className="text-sm md:text-base text-foreground/90 font-serif leading-relaxed mb-2">
          {sanitizedMessage}
        </p>
        
        {/* Likes section */}
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={handleLikeClick}
            className={cn(
              "relative flex items-center gap-1.5 text-xs transition-all group",
              isLiked 
                ? "text-red-500" 
                : "text-muted-foreground hover:text-red-400"
            )}
            aria-label={isLiked ? 'Unlike' : 'Like'}
            aria-pressed={isLiked}
          >
            <div className="relative">
              <Heart 
                className={cn(
                  "w-4 h-4 transition-all duration-300",
                  isLiked && "fill-current",
                  isAnimating && "animate-like-bounce"
                )} 
                aria-hidden="true"
              />
              {isAnimating && (
                <span className="absolute inset-0 rounded-full animate-like-ring border-2 border-red-500/50" aria-hidden="true" />
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
              <ThumbsUp className="w-3 h-3 text-muted-foreground" aria-hidden="true" />
              <div className="flex -space-x-1">
                {characterLikes.slice(0, 5).map((cl, j) => (
                  <span 
                    key={cl.characterId || j} 
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
});

export function ThreadedCharacterChat({ messages }: ThreadedCharacterChatProps) {
  const { t } = useLanguage();
  const [likedMessages, setLikedMessages] = useState<Set<number>>(() => new Set());
  const [localLikes, setLocalLikes] = useState<Record<number, number>>({});
  const [animatingLikes, setAnimatingLikes] = useState<Set<number>>(() => new Set());
  const [confettiMap, setConfettiMap] = useState<Record<number, ConfettiParticle[]>>({});
  
  // Track timeouts for cleanup
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Cleanup timeouts on unmount
  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
      timeouts.clear();
    };
  }, []);

  const generateConfetti = useCallback((index: number) => {
    const particles: ConfettiParticle[] = Array.from({ length: MAX_CONFETTI_PARTICLES }, (_, i) => ({
      id: Date.now() + i,
      x: 10 + Math.random() * 30,
      y: 70 + Math.random() * 20,
      emoji: getRandomEmoji(),
      rotation: Math.random() * 360,
      scale: 0.6 + Math.random() * 0.6,
    }));

    setConfettiMap(prev => ({ ...prev, [index]: particles }));

    // Clear existing timeout if any
    const existingTimeout = timeoutsRef.current.get(`confetti-${index}`);
    if (existingTimeout) clearTimeout(existingTimeout);

    const timeout = setTimeout(() => {
      setConfettiMap(prev => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
      timeoutsRef.current.delete(`confetti-${index}`);
    }, CONFETTI_DURATION);

    timeoutsRef.current.set(`confetti-${index}`, timeout);
  }, []);

  // Organize messages into threads with validation
  const { rootMessages, replyMap, messageById, globalIndexMap } = useMemo(() => {
    const messageById = new Map<string, ChatMessage>();
    const replyMap = new Map<string, ChatMessage[]>();
    const rootMessages: ChatMessage[] = [];
    const globalIndexMap = new Map<string, number>();

    // Validate messages array
    if (!Array.isArray(messages)) {
      return { rootMessages, replyMap, messageById, globalIndexMap };
    }

    // First pass: index all messages by ID
    messages.forEach((msg, idx) => {
      if (!msg || typeof msg !== 'object') return;
      const msgId = msg.id || `msg-${idx}`;
      const enrichedMsg = { ...msg, id: msgId };
      messageById.set(msgId, enrichedMsg);
      globalIndexMap.set(msgId, idx);
    });

    // Second pass: organize into threads
    messages.forEach((msg, idx) => {
      if (!msg || typeof msg !== 'object') return;
      const msgId = msg.id || `msg-${idx}`;
      const enrichedMsg = messageById.get(msgId);
      if (!enrichedMsg) return;

      if (msg.replyTo && messageById.has(msg.replyTo)) {
        const replies = replyMap.get(msg.replyTo) || [];
        replies.push(enrichedMsg);
        replyMap.set(msg.replyTo, replies);
      } else {
        rootMessages.push(enrichedMsg);
      }
    });

    return { rootMessages, replyMap, messageById, globalIndexMap };
  }, [messages]);

  // Early return for empty messages
  if (!messages || messages.length === 0) return null;

  const handleLike = (index: number) => {
    if (!Number.isFinite(index) || index < 0) return;
    
    const wasLiked = likedMessages.has(index);
    
    if (wasLiked) {
      setLikedMessages(prev => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
      setLocalLikes(prev => ({
        ...prev,
        [index]: Math.max((prev[index] || 0) - 1, -1)
      }));
    } else {
      setLikedMessages(prev => new Set(prev).add(index));
      setLocalLikes(prev => ({
        ...prev,
        [index]: (prev[index] || 0) + 1
      }));
      
      setAnimatingLikes(prev => new Set(prev).add(index));
      
      // Clear existing animation timeout
      const existingTimeout = timeoutsRef.current.get(`anim-${index}`);
      if (existingTimeout) clearTimeout(existingTimeout);

      const timeout = setTimeout(() => {
        setAnimatingLikes(prev => {
          const next = new Set(prev);
          next.delete(index);
          return next;
        });
        timeoutsRef.current.delete(`anim-${index}`);
      }, ANIMATION_DURATION);

      timeoutsRef.current.set(`anim-${index}`, timeout);
      generateConfetti(index);
    }
  };

  // Get likes data for a message
  const getLikesData = (msg: ChatMessage, globalIndex: number) => {
    const baseLikes = typeof msg.likes === 'number' && Number.isFinite(msg.likes) 
      ? msg.likes 
      : Math.floor(Math.random() * 1908);
    const totalLikes = baseLikes + (localLikes[globalIndex] || 0);
    return {
      isLiked: likedMessages.has(globalIndex),
      totalLikes: Math.max(0, totalLikes),
      isAnimating: animatingLikes.has(globalIndex),
      confettiParticles: confettiMap[globalIndex] || [],
    };
  };

  // Render a message with its replies
  const renderMessageWithReplies = (msg: ChatMessage, globalIndex: number) => {
    const replies = msg.id ? replyMap.get(msg.id) || [] : [];
    const likesData = getLikesData(msg, globalIndex);
    
    return (
      <div key={msg.id || globalIndex} className="space-y-2">
        <MessageCard
          msg={msg}
          index={globalIndex}
          {...likesData}
          onLike={handleLike}
        />
        
        {/* Replies */}
        {replies.length > 0 && (
          <div className="space-y-2">
            {replies.map((reply) => {
              const replyGlobalIndex = globalIndexMap.get(reply.id!) ?? -1;
              if (replyGlobalIndex < 0) return null;
              
              const replyLikesData = getLikesData(reply, replyGlobalIndex);
              return (
                <MessageCard
                  key={reply.id}
                  msg={reply}
                  index={replyGlobalIndex}
                  isReply={true}
                  replyToMessage={msg}
                  {...replyLikesData}
                  onLike={handleLike}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Check if this is a threaded conversation
  const hasThreads = messages.some(m => m?.replyTo);

  return (
    <div className="mt-8 md:mt-12 pt-4 md:pt-8 border-t border-border">
      <h3 className="text-xs md:text-sm font-mono text-muted-foreground mb-4 md:mb-6 flex items-center gap-2">
        <span className="text-lg md:text-xl" aria-hidden="true">💬</span>
        {t('chat.title')}
        {hasThreads && (
          <span className="ml-2 flex items-center gap-1 text-[10px] bg-primary/10 px-2 py-0.5 rounded-full">
            <CornerDownRight className="h-3 w-3" aria-hidden="true" />
            <span>з гілками</span>
          </span>
        )}
      </h3>
      
      <div className="space-y-3 md:space-y-4 max-w-2xl" role="feed" aria-label="Character chat">
        {hasThreads ? (
          // Threaded view
          rootMessages.map((msg) => {
            const globalIndex = globalIndexMap.get(msg.id!) ?? 0;
            return renderMessageWithReplies(msg, globalIndex);
          })
        ) : (
          // Linear view (fallback for non-threaded messages)
          messages.map((msg, i) => {
            if (!msg) return null;
            const likesData = getLikesData(msg, i);
            return (
              <MessageCard
                key={msg.id || i}
                msg={msg}
                index={i}
                {...likesData}
                onLike={handleLike}
              />
            );
          })
        )}
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
