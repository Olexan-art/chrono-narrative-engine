import { useState, useRef, useCallback, useEffect, useMemo } from 'react';

interface VirtualListOptions<T> {
  items: T[];
  itemHeight: number | ((index: number) => number);
  overscan?: number;
  containerRef: React.RefObject<HTMLElement>;
}

interface VirtualListResult<T> {
  virtualItems: Array<{ index: number; item: T; style: React.CSSProperties }>;
  totalHeight: number;
  scrollToIndex: (index: number) => void;
}

/**
 * Hook for virtualizing long lists
 */
export function useVirtualList<T>({
  items,
  itemHeight,
  overscan = 5,
  containerRef
}: VirtualListOptions<T>): VirtualListResult<T> {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // Calculate item heights
  const getItemHeight = useCallback((index: number) => {
    return typeof itemHeight === 'function' ? itemHeight(index) : itemHeight;
  }, [itemHeight]);

  // Calculate positions for all items
  const { positions, totalHeight } = useMemo(() => {
    let offset = 0;
    const pos: number[] = [];
    
    for (let i = 0; i < items.length; i++) {
      pos.push(offset);
      offset += getItemHeight(i);
    }
    
    return { positions: pos, totalHeight: offset };
  }, [items.length, getItemHeight]);

  // Find visible range
  const { startIndex, endIndex } = useMemo(() => {
    if (!containerHeight) return { startIndex: 0, endIndex: 0 };

    let start = 0;
    let end = items.length - 1;

    // Binary search for start
    let low = 0;
    let high = items.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (positions[mid] < scrollTop) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    start = Math.max(0, high - overscan);

    // Find end
    const endOffset = scrollTop + containerHeight;
    while (end > start && positions[end] > endOffset) {
      end--;
    }
    end = Math.min(items.length - 1, end + overscan);

    return { startIndex: start, endIndex: end };
  }, [scrollTop, containerHeight, positions, overscan, items.length]);

  // Handle scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollTop(container.scrollTop);
    };

    const handleResize = () => {
      setContainerHeight(container.clientHeight);
    };

    // Initial setup
    handleResize();
    
    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [containerRef]);

  // Generate virtual items
  const virtualItems = useMemo(() => {
    const result: Array<{ index: number; item: T; style: React.CSSProperties }> = [];
    
    for (let i = startIndex; i <= endIndex && i < items.length; i++) {
      result.push({
        index: i,
        item: items[i],
        style: {
          position: 'absolute',
          top: positions[i],
          left: 0,
          right: 0,
          height: getItemHeight(i)
        }
      });
    }
    
    return result;
  }, [startIndex, endIndex, items, positions, getItemHeight]);

  // Scroll to specific index
  const scrollToIndex = useCallback((index: number) => {
    const container = containerRef.current;
    if (!container || index < 0 || index >= items.length) return;

    container.scrollTop = positions[index];
  }, [containerRef, positions, items.length]);

  return {
    virtualItems,
    totalHeight,
    scrollToIndex
  };
}
