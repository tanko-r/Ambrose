"use client";

// =============================================================================
// RevisionSheet — Drawer-based bottom sheet wrapping revision content
// Uses shadcn Drawer (Vaul) with snap points for peek/half/full height.
// Non-modal so sidebar + document remain interactive.
// =============================================================================

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { useRevision } from "@/hooks/use-revision";
import { TrackChangesEditor } from "./track-changes-editor";
import { RevisionActions } from "./revision-actions";

const SNAP_POINTS = [0.25, 0.5, 1] as const;

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
  const [isModified, setIsModified] = useState(false);
  const [snap, setSnap] = useState<number | string | null>(SNAP_POINTS[1]);

  const revision = revisionSheetParaId
    ? revisions[revisionSheetParaId]
    : undefined;

  // ---- Persist edits when switching paragraphs ----
  useEffect(() => {
    const prevId = prevParaIdRef.current;

    if (prevId && prevId !== revisionSheetParaId) {
      const prevRevision = useAppStore.getState().revisions[prevId];
      if (prevRevision && editorRef.current) {
        const html = editorRef.current.innerHTML;
        if (html && html !== prevRevision.diff_html) {
          setRevision(prevId, { ...prevRevision, editedHtml: html });
        }
      }
    }

    prevParaIdRef.current = revisionSheetParaId;
    setIsModified(false);
  }, [revisionSheetParaId, setRevision]);

  // ---- Handle close: persist edits, then toggle ----
  function handleOpenChange(open: boolean) {
    if (!open) {
      // Persist edits before closing
      if (revisionSheetParaId && revision && editorRef.current) {
        const html = editorRef.current.innerHTML;
        if (html && html !== revision.diff_html) {
          setRevision(revisionSheetParaId, {
            ...revision,
            editedHtml: html,
          });
        }
      }
      toggleBottomSheet();
    }
  }

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
    <Drawer
      open={bottomSheetOpen}
      onOpenChange={handleOpenChange}
      snapPoints={SNAP_POINTS as unknown as (number | string)[]}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
      direction="bottom"
      modal={false}
      dismissible
    >
      <DrawerContent className="mx-auto max-w-none px-4 pb-4">
        {/* Header with drag handle (built-in), title, and close button */}
        <DrawerHeader className="flex flex-row items-center justify-between gap-2 px-0">
          <DrawerTitle className="truncate text-sm">
            {headerTitle}
          </DrawerTitle>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => handleOpenChange(false)}
            aria-label="Close revision sheet"
          >
            <X className="size-4" />
          </Button>
        </DrawerHeader>

        {/* Content area */}
        {!revisionSheetParaId || !revision ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No revision to display. Select a paragraph and generate a revision.
          </p>
        ) : (
          <div className="flex flex-col gap-3 overflow-y-auto">
            {/* Track changes editor */}
            <TrackChangesEditor
              diffHtml={revision.editedHtml || revision.diff_html}
              readOnly={revision.accepted}
              onModified={() => setIsModified(true)}
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
      </DrawerContent>
    </Drawer>
  );
}
