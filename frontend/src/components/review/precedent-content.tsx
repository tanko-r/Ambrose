"use client";

// =============================================================================
// PrecedentContent -- Renders precedent document HTML with imperative handlers
// Follows the same pattern as DocumentViewer: dangerouslySetInnerHTML +
// requestAnimationFrame + click handlers + useImperativeHandle for scroll.
// =============================================================================

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { useAppStore } from "@/lib/store";
import { Skeleton } from "@/components/ui/skeleton";
import { PrecedentSelectionTooltip } from "./precedent-selection-tooltip";
import type { RelatedClause } from "@/lib/types";

export interface PrecedentContentHandle {
  scrollToClause: (paraId: string) => void;
}

interface PrecedentContentProps {
  onScrollToClause?: (paraId: string) => void;
  relatedClauses: RelatedClause[];
  isLocked: boolean;
}

export const PrecedentContent = forwardRef<
  PrecedentContentHandle,
  PrecedentContentProps
>(function PrecedentContent({ onScrollToClause, relatedClauses, isLocked }, ref) {
  const precedentHtml = useAppStore((s) => s.precedentHtml);

  const containerRef = useRef<HTMLDivElement>(null);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // =========================================================================
  // 1. Expose scrollToClause via forwardRef
  // =========================================================================

  useImperativeHandle(
    ref,
    () => ({
      scrollToClause(paraId: string) {
        const container = containerRef.current;
        if (!container) return;

        const el = container.querySelector(`[data-para-id="${paraId}"]`);
        if (!el) return;

        el.scrollIntoView({ behavior: "smooth", block: "center" });

        // Flash highlight
        el.classList.add("flash-highlight");
        if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
        flashTimeoutRef.current = setTimeout(() => {
          el.classList.remove("flash-highlight");
          flashTimeoutRef.current = null;
        }, 1000);
      },
    }),
    []
  );

  // =========================================================================
  // 2. Attach click handlers to [data-para-id] elements
  // =========================================================================

  const attachClickHandlers = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const paras = container.querySelectorAll<HTMLElement>("[data-para-id]");
    paras.forEach((el) => {
      el.style.cursor = "pointer";
      el.addEventListener("click", () => {
        const paraId = el.getAttribute("data-para-id");
        if (paraId) {
          onScrollToClause?.(paraId);
        }
      });
    });
  }, [onScrollToClause]);

  // After HTML renders, attach handlers
  useEffect(() => {
    if (precedentHtml) {
      requestAnimationFrame(() => {
        attachClickHandlers();
      });
    }
  }, [precedentHtml, attachClickHandlers]);

  // =========================================================================
  // 3. Apply related clause highlights
  // =========================================================================

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Remove all existing related-clause classes
    container
      .querySelectorAll<HTMLElement>("[data-para-id]")
      .forEach((el) => {
        el.classList.remove("related-clause", "related-clause-locked");
      });

    // Apply new highlights
    const highlightClass = isLocked ? "related-clause-locked" : "related-clause";
    for (const clause of relatedClauses) {
      const el = container.querySelector(
        `[data-para-id="${clause.para_id}"]`
      );
      if (el) {
        el.classList.add(highlightClass);
      }
    }
  }, [relatedClauses, isLocked]);

  // =========================================================================
  // 4. Render
  // =========================================================================

  if (!precedentHtml) {
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-6 w-40 mt-6" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-card px-6 py-4">
      <div
        ref={containerRef}
        className="document-container"
        dangerouslySetInnerHTML={{ __html: precedentHtml }}
      />
      <PrecedentSelectionTooltip containerRef={containerRef} />
    </div>
  );
});
