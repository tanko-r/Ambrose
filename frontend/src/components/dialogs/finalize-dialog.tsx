"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { useFinalize } from "@/hooks/use-finalize";
import type { FinalizeResponse } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2,
  Flag,
  AlertTriangle,
  Loader2,
  FileDown,
  ChevronDown,
} from "lucide-react";

type ExportType = "both" | "track_changes" | "clean";

interface FinalizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FinalizeDialog({ open, onOpenChange }: FinalizeDialogProps) {
  const { doExport, download } = useFinalize();

  // Local state
  // TODO: Move author name to user settings/preferences page
  const [authorName, setAuthorName] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("ambrose-author-name") ?? "";
  });
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [exportResult, setExportResult] = useState<FinalizeResponse | null>(
    null
  );
  const [exportType, setExportType] = useState<ExportType>("both");

  // Persist author name to localStorage
  useEffect(() => {
    if (authorName) {
      localStorage.setItem("ambrose-author-name", authorName);
    }
  }, [authorName]);

  // Compute stats from store
  const revisions = useAppStore((s) => s.revisions);
  const flags = useAppStore((s) => s.flags);
  const risks = useAppStore((s) => s.risks);

  const acceptedCount = useMemo(
    () => Object.values(revisions).filter((r) => r.accepted).length,
    [revisions]
  );

  const flagCount = flags.length;

  const unreviewedCount = useMemo(() => {
    const totalRiskParaIds = new Set(risks.map((r) => r.para_id));
    const reviewedParaIds = new Set(Object.keys(revisions));
    let count = 0;
    for (const paraId of totalRiskParaIds) {
      if (!reviewedParaIds.has(paraId)) count++;
    }
    return count;
  }, [risks, revisions]);

  // Build approved revisions list from store (single source of truth)
  const approvedRevisions = useMemo(() => {
    const sessionParagraphs = useAppStore.getState().paragraphs;
    return Object.entries(revisions)
      .filter(([, r]) => r.accepted)
      .map(([paraId, r]) => {
        const para = sessionParagraphs.find((p) => p.id === paraId);
        return {
          para_id: paraId,
          section_ref: para?.section_ref ?? paraId,
          rationale: r.rationale,
          diff_html: r.editedHtml || r.diff_html,
        };
      });
  }, [revisions]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setExported(false);
      setExportResult(null);
      setExportType("both");
    }
  }, [open]);

  // Auto-download after export completes
  useEffect(() => {
    if (!exported || !exportType) return;
    if (exportType === "both") {
      download("track_changes");
      // Small delay to avoid browser blocking second download
      setTimeout(() => download("clean"), 500);
    } else {
      download(exportType);
    }
  }, [exported, exportType, download]);

  const handleExport = useCallback(
    async (type: ExportType) => {
      setExporting(true);
      const result = await doExport(authorName);
      setExporting(false);
      if (result) {
        setExported(true);
        setExportResult(result);
        setExportType(type);
      }
    },
    [authorName, doExport]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Finalize & Export</DialogTitle>
          <DialogDescription>
            Review your approved revisions and export Word documents.
          </DialogDescription>
        </DialogHeader>

        {/* Stats row */}
        <div className="flex gap-3">
          {/* Approved revisions */}
          <div className="flex-1 rounded-md border p-3 text-center">
            <CheckCircle2 className="mx-auto mb-1 h-5 w-5 text-green-600" />
            <div className="text-2xl font-semibold tabular-nums">
              {acceptedCount}
            </div>
            <div className="text-[11px] text-muted-foreground">
              revisions approved
            </div>
          </div>

          {/* Flags */}
          <div className="flex-1 rounded-md border p-3 text-center">
            <Flag className="mx-auto mb-1 h-5 w-5 text-blue-600" />
            <div className="text-2xl font-semibold tabular-nums">
              {flagCount}
            </div>
            <div className="text-[11px] text-muted-foreground">
              items flagged
            </div>
          </div>

          {/* Unreviewed */}
          <div className="flex-1 rounded-md border p-3 text-center">
            {unreviewedCount > 0 ? (
              <AlertTriangle className="mx-auto mb-1 h-5 w-5 text-amber-500" />
            ) : (
              <CheckCircle2 className="mx-auto mb-1 h-5 w-5 text-green-600" />
            )}
            <div className="text-2xl font-semibold tabular-nums">
              {unreviewedCount > 0 ? unreviewedCount : 0}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {unreviewedCount > 0
                ? "risks not yet reviewed"
                : "all risks reviewed"}
            </div>
          </div>
        </div>

        {/* Revision list — sourced from store */}
        {approvedRevisions.length > 0 ? (
          <div className="max-h-64 overflow-y-auto rounded-md border">
            <Accordion type="multiple">
              {approvedRevisions.map((rev, i) => (
                <AccordionItem key={rev.para_id} value={`rev-${i}`}>
                  <AccordionTrigger className="px-3 py-2 text-xs">
                    <span className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {rev.section_ref}
                      </Badge>
                      <span className="line-clamp-1 text-left">
                        {rev.rationale.slice(0, 80)}
                        {rev.rationale.length > 80 ? "..." : ""}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-3 pb-3">
                    <div
                      className="revision-diff text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: rev.diff_html }}
                    />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No approved revisions to export.
          </p>
        )}

        {/* Author name input */}
        <div className="space-y-1.5">
          <label
            htmlFor="author-name"
            className="text-sm font-medium leading-none"
          >
            Track Changes Author
          </label>
          <Input
            id="author-name"
            placeholder="e.g., David Smith"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            This name appears as the revision author in Word.
          </p>
        </div>

        {/* Footer */}
        <DialogFooter>
          {!exported ? (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={exporting}
              >
                Cancel
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button disabled={exporting || acceptedCount === 0}>
                    {exporting && (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    )}
                    Export
                    <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport("both")}>
                    Export Both (Redline + Clean)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleExport("track_changes")}
                  >
                    Export Redline Only
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("clean")}>
                    Export Clean Only
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="flex w-full flex-col gap-2">
              <p className="text-sm text-green-700">
                Export complete. Downloads started.
              </p>
              <div className="flex gap-2 sm:justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => download("track_changes")}
                >
                  <FileDown className="mr-1.5 h-3.5 w-3.5" />
                  Re-download Redline
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => download("clean")}
                >
                  <FileDown className="mr-1.5 h-3.5 w-3.5" />
                  Re-download Clean
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Session remains open. You can continue reviewing and
                  re-export.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
