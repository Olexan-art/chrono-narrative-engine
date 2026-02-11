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

// Generate optimized image URL
export function getOptimizedUrl(src: string, width?: number): string {
  // If it's a Supabase storage URL, use render/image endpoint for transformations
  if (src.includes('supabase.co/storage/v1/object/public/')) {
    const transformed = src.replace(
      '/storage/v1/object/public/',
      '/storage/v1/render/image/public/'
    );
    const url = new URL(transformed);
    if (width) {
      url.searchParams.set('width', String(width));
    }
    url.searchParams.set('quality', '75');
    url.searchParams.set('format', 'origin');
    return url.toString();
  }

  // For Wikipedia images, request smaller thumbnails via thumb URL
  if (src.includes('upload.wikimedia.org/wikipedia/commons/') && width) {
    // Already a thumb URL - replace size
    const thumbMatch = src.match(/\/thumb\/(.+?)\/(\d+)px-/);
    if (thumbMatch) {
      return src.replace(/\/(\d+)px-/, `/${width}px-`);
    }
    // Full-size URL - convert to thumb
    const fullMatch = src.match(/\/commons\/(.+)/);
    if (fullMatch) {
      const filename = fullMatch[1].split('/').pop();
      return src.replace(
        `/commons/${fullMatch[1]}`,
        `/commons/thumb/${fullMatch[1]}/${width}px-${filename}`
      );
    }
  }

  return src;
}

// Calculate responsive srcset
function getSrcSet(src: string): string {
  if (!src || (!src.includes('supabase.co/storage') && !src.includes('upload.wikimedia.org'))) {
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

  const showIconFallback = hasError && !fallbackSrc;
  const imageSrc = hasError ? fallbackSrc : (src || fallbackSrc);
  const optimizedSrc = isInView ? (imageSrc ? getOptimizedUrl(imageSrc) : undefined) : undefined;
  const srcSet = isInView && imageSrc ? getSrcSet(imageSrc) : undefined;

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
      {/* Icon fallback for broken images with no fallbackSrc */}
      {showIconFallback && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted/30 via-muted/10 to-muted/30">
          <Newspaper className="w-1/3 h-1/3 max-w-10 max-h-10 text-muted-foreground/30" />
        </div>
      )}

      {/* Blur placeholder */}
      {placeholder === "blur" && !isLoaded && !showIconFallback && (
        <div 
          className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted/50 via-muted/30 to-muted/50"
        />
      )}

      {/* Main image */}
      {isInView && !showIconFallback && imageSrc && (
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
