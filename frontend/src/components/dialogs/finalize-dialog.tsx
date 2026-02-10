"use client";

import { useState, useEffect, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { useFinalize } from "@/hooks/use-finalize";
import type { FinalizePreviewResponse, FinalizeResponse } from "@/lib/types";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2,
  Flag,
  AlertTriangle,
  Loader2,
  FileDown,
} from "lucide-react";

interface FinalizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FinalizeDialog({ open, onOpenChange }: FinalizeDialogProps) {
  const { fetchPreview, doExport, download } = useFinalize();

  // Local state
  const [preview, setPreview] = useState<FinalizePreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [authorName, setAuthorName] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [exportResult, setExportResult] = useState<FinalizeResponse | null>(
    null
  );

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

  // Fetch preview on open
  useEffect(() => {
    if (!open) {
      setPreview(null);
      setExported(false);
      setExportResult(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    fetchPreview()
      .then((data) => {
        if (!controller.signal.aborted) setPreview(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, fetchPreview]);

  const handleExport = async () => {
    setExporting(true);
    const result = await doExport(authorName);
    setExporting(false);
    if (result) {
      setExported(true);
      setExportResult(result);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Finalize & Export</DialogTitle>
          <DialogDescription>
            Review your revisions and export Word documents.
          </DialogDescription>
        </DialogHeader>

        {/* Stats row */}
        <div className="flex gap-3">
          <div className="flex flex-1 items-center gap-2 rounded-md border p-3">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div>
              <div className="text-lg font-semibold tabular-nums">
                {acceptedCount}
              </div>
              <div className="text-xs text-muted-foreground">
                revisions accepted
              </div>
            </div>
          </div>
          <div className="flex flex-1 items-center gap-2 rounded-md border p-3">
            <Flag className="h-5 w-5 text-blue-600" />
            <div>
              <div className="text-lg font-semibold tabular-nums">
                {flagCount}
              </div>
              <div className="text-xs text-muted-foreground">
                items flagged
              </div>
            </div>
          </div>
          <div className="flex flex-1 items-center gap-2 rounded-md border p-3">
            {unreviewedCount > 0 ? (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            )}
            <div>
              <div className="text-lg font-semibold tabular-nums">
                {unreviewedCount > 0 ? unreviewedCount : ""}
              </div>
              <div className="text-xs text-muted-foreground">
                {unreviewedCount > 0
                  ? "clauses with risks not yet reviewed"
                  : "All risk clauses reviewed"}
              </div>
            </div>
          </div>
        </div>

        {/* Revision list */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              Loading preview...
            </span>
          </div>
        ) : preview && preview.revisions.length > 0 ? (
          <div className="max-h-64 overflow-y-auto rounded-md border">
            <Accordion type="multiple">
              {preview.revisions.map((rev, i) => (
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
                  <AccordionContent className="px-3">
                    <div
                      className="revision-diff text-xs"
                      dangerouslySetInnerHTML={{ __html: rev.diff_html }}
                    />
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <div>
                        <span className="font-medium">Original:</span>{" "}
                        {rev.original.slice(0, 120)}
                        {rev.original.length > 120 ? "..." : ""}
                      </div>
                      <div>
                        <span className="font-medium">Revised:</span>{" "}
                        {rev.revised.slice(0, 120)}
                        {rev.revised.length > 120 ? "..." : ""}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        ) : !loading && preview ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No accepted revisions to export.
          </p>
        ) : null}

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
              <Button
                onClick={handleExport}
                disabled={exporting || acceptedCount === 0}
              >
                {exporting && (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                )}
                Export Documents
              </Button>
            </>
          ) : (
            <div className="flex w-full flex-col gap-2">
              <div className="flex gap-2 sm:justify-end">
                <Button onClick={() => download("track_changes")}>
                  <FileDown className="mr-1.5 h-3.5 w-3.5" />
                  Download Redline (.docx)
                </Button>
                <Button
                  variant="outline"
                  onClick={() => download("clean")}
                >
                  <FileDown className="mr-1.5 h-3.5 w-3.5" />
                  Download Clean (.docx)
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
