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
  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  const isModifiedRef = useRef(false);

  // ---- Set innerHTML imperatively when diffHtml changes ----
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = diffHtml;
      undoStackRef.current = [];
      redoStackRef.current = [];
      isModifiedRef.current = false;
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

    function saveUndoState() {
      if (!el) return;
      undoStackRef.current.push(el.innerHTML);
      if (undoStackRef.current.length > 50) {
        undoStackRef.current.shift();
      }
      redoStackRef.current = [];
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
        saveUndoState();

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
        if (e.shiftKey) {
          // Redo: Ctrl+Shift+Z
          if (redoStackRef.current.length === 0 || !el) return;
          undoStackRef.current.push(el.innerHTML);
          el.innerHTML = redoStackRef.current.pop()!;
          markModified();
        } else {
          // Undo
          if (undoStackRef.current.length === 0 || !el) return;
          redoStackRef.current.push(el.innerHTML);
          el.innerHTML = undoStackRef.current.pop()!;
          markModified();
        }
        return;
      }

      // Redo: Ctrl+Y
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        if (redoStackRef.current.length === 0 || !el) return;
        undoStackRef.current.push(el.innerHTML);
        el.innerHTML = redoStackRef.current.pop()!;
        markModified();
        return;
      }

      // Backspace / Delete — wrap as track-change deletion
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        saveUndoState();

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
