import { useState, useMemo, useEffect } from "react";
import { ThumbsUp, ThumbsDown, Sparkles, Scale, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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

// Get or create persistent visitor ID
const getVisitorId = (): string => {
  const key = 'chrono-visitor-id';
  let visitorId = localStorage.getItem(key);
  if (!visitorId) {
    visitorId = `v_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(key, visitorId);
  }
  return visitorId;
};

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

  // Check user's existing vote on mount
  useEffect(() => {
    const checkExistingVote = async () => {
      const visitorId = getVisitorId();
      const { data } = await supabase
        .from('news_votes')
        .select('vote_type')
        .eq('news_item_id', newsId)
        .eq('visitor_id', visitorId)
        .maybeSingle();
      
      if (data?.vote_type) {
        setCurrentVote(data.vote_type as 'like' | 'dislike');
      }
    };
    checkExistingVote();
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
    const visitorId = getVisitorId();

    try {
      // If clicking the same vote, toggle it off
      if (currentVote === voteType) {
        // Remove vote - decrement counter
        await supabase.from('news_votes').delete().eq('news_item_id', newsId).eq('visitor_id', visitorId);
        
        if (voteType === 'like') {
          setLocalLikes(prev => Math.max(0, prev - 1));
        } else {
          setLocalDislikes(prev => Math.max(0, prev - 1));
        }
        
        // Update news_rss_items counter
        await supabase.from('news_rss_items').update({
          [voteType === 'like' ? 'likes' : 'dislikes']: voteType === 'like' ? localLikes - 1 : localDislikes - 1
        }).eq('id', newsId);
        
        setCurrentVote(null);
      } else {
        // Add or change vote
        if (currentVote) {
          // Changing vote: decrement old, increment new
          const oldType = currentVote;
          
          await supabase.from('news_votes').update({ vote_type: voteType }).eq('news_item_id', newsId).eq('visitor_id', visitorId);
          
          if (oldType === 'like') {
            setLocalLikes(prev => Math.max(0, prev - 1));
            setLocalDislikes(prev => prev + 1);
          } else {
            setLocalDislikes(prev => Math.max(0, prev - 1));
            setLocalLikes(prev => prev + 1);
          }
          
          await supabase.from('news_rss_items').update({
            likes: oldType === 'like' ? localLikes - 1 : localLikes + 1,
            dislikes: oldType === 'dislike' ? localDislikes - 1 : localDislikes + 1
          }).eq('id', newsId);
          
        } else {
          // New vote
          await supabase.from('news_votes').insert({
            news_item_id: newsId,
            visitor_id: visitorId,
            vote_type: voteType
          });
          
          if (voteType === 'like') {
            setLocalLikes(prev => prev + 1);
          } else {
            setLocalDislikes(prev => prev + 1);
          }
          
          await supabase.from('news_rss_items').update({
            [voteType === 'like' ? 'likes' : 'dislikes']: voteType === 'like' ? localLikes + 1 : localDislikes + 1
          }).eq('id', newsId);
        }
        
        setCurrentVote(voteType);
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
