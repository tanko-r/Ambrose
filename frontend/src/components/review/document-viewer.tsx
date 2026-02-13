"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { Skeleton } from "@/components/ui/skeleton";
import { FlagDialog } from "@/components/dialogs/flag-dialog";
import { ErrorBoundary } from "@/components/error-boundary";
import { useDelayedLoading } from "@/hooks/use-delayed-loading";
import { Flag as FlagIcon, FileText } from "lucide-react";

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
  const originalHtmlCache = useRef<Map<string, string>>(new Map());

  // Text selection flagging state
  const [selectionContext, setSelectionContext] = useState<{
    paraId: string;
    textExcerpt: string;
    rect: { top: number; left: number };
  } | null>(null);
  const [flagDialogOpen, setFlagDialogOpen] = useState(false);
  // Saved context for the dialog — persists after selection is cleared
  const [dialogContext, setDialogContext] = useState<{
    paraId: string;
    textExcerpt: string;
  } | null>(null);
  // Guard: when true, suppress selectionchange from clearing selectionContext
  const suppressSelectionClear = useRef(false);

  // Attach click handlers to paragraph elements rendered by backend HTML
  const attachClickHandlers = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const clickableParas = container.querySelectorAll<HTMLElement>(
      "[data-para-id]"
    );

    clickableParas.forEach((el) => {
      el.style.cursor = "pointer";

      // Accessibility: make paragraphs keyboard-navigable
      el.setAttribute("role", "button");
      el.setAttribute("tabindex", "0");
      const sectionRef = el.getAttribute("data-section-ref") || el.querySelector(".section-ref")?.textContent || "";
      el.setAttribute("aria-label", sectionRef ? `Paragraph: ${sectionRef}` : "Document paragraph");

      // Keyboard handler: Enter/Space triggers same as click
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          const paraId = el.getAttribute("data-para-id");
          if (paraId) selectParagraph(paraId);
        }
      });

      el.addEventListener("click", (e) => {
        // Don't fire paragraph selection when user is selecting text
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed && selection.toString().trim()) {
          return;
        }

        // Check if click was on the flag icon area (right margin, ~30px from right edge)
        // This selects the paragraph so the Flags tab shows its flags
        // TODO: Switch sidebar to Flags tab on flag icon click (activeTab is local to Sidebar)
        const rect = el.getBoundingClientRect();
        const clickX = (e as MouseEvent).clientX;
        if (el.classList.contains("flagged") && clickX > rect.right - 30) {
          const paraId = el.getAttribute("data-para-id");
          if (paraId) selectParagraph(paraId);
          return;
        }

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

    // Build a map from para_id to the first flag's category (for margin icon color)
    const flagCategoryMap = new Map<string, string>();
    for (const f of flags) {
      if (!flagCategoryMap.has(f.para_id)) {
        flagCategoryMap.set(f.para_id, f.category ?? "for-discussion");
      }
    }
    const flaggedIds = new Set(flags.map((f) => f.para_id));
    const riskParaIds = new Set(risks.map((r) => r.para_id));

    allParas.forEach((el) => {
      const paraId = el.getAttribute("data-para-id");
      if (!paraId) return;

      // Selection state
      const isSelected = paraId === selectedParaId;
      el.classList.toggle("selected", isSelected);
      el.setAttribute("aria-selected", String(isSelected));

      // Risk state
      el.classList.toggle("has-risk", riskParaIds.has(paraId));

      // Revision state
      const revision = revisions[paraId];
      const isAccepted = !!revision && revision.accepted;
      el.classList.toggle("has-revision", !!revision && !revision.accepted);
      el.classList.toggle("revision-accepted", isAccepted);

      // Inline track changes for approved revisions
      if (isAccepted) {
        const diffContent = revision.editedHtml || revision.diff_html;
        if (diffContent) {
          // Cache original HTML before replacing (only on first accept)
          if (!originalHtmlCache.current.has(paraId)) {
            originalHtmlCache.current.set(paraId, el.innerHTML);
          }
          // Only replace if not already showing diff content
          if (!el.classList.contains("showing-diff")) {
            el.innerHTML = diffContent;
            el.classList.add("showing-diff");
          }
        }
      } else if (originalHtmlCache.current.has(paraId)) {
        // Revision reopened or removed — restore original HTML
        el.innerHTML = originalHtmlCache.current.get(paraId)!;
        originalHtmlCache.current.delete(paraId);
        el.classList.remove("showing-diff");
      }

      // Flag state + category data attribute for CSS margin icons
      const isFlagged = flaggedIds.has(paraId);
      el.classList.toggle("flagged", isFlagged);
      if (isFlagged) {
        el.setAttribute("data-flag-category", flagCategoryMap.get(paraId) ?? "for-discussion");
        // Tooltip: show first flag's note on hover
        const flagNote = flags.find((f) => f.para_id === paraId)?.note;
        el.title = flagNote ? flagNote.slice(0, 100) : "Flagged for review";
      } else {
        el.removeAttribute("data-flag-category");
        el.title = "";
      }
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

    // Skip risk highlighting for accepted paragraphs (diff HTML breaks text matching)
    if (paraEl.classList.contains("showing-diff")) return;

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

  // Track which paragraph the revision sheet is pointing at.
  // The bottom sheet should NOT auto-open — the user opens it explicitly via
  // "View Revision" in the sidebar. We only update the paraId so the sheet
  // shows the correct revision when the user does open it.
  useEffect(() => {
    if (!selectedParaId) return;
    const store = useAppStore.getState();
    store.setRevisionSheetParaId(selectedParaId);
  }, [selectedParaId]);

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

  // Text selection flagging: detect mouseup in document and show floating Flag button
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handleMouseUp() {
      requestAnimationFrame(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || !selection.toString().trim()) {
          return;
        }

        const range = selection.getRangeAt(0);
        if (!container!.contains(range.commonAncestorContainer)) {
          return;
        }

        // Find the nearest ancestor with data-para-id
        let node: Node | null = selection.anchorNode;
        let el = node instanceof HTMLElement ? node : node?.parentElement;
        let paraId: string | null = null;
        while (el) {
          paraId = el.getAttribute?.("data-para-id");
          if (paraId) break;
          el = el.parentElement;
        }

        if (!paraId) return;

        const text = selection.toString().trim().slice(0, 200);
        const rect = range.getBoundingClientRect();
        const containerRect = container!.getBoundingClientRect();

        setSelectionContext({
          paraId,
          textExcerpt: text,
          rect: {
            // Position relative to the scrollable container parent
            top: rect.top - containerRect.top - 36,
            left: rect.left - containerRect.left + rect.width / 2,
          },
        });
      });
    }

    // Clear selection context when selection changes to collapsed
    function handleSelectionChange() {
      if (suppressSelectionClear.current) return;
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setSelectionContext(null);
      }
    }

    container.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("selectionchange", handleSelectionChange);

    return () => {
      container.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [documentHtml]);

  // Open flag dialog from floating button
  const handleSelectionFlag = useCallback(() => {
    if (!selectionContext) return;
    // Save context for the dialog before clearing anything
    setDialogContext({
      paraId: selectionContext.paraId,
      textExcerpt: selectionContext.textExcerpt,
    });
    setFlagDialogOpen(true);
    // Suppress the selectionchange listener while we clean up
    suppressSelectionClear.current = true;
    setSelectionContext(null);
    window.getSelection()?.removeAllRanges();
    // Re-enable selectionchange listener on next tick
    requestAnimationFrame(() => {
      suppressSelectionClear.current = false;
    });
  }, [selectionContext]);

  const showSkeleton = useDelayedLoading(loading);

  if (loading) {
    if (!showSkeleton) {
      // Delay skeleton to avoid flash for instant loads
      return <div className="flex-1" />;
    }
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
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  // High-fidelity HTML mode (preferred)
  if (documentHtml) {
    return (
      <ErrorBoundary friendlyMessage="Failed to render the document. The HTML content may be malformed.">
      <div role="main" aria-label="Document viewer" className="flex-1 overflow-y-auto bg-card px-6 py-4">
        <div className="relative">
          <div
            ref={containerRef}
            className="document-container"
            dangerouslySetInnerHTML={{ __html: documentHtml }}
          />

          {/* Floating Flag button on text selection */}
          {selectionContext && !flagDialogOpen && (
            <button
              onMouseDown={(e) => {
                // Prevent mousedown from collapsing the text selection
                // so the click handler can fire with selectionContext intact
                e.preventDefault();
              }}
              onClick={handleSelectionFlag}
              aria-label="Flag selected text"
              className="absolute z-40 flex items-center gap-1 rounded-md border bg-card px-2 py-1.5 text-xs font-medium shadow-lg transition-colors hover:bg-accent"
              style={{
                top: selectionContext.rect.top,
                left: selectionContext.rect.left,
                transform: "translateX(-50%)",
              }}
            >
              <FlagIcon className="h-3 w-3 text-primary" />
              Flag
            </button>
          )}

          {/* Flag dialog for text selection flagging */}
          {dialogContext && (
            <FlagDialog
              open={flagDialogOpen}
              onOpenChange={(open) => {
                setFlagDialogOpen(open);
                if (!open) {
                  setDialogContext(null);
                  setSelectionContext(null);
                }
              }}
              paraId={dialogContext.paraId}
              defaultCategory="for-discussion"
              defaultFlagType="client"
            />
          )}
        </div>
      </div>
      </ErrorBoundary>
    );
  }

  // Fallback: plain-text paragraph rendering
  if (paragraphs.length > 0) {
    return (
      <div className="flex-1 overflow-y-auto bg-card px-6 py-4">
        <div ref={containerRef} className="document-container">
            {paragraphs
              .filter((p) => p.type === "paragraph")
              .map((para) => (
                <div
                  key={para.id}
                  data-para-id={para.id}
                  role="button"
                  tabIndex={0}
                  aria-selected={para.id === selectedParaId}
                  aria-label={para.section_ref ? `Paragraph: ${para.section_ref}` : "Document paragraph"}
                  className={`group relative my-2 cursor-pointer rounded border border-transparent px-4 py-2.5 transition-colors hover:border-border hover:bg-accent/50 ${
                    para.id === selectedParaId
                      ? "border-primary bg-primary/5 shadow-sm"
                      : ""
                  }`}
                  onClick={() => selectParagraph(para.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      selectParagraph(para.id);
                    }
                  }}
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
    );
  }

  // Empty state
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3">
      <FileText className="h-8 w-8 text-muted-foreground/40" />
      <div className="text-center">
        <p className="text-sm font-medium text-muted-foreground">
          No document loaded
        </p>
        <p className="mt-1 max-w-[260px] text-xs text-muted-foreground/70">
          Upload a contract on the dashboard to begin your review.
        </p>
      </div>
    </div>
  );
}
