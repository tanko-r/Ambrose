"use client";

// =============================================================================
// TrackChangesEditor — Imperative contentEditable wrapper with track-changes
// React does NOT reconcile the inner HTML. Everything is managed via refs.
// Ported from app/static/js/revision.js
// =============================================================================

import { useEffect, useRef } from "react";
import {
  wrapRangeAsDeleted,
  insertUserText,
  selectCharacterBefore,
  selectCharacterAfter,
} from "@/lib/track-changes";

// ---- Cursor offset helpers for undo/redo ----

/** Count text characters from start of element to current cursor position. */
function getTextOffset(el: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return 0;
  const range = selection.getRangeAt(0);
  const preRange = document.createRange();
  preRange.selectNodeContents(el);
  preRange.setEnd(range.startContainer, range.startOffset);
  return preRange.toString().length;
}

/** Place cursor at a text character offset within element. */
function setTextOffset(el: HTMLElement, offset: number): void {
  const selection = window.getSelection();
  if (!selection) return;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let current = 0;
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    const len = node.textContent?.length || 0;
    if (current + len >= offset) {
      const range = document.createRange();
      range.setStart(node, offset - current);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    current += len;
  }
  // Offset beyond content — place at end
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

interface UndoEntry {
  html: string;
  offset: number;
}

interface TrackChangesEditorProps {
  diffHtml: string;
  readOnly: boolean;
  onModified: () => void;
  editorRef: React.RefObject<HTMLDivElement | null>;
}

export function TrackChangesEditor({
  diffHtml,
  readOnly,
  onModified,
  editorRef,
}: TrackChangesEditorProps) {
  const undoStackRef = useRef<UndoEntry[]>([]);
  const redoStackRef = useRef<UndoEntry[]>([]);
  const isModifiedRef = useRef(false);
  const pendingSnapshotRef = useRef<UndoEntry | null>(null);
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const BATCH_DELAY = 300;

  // ---- Set innerHTML imperatively when diffHtml changes ----
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = diffHtml;
      undoStackRef.current = [];
      redoStackRef.current = [];
      isModifiedRef.current = false;
      pendingSnapshotRef.current = null;
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
        batchTimerRef.current = null;
      }
    }
  }, [diffHtml, editorRef]);

  // ---- Toggle contentEditable based on readOnly ----
  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.contentEditable = readOnly ? "false" : "true";
  }, [readOnly, editorRef]);

  // ---- Attach imperative event listeners when editable ----
  useEffect(() => {
    const el = editorRef.current;
    if (!el || readOnly) return;

    function commitPendingSnapshot() {
      if (pendingSnapshotRef.current !== null) {
        undoStackRef.current.push(pendingSnapshotRef.current);
        if (undoStackRef.current.length > 50) {
          undoStackRef.current.shift();
        }
        pendingSnapshotRef.current = null;
      }
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
        batchTimerRef.current = null;
      }
    }

    function captureForUndo() {
      if (!el) return;
      // On first keystroke of a batch, snapshot current state + cursor
      if (pendingSnapshotRef.current === null) {
        pendingSnapshotRef.current = {
          html: el.innerHTML,
          offset: getTextOffset(el),
        };
        redoStackRef.current = [];
      }
      // Reset the batch timer on every keystroke
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
      }
      batchTimerRef.current = setTimeout(() => {
        commitPendingSnapshot();
        batchTimerRef.current = null;
      }, BATCH_DELAY);
    }

    function markModified() {
      if (!isModifiedRef.current) {
        isModifiedRef.current = true;
      }
      onModified();
    }

    function handleBeforeInput(e: InputEvent) {
      if (e.inputType === "insertText" || e.inputType === "insertParagraph") {
        e.preventDefault();
        captureForUndo();

        const selection = window.getSelection();
        if (!selection?.rangeCount) return;

        const range = selection.getRangeAt(0);

        // If there's a selection, wrap it as deleted first
        if (!range.collapsed) {
          wrapRangeAsDeleted(range);
        }

        const text =
          e.inputType === "insertParagraph" ? "\n" : (e.data || "");
        insertUserText(text);
        markModified();
      }
    }

    function handleKeydown(e: KeyboardEvent) {
      // Undo: Ctrl+Z (without Shift)
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        commitPendingSnapshot(); // flush in-progress batch
        if (e.shiftKey) {
          // Redo: Ctrl+Shift+Z
          if (redoStackRef.current.length === 0 || !el) return;
          undoStackRef.current.push({ html: el.innerHTML, offset: getTextOffset(el) });
          const entry = redoStackRef.current.pop()!;
          el.innerHTML = entry.html;
          setTextOffset(el, entry.offset);
          markModified();
        } else {
          // Undo
          if (undoStackRef.current.length === 0 || !el) return;
          redoStackRef.current.push({ html: el.innerHTML, offset: getTextOffset(el) });
          const entry = undoStackRef.current.pop()!;
          el.innerHTML = entry.html;
          setTextOffset(el, entry.offset);
          markModified();
        }
        return;
      }

      // Redo: Ctrl+Y
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        commitPendingSnapshot(); // flush in-progress batch
        if (redoStackRef.current.length === 0 || !el) return;
        undoStackRef.current.push({ html: el.innerHTML, offset: getTextOffset(el) });
        const entry = redoStackRef.current.pop()!;
        el.innerHTML = entry.html;
        setTextOffset(el, entry.offset);
        markModified();
        return;
      }

      // Backspace / Delete — wrap as track-change deletion
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        captureForUndo();

        const selection = window.getSelection();
        if (!selection?.rangeCount) return;

        const range = selection.getRangeAt(0);

        if (!range.collapsed) {
          // There's a selection — wrap it as deleted
          wrapRangeAsDeleted(range);
        } else {
          // No selection — select the character to delete
          if (e.key === "Backspace") {
            selectCharacterBefore(range);
          } else {
            selectCharacterAfter(range);
          }
          // Now wrap the new selection
          const newRange = selection.getRangeAt(0);
          if (!newRange.collapsed) {
            wrapRangeAsDeleted(newRange);
          }
        }

        markModified();
      }
    }

    el.addEventListener("beforeinput", handleBeforeInput as EventListener);
    el.addEventListener("keydown", handleKeydown as EventListener);

    return () => {
      el.removeEventListener("beforeinput", handleBeforeInput as EventListener);
      el.removeEventListener("keydown", handleKeydown as EventListener);
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
        batchTimerRef.current = null;
      }
    };
  }, [readOnly, onModified, editorRef]);

  // ---- Render: a single div, no children, no dangerouslySetInnerHTML ----
  return (
    <div
      ref={editorRef}
      className="revision-diff"
      contentEditable={!readOnly}
      suppressContentEditableWarning
    />
  );
}
