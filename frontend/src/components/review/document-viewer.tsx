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
