"use client";

import { useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Columns2,
  FileDown,
  Mail,
  AlertTriangle,
  Pencil,
  Flag,
} from "lucide-react";
import { FinalizeDialog } from "@/components/dialogs/finalize-dialog";
import { TransmittalDialog } from "@/components/dialogs/transmittal-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

  const hasPrecedent = useAppStore((s) => s.hasPrecedent);
  const precedentPanelOpen = useAppStore((s) => s.precedentPanelOpen);
  const togglePrecedentPanel = useAppStore((s) => s.togglePrecedentPanel);

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

  // Filtered paragraphs based on active filters
  const filteredParaIds = useMemo(() => {
    if (!showRisks && !showRevisions && !showFlags) {
      // No filters active → show all risk paragraphs (default behavior)
      return riskParaIds;
    }

    const result = new Set<typeof riskParaIds[0]>();

    if (showRisks) {
      const riskIds = new Set(risks.map((r) => r.para_id));
      contentParas.filter((p) => riskIds.has(p.id)).forEach((p) => result.add(p));
    }

    if (showRevisions) {
      contentParas
        .filter((p) => revisions[p.id])
        .forEach((p) => result.add(p));
    }

    if (showFlags) {
      const flagIds = new Set(flags.map((f) => f.para_id));
      contentParas.filter((p) => flagIds.has(p.id)).forEach((p) => result.add(p));
    }

    return Array.from(result);
  }, [showRisks, showRevisions, showFlags, riskParaIds, contentParas, revisions, flags, risks]);

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

  // Navigate to prev/next paragraph with risks (using filtered list)
  const currentIndex = filteredParaIds.findIndex(
    (p) => p.id === selectedParaId
  );

  const goPrev = () => {
    if (filteredParaIds.length === 0) return;
    const idx = currentIndex <= 0 ? filteredParaIds.length - 1 : currentIndex - 1;
    selectParagraph(filteredParaIds[idx].id);
  };

  const goNext = () => {
    if (filteredParaIds.length === 0) return;
    const idx = currentIndex >= filteredParaIds.length - 1 ? 0 : currentIndex + 1;
    selectParagraph(filteredParaIds[idx].id);
  };

  // Hide bottom bar when revision sheet is open to avoid overlap
  if (bottomSheetOpen) return null;

  return (
    <>
    <TooltipProvider>
    <div role="toolbar" aria-label="Review toolbar" className={cn("no-print flex shrink-0 items-center justify-between border-t bg-muted/70", compactMode ? "h-9 px-3" : "h-11 px-4")}>
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
        <div className="flex items-center gap-2 max-w-[200px] flex-wrap">
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
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] font-medium text-muted-foreground">Filter:</span>
          <FilterPill
            active={showRisks}
            onClick={toggleShowRisks}
            icon={<AlertTriangle className={cn(compactMode ? "h-2.5 w-2.5" : "h-3 w-3")} />}
            label="Risks"
            tooltip="Filter to paragraphs with risks"
            compactMode={compactMode}
          />
          <FilterPill
            active={showRevisions}
            onClick={toggleShowRevisions}
            icon={<Pencil className={cn(compactMode ? "h-2.5 w-2.5" : "h-3 w-3")} />}
            label="Revisions"
            tooltip="Filter to paragraphs with revisions"
            compactMode={compactMode}
          />
          <FilterPill
            active={showFlags}
            onClick={toggleShowFlags}
            icon={<Flag className={cn(compactMode ? "h-2.5 w-2.5" : "h-3 w-3")} />}
            label="Flags"
            tooltip="Filter to flagged paragraphs"
            compactMode={compactMode}
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
          disabled={filteredParaIds.length === 0}
          aria-label="Previous risk"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[60px] text-center text-xs tabular-nums text-foreground">
          {filteredParaIds.length > 0
            ? `${currentIndex + 1} of ${filteredParaIds.length}`
            : "—"}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={goNext}
          disabled={filteredParaIds.length === 0}
          aria-label="Next risk"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Right: precedent + transmittal + finalize */}
      <div className="flex items-center gap-2">
        {hasPrecedent && (
          <Button
            variant={precedentPanelOpen ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={togglePrecedentPanel}
            aria-label="Toggle precedent panel"
          >
            <Columns2 className="mr-1.5 h-3.5 w-3.5" />
            {precedentPanelOpen ? "Hide Precedent" : "Show Precedent"}
          </Button>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={flags.length === 0}
                onClick={() => setTransmittalOpen(true)}
                aria-label="Generate transmittal email"
                title={flags.length === 0 ? "Flag at least one item to enable transmittal" : undefined}
              >
                <Mail className="mr-1.5 h-3.5 w-3.5" />
                Generate Transmittal
              </Button>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {flags.length === 0
              ? "Flag at least one item to enable transmittal"
              : "Generate client transmittal email"}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Button
                size="sm"
                className="h-7 text-xs"
                disabled={!hasAcceptedRevisions}
                onClick={() => setFinalizeOpen(true)}
                aria-label="Finalize redline document"
                title={!hasAcceptedRevisions ? "Accept at least one revision to enable export" : undefined}
              >
                <FileDown className="mr-1.5 h-3.5 w-3.5" />
                Finalize Redline
              </Button>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {!hasAcceptedRevisions
              ? "Accept at least one revision to enable export"
              : "Export redline Word document with track changes"}
          </TooltipContent>
        </Tooltip>
      </div>

    </div>
    </TooltipProvider>
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
  tooltip,
  compactMode,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  tooltip: string;
  compactMode?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "flex items-center gap-1 rounded-full border transition-colors",
            compactMode ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
            active
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
          aria-pressed={active}
          aria-label={`${active ? "Hide" : "Show"} ${label.toLowerCase()}`}
          aria-description={tooltip}
        >
          {icon}
          {label}
        </button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
