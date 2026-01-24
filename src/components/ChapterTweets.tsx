import { Heart, Repeat2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Tweet } from "@/types/database";

interface ChapterTweetsProps {
  tweets: Tweet[];
}

function formatNumber(num: number): string {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

export function ChapterTweets({ tweets }: ChapterTweetsProps) {
  const { t } = useLanguage();
  
  if (!tweets || tweets.length === 0) return null;

  return (
    <section className="my-8 md:my-16">
      <h3 className="text-xs md:text-sm font-mono text-muted-foreground mb-4 md:mb-6 flex items-center gap-2">
        <span className="text-lg md:text-xl font-bold">MW</span>
        {t('tweets.observers')}
      </h3>
      
      <div className="grid gap-3 md:gap-4 sm:grid-cols-2">
        {tweets.map((tweet, i) => (
          <div
            key={i}
            className="border border-border bg-card/50 rounded-lg p-3 md:p-4 hover:bg-card/70 transition-all"
          >
            {/* Header */}
            <div className="flex items-start gap-2 md:gap-3 mb-2 md:mb-3">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-sm md:text-lg font-bold shrink-0">
                {tweet.author.split(' ').pop() || tweet.author.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-xs md:text-sm truncate">{tweet.author}</span>
                  <svg className="w-3 h-3 md:w-4 md:h-4 text-primary shrink-0" viewBox="0 0 22 22" fill="currentColor">
                    <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
                  </svg>
                </div>
                <span className="text-[10px] md:text-xs text-muted-foreground">{tweet.handle}</span>
              </div>
            </div>

            {/* Content */}
            <p className="text-xs md:text-sm leading-relaxed mb-2 md:mb-3 font-serif">
              {tweet.content}
            </p>

            {/* Actions */}
            <div className="flex items-center gap-3 md:gap-4 text-muted-foreground text-[10px] md:text-xs pt-2 md:pt-3 border-t border-border/50">
              <span className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer">
                <Repeat2 className="w-3 h-3 md:w-4 md:h-4" />
                {formatNumber(tweet.retweets)}
              </span>
              <span className="flex items-center gap-1 hover:text-red-400 transition-colors cursor-pointer">
                <Heart className="w-3 h-3 md:w-4 md:h-4" />
                {formatNumber(tweet.likes)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
