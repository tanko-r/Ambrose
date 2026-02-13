"use client";

// =============================================================================
// RevisionActions — Approve/Reject/Reset/Reopen button bar for revisions
// =============================================================================

import { Check, X, RotateCcw, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RevisionActionsProps {
  paraId: string;
  accepted: boolean;
  isModified: boolean;
  onAccept: () => void;
  onReject: () => void;
  onReset: () => void;
  onReopen: () => void;
}

export function RevisionActions({
  accepted,
  isModified,
  onAccept,
  onReject,
  onReset,
  onReopen,
}: RevisionActionsProps) {
  if (accepted) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
          <Check className="size-4" />
          Approved
        </span>
        <Button variant="secondary" size="sm" onClick={onReopen} aria-label="Reopen revision for editing">
          <RotateCw className="size-3.5" />
          Reopen
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="default" size="sm" onClick={onAccept} aria-label="Approve revision">
        <Check className="size-3.5" />
        Approve
      </Button>
      {isModified && (
        <Button variant="outline" size="sm" onClick={onReset} aria-label="Reset revision edits">
          <RotateCcw className="size-3.5" />
          Reset
        </Button>
      )}
      <Button variant="destructive" size="sm" onClick={onReject} aria-label="Reject revision">
        <X className="size-3.5" />
        Reject
      </Button>
    </div>
  );
}
