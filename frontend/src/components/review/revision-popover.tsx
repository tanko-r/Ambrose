"use client";

// =============================================================================
// RevisionPopover — Floating popover anchored to the paragraph in the document
// Replaces the bottom sheet for displaying revision content.
// Positioned to the right of the selected paragraph, within the document area.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Check, RotateCcw, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { useRevision } from "@/hooks/use-revision";
import { TrackChangesEditor } from "./track-changes-editor";
import { RevisionActions } from "./revision-actions";

interface PopoverPosition {
  top: number;
  left: number;
  maxHeight: number;
}

export function RevisionPopover() {
  const bottomSheetOpen = useAppStore((s) => s.bottomSheetOpen);
  const revisions = useAppStore((s) => s.revisions);
  const revisionSheetParaId = useAppStore((s) => s.revisionSheetParaId);
  const toggleBottomSheet = useAppStore((s) => s.toggleBottomSheet);
  const setRevision = useAppStore((s) => s.setRevision);
  const paragraphs = useAppStore((s) => s.paragraphs);

  const { accept, reject, reopen } = useRevision();

  const editorRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const prevParaIdRef = useRef<string | null>(null);
  const lastHtmlRef = useRef<string | null>(null);
  const [isModified, setIsModified] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);

  const revision = revisionSheetParaId
    ? revisions[revisionSheetParaId]
    : undefined;

  // ---- Persist edits when switching paragraphs ----
  useEffect(() => {
    const prevId = prevParaIdRef.current;

    if (prevId && prevId !== revisionSheetParaId) {
      const prevRevision = useAppStore.getState().revisions[prevId];
      if (prevRevision && lastHtmlRef.current) {
        const html = lastHtmlRef.current;
        if (html !== prevRevision.diff_html) {
          setRevision(prevId, { ...prevRevision, editedHtml: html });
        }
      }
    }

    prevParaIdRef.current = revisionSheetParaId;
    lastHtmlRef.current = null;
    setIsModified(false);
  }, [revisionSheetParaId, setRevision]);

  // ---- Position the popover near the paragraph ----
  const updatePosition = useCallback(() => {
    if (!revisionSheetParaId || !bottomSheetOpen) {
      setPosition(null);
      return;
    }

    const paraEl = document.querySelector(
      `[data-para-id="${revisionSheetParaId}"]`
    );
    if (!paraEl) {
      setPosition(null);
      return;
    }

    const paraRect = paraEl.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Popover width is ~420px, position it to the right of the paragraph
    // or overlay if not enough space
    const popoverWidth = 420;
    const margin = 12;

    // Try to position to the right of the document area
    // Find the document viewer's scroll container
    const scrollContainer = paraEl.closest("[role='main']");
    if (!scrollContainer) {
      setPosition(null);
      return;
    }

    const containerRect = scrollContainer.getBoundingClientRect();

    // Position relative to the viewport
    let left = containerRect.right - popoverWidth - margin;
    // If document area is too narrow, position at right edge of viewport
    if (left < containerRect.left + 100) {
      left = Math.max(margin, viewportWidth - popoverWidth - margin);
    }

    // Vertical: align with the top of the paragraph, but clamp within viewport
    let top = paraRect.top;
    const maxHeight = viewportHeight - top - 60; // leave room for bottom bar

    // If too little space below, shift up
    if (maxHeight < 200) {
      top = Math.max(60, viewportHeight - 400);
    }

    setPosition({
      top,
      left,
      maxHeight: Math.min(Math.max(maxHeight, 200), viewportHeight - 120),
    });
  }, [revisionSheetParaId, bottomSheetOpen]);

  // Update position on open and on scroll/resize
  useEffect(() => {
    updatePosition();

    if (!bottomSheetOpen) return;

    const scrollContainer = document.querySelector("[role='main']");
    const handleUpdate = () => requestAnimationFrame(updatePosition);

    scrollContainer?.addEventListener("scroll", handleUpdate);
    window.addEventListener("resize", handleUpdate);

    return () => {
      scrollContainer?.removeEventListener("scroll", handleUpdate);
      window.removeEventListener("resize", handleUpdate);
    };
  }, [updatePosition, bottomSheetOpen]);

  // ---- Extract font styles from the source paragraph ----
  const [paraFontVars, setParaFontVars] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!revisionSheetParaId) {
      setParaFontVars({});
      return;
    }
    const paraEl = document.querySelector(
      `[data-para-id="${revisionSheetParaId}"]`
    );
    if (!paraEl) {
      setParaFontVars({});
      return;
    }
    const computed = window.getComputedStyle(paraEl);
    setParaFontVars({
      "--revision-font-family": computed.fontFamily,
      "--revision-font-size": computed.fontSize,
      "--revision-line-height": computed.lineHeight,
    } as React.CSSProperties);
  }, [revisionSheetParaId]);

  // ---- Get paragraph info for header ----
  const para = revisionSheetParaId
    ? paragraphs.find((p) => p.id === revisionSheetParaId)
    : undefined;
  const headerTitle = para?.section_ref || "Revision";

  // ---- Track modifications ----
  const handleModified = useCallback(() => {
    setIsModified(true);
    if (editorRef.current) {
      lastHtmlRef.current = editorRef.current.innerHTML;
    }
  }, []);

  // ---- Handle close ----
  const handleClose = useCallback(() => {
    if (revisionSheetParaId && revision) {
      const html = lastHtmlRef.current ?? editorRef.current?.innerHTML;
      if (html && html !== revision.diff_html) {
        setRevision(revisionSheetParaId, { ...revision, editedHtml: html });
      }
    }
    toggleBottomSheet();
  }, [revisionSheetParaId, revision, setRevision, toggleBottomSheet]);

  // ---- Close on Escape ----
  useEffect(() => {
    if (!bottomSheetOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [bottomSheetOpen, handleClose]);

  // ---- Click outside to close ----
  useEffect(() => {
    if (!bottomSheetOpen) return;

    const handleClick = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        // Don't close if clicking inside the sidebar
        const sidebar = document.querySelector("[role='complementary']");
        if (sidebar?.contains(e.target as Node)) return;
        handleClose();
      }
    };

    // Delay attachment to avoid closing on the same click that opens
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [bottomSheetOpen, handleClose]);

  // ---- Action handlers ----
  function handleAccept() {
    if (!revisionSheetParaId) return;
    accept(revisionSheetParaId, editorRef.current);
  }

  function handleReject() {
    if (!revisionSheetParaId) return;
    reject(revisionSheetParaId);
  }

  function handleReopen() {
    if (!revisionSheetParaId) return;
    reopen(revisionSheetParaId);
  }

  function handleReset() {
    if (!revisionSheetParaId || !revision || !editorRef.current) return;
    editorRef.current.innerHTML = revision.diff_html;
    setIsModified(false);
  }

  if (!bottomSheetOpen || !position) return null;

  return createPortal(
    <div
      ref={popoverRef}
      className={cn(
        "fixed z-50 flex flex-col rounded-lg border bg-background shadow-xl",
        "animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200"
      )}
      style={{
        top: position.top,
        left: position.left,
        width: 420,
        maxHeight: position.maxHeight,
      }}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {headerTitle}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleClose}
          aria-label="Close revision popover"
        >
          <X className="size-3.5" />
        </Button>
      </div>

      {/* Content */}
      <div
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-3"
        style={paraFontVars}
      >
        {!revisionSheetParaId || !revision ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No revision to display.
          </p>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            {/* Track changes editor */}
            <TrackChangesEditor
              diffHtml={revision.editedHtml || revision.diff_html}
              readOnly={revision.accepted}
              onModified={handleModified}
              editorRef={editorRef}
            />

            {/* Rationale */}
            {revision.rationale && (
              <div className="rounded-r border-l-[3px] border-violet-500 bg-gradient-to-r from-violet-50 to-purple-50 px-3 py-2 text-xs italic text-muted-foreground">
                <span className="not-italic font-semibold text-foreground">
                  Rationale:{" "}
                </span>
                {revision.rationale}
              </div>
            )}

            {/* Action buttons */}
            <RevisionActions
              paraId={revisionSheetParaId}
              accepted={revision.accepted}
              isModified={isModified}
              onAccept={handleAccept}
              onReject={handleReject}
              onReset={handleReset}
              onReopen={handleReopen}
            />
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
