import { useState, useRef, useEffect, memo } from "react";
import { Newspaper } from "lucide-react";
import { cn } from "@/lib/utils";

interface OptimizedImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  containerClassName?: string;
  aspectRatio?: "auto" | "video" | "square" | "portrait";
  priority?: boolean;
  placeholder?: "blur" | "empty";
  onLoad?: () => void;
  onError?: () => void;
  fallbackSrc?: string;
}

// Generate Cloudflare-compatible image URL with optimizations
function getOptimizedUrl(src: string, width?: number): string {
  // If it's already a Supabase storage URL, use their transformations
  if (src.includes('supabase.co/storage')) {
    const url = new URL(src);
    if (width) {
      url.searchParams.set('width', String(width));
    }
    url.searchParams.set('quality', '80');
    return url.toString();
  }
  
  // For external images, we can't optimize them
  return src;
}

// Calculate responsive srcset
function getSrcSet(src: string): string {
  if (!src || src.includes('supabase.co/storage') === false) {
    return '';
  }
  
  const widths = [320, 640, 768, 1024, 1280];
  return widths
    .map(w => `${getOptimizedUrl(src, w)} ${w}w`)
    .join(', ');
}

// Generate sizes attribute based on layout context
function getSizes(aspectRatio?: string): string {
  return '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw';
}

export const OptimizedImage = memo(function OptimizedImage({
  src,
  alt,
  className,
  containerClassName,
  aspectRatio = "auto",
  priority = false,
  placeholder = "blur",
  onLoad,
  onError,
  fallbackSrc = "/placeholder.svg"
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || !containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '200px', // Start loading 200px before entering viewport
        threshold: 0
      }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [priority]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  const imageSrc = hasError ? fallbackSrc : (src || fallbackSrc);
  const optimizedSrc = isInView ? getOptimizedUrl(imageSrc) : undefined;
  const srcSet = isInView ? getSrcSet(imageSrc) : undefined;

  const aspectRatioClass = {
    auto: "",
    video: "aspect-video",
    square: "aspect-square",
    portrait: "aspect-[3/4]"
  }[aspectRatio];

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative overflow-hidden bg-muted/30",
        aspectRatioClass,
        containerClassName
      )}
    >
      {/* Blur placeholder */}
      {placeholder === "blur" && !isLoaded && (
        <div 
          className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted/50 via-muted/30 to-muted/50"
        />
      )}

      {/* Main image */}
      {isInView && (
        <img
          ref={imgRef}
          src={optimizedSrc}
          srcSet={srcSet || undefined}
          sizes={srcSet ? getSizes(aspectRatio) : undefined}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding={priority ? "sync" : "async"}
          fetchPriority={priority ? "high" : "auto"}
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            "transition-opacity duration-300",
            isLoaded ? "opacity-100" : "opacity-0",
            className
          )}
        />
      )}
    </div>
  );
});

// Preload critical images
export function preloadImage(src: string): void {
  if (typeof window === 'undefined') return;
  
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = getOptimizedUrl(src);
  document.head.appendChild(link);
}

// Hook for preloading multiple images
export function usePreloadImages(srcs: string[], enabled = true): void {
  useEffect(() => {
    if (!enabled || !srcs.length) return;
    srcs.slice(0, 3).forEach(preloadImage); // Limit to first 3
  }, [srcs, enabled]);
}
