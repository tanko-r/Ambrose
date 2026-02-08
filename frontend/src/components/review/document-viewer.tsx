"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { Skeleton } from "@/components/ui/skeleton";

interface DocumentViewerProps {
  loading: boolean;
}

export function DocumentViewer({ loading }: DocumentViewerProps) {
  const documentHtml = useAppStore((s) => s.documentHtml);
  const paragraphs = useAppStore((s) => s.paragraphs);
  const selectedParaId = useAppStore((s) => s.selectedParaId);
  const selectParagraph = useAppStore((s) => s.selectParagraph);
  const revisions = useAppStore((s) => s.revisions);
  const flags = useAppStore((s) => s.flags);
  const risks = useAppStore((s) => s.risks);
  const hoveredRiskId = useAppStore((s) => s.hoveredRiskId);
  const focusedRiskId = useAppStore((s) => s.focusedRiskId);

  const containerRef = useRef<HTMLDivElement>(null);

  // Attach click handlers to paragraph elements rendered by backend HTML
  const attachClickHandlers = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const clickableParas = container.querySelectorAll<HTMLElement>(
      "[data-para-id]"
    );

    clickableParas.forEach((el) => {
      el.style.cursor = "pointer";
      el.addEventListener("click", () => {
        const paraId = el.getAttribute("data-para-id");
        if (paraId) selectParagraph(paraId);
      });
    });
  }, [selectParagraph]);

  // Update visual state of paragraphs (selection, risk indicators, revision status)
  const updateParagraphStates = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const allParas = container.querySelectorAll<HTMLElement>("[data-para-id]");

    const flaggedIds = new Set(flags.map((f) => f.para_id));
    const riskParaIds = new Set(risks.map((r) => r.para_id));

    allParas.forEach((el) => {
      const paraId = el.getAttribute("data-para-id");
      if (!paraId) return;

      // Selection state
      el.classList.toggle("selected", paraId === selectedParaId);

      // Risk state
      el.classList.toggle("has-risk", riskParaIds.has(paraId));

      // Revision state
      const revision = revisions[paraId];
      el.classList.toggle("has-revision", !!revision && !revision.accepted);
      el.classList.toggle(
        "revision-accepted",
        !!revision && revision.accepted
      );

      // Flag state
      el.classList.toggle("flagged", flaggedIds.has(paraId));
    });
  }, [selectedParaId, revisions, flags, risks]);

  // Highlight risk text in the document when hovering/focusing a risk card
  const highlightRiskText = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    // Remove all existing risk highlights
    container
      .querySelectorAll(".risk-highlight, .risk-highlight-active")
      .forEach((mark) => {
        const parent = mark.parentNode;
        if (parent) {
          parent.replaceChild(
            document.createTextNode(mark.textContent || ""),
            mark
          );
          parent.normalize(); // merge adjacent text nodes
        }
      });

    // Determine which risk to highlight (focused takes priority over hovered)
    const activeRiskId = focusedRiskId || hoveredRiskId;
    if (!activeRiskId) return;

    // Find the risk object to get highlight_text and para_id
    const risk = risks.find((r) => r.risk_id === activeRiskId);
    if (!risk?.highlight_text) return;

    // Find the paragraph element
    const paraEl = container.querySelector(
      `[data-para-id="${risk.para_id}"]`
    );
    if (!paraEl) return;

    // Use TreeWalker to find text nodes containing the highlight_text
    const walker = document.createTreeWalker(paraEl, NodeFilter.SHOW_TEXT);
    const textContent = risk.highlight_text;
    let node: Text | null;
    let found = false;

    while ((node = walker.nextNode() as Text | null)) {
      const idx = node.textContent?.indexOf(textContent) ?? -1;
      if (idx !== -1 && node.textContent) {
        // Split text node and wrap the matching part
        const before = node.textContent.substring(0, idx);
        const match = node.textContent.substring(
          idx,
          idx + textContent.length
        );
        const after = node.textContent.substring(idx + textContent.length);

        const markEl = document.createElement("mark");
        markEl.className =
          focusedRiskId === activeRiskId
            ? "risk-highlight-active"
            : "risk-highlight";
        markEl.textContent = match;

        const parent = node.parentNode!;
        if (before)
          parent.insertBefore(document.createTextNode(before), node);
        parent.insertBefore(markEl, node);
        if (after)
          parent.insertBefore(document.createTextNode(after), node);
        parent.removeChild(node);

        found = true;
        break; // Only highlight first match
      }
    }

    // Fallback: try matching first 50 chars if full text not found
    if (!found && textContent.length > 50) {
      const shortText = textContent.substring(0, 50);
      const walker2 = document.createTreeWalker(paraEl, NodeFilter.SHOW_TEXT);
      while ((node = walker2.nextNode() as Text | null)) {
        const idx = node.textContent?.indexOf(shortText) ?? -1;
        if (idx !== -1 && node.textContent) {
          const markEl = document.createElement("mark");
          markEl.className =
            focusedRiskId === activeRiskId
              ? "risk-highlight-active"
              : "risk-highlight";
          // Highlight from match start to end of text node (approximate)
          const before = node.textContent.substring(0, idx);
          const matchText = node.textContent.substring(idx);
          markEl.textContent = matchText;

          const parent = node.parentNode!;
          if (before)
            parent.insertBefore(document.createTextNode(before), node);
          parent.insertBefore(markEl, node);
          parent.removeChild(node);
          break;
        }
      }
    }

    // Scroll highlighted text into view if focused (not just hovered)
    if (focusedRiskId === activeRiskId) {
      const highlighted = container.querySelector(".risk-highlight-active");
      if (highlighted) {
        highlighted.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [hoveredRiskId, focusedRiskId, risks]);

  // Trigger risk highlighting when hover/focus changes
  useEffect(() => {
    if (documentHtml) {
      requestAnimationFrame(() => highlightRiskText());
    }
  }, [documentHtml, highlightRiskText]);

  // Auto-open bottom sheet when clicking a paragraph with an existing revision
  useEffect(() => {
    if (!selectedParaId) return;
    const revision = revisions[selectedParaId];
    if (revision) {
      const store = useAppStore.getState();
      store.setRevisionSheetParaId(selectedParaId);
      if (!store.bottomSheetOpen) {
        store.toggleBottomSheet();
      }
    } else {
      // Update revision sheet para ID to track current paragraph even without revision
      useAppStore.getState().setRevisionSheetParaId(selectedParaId);
    }
  }, [selectedParaId, revisions]);

  // Scroll selected paragraph into view
  useEffect(() => {
    if (!selectedParaId || !containerRef.current) return;

    const el = containerRef.current.querySelector(
      `[data-para-id="${selectedParaId}"]`
    );
    if (!el) return;

    // Smart scroll: only scroll if element is not in the middle third of the viewport
    const rect = el.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const topThird = viewportHeight / 3;
    const bottomThird = (viewportHeight * 2) / 3;

    if (rect.top < topThird || rect.bottom > bottomThird) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedParaId]);

  // Attach handlers after HTML renders
  useEffect(() => {
    if (documentHtml) {
      // Use requestAnimationFrame to ensure DOM is painted
      requestAnimationFrame(() => {
        attachClickHandlers();
        updateParagraphStates();
      });
    }
  }, [documentHtml, attachClickHandlers, updateParagraphStates]);

  // Update states when selection/risks/revisions/flags change
  useEffect(() => {
    updateParagraphStates();
  }, [updateParagraphStates]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-8">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-6 w-40 mt-6" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  // High-fidelity HTML mode (preferred)
  if (documentHtml) {
    return (
      <div className="flex-1 overflow-y-auto bg-secondary/30">
        <div className="mx-auto max-w-3xl rounded border bg-card p-10 my-6 shadow-sm">
          <div
            ref={containerRef}
            className="document-container"
            dangerouslySetInnerHTML={{ __html: documentHtml }}
          />
        </div>
      </div>
    );
  }

  // Fallback: plain-text paragraph rendering
  if (paragraphs.length > 0) {
    return (
      <div className="flex-1 overflow-y-auto bg-secondary/30">
        <div className="mx-auto max-w-3xl rounded border bg-card p-10 my-6 shadow-sm">
          <div ref={containerRef} className="document-container">
            {paragraphs
              .filter((p) => p.type === "paragraph")
              .map((para) => (
                <div
                  key={para.id}
                  data-para-id={para.id}
                  className={`group relative my-2 cursor-pointer rounded border border-transparent px-4 py-2.5 transition-colors hover:border-border hover:bg-accent/50 ${
                    para.id === selectedParaId
                      ? "border-primary bg-primary/5 shadow-sm"
                      : ""
                  }`}
                  onClick={() => selectParagraph(para.id)}
                >
                  {para.section_ref && (
                    <div className="mb-1 text-xs font-medium tracking-wider text-muted-foreground">
                      {para.section_ref}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap text-[15px] leading-[1.7] text-foreground">
                    {para.text}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  return (
    <div className="flex flex-1 items-center justify-center">
      <p className="text-sm text-muted-foreground">No document loaded</p>
    </div>
  );
}
