import { memo } from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroTweets } from "@/components/HeroTweets";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Part } from "@/types/database";

interface HeroSectionProps {
  latestParts: Part[];
}

export const HeroSection = memo(function HeroSection({ latestParts }: HeroSectionProps) {
  const { t } = useLanguage();

  return (
    <section className="relative py-6 md:py-12 overflow-hidden border-b border-border">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
      <div className="container mx-auto px-4 relative">
        <div className="grid lg:grid-cols-2 gap-6 md:gap-8 items-center">
          {/* Left - Main Content */}
          <div className="text-center lg:text-left animate-fade-in">
            <div className="inline-flex items-center gap-2 px-2 md:px-3 py-1 border border-primary/30 bg-primary/5 mb-2 md:mb-3 transition-all duration-300 hover:border-primary/60 hover:bg-primary/10">
              <Sparkles className="w-3 h-3 text-primary animate-pulse" />
              <span className="text-[10px] md:text-xs font-mono text-primary">{t('hero.badge')}</span>
            </div>
            
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 text-glow font-sans tracking-tight">
              {t('hero.title')}
            </h1>
            
            <p className="text-xs md:text-sm text-muted-foreground mb-3 md:mb-4 font-serif leading-relaxed max-w-lg mx-auto lg:mx-0">
              {t('hero.description')}
            </p>
            
            <div className="flex flex-wrap gap-2 md:gap-3 justify-center lg:justify-start">
              <Link to="/news/us">
                <Button size="sm" className="gap-2 text-xs md:text-sm transition-all duration-300 hover:scale-105 active:scale-95">
                  <Sparkles className="w-3 h-3 md:w-4 md:h-4" />
                  {t('hero.allUsNews')}
                </Button>
              </Link>
            </div>
          </div>

          {/* Right - Tweets Carousel */}
          <div className="hidden sm:block lg:pl-4 animate-fade-in" style={{ animationDelay: '150ms' }}>
            <div className="flex items-center gap-2 mb-3 justify-center lg:justify-start">
              <span className="text-lg font-bold">MW</span>
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                {t('tweets.title')}
              </span>
            </div>
            <HeroTweets parts={latestParts} />
          </div>
        </div>
      </div>
    </section>
  );
});
