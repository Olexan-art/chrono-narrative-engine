import { Link } from "react-router-dom";
import { Palette, Calendar, Users, Hash, Mail, Newspaper, TrendingUp, Zap, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";
import { Logo } from "@/components/Logo";

export function Footer() {
  const { t } = useLanguage();
  const year = new Date().getFullYear();

  // News ticker items
  const tickerItems = [
    { icon: Newspaper, text: "Breaking News" },
    { icon: TrendingUp, text: "Trending Topics" },
    { icon: Zap, text: "Live Updates" },
    { icon: Radio, text: "24/7 Coverage" },
    { icon: Newspaper, text: "Global Events" },
    { icon: TrendingUp, text: "Analysis" },
    { icon: Zap, text: "Real-time" },
    { icon: Radio, text: "Verified" },
  ];

  return (
    <footer className="border-t border-border/40 bg-[#030711]/95 backdrop-blur-md transition-colors duration-300 relative overflow-hidden">
      {/* Animated News Ticker Background */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent overflow-hidden">
        <div className="h-full w-full bg-gradient-to-r from-primary/60 via-accent/60 to-primary/60 animate-shimmer" 
             style={{ backgroundSize: '200% 100%' }}></div>
      </div>

      {/* Floating news icons animation */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-5">
        <div className="animate-float-slow absolute top-4 left-[10%]">
          <Newspaper className="w-6 h-6" />
        </div>
        <div className="animate-float-medium absolute top-8 right-[20%]">
          <TrendingUp className="w-5 h-5" />
        </div>
        <div className="animate-float-fast absolute bottom-6 left-[30%]">
          <Zap className="w-4 h-4" />
        </div>
        <div className="animate-float-slow absolute bottom-10 right-[15%]">
          <Radio className="w-5 h-5" />
        </div>
      </div>

      <div className="container mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between relative z-10">
        <Link to="/" className="flex items-center gap-2 group">
          <Logo className="transition-transform duration-300 group-hover:scale-[1.02]" />
        </Link>

        <nav className="flex flex-wrap items-center gap-2 justify-center">
          <Link to="/ink-abyss">
            <Button variant="ghost" size="sm" className="gap-2">
              <Palette className="w-4 h-4" />
              <span>Ink Abyss</span>
            </Button>
          </Link>
          <Link to="/media-calendar">
            <Button variant="ghost" size="sm" className="gap-2">
              <Calendar className="w-4 h-4" />
              <span>{t('nav.calendar')}</span>
            </Button>
          </Link>
          <Link to="/wiki">
            <Button variant="ghost" size="sm" className="gap-2">
              <Users className="w-4 h-4" />
              <span>Wiki</span>
            </Button>
          </Link>
          <Link to="/topics">
            <Button variant="ghost" size="sm" className="gap-2">
              <Hash className="w-4 h-4" />
              <span>Topics</span>
            </Button>
          </Link>
          <Link to="/contact">
            <Button variant="ghost" size="sm" className="gap-2">
              <Mail className="w-4 h-4" />
              <span>{t('nav.contact')}</span>
            </Button>
          </Link>
        </nav>

        <div className="mt-2 md:mt-0">
          <LanguageSwitcher />
        </div>
      </div>

      {/* Animated News Ticker */}
      <div className="border-t border-border/40 bg-primary/5 overflow-hidden relative">
        <div className="flex animate-scroll">
          {/* Duplicate items to create seamless loop */}
          {[...tickerItems, ...tickerItems, ...tickerItems].map((item, index) => (
            <div 
              key={index}
              className="flex items-center gap-2 px-6 py-2 whitespace-nowrap"
            >
              <item.icon className="w-3 h-3 text-primary animate-pulse" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {item.text}
              </span>
              <span className="text-primary">•</span>
            </div>
          ))}
        </div>
      </div>

      <div className="container mx-auto px-4 text-center text-sm text-muted-foreground font-mono py-2 flex flex-wrap items-center justify-center gap-3 relative z-10">
        <span>{t('footer.style')} © {year}</span>
        <Link to="/dmca" className="hover:text-foreground transition-colors">DMCA</Link>
        <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
      </div>

      <style>{`
        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-33.333%);
          }
        }
        @keyframes float-slow {
          0%, 100% {
            transform: translateY(0) rotate(0deg);
          }
          50% {
            transform: translateY(-20px) rotate(5deg);
          }
        }
        @keyframes float-medium {
          0%, 100% {
            transform: translateY(0) rotate(0deg);
          }
          50% {
            transform: translateY(-15px) rotate(-5deg);
          }
        }
        @keyframes float-fast {
          0%, 100% {
            transform: translateY(0) rotate(0deg);
          }
          50% {
            transform: translateY(-10px) rotate(3deg);
          }
        }
        .animate-shimmer {
          animation: shimmer 3s linear infinite;
        }
        .animate-scroll {
          animation: scroll 30s linear infinite;
        }
        .animate-float-slow {
          animation: float-slow 8s ease-in-out infinite;
        }
        .animate-float-medium {
          animation: float-medium 6s ease-in-out infinite;
        }
        .animate-float-fast {
          animation: float-fast 4s ease-in-out infinite;
        }
      `}</style>
    </footer>
  );
}
