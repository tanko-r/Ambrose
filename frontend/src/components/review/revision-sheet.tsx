"use client";

// =============================================================================
// RevisionSheet — CSS-animated bottom sheet panel for revision content
// Replaces Vaul Drawer (which had rendering bugs in non-modal + snap-point mode).
// Simple fixed-position panel with slide-up transition and resize toggle.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { useRevision } from "@/hooks/use-revision";
import { TrackChangesEditor } from "./track-changes-editor";
import { RevisionActions } from "./revision-actions";

const SNAP_HEIGHTS = ["25vh", "50vh", "100vh"] as const;
type SnapIndex = 0 | 1 | 2;

export function RevisionSheet() {
  const bottomSheetOpen = useAppStore((s) => s.bottomSheetOpen);
  const revisions = useAppStore((s) => s.revisions);
  const revisionSheetParaId = useAppStore((s) => s.revisionSheetParaId);
  const toggleBottomSheet = useAppStore((s) => s.toggleBottomSheet);
  const setRevision = useAppStore((s) => s.setRevision);
  const paragraphs = useAppStore((s) => s.paragraphs);

  const { accept, reject, reopen } = useRevision();

  const editorRef = useRef<HTMLDivElement | null>(null);
  const prevParaIdRef = useRef<string | null>(null);
  const lastHtmlRef = useRef<string | null>(null);
  const [isModified, setIsModified] = useState(false);
  const [snapIdx, setSnapIdx] = useState<SnapIndex>(1); // start at 50vh

  const revision = revisionSheetParaId
    ? revisions[revisionSheetParaId]
    : undefined;

  // ---- Persist edits when switching paragraphs ----
  // NOTE: We read from lastHtmlRef (captured on every modification) instead of
  // editorRef.current.innerHTML because child effects fire first — by the time
  // this parent effect runs, TrackChangesEditor has already replaced innerHTML
  // with the new paragraph's content.
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

  // ---- Track modifications: capture innerHTML for persist effect ----
  const handleModified = useCallback(() => {
    setIsModified(true);
    if (editorRef.current) {
      lastHtmlRef.current = editorRef.current.innerHTML;
    }
  }, []);

  // ---- Handle close: persist edits, then toggle ----
  const handleClose = useCallback(() => {
    if (revisionSheetParaId && revision) {
      const html = lastHtmlRef.current ?? editorRef.current?.innerHTML;
      if (html && html !== revision.diff_html) {
        setRevision(revisionSheetParaId, { ...revision, editedHtml: html });
      }
    }
    toggleBottomSheet();
  }, [revisionSheetParaId, revision, setRevision, toggleBottomSheet]);

  // ---- Cycle through snap heights ----
  const cycleSnap = useCallback(() => {
    setSnapIdx((prev) => ((prev + 1) % SNAP_HEIGHTS.length) as SnapIndex);
  }, []);

  // ---- Get paragraph info for header ----
  const para = revisionSheetParaId
    ? paragraphs.find((p) => p.id === revisionSheetParaId)
    : undefined;
  const headerTitle = para
    ? `${para.section_ref} — ${para.text.slice(0, 60)}${para.text.length > 60 ? "..." : ""}`
    : "Revision";

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

  return (
    <div
      aria-hidden={!bottomSheetOpen}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-4xl flex-col rounded-t-lg border bg-background shadow-[0_-4px_24px_rgba(0,0,0,0.12)]",
        "transition-all duration-300 ease-in-out",
        bottomSheetOpen ? "translate-y-0" : "translate-y-full",
      )}
      style={{ height: SNAP_HEIGHTS[snapIdx] }}
    >
      {/* Header bar */}
      <div className="flex shrink-0 items-center justify-between border-b px-6 py-2">
        <div className="flex min-w-0 items-center gap-3">
          {/* Drag-handle visual indicator */}
          <div className="h-1 w-8 shrink-0 rounded-full bg-muted-foreground/25" />
          <span className="truncate text-sm font-semibold">{headerTitle}</span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={cycleSnap}
            aria-label="Resize panel"
          >
            {snapIdx < 2 ? (
              <Maximize2 className="size-3.5" />
            ) : (
              <Minimize2 className="size-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleClose}
            aria-label="Close revision sheet"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Content — only mount children when open to avoid wasted renders */}
      {bottomSheetOpen && (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-3">
          {!revisionSheetParaId || !revision ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No revision to display. Select a paragraph and generate a
              revision.
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
                <div className="rounded-r border-l-[3px] border-violet-500 bg-gradient-to-r from-violet-50 to-purple-50 px-3 py-2.5 text-sm italic text-muted-foreground">
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
      )}
    </div>
  );
}
