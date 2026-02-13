import { useState, useEffect } from "react";

/**
 * Delays showing a loading skeleton to prevent flash for instant responses.
 * When `isLoading` becomes true, waits `delay` ms before returning true.
 * When `isLoading` becomes false, immediately returns false.
 *
 * @param isLoading - Whether the async operation is in progress
 * @param delay - Milliseconds to wait before showing skeleton (default: 200)
 * @returns showSkeleton - Whether to display the skeleton UI
 */
export function useDelayedLoading(isLoading: boolean, delay = 200): boolean {
  const [showSkeleton, setShowSkeleton] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setShowSkeleton(false);
      return;
    }

    const timer = setTimeout(() => {
      setShowSkeleton(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [isLoading, delay]);

  return showSkeleton;
}
