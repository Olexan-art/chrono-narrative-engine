import { cn } from "@/lib/utils";

interface EntitySentimentBadgeProps {
  sentiment: string | null | undefined;
  className?: string;
}

export function EntitySentimentBadge({ sentiment, className }: EntitySentimentBadgeProps) {
  if (!sentiment) return null;

  const getSentimentConfig = () => {
    switch (sentiment) {
      case 'positive':
        return {
          icon: '🟢',
          bgColor: 'bg-green-500/90',
          animation: ''
        };
      case 'negative':
        return {
          icon: '🔴',
          bgColor: 'bg-red-500/90',
          animation: 'animate-pulse'
        };
      case 'neutral':
        return {
          icon: '⚪',
          bgColor: 'bg-gray-500/90',
          animation: ''
        };
      case 'mixed':
        return {
          icon: '🟡',
          bgColor: 'bg-yellow-500/90',
          animation: ''
        };
      default:
        return null;
    }
  };

  const config = getSentimentConfig();
  if (!config) return null;

  return (
    <div
      className={cn(
        "absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs backdrop-blur-sm shadow-lg z-10",
        config.bgColor,
        config.animation,
        className
      )}
      title={`Manual sentiment: ${sentiment}`}
    >
      {config.icon}
    </div>
  );
}
