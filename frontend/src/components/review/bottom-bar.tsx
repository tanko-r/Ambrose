"use client";

import { useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  FileDown,
  Mail,
  AlertTriangle,
  Pencil,
  Flag,
} from "lucide-react";
import { FinalizeDialog } from "@/components/dialogs/finalize-dialog";
import { TransmittalDialog } from "@/components/dialogs/transmittal-dialog";

export function BottomBar() {
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [transmittalOpen, setTransmittalOpen] = useState(false);
  const {
    paragraphs,
    risks,
    revisions,
    flags,
    selectedParaId,
    selectParagraph,
    bottomSheetOpen,
    compactMode,
    showRisks,
    showRevisions,
    showFlags,
    toggleShowRisks,
    toggleShowRevisions,
    toggleShowFlags,
  } = useAppStore();

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

  const hasAcceptedRevisions = Object.values(revisions).some(
    (r) => r.accepted
  );

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

  // Hide bottom bar when revision sheet is open to avoid overlap
  if (bottomSheetOpen) return null;

  return (
    <>
    <div role="toolbar" aria-label="Review toolbar" className={cn("no-print flex shrink-0 items-center justify-between border-t bg-card", compactMode ? "h-9 px-3" : "h-11 px-4")}>
      {/* Left: progress + filter pills */}
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
            <span className="flex items-center gap-1" aria-label={`${severityCounts.critical} critical risks`}>
              <span className="h-2 w-2 rounded-full bg-severity-critical" aria-hidden="true" />
              <span className="tabular-nums">{severityCounts.critical}</span>
            </span>
          )}
          {severityCounts.high > 0 && (
            <span className="flex items-center gap-1" aria-label={`${severityCounts.high} high risks`}>
              <span className="h-2 w-2 rounded-full bg-severity-high" aria-hidden="true" />
              <span className="tabular-nums">{severityCounts.high}</span>
            </span>
          )}
          {severityCounts.medium > 0 && (
            <span className="flex items-center gap-1" aria-label={`${severityCounts.medium} medium risks`}>
              <span className="h-2 w-2 rounded-full bg-severity-medium" aria-hidden="true" />
              <span className="tabular-nums">{severityCounts.medium}</span>
            </span>
          )}
          {severityCounts.low > 0 && (
            <span className="flex items-center gap-1" aria-label={`${severityCounts.low} low risks`}>
              <span className="h-2 w-2 rounded-full bg-severity-low" aria-hidden="true" />
              <span className="tabular-nums">{severityCounts.low}</span>
            </span>
          )}
        </div>

        {/* Filter toggle pills */}
        <div className="flex items-center gap-1">
          <FilterPill
            active={showRisks}
            onClick={toggleShowRisks}
            icon={<AlertTriangle className="h-3 w-3" />}
            label="Risks"
          />
          <FilterPill
            active={showRevisions}
            onClick={toggleShowRevisions}
            icon={<Pencil className="h-3 w-3" />}
            label="Revisions"
          />
          <FilterPill
            active={showFlags}
            onClick={toggleShowFlags}
            icon={<Flag className="h-3 w-3" />}
            label="Flags"
          />
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
          aria-label="Previous risk"
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
          aria-label="Next risk"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Right: transmittal + finalize */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={flags.length === 0}
          onClick={() => setTransmittalOpen(true)}
          aria-label="Generate transmittal email"
        >
          <Mail className="mr-1.5 h-3.5 w-3.5" />
          Generate Transmittal
        </Button>
        <Button
          size="sm"
          className="h-7 text-xs"
          disabled={!hasAcceptedRevisions}
          onClick={() => setFinalizeOpen(true)}
          aria-label="Finalize redline document"
        >
          <FileDown className="mr-1.5 h-3.5 w-3.5" />
          Finalize Redline
        </Button>
      </div>

    </div>
    <TransmittalDialog open={transmittalOpen} onOpenChange={setTransmittalOpen} />
    <FinalizeDialog open={finalizeOpen} onOpenChange={setFinalizeOpen} />
    </>
  );
}

// ---------------------------------------------------------------------------
// FilterPill - toggle button for navigator content filters
// ---------------------------------------------------------------------------

function FilterPill({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
      aria-pressed={active}
      aria-label={`${active ? "Hide" : "Show"} ${label.toLowerCase()}`}
    >
      {icon}
      {label}
    </button>
  );
}
