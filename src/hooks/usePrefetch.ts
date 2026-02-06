import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface PrefetchOptions {
  // Delay before starting prefetch (ms)
  delay?: number;
  // Whether to prefetch on hover
  onHover?: boolean;
  // Whether to prefetch when visible
  onVisible?: boolean;
  // Stale time for prefetched data
  staleTime?: number;
}

/**
 * Hook for prefetching data on hover or visibility
 */
export function usePrefetch<T>(
  queryKey: unknown[],
  queryFn: () => Promise<T>,
  options: PrefetchOptions = {}
) {
  const {
    delay = 100,
    onHover = true,
    onVisible = false,
    staleTime = 1000 * 60 * 5 // 5 minutes
  } = options;

  const queryClient = useQueryClient();
  const timeoutRef = useRef<NodeJS.Timeout>();
  const hasPrefetched = useRef(false);

  const prefetch = useCallback(() => {
    if (hasPrefetched.current) return;
    
    timeoutRef.current = setTimeout(() => {
      hasPrefetched.current = true;
      queryClient.prefetchQuery({
        queryKey,
        queryFn,
        staleTime
      });
    }, delay);
  }, [queryClient, queryKey, queryFn, delay, staleTime]);

  const cancelPrefetch = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handlers = onHover ? {
    onMouseEnter: prefetch,
    onMouseLeave: cancelPrefetch,
    onFocus: prefetch,
    onBlur: cancelPrefetch
  } : {};

  // Create ref for intersection observer
  const observerRef = useRef<IntersectionObserver>();
  const elementRef = useCallback((node: HTMLElement | null) => {
    if (!onVisible || !node) return;

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          prefetch();
          observerRef.current?.disconnect();
        }
      },
      { rootMargin: '100px' }
    );

    observerRef.current.observe(node);
  }, [onVisible, prefetch]);

  return {
    handlers,
    elementRef: onVisible ? elementRef : undefined,
    prefetch,
    cancelPrefetch
  };
}

/**
 * Hook for prefetching route data
 */
export function useRoutePrefetch() {
  const queryClient = useQueryClient();

  const prefetchNewsArticle = useCallback((countryCode: string, slug: string) => {
    // This will be implemented based on actual query structure
  }, [queryClient]);

  const prefetchCountryNews = useCallback((countryCode: string) => {
    // This will be implemented based on actual query structure  
  }, [queryClient]);

  return {
    prefetchNewsArticle,
    prefetchCountryNews
  };
}
