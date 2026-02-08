"use client";

// =============================================================================
// PrecedentPanel -- Top-level precedent panel composing header bar,
// PrecedentContent, and PrecedentNavigator. Handles lock toggle, close,
// keyboard shortcuts, and navigator position layout.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { usePrecedent } from "@/hooks/use-precedent";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock, Unlock, X, List } from "lucide-react";
import {
  PrecedentContent,
  type PrecedentContentHandle,
} from "./precedent-content";
import { PrecedentNavigator } from "./precedent-navigator";

interface PrecedentPanelProps {
  initialScrollTarget?: string;
}

export function PrecedentPanel({ initialScrollTarget }: PrecedentPanelProps) {
  const {
    precedentFilename,
    relatedClauses,
    allRelatedClauses,
    isLocked,
    toggleLock,
    loading,
  } = usePrecedent();

  const navigatorPosition = useAppStore((s) => s.navigatorPosition);
  const closePrecedentPanel = useAppStore((s) => s.closePrecedentPanel);
  const togglePrecedentPanel = useAppStore((s) => s.togglePrecedentPanel);

  const contentRef = useRef<PrecedentContentHandle>(null);

  // Overlay toggle state
  const [overlayVisible, setOverlayVisible] = useState(false);

  // =========================================================================
  // Compute relatedParaIds and pulsingParaIds
  // =========================================================================

  const relatedParaIds = useMemo(
    () => new Set(relatedClauses.map((c) => c.para_id)),
    [relatedClauses]
  );

  // Track which paraIds are NEW since the last update for pulse animation
  const prevRelatedRef = useRef<Set<string>>(new Set());
  const [pulsingParaIds, setPulsingParaIds] = useState<Set<string>>(new Set());
  const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const prev = prevRelatedRef.current;
    const newIds = new Set<string>();
    for (const id of relatedParaIds) {
      if (!prev.has(id)) {
        newIds.add(id);
      }
    }

    if (newIds.size > 0) {
      setPulsingParaIds(newIds);

      // Clear pulsing state after 1.5 seconds
      if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
      pulseTimeoutRef.current = setTimeout(() => {
        setPulsingParaIds(new Set());
        pulseTimeoutRef.current = null;
      }, 1500);
    }

    prevRelatedRef.current = new Set(relatedParaIds);
  }, [relatedParaIds]);

  // =========================================================================
  // Keyboard shortcuts: Escape to close, Ctrl+Shift+P to toggle
  // =========================================================================

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closePrecedentPanel();
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "p"
      ) {
        e.preventDefault();
        togglePrecedentPanel();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closePrecedentPanel, togglePrecedentPanel]);

  // =========================================================================
  // Initial scroll on open
  // =========================================================================

  const initialScrollDone = useRef(false);
  useEffect(() => {
    if (initialScrollTarget && contentRef.current && !initialScrollDone.current) {
      initialScrollDone.current = true;
      // Delay to let content render
      requestAnimationFrame(() => {
        contentRef.current?.scrollToClause(initialScrollTarget);
      });
    }
  }, [initialScrollTarget]);

  // =========================================================================
  // Navigator callbacks
  // =========================================================================

  const handleNavigate = useCallback((paraId: string) => {
    contentRef.current?.scrollToClause(paraId);
  }, []);

  const handleContentScrollToClause = useCallback((paraId: string) => {
    // When user clicks a paragraph in the precedent content, we could
    // navigate or highlight -- for now, this is a no-op callback
    // that could be wired to scroll the navigator in a future iteration
  }, []);

  // =========================================================================
  // Loading state
  // =========================================================================

  if (loading) {
    return (
      <div className="flex h-full flex-col bg-card">
        <header className="flex h-10 items-center justify-between border-b px-3">
          <Skeleton className="h-4 w-40" />
          <div className="flex items-center gap-1">
            <Skeleton className="h-6 w-6 rounded" />
            <Skeleton className="h-6 w-6 rounded" />
          </div>
        </header>
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 p-8">
            <div className="mx-auto max-w-3xl space-y-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-6 w-40 mt-6" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </div>
          {navigatorPosition === "right-sidebar" && (
            <div className="w-[220px] shrink-0 border-l p-3 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // Navigator component (shared across layouts)
  // =========================================================================

  const navigatorElement = (
    <PrecedentNavigator
      onNavigate={handleNavigate}
      relatedParaIds={relatedParaIds}
      pulsingParaIds={pulsingParaIds}
    />
  );

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header bar */}
      <header className="flex h-10 items-center justify-between border-b px-3">
        <span className="text-sm font-medium truncate max-w-[200px]">
          {precedentFilename || "Precedent Document"}
        </span>
        <div className="flex items-center gap-1">
          {/* Overlay toggle (only in overlay mode) */}
          {navigatorPosition === "overlay" && (
            <Button
              variant={overlayVisible ? "default" : "ghost"}
              size="icon-xs"
              onClick={() => setOverlayVisible(!overlayVisible)}
              title="Toggle navigator"
            >
              <List className="h-3.5 w-3.5" />
            </Button>
          )}
          {/* Lock toggle */}
          <Button
            variant={isLocked ? "default" : "ghost"}
            size="icon-xs"
            onClick={toggleLock}
            title={isLocked ? "Unlock from current clause" : "Lock to current clause"}
          >
            {isLocked ? (
              <Lock className="h-3.5 w-3.5" />
            ) : (
              <Unlock className="h-3.5 w-3.5" />
            )}
          </Button>
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={closePrecedentPanel}
            title="Close precedent panel (Esc)"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      {/* Content + Navigator layout */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Right sidebar mode */}
        {navigatorPosition === "right-sidebar" && (
          <>
            <PrecedentContent
              ref={contentRef}
              onScrollToClause={handleContentScrollToClause}
            />
            <div className="w-[220px] shrink-0 border-l overflow-hidden">
              {navigatorElement}
            </div>
          </>
        )}

        {/* Bottom drawer mode */}
        {navigatorPosition === "bottom-drawer" && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <PrecedentContent
              ref={contentRef}
              onScrollToClause={handleContentScrollToClause}
            />
            <div className="h-[200px] shrink-0 border-t overflow-hidden">
              {navigatorElement}
            </div>
          </div>
        )}

        {/* Overlay mode */}
        {navigatorPosition === "overlay" && (
          <>
            <PrecedentContent
              ref={contentRef}
              onScrollToClause={handleContentScrollToClause}
            />
            {overlayVisible && (
              <>
                {/* Backdrop */}
                <div
                  className="absolute inset-0 z-20 bg-black/10"
                  onClick={() => setOverlayVisible(false)}
                />
                {/* Navigator overlay */}
                <div className="absolute right-0 top-0 bottom-0 z-30 w-[260px] border-l bg-card shadow-xl">
                  {navigatorElement}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
