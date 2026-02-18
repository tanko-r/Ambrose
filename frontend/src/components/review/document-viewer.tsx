"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, memo } from "react";
import { useAppStore } from "@/lib/store";
import { Skeleton } from "@/components/ui/skeleton";
import { FlagBubble } from "@/components/review/flag-bubble";
import { ErrorBoundary } from "@/components/error-boundary";
import { useDelayedLoading } from "@/hooks/use-delayed-loading";
import { calculateConnectorPath } from "@/lib/utils/connector";
import { Flag as FlagIcon, FileText } from "lucide-react";
import { HistoryNav } from "@/components/review/history-nav";

interface DocumentViewerProps {
  loading: boolean;
}

/**
 * Memoized component to render the document HTML.
 * This prevents React from reconciliating the dangerouslySetInnerHTML container 
 * every time DocumentViewer state (like selectionContext) changes, which 
 * is the primary cause of browser text selection collapse.
 */
const StaticHTML = memo(({ html }: { html: string }) => {
  return (
    <div
      className="document-container"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});
StaticHTML.displayName = 'StaticHTML';

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
  const focusedFlagId = useAppStore((s) => s.focusedFlagId);
  const setFocusedFlagId = useAppStore((s) => s.setFocusedFlagId);

  const containerRef = useRef<HTMLDivElement>(null);
  const originalHtmlCache = useRef<Map<string, string>>(new Map());

  // Text selection flagging state
  const [selectionContext, setSelectionContext] = useState<{
    paraId: string;
    textExcerpt: string;
    rect: { top: number; left: number };
  } | null>(null);

  // Bubble context — persists after selection is cleared, drives the comment bubble
  const [bubbleContext, setBubbleContext] = useState<{
    paraId: string;
    textExcerpt: string;
    anchorRect: { top: number; right: number };
  } | null>(null);

  // Connector line path
  const [connectorPath, setConnectorPath] = useState<string | null>(null);

  // Selection persistence: save Range and restore after React re-renders
  const savedRangeRef = useRef<Range | null>(null);
  const isSelectingRef = useRef(false);

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
      if (el.classList.contains("selected") !== isSelected) {
        el.classList.toggle("selected", isSelected);
        el.setAttribute("aria-selected", String(isSelected));
      }

      // Risk state
      const hasRisk = riskParaIds.has(paraId);
      const showRisk = hasRisk && isSelected;
      if (el.classList.contains("has-risk") !== showRisk) {
        el.classList.toggle("has-risk", showRisk);
      }

      // Revision state
      const revision = revisions[paraId];
      const isAccepted = !!revision && revision.accepted;
      const hasRevision = !!revision && !revision.accepted;
      
      if (el.classList.contains("has-revision") !== hasRevision) {
        el.classList.toggle("has-revision", hasRevision);
      }
      if (el.classList.contains("revision-accepted") !== isAccepted) {
        el.classList.toggle("revision-accepted", isAccepted);
      }

      // Inline track changes for approved revisions
      if (isAccepted) {
        const diffContent = revision.editedHtml || revision.diff_html;
        if (diffContent) {
          if (!originalHtmlCache.current.has(paraId)) {
            originalHtmlCache.current.set(paraId, el.innerHTML);
          }
          if (el.innerHTML !== diffContent) {
            el.innerHTML = diffContent;
            el.classList.add("showing-diff");
          }
        }
      } else if (originalHtmlCache.current.has(paraId)) {
        el.innerHTML = originalHtmlCache.current.get(paraId)!;
        originalHtmlCache.current.delete(paraId);
        el.classList.remove("showing-diff");
      }

      // Flag state + category data attribute for CSS margin icons
      const isFlagged = flaggedIds.has(paraId);
      const currentFlagged = el.classList.contains("flagged");
      const category = isFlagged ? (flagCategoryMap.get(paraId) ?? "for-discussion") : null;
      const currentCategory = el.getAttribute("data-flag-category");

      if (currentFlagged !== isFlagged) {
        el.classList.toggle("flagged", isFlagged);
      }
      
      if (isFlagged && currentCategory !== category) {
        el.setAttribute("data-flag-category", category!);
        const flagNote = flags.find((f) => f.para_id === paraId)?.note;
        el.title = flagNote ? flagNote.slice(0, 100) : "Flagged for review";
      } else if (!isFlagged && currentCategory !== null) {
        el.removeAttribute("data-flag-category");
        el.title = "";
      }
    });
  }, [selectedParaId, revisions, flags, risks]);

  // Highlight risk text in the document
  const highlightRiskText = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    try {
      // Remove all existing risk highlights
      container.querySelectorAll(".risk-highlight, .risk-highlight-active").forEach((mark) => {
        const parent = mark.parentNode;
        if (parent) {
          parent.replaceChild(document.createTextNode(mark.textContent || ""), mark);
          parent.normalize();
        }
      });

      const activeRiskId = focusedRiskId || hoveredRiskId;
      if (!activeRiskId) return;

      const risk = risks.find((r) => r.risk_id === activeRiskId);
      if (!risk?.highlight_text) return;

      const paraEl = container.querySelector(`[data-para-id="${risk.para_id}"]`);
      if (!paraEl || paraEl.classList.contains("showing-diff")) return;

      const walker = document.createTreeWalker(paraEl, NodeFilter.SHOW_TEXT);
      const textContent = risk.highlight_text;
      let node: Text | null;

      while ((node = walker.nextNode() as Text | null)) {
        const idx = node.textContent?.indexOf(textContent) ?? -1;
        if (idx !== -1 && node.textContent) {
          const markEl = document.createElement("mark");
          markEl.className = focusedRiskId === activeRiskId ? "risk-highlight-active" : "risk-highlight";
          markEl.textContent = textContent;

          const before = node.textContent.substring(0, idx);
          const after = node.textContent.substring(idx + textContent.length);

          const parent = node.parentNode!;
          if (before) parent.insertBefore(document.createTextNode(before), node);
          parent.insertBefore(markEl, node);
          if (after) parent.insertBefore(document.createTextNode(after), node);
          parent.removeChild(node);

          if (focusedRiskId === activeRiskId) {
            markEl.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          break;
        }
      }
    } catch (err) {
      console.warn("Risk highlighting failed:", err);
    }
  }, [hoveredRiskId, focusedRiskId, risks]);

  // Highlight flag text in the document
  const highlightFlags = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear existing flag highlights
    container.querySelectorAll(".flag-highlight-active, .flag-highlight-unfocused").forEach((mark) => {
      const parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(mark.textContent || ""), mark);
        parent.normalize();
      }
    });

    // We also need to highlight the active creation selection (bubbleContext)
    const allFlagsToHighlight = [...flags];
    if (bubbleContext && !flags.some(f => f.para_id === bubbleContext.paraId)) {
        // Mock a flag for the one being created
        allFlagsToHighlight.push({
            id: `temp-${bubbleContext.paraId}`,
            para_id: bubbleContext.paraId,
            text_excerpt: bubbleContext.textExcerpt,
            note: '',
            flag_type: 'client',
            section_ref: '',
            timestamp: ''
        });
    }

    allFlagsToHighlight.forEach(flag => {
      const paraEl = container.querySelector(`[data-para-id="${flag.para_id}"]`);
      if (!paraEl || paraEl.classList.contains("showing-diff")) return;

      const isFocused = flag.id === focusedFlagId || (bubbleContext?.paraId === flag.para_id);
      const textContent = flag.text_excerpt;
      if (!textContent) return;

      const walker = document.createTreeWalker(paraEl, NodeFilter.SHOW_TEXT);
      let node: Text | null;
      while ((node = walker.nextNode() as Text | null)) {
        const idx = node.textContent?.indexOf(textContent) ?? -1;
        if (idx !== -1 && node.textContent) {
          const markEl = document.createElement("mark");
          markEl.className = isFocused ? "flag-highlight-active" : "flag-highlight-unfocused";
          markEl.textContent = textContent;
          markEl.setAttribute('data-flag-id', flag.id);

          const before = node.textContent.substring(0, idx);
          const after = node.textContent.substring(idx + textContent.length);

          const parent = node.parentNode!;
          if (before) parent.insertBefore(document.createTextNode(before), node);
          parent.insertBefore(markEl, node);
          if (after) parent.insertBefore(document.createTextNode(after), node);
          parent.removeChild(node);
          break;
        }
      }
    });
  }, [flags, focusedFlagId, bubbleContext]);

  // Update connector line
  const updateConnector = useCallback(() => {
    if (!bubbleContext || !containerRef.current) {
      setConnectorPath(null);
      return;
    }

    const highlight = containerRef.current.querySelector(".flag-highlight-active");
    if (!highlight) {
      setConnectorPath(null);
      return;
    }

    const hRect = highlight.getBoundingClientRect();
    const cRect = containerRef.current.getBoundingClientRect();

    // Start point: middle of right edge of the highlight
    const startX = hRect.right - cRect.left;
    const startY = hRect.top - cRect.top + hRect.height / 2;

    // End point: anchorRect is viewport coordinates
    const endX = bubbleContext.anchorRect.right - cRect.left;
    const endY = bubbleContext.anchorRect.top - cRect.top;

    setConnectorPath(calculateConnectorPath(startX, startY, endX, endY));
  }, [bubbleContext]);

  // Restore browser selection after React re-renders
  useLayoutEffect(() => {
    if (!savedRangeRef.current) return;
    if (!selectionContext && !bubbleContext) return;

    const sel = window.getSelection();
    if (!sel || (!sel.isCollapsed && sel.rangeCount > 0)) return;

    try {
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    } catch (err) {
      console.log('[FLAG-DEBUG] Restoration failed', err);
    }
  });

  // Effect: Paragraph state updates
  useEffect(() => {
    // Optimization: avoid background DOM updates while user is actively flagging
    if (!selectionContext && !bubbleContext) {
      updateParagraphStates();
    }
  }, [updateParagraphStates, selectionContext, bubbleContext]);

  // Effect: Risk highlighting
  useEffect(() => {
    if (documentHtml) {
      requestAnimationFrame(() => highlightRiskText());
    }
  }, [documentHtml, highlightRiskText]);

  // Effect: Flag highlighting
  useEffect(() => {
    if (documentHtml) {
      requestAnimationFrame(() => {
        highlightFlags();
        updateConnector();
      });
    }
  }, [documentHtml, highlightFlags, updateConnector, focusedFlagId]);

  // Effect: Update connector on scroll/resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scrollParent = container.parentElement;
    if (!scrollParent) return;

    const handleUpdate = () => requestAnimationFrame(updateConnector);
    scrollParent.addEventListener("scroll", handleUpdate);
    window.addEventListener("resize", handleUpdate);

    return () => {
      scrollParent.removeEventListener("scroll", handleUpdate);
      window.removeEventListener("resize", handleUpdate);
    };
  }, [updateConnector]);

  // Effect: Scroll selected paragraph into view
  useEffect(() => {
    if (!selectedParaId || !containerRef.current) return;
    const el = containerRef.current.querySelector(`[data-para-id="${selectedParaId}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedParaId]);

  // Effect: Sync bubble context with focusedFlagId
  useEffect(() => {
    if (focusedFlagId && containerRef.current) {
        const flag = flags.find(f => f.id === focusedFlagId);
        if (flag) {
            const paraEl = containerRef.current.querySelector(`[data-para-id="${flag.para_id}"]`);
            if (paraEl) {
                const pRect = paraEl.getBoundingClientRect();
                const cRect = containerRef.current.getBoundingClientRect();
                setBubbleContext({
                    paraId: flag.para_id,
                    textExcerpt: flag.text_excerpt,
                    anchorRect: {
                        top: pRect.top + 20,
                        right: cRect.right
                    }
                });
            }
        }
    } else if (!selectionContext) {
        setBubbleContext(null);
    }
  }, [focusedFlagId, flags]);

  // Effect: Main event handlers
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !documentHtml) return;

    const handleContainerClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Check if clicking a flag highlight
      const flagMark = target.closest<HTMLElement>('mark[data-flag-id]');
      if (flagMark) {
          const flagId = flagMark.getAttribute('data-flag-id');
          if (flagId) {
              setFocusedFlagId(flagId);
              const paraEl = flagMark.closest<HTMLElement>("[data-para-id]");
              if (paraEl) {
                  const paraId = paraEl.getAttribute("data-para-id");
                  if (paraId) selectParagraph(paraId);
              }
              return;
          }
      }

      const paraEl = target.closest<HTMLElement>("[data-para-id]");
      if (!paraEl || !container.contains(paraEl)) return;

      const selection = window.getSelection();
      const hasTextSelection = selection && !selection.isCollapsed && selection.toString().trim();
      
      if (hasTextSelection || isSelectingRef.current) return;

      const paraId = paraEl.getAttribute("data-para-id");
      if (!paraId) return;

      // Icon click area check
      const rect = paraEl.getBoundingClientRect();
      const clickX = e.clientX;
      if (paraEl.classList.contains("flagged") && clickX > rect.right - 30) {
        // If multiple flags, we'll just focus the first one for now
        const firstFlag = flags.find(f => f.para_id === paraId);
        if (firstFlag) setFocusedFlagId(firstFlag.id);
        selectParagraph(paraId);
        return;
      }
      selectParagraph(paraId);
    };

    function handleMouseUp() {
      // Small delay to let browser finish native selection events
      setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || !selection.toString().trim()) return;

        const range = selection.getRangeAt(0);
        if (!container!.contains(range.commonAncestorContainer)) return;

        let node: Node | null = selection.anchorNode;
        let el = node instanceof HTMLElement ? node : node?.parentElement;
        let paraId: string | null = null;
        while (el) {
          paraId = el.getAttribute?.("data-para-id");
          if (paraId) break;
          el = el.parentElement;
        }

        if (!paraId) return;

        // Block click handler temporarily
        isSelectingRef.current = true;
        setTimeout(() => { isSelectingRef.current = false; }, 300);

        const rect = range.getBoundingClientRect();
        const containerRect = container!.getBoundingClientRect();
        
        savedRangeRef.current = range.cloneRange();
        setSelectionContext({
          paraId,
          textExcerpt: selection.toString().trim().slice(0, 200),
          rect: {
            top: rect.top - containerRect.top - 36,
            left: rect.left - containerRect.left + rect.width / 2,
          },
        });
      }, 20);
    }

    function handleMouseDown(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target.closest('[aria-label="Flag selected text"]')) return;
      if (target.closest('[role="dialog"]')) return; // Flag bubble

      savedRangeRef.current = null;
      setSelectionContext(null);
      setFocusedFlagId(null);
    }

    function handleDocumentKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        savedRangeRef.current = null;
        setSelectionContext(null);
        setFocusedFlagId(null);
      }
    }

    function handleContainerKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter" || e.key === " ") {
        const target = e.target as HTMLElement;
        const paraEl = target.closest<HTMLElement>("[data-para-id]");
        if (paraEl && container!.contains(paraEl)) {
          e.preventDefault();
          const paraId = paraEl.getAttribute("data-para-id");
          if (paraId) selectParagraph(paraId);
        }
      }
    }

    container.addEventListener("click", handleContainerClick);
    container.addEventListener("mouseup", handleMouseUp);
    container.addEventListener("keydown", handleContainerKeyDown);
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleDocumentKeyDown);

    return () => {
      container.removeEventListener("click", handleContainerClick);
      container.removeEventListener("mouseup", handleMouseUp);
      container.removeEventListener("keydown", handleContainerKeyDown);
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [documentHtml, selectParagraph, setFocusedFlagId, flags]);

  const handleSelectionFlag = useCallback(() => {
    if (!selectionContext) return;
    const containerRect = containerRef.current?.getBoundingClientRect();
    setBubbleContext({
      paraId: selectionContext.paraId,
      textExcerpt: selectionContext.textExcerpt,
      anchorRect: { 
        top: selectionContext.rect.top + (containerRect?.top ?? 0) + 36, 
        right: containerRect?.right ?? window.innerWidth / 2 
      },
    });
    setSelectionContext(null);
  }, [selectionContext]);

  const showSkeleton = useDelayedLoading(loading);

  if (loading) {
    if (!showSkeleton) return <div className="flex-1" />;
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (documentHtml) {
    return (
      <ErrorBoundary friendlyMessage="Failed to render the document.">
        <div role="main" aria-label="Document viewer" className="relative flex-1 overflow-y-auto bg-card px-6 py-4">
          <HistoryNav />
          <div className="relative" ref={containerRef}>
            <StaticHTML html={documentHtml} />
            
            {/* SVG Connector Layer */}
            {connectorPath && (
              <svg className="flag-connector-layer">
                <path d={connectorPath} className="flag-connector-line" />
              </svg>
            )}

            {selectionContext && !bubbleContext && (
              <button
                onMouseDown={(e) => e.preventDefault()}
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

            {bubbleContext && (
              <FlagBubble
                key={focusedFlagId || 'new-flag'}
                paraId={bubbleContext.paraId}
                textExcerpt={bubbleContext.textExcerpt}
                anchorRect={bubbleContext.anchorRect}
                initialFlag={flags.find(f => f.para_id === bubbleContext.paraId)}
                onClose={() => {
                  savedRangeRef.current = null;
                  window.getSelection()?.removeAllRanges();
                  setBubbleContext(null);
                  setFocusedFlagId(null);
                }}
              />
            )}
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3">
      <FileText className="h-8 w-8 text-muted-foreground/40" />
      <p className="text-sm font-medium text-muted-foreground">No document loaded</p>
    </div>
  );
}
