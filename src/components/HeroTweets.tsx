import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Repeat2, ArrowUpRight } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Part } from "@/types/database";
import type { Tweet } from "@/types/database";

interface HeroTweetsProps {
  parts: Part[];
}

function formatNumber(num: number): string {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

export function HeroTweets({ parts }: HeroTweetsProps) {
  const { language } = useLanguage();
  
  // Get first 5 tweets from most recent parts that have tweets
  const tweetsWithLinks: { tweet: Tweet; partDate: string; partTitle: string; partNumber: number }[] = [];
  
  for (const part of parts) {
    if (tweetsWithLinks.length >= 5) break;
    
    // Get localized tweets
    const localizedTweets = language === 'en' 
      ? ((part as any).tweets_en || part.tweets)
      : language === 'pl'
      ? ((part as any).tweets_pl || part.tweets)
      : part.tweets;
    
    const tweets = localizedTweets as Tweet[] | null;
    if (tweets && tweets.length > 0) {
      // Take up to 2 tweets per part
      for (let i = 0; i < Math.min(2, tweets.length) && tweetsWithLinks.length < 5; i++) {
        tweetsWithLinks.push({
          tweet: tweets[i],
          partDate: part.date,
          partTitle: part.title,
          partNumber: (part as any).number || 1
        });
      }
    }
  }

  if (tweetsWithLinks.length === 0) return null;

  const [api, setApi] = useState<CarouselApi>();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!api) return;

    intervalRef.current = setInterval(() => {
      api.scrollNext();
    }, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [api]);

  return (
    <Carousel
      setApi={setApi}
      opts={{
        align: "start",
        loop: true,
      }}
      className="w-full"
    >
      <CarouselContent className="-ml-2 md:-ml-3">
        {tweetsWithLinks.map(({ tweet, partDate, partNumber }, i) => (
          <CarouselItem key={i} className="pl-2 md:pl-3 basis-full sm:basis-1/2 lg:basis-1/3">
            <Link 
              to={`/read/${partDate}/${partNumber}`}
              className="group block h-full"
            >
              <div className="border border-border bg-card/50 rounded-lg p-3 hover:bg-card/70 hover:border-primary/30 transition-all h-full flex flex-col">
                {/* Header */}
                <div className="flex items-start gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-sm font-bold shrink-0">
                    {tweet.author.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-xs truncate">{tweet.author}</span>
                      <svg className="w-3 h-3 text-primary shrink-0" viewBox="0 0 22 22" fill="currentColor">
                        <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
                      </svg>
                    </div>
                    <span className="text-xs text-muted-foreground">{tweet.handle}</span>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </div>

                {/* Content */}
                <p className="text-xs leading-relaxed mb-2 font-serif line-clamp-3 flex-1">
                  {tweet.content}
                </p>

                {/* Actions */}
                <div className="flex items-center justify-between text-muted-foreground text-xs mt-auto pt-2 border-t border-border/50">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Repeat2 className="w-3 h-3" />
                      {formatNumber(tweet.retweets)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="w-3 h-3" />
                      {formatNumber(tweet.likes)}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="hidden sm:flex -left-4" />
      <CarouselNext className="hidden sm:flex -right-4" />
    </Carousel>
  );
}
