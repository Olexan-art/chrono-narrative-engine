import { useState, useMemo, useEffect } from "react";
import { ThumbsUp, ThumbsDown, Sparkles, Scale, AlertTriangle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface NewsVoteBlockProps {
  newsId: string;
  likes: number;
  dislikes: number;
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

type VoteStatus = 'majority_likes' | 'majority_dislikes' | 'balanced';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function callVoteFunction(newsId: string, voteType: 'like' | 'dislike') {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/vote-news`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({ newsId, voteType }),
  });
  if (!response.ok) throw new Error('Vote failed');
  return response.json();
}

async function checkExistingVote(newsId: string): Promise<{ vote: string | null; visitorId: string | null }> {
  // Check via edge function - it will identify us by IP fingerprint
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/vote-news`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ newsId, voteType: null }),
    });
    // A null voteType check returns existing state without changing anything
    // But our edge function handles this - if no voteType and existing vote, it does nothing
    // We need a different approach - just try to read from the response
    return { vote: null, visitorId: null };
  } catch {
    return { vote: null, visitorId: null };
  }
}

export function NewsVoteBlock({ newsId, likes, dislikes, className, showLabel = true, size = 'md' }: NewsVoteBlockProps) {
  const { language } = useLanguage();
  const [currentVote, setCurrentVote] = useState<'like' | 'dislike' | null>(null);
  const [localLikes, setLocalLikes] = useState(likes);
  const [localDislikes, setLocalDislikes] = useState(dislikes);
  const [isLoading, setIsLoading] = useState(false);

  // Size configurations
  const sizeConfig = {
    sm: { button: 'p-1.5', icon: 'w-4 h-4', label: 'text-xs px-2 py-1', statusIcon: 'w-3.5 h-3.5', sparkle: 'w-3 h-3' },
    md: { button: 'p-2', icon: 'w-5 h-5', label: 'text-sm px-3 py-1.5', statusIcon: 'w-4 h-4', sparkle: 'w-3.5 h-3.5' },
    lg: { button: 'p-3', icon: 'w-6 h-6', label: 'text-base px-4 py-2', statusIcon: 'w-5 h-5', sparkle: 'w-4 h-4' },
  };
  const sizes = sizeConfig[size];

  // Check local storage for vote state (optimistic UI only - server is source of truth)
  useEffect(() => {
    const stored = localStorage.getItem(`vote-${newsId}`);
    if (stored === 'like' || stored === 'dislike') {
      setCurrentVote(stored);
    }
  }, [newsId]);

  // Calculate vote status
  const voteStatus = useMemo((): VoteStatus => {
    const total = localLikes + localDislikes;
    if (total === 0) return 'balanced';
    
    const likeRatio = localLikes / total;
    if (likeRatio >= 0.6) return 'majority_likes';
    if (likeRatio <= 0.4) return 'majority_dislikes';
    return 'balanced';
  }, [localLikes, localDislikes]);

  const handleVote = async (voteType: 'like' | 'dislike') => {
    if (isLoading) return;
    
    setIsLoading(true);

    try {
      const result = await callVoteFunction(newsId, voteType);
      
      setLocalLikes(result.likes);
      setLocalDislikes(result.dislikes);
      setCurrentVote(result.vote as 'like' | 'dislike' | null);
      
      // Store vote state locally for optimistic UI on revisit
      if (result.vote) {
        localStorage.setItem(`vote-${newsId}`, result.vote);
      } else {
        localStorage.removeItem(`vote-${newsId}`);
      }
    } catch (error) {
      console.error('Vote error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Labels and styling based on status
  const statusConfig = {
    majority_likes: {
      label: language === 'en' ? 'Majority likes' : language === 'pl' ? 'Większość lubi' : 'Більшості подобається',
      icon: ThumbsUp,
      colorClass: 'text-emerald-500',
      bgClass: 'bg-emerald-500/10',
      animated: true,
    },
    majority_dislikes: {
      label: language === 'en' ? 'Majority dislikes' : language === 'pl' ? 'Większość nie lubi' : 'Більшість проти',
      icon: ThumbsDown,
      colorClass: 'text-rose-500',
      bgClass: 'bg-rose-500/10',
      animated: false,
    },
    balanced: {
      label: language === 'en' ? 'Approximately equal' : language === 'pl' ? 'Mniej więcej równo' : 'Приблизно порівну',
      icon: Scale,
      colorClass: 'text-amber-500',
      bgClass: 'bg-amber-500/10',
      animated: false,
    },
  };

  const config = statusConfig[voteStatus];
  const StatusIcon = config.icon;

  return (
    <div className={cn("flex items-center gap-4 flex-wrap", className)}>
      {/* Vote buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleVote('like')}
          disabled={isLoading}
          className={cn(
            sizes.button,
            "rounded-full transition-all duration-200 hover:scale-110 flex items-center justify-center",
            currentVote === 'like' 
              ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" 
              : "hover:bg-emerald-500/20 text-muted-foreground hover:text-emerald-500 border border-border/50"
          )}
          aria-label="Like"
        >
          <ThumbsUp className={sizes.icon} />
        </button>
        
        <button
          onClick={() => handleVote('dislike')}
          disabled={isLoading}
          className={cn(
            sizes.button,
            "rounded-full transition-all duration-200 hover:scale-110 flex items-center justify-center",
            currentVote === 'dislike' 
              ? "bg-rose-500 text-white shadow-lg shadow-rose-500/30" 
              : "hover:bg-rose-500/20 text-muted-foreground hover:text-rose-500 border border-border/50"
          )}
          aria-label="Dislike"
        >
          <ThumbsDown className={sizes.icon} />
        </button>
      </div>

      {/* Status indicator */}
      {showLabel && (localLikes > 0 || localDislikes > 0) && (
        <div className={cn(
          "flex items-center gap-2 rounded-full font-medium",
          sizes.label,
          config.bgClass,
          config.colorClass
        )}>
          <StatusIcon 
            className={cn(
              sizes.statusIcon,
              config.animated && "animate-pulse"
            )} 
          />
          <span>{config.label}</span>
          {config.animated && (
            <Sparkles className={cn(sizes.sparkle, "animate-bounce")} />
          )}
        </div>
      )}
    </div>
  );
}

// Compact variant for news cards in feed
export function NewsVoteCompact({ newsId, likes, dislikes }: Omit<NewsVoteBlockProps, 'showLabel' | 'size'>) {
  return <NewsVoteBlock newsId={newsId} likes={likes} dislikes={dislikes} showLabel={false} size="sm" />;
}
