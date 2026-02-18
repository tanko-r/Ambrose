"use client";

import { useAppStore } from "@/lib/store";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SectionHierarchyItem } from "@/lib/types";

export function BreadcrumbBar() {
  const selectedParaId = useAppStore((s) => s.selectedParaId);
  const paragraphs = useAppStore((s) => s.paragraphs);
  const focusHistory = useAppStore((s) => s.focusHistory);
  const focusHistoryIndex = useAppStore((s) => s.focusHistoryIndex);
  const goBackInHistory = useAppStore((s) => s.goBackInHistory);
  const goForwardInHistory = useAppStore((s) => s.goForwardInHistory);
  const selectParagraph = useAppStore((s) => s.selectParagraph);

  if (!selectedParaId) return null;

  const selectedParagraph = paragraphs.find((p) => p.id === selectedParaId);
  if (!selectedParagraph) return null;

  // Back is disabled when we're at the earliest entry or have only one entry
  const currentPos =
    focusHistoryIndex === -1 ? focusHistory.length - 1 : focusHistoryIndex;
  const backDisabled = focusHistory.length <= 1 || currentPos <= 0;

  // Forward is disabled when focusHistoryIndex is -1 (already at head)
  const forwardDisabled = focusHistoryIndex === -1;

  const hierarchy: SectionHierarchyItem[] =
    selectedParagraph.section_hierarchy ?? [];

  const handleCrumbClick = (item: SectionHierarchyItem) => {
    // Find the first paragraph whose section_ref starts with this hierarchy item's number
    const target = paragraphs.find(
      (p) =>
        p.section_ref === item.number ||
        p.section_ref.startsWith(item.number + ".") ||
        p.section_ref.startsWith(item.number + " "),
    );
    if (target) {
      selectParagraph(target.id);
    }
  };

  // Determine if the paragraph's own section_ref differs from the last hierarchy crumb
  const lastHierarchyNumber =
    hierarchy.length > 0 ? hierarchy[hierarchy.length - 1].number : null;
  const showFinalCrumb =
    selectedParagraph.section_ref &&
    selectedParagraph.section_ref !== lastHierarchyNumber;

  return (
    <div className="no-print flex h-8 shrink-0 items-center gap-1 border-b bg-muted/40 px-3 text-xs text-muted-foreground">
      {/* Back button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        disabled={backDisabled}
        onClick={goBackInHistory}
        aria-label="Go back in clause history"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </Button>

      {/* Forward button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        disabled={forwardDisabled}
        onClick={goForwardInHistory}
        aria-label="Go forward in clause history"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </Button>

      {/* Separator */}
      <div className="mx-1 h-4 w-px bg-border" />

      {/* Breadcrumb hierarchy crumbs */}
      {hierarchy.map((item, idx) => (
        <span key={`${item.number}-${idx}`} className="flex items-center gap-1">
          {idx > 0 && (
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/60" />
          )}
          <button
            className="hover:text-foreground hover:underline transition-colors"
            onClick={() => handleCrumbClick(item)}
          >
            {item.number}
            {item.caption ? ` ${item.caption}` : ""}
          </button>
        </span>
      ))}

      {/* Final non-clickable crumb for the paragraph's own section_ref */}
      {showFinalCrumb && (
        <span className="flex items-center gap-1">
          {hierarchy.length > 0 && (
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/60" />
          )}
          <span className="font-medium text-foreground">
            {selectedParagraph.section_ref}
          </span>
        </span>
      )}
    </div>
  );
}
