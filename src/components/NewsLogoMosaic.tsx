import { useMemo, useState, useRef, useEffect } from "react";

interface NewsLogoMosaicProps {
  feedName?: string;
  sourceUrl?: string;
  className?: string;
  logoSize?: 'sm' | 'md' | 'lg';
}

/**
 * Creates a modern mosaic pattern using the source logo
 * with a gradient background, geometric shapes, and parallax effects
 */
export function NewsLogoMosaic({
  feedName = '',
  sourceUrl = '',
  className = '',
  logoSize = 'md'
}: NewsLogoMosaicProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setMousePos({ x, y });
  };
  
  // Get source domain from URL
  const sourceDomain = useMemo(() => {
    if (!sourceUrl) return feedName || 'news';
    try {
      const url = new URL(sourceUrl);
      return url.hostname.replace('www.', '');
    } catch {
      return feedName || 'news';
    }
  }, [sourceUrl, feedName]);

  // Get logo URL using Google's favicon service
  const logoUrl = useMemo(() => {
    if (!sourceUrl) return '/favicon.png';
    try {
      const url = new URL(sourceUrl);
      const domain = url.hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    } catch {
      return '/favicon.png';
    }
  }, [sourceUrl]);

  // Generate gradient colors based on domain name - using blue tones
  const gradientColors = useMemo(() => {
    const hash = sourceDomain.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    // Use blue color range (190-240 hue) instead of full spectrum
    const baseHue = 200 + (Math.abs(hash) % 40); // 200-240 range (blue tones)
    const hue1 = baseHue;
    const hue2 = baseHue + 20;
    const hue3 = baseHue - 20;
    
    return {
      primary: `hsl(${hue1}, 65%, 55%)`,
      secondary: `hsl(${hue2}, 60%, 50%)`,
      tertiary: `hsl(${hue3}, 70%, 60%)`,
    };
  }, [sourceDomain]);

  const sizeClasses = {
    sm: {
      container: 'w-16 h-16',
      logo: 'w-8 h-8',
      pattern: 'w-4 h-4'
    },
    md: {
      container: 'w-24 h-24 sm:w-32 sm:h-32',
      logo: 'w-12 h-12 sm:w-16 sm:h-16',
      pattern: 'w-6 h-6 sm:w-8 sm:h-8'
    },
    lg: {
      container: 'w-32 h-32 sm:w-48 sm:h-48',
      logo: 'w-16 h-16 sm:w-24 sm:h-24',
      pattern: 'w-8 h-8 sm:w-12 sm:h-12'
    }
  };

  const sizes = sizeClasses[logoSize];

  // Calculate parallax offsets
  const parallaxOffset = {
    layer1: { x: (mousePos.x - 0.5) * 10, y: (mousePos.y - 0.5) * 10 },
    layer2: { x: (mousePos.x - 0.5) * 20, y: (mousePos.y - 0.5) * 20 },
    layer3: { x: (mousePos.x - 0.5) * 15, y: (mousePos.y - 0.5) * 15 },
  };

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative overflow-hidden bg-gradient-to-br from-muted via-background to-muted/50 transition-all duration-300 ${className}`}
      style={{
        background: `linear-gradient(135deg, 
          ${gradientColors.primary}15 0%, 
          ${gradientColors.secondary}10 50%, 
          ${gradientColors.tertiary}15 100%)`
      }}
    >
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(5deg); }
        }
        @keyframes float-reverse {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(10px) rotate(-5deg); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.5; }
        }
        @keyframes scale-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animate-float-reverse {
          animation: float-reverse 7s ease-in-out infinite;
        }
        .animate-spin-slow {
          animation: spin-slow 20s linear infinite;
        }
        .animate-pulse-glow {
          animation: pulse-glow 4s ease-in-out infinite;
        }
        .animate-scale-pulse {
          animation: scale-pulse 3s ease-in-out infinite;
        }
      `}</style>

      {/* Geometric pattern background */}
      <div 
        className="absolute inset-0 opacity-20 transition-transform duration-700 ease-out"
        style={{
          transform: `translate(${parallaxOffset.layer1.x}px, ${parallaxOffset.layer1.y}px)`
        }}
      >
        {/* Grid pattern */}
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(${gradientColors.primary}40 1px, transparent 1px),
            linear-gradient(90deg, ${gradientColors.secondary}40 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px'
        }} />
        
        {/* Diagonal stripes */}
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            ${gradientColors.tertiary}20,
            ${gradientColors.tertiary}20 10px,
            transparent 10px,
            transparent 20px
          )`
        }} />
      </div>

      {/* Floating geometric shapes */}
      <div 
        className="absolute inset-0 opacity-30 transition-transform duration-500 ease-out"
        style={{
          transform: `translate(${parallaxOffset.layer2.x}px, ${parallaxOffset.layer2.y}px)`
        }}
      >
        <div 
          className="absolute top-2 left-2 rotate-12 animate-float"
          style={{
            width: sizes.pattern.split(' ')[0].replace('w-', '') + 'rem',
            height: sizes.pattern.split(' ')[1].replace('h-', '') + 'rem',
            background: gradientColors.primary,
            borderRadius: '30% 70% 70% 30% / 30% 30% 70% 70%',
            transition: 'transform 0.3s ease-out'
          }}
        />
        <div 
          className="absolute bottom-3 right-3 -rotate-12 animate-float-reverse"
          style={{
            width: sizes.pattern.split(' ')[0].replace('w-', '') + 'rem',
            height: sizes.pattern.split(' ')[1].replace('h-', '') + 'rem',
            background: gradientColors.secondary,
            borderRadius: '70% 30% 30% 70% / 70% 70% 30% 30%',
            transition: 'transform 0.3s ease-out',
            animationDelay: '1s'
          }}
        />
        <div 
          className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 rotate-45 animate-spin-slow"
          style={{
            width: sizes.pattern.split(' ')[0].replace('w-', '') + 'rem',
            height: sizes.pattern.split(' ')[1].replace('h-', '') + 'rem',
            background: gradientColors.tertiary,
            clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
            transition: 'transform 0.3s ease-out'
          }}
        />
      </div>

      {/* Multiple logo instances creating mosaic effect */}
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Background blur glow */}
        <div 
          className="absolute blur-2xl opacity-40 animate-pulse-glow"
          style={{
            width: '60%',
            height: '60%',
            background: `radial-gradient(circle, ${gradientColors.primary}60, transparent)`
          }}
        />
        
        {/* Repeated logos in different positions with varying opacity */}
        <div 
          className="absolute inset-0 opacity-10 transition-transform duration-700 ease-out"
          style={{
            transform: `translate(${parallaxOffset.layer3.x}px, ${parallaxOffset.layer3.y}px)`
          }}
        >
          <img
            src={logoUrl}
            alt=""
            className={`absolute top-1 left-1 ${sizes.pattern} opacity-50 animate-float`}
            style={{ animationDelay: '0.5s' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <img
            src={logoUrl}
            alt=""
            className={`absolute top-1 right-1 ${sizes.pattern} opacity-50 animate-float-reverse`}
            style={{ animationDelay: '1.5s' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <img
            src={logoUrl}
            alt=""
            className={`absolute bottom-1 left-1 ${sizes.pattern} opacity-50 animate-float`}
            style={{ animationDelay: '2s' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <img
            src={logoUrl}
            alt=""
            className={`absolute bottom-1 right-1 ${sizes.pattern} opacity-50 animate-float-reverse`}
            style={{ animationDelay: '0.8s' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>

        {/* Main centered logo with backdrop */}
        <div 
          className="relative z-10 transition-transform duration-500 ease-out"
          style={{
            transform: isHovered 
              ? `translate(${parallaxOffset.layer2.x * 0.5}px, ${parallaxOffset.layer2.y * 0.5}px) scale(1.05)` 
              : 'translate(0, 0) scale(1)'
          }}
        >
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm rounded-2xl -m-2 animate-scale-pulse" />
          <div 
            className={`relative ${sizes.container} rounded-2xl bg-gradient-to-br from-background/90 to-background/70 border border-border/50 flex items-center justify-center shadow-xl transition-shadow duration-300 ${
              isHovered ? 'shadow-2xl' : ''
            }`}
          >
            <img
              src={logoUrl}
              alt={sourceDomain}
              className={`${sizes.logo} opacity-90 drop-shadow-lg transition-transform duration-300 ${
                isHovered ? 'scale-110' : 'scale-100'
              }`}
              onError={(e) => { (e.target as HTMLImageElement).src = '/favicon.png'; }}
            />
          </div>
        </div>
      </div>

      {/* Bottom label with source name */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/90 to-transparent p-2 backdrop-blur-sm transition-all duration-300">
        <div className="text-center">
          <span className={`text-xs sm:text-sm text-muted-foreground font-medium transition-all duration-300 ${
            isHovered ? 'text-primary' : ''
          }`}>
            {feedName || sourceDomain}
          </span>
        </div>
      </div>
    </div>
  );
}
