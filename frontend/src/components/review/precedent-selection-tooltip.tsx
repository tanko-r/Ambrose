"use client";

// =============================================================================
// PrecedentSelectionTooltip -- Floating tooltip on text selection in precedent
// Shows Copy, Use in Revision, Flag for Reference actions.
// Uses @floating-ui/react-dom with virtual element positioning.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { useFloating, offset, flip, shift } from "@floating-ui/react-dom";
import { Button } from "@/components/ui/button";
import { Copy, FileInput, Flag } from "lucide-react";
import { toast } from "sonner";
import { usePrecedent } from "@/hooks/use-precedent";
import { useAppStore } from "@/lib/store";
import { flagItem } from "@/lib/api";

interface PrecedentSelectionTooltipProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function PrecedentSelectionTooltip({
  containerRef,
}: PrecedentSelectionTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const sourceParaIdRef = useRef<string | null>(null);
  const sourceSectionRef = useRef<string>("");

  const { addSnippet } = usePrecedent();

  const { refs, floatingStyles } = useFloating({
    placement: "top",
    middleware: [offset(8), flip(), shift({ padding: 8 })],
  });

  // Find the closest [data-para-id] ancestor of a node
  const findParaId = useCallback((node: Node | null): string | null => {
    let el = node instanceof HTMLElement ? node : node?.parentElement;
    while (el) {
      const paraId = el.getAttribute?.("data-para-id");
      if (paraId) return paraId;
      el = el.parentElement;
    }
    return null;
  }, []);

  // Handle mouseup -- detect text selection
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handleMouseUp() {
      // Small delay to let selection finalize
      requestAnimationFrame(() => {
        const selection = window.getSelection();
        if (
          !selection ||
          selection.isCollapsed ||
          !selection.toString().trim()
        ) {
          return;
        }

        // Check that selection is within the container
        const range = selection.getRangeAt(0);
        if (!container!.contains(range.commonAncestorContainer)) {
          return;
        }

        const text = selection.toString().trim();
        if (!text) return;

        // Identify source paragraph
        const paraId = findParaId(selection.anchorNode);
        sourceParaIdRef.current = paraId;

        // Try to get section info from data attributes
        if (paraId) {
          const el = container!.querySelector(`[data-para-id="${paraId}"]`);
          sourceSectionRef.current =
            el?.getAttribute("data-section-ref") || "";
        }

        setSelectedText(text);

        // Create virtual reference element from selection bounding rect
        const rect = range.getBoundingClientRect();
        refs.setReference({
          getBoundingClientRect: () => rect,
        });

        setIsOpen(true);
      });
    }

    container.addEventListener("mouseup", handleMouseUp);
    return () => {
      container.removeEventListener("mouseup", handleMouseUp);
    };
  }, [containerRef, refs, findParaId]);

  // Dismiss on mousedown outside tooltip
  useEffect(() => {
    if (!isOpen) return;

    function handleMouseDown(e: MouseEvent) {
      const floating = refs.floating.current;
      if (floating && floating.contains(e.target as Node)) return;
      setIsOpen(false);
    }

    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [isOpen, refs.floating]);

  // Dismiss on scroll within the container
  useEffect(() => {
    if (!isOpen) return;
    const container = containerRef.current;
    if (!container) return;

    // Find the scrollable parent (the overflow-y-auto wrapper)
    const scrollParent = container.closest(".overflow-y-auto") || container;

    function handleScroll() {
      setIsOpen(false);
    }

    scrollParent.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      scrollParent.removeEventListener("scroll", handleScroll);
    };
  }, [isOpen, containerRef]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(selectedText);
    toast.success("Copied to clipboard");
    setIsOpen(false);
    window.getSelection()?.removeAllRanges();
  }, [selectedText]);

  const handleUseInRevision = useCallback(() => {
    const sourceParagraphId = sourceParaIdRef.current || "";
    const sourceSection = sourceSectionRef.current || "";
    addSnippet(selectedText, sourceParagraphId, sourceSection);
    toast.success("Added to revision queue");
    setIsOpen(false);
    window.getSelection()?.removeAllRanges();
  }, [selectedText, addSnippet]);

  const handleFlagForReference = useCallback(async () => {
    const sessionId = useAppStore.getState().sessionId;
    const selectedParaId = useAppStore.getState().selectedParaId;
    if (!sessionId || !selectedParaId) {
      toast.error("Select a target paragraph first");
      return;
    }

    const sourceSection = sourceSectionRef.current || "unknown section";
    const excerpt =
      selectedText.length > 80
        ? selectedText.slice(0, 80) + "..."
        : selectedText;
    const note = `Precedent ref: [${sourceSection}] - ${excerpt}`;

    try {
      await flagItem({
        session_id: sessionId,
        para_id: selectedParaId,
        note,
        flag_type: "attorney",
      });
      toast.success("Flagged for reference");
    } catch {
      toast.error("Failed to flag for reference");
    }

    setIsOpen(false);
    window.getSelection()?.removeAllRanges();
  }, [selectedText]);

  if (!isOpen) return null;

  return (
    <div
      ref={refs.setFloating}
      style={floatingStyles}
      className="precedent-selection-tooltip z-50 flex items-center gap-1 rounded-lg border bg-card px-1.5 py-1 shadow-lg"
    >
      <Button
        variant="secondary"
        size="xs"
        onClick={handleCopy}
        title="Copy"
      >
        <Copy className="h-3.5 w-3.5" />
        <span className="text-[11px]">Copy</span>
      </Button>
      <Button
        variant="secondary"
        size="xs"
        onClick={handleUseInRevision}
        title="Use in Revision"
      >
        <FileInput className="h-3.5 w-3.5" />
        <span className="text-[11px]">Use</span>
      </Button>
      <Button
        variant="secondary"
        size="xs"
        onClick={handleFlagForReference}
        title="Flag for Reference"
      >
        <Flag className="h-3.5 w-3.5" />
        <span className="text-[11px]">Flag</span>
      </Button>
    </div>
  );
}
