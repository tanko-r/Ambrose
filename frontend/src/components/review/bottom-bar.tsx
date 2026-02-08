"use client";

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  FileDown,
} from "lucide-react";

export function BottomBar() {
  const {
    paragraphs,
    risks,
    revisions,
    selectedParaId,
    selectParagraph,
    bottomSheetOpen,
  } = useAppStore();

  // Hide bottom bar when revision sheet is open to avoid overlap
  if (bottomSheetOpen) return null;

  // Content paragraphs only
  const contentParas = useMemo(
    () => paragraphs.filter((p) => p.type === "paragraph"),
    [paragraphs]
  );

  // Paragraphs that have risks
  const riskParaIds = useMemo(() => {
    const ids = new Set(risks.map((r) => r.para_id));
    return contentParas.filter((p) => ids.has(p.id));
  }, [contentParas, risks]);

  // Review progress
  const reviewedCount = riskParaIds.filter(
    (p) => revisions[p.id]?.accepted === true
  ).length;

  // Risk severity counts
  const severityCounts = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const risk of risks) {
      if (risk.severity in counts) {
        counts[risk.severity as keyof typeof counts]++;
      }
    }
    return counts;
  }, [risks]);

  // Navigate to prev/next paragraph with risks
  const currentIndex = riskParaIds.findIndex(
    (p) => p.id === selectedParaId
  );

  const goPrev = () => {
    if (riskParaIds.length === 0) return;
    const idx = currentIndex <= 0 ? riskParaIds.length - 1 : currentIndex - 1;
    selectParagraph(riskParaIds[idx].id);
  };

  const goNext = () => {
    if (riskParaIds.length === 0) return;
    const idx = currentIndex >= riskParaIds.length - 1 ? 0 : currentIndex + 1;
    selectParagraph(riskParaIds[idx].id);
  };

  return (
    <div className="flex h-11 shrink-0 items-center justify-between border-t bg-card px-4">
      {/* Left: progress */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>
          Reviewed{" "}
          <span className="font-semibold tabular-nums text-foreground">
            {reviewedCount}
          </span>
          /
          <span className="tabular-nums">{riskParaIds.length}</span>
        </span>

        {/* Severity summary pills */}
        <div className="flex items-center gap-2">
          {severityCounts.critical > 0 && (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-severity-critical" />
              <span className="tabular-nums">{severityCounts.critical}</span>
            </span>
          )}
          {severityCounts.high > 0 && (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-severity-high" />
              <span className="tabular-nums">{severityCounts.high}</span>
            </span>
          )}
          {severityCounts.medium > 0 && (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-severity-medium" />
              <span className="tabular-nums">{severityCounts.medium}</span>
            </span>
          )}
          {severityCounts.low > 0 && (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-severity-low" />
              <span className="tabular-nums">{severityCounts.low}</span>
            </span>
          )}
        </div>
      </div>

      {/* Center: prev/next navigation */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={goPrev}
          disabled={riskParaIds.length === 0}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[60px] text-center text-xs tabular-nums text-muted-foreground">
          {riskParaIds.length > 0
            ? `${currentIndex + 1} of ${riskParaIds.length}`
            : "—"}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={goNext}
          disabled={riskParaIds.length === 0}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Right: finalize */}
      <Button size="sm" className="h-7 text-xs" disabled>
        <FileDown className="mr-1.5 h-3.5 w-3.5" />
        Finalize Redline
      </Button>
    </div>
  );
}
