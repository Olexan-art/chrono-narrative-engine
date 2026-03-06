import { memo } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroTrendingEntities } from "@/components/home/HeroTrendingEntities";
import { useLanguage } from "@/contexts/LanguageContext";

export const HeroSection = memo(function HeroSection() {
  const { t, language } = useLanguage();

  return (
    <section className="relative py-6 md:py-10 overflow-hidden border-b border-cyan-500/20">
      {/* Minimal Digital Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0891b220_1px,transparent_1px),linear-gradient(to_bottom,#0891b220_1px,transparent_1px)] bg-[size:14px_24px] opacity-30" />
      
      <div className="container mx-auto px-4 relative">
        <div className="grid lg:grid-cols-2 gap-6 md:gap-8 items-start">
          {/* Left - Compact Digital Content */}
          <div className="text-center lg:text-left space-y-3 md:space-y-4">
            {/* Mini Digital Badge */}
            <div className="inline-flex items-center gap-1.5 px-2 py-1 border border-cyan-500/40 bg-cyan-500/5">
              <div className="w-1.5 h-1.5 bg-cyan-400 animate-digital-blink" />
              <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider">
                {t('hero.badge')}
              </span>
            </div>
            
            {/* Compact Title */}
            <div className="space-y-1">
              <h1 className="text-xl md:text-2xl lg:text-3xl font-mono font-bold text-foreground tracking-tight leading-tight">
                <span className="text-cyan-400">&gt;</span> {t('hero.title')}
              </h1>
            </div>
            
            {/* Mini Description */}
            <p className="text-xs md:text-sm text-muted-foreground font-mono leading-relaxed max-w-md mx-auto lg:mx-0">
              {t('hero.description')}
            </p>
            
            {/* Compact CTA */}
            <div className="flex gap-2 justify-center lg:justify-start pt-1">
              <Link to="/news/us">
                <Button 
                  size="sm" 
                  className="gap-1.5 text-xs font-mono bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/40 hover:border-cyan-500/60 text-cyan-400 transition-all duration-300"
                  variant="outline"
                >
                  {t('hero.allUsNews')}
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>

            {/* Digital Status Line */}
            <div className="hidden md:flex items-center gap-2 pt-2 text-[10px] font-mono text-muted-foreground/60">
              <span className="text-cyan-400">●</span>
              <span>LIVE</span>
              <span className="text-cyan-500/30">|</span>
              <span className="animate-digital-blink">SYNC</span>
              <span className="text-cyan-500/30">|</span>
              <span>24/7</span>
            </div>
          </div>

          {/* Right - Trending Entities */}
          <div className="hidden sm:block lg:pl-4">
            <div className="flex items-center gap-2 mb-3 justify-center lg:justify-start">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider font-bold">
                {language === 'uk' ? 'Топ 24г' : language === 'pl' ? 'Top 24h' : 'Top 24h'}
              </span>
            </div>
            <HeroTrendingEntities />
          </div>
        </div>
      </div>
    </section>
  );
});
