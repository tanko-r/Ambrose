"use client";

import { useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";
import { useFlags } from "@/hooks/use-flags";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FlagDialog } from "@/components/dialogs/flag-dialog";
import { Flag as FlagIcon, Pencil, Plus, X, ChevronDown, ChevronUp } from "lucide-react";
import { FLAG_CATEGORY_LABELS } from "@/lib/types";
import type { Flag } from "@/lib/types";

// ---------------------------------------------------------------------------
// Category badge color classes
// ---------------------------------------------------------------------------

const CATEGORY_BADGE_CLASSES: Record<string, string> = {
  "business-decision": "border-blue-300 text-blue-700 bg-blue-50",
  "risk-alert": "border-orange-300 text-orange-700 bg-orange-50",
  "for-discussion": "border-purple-300 text-purple-700 bg-purple-50",
  fyi: "border-gray-300 text-gray-700 bg-gray-50",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FlagsTabProps {
  paraId: string | null;
}

// ---------------------------------------------------------------------------
// FlagCard - renders a single flag entry
// ---------------------------------------------------------------------------

function FlagCard({
  flag,
  onRemove,
  onEdit,
  onClickSection,
}: {
  flag: Flag;
  onRemove: (paraId: string) => void;
  onEdit?: (flag: Flag) => void;
  onClickSection?: (paraId: string) => void;
}) {
  const isAttorney = flag.flag_type === "attorney";
  const categoryLabel = isAttorney
    ? "Attorney"
    : flag.category
      ? (FLAG_CATEGORY_LABELS[flag.category] ?? flag.category)
      : "Flag";
  const badgeClasses = isAttorney
    ? "border-gray-300 text-gray-600 bg-gray-50"
    : (flag.category ? CATEGORY_BADGE_CLASSES[flag.category] : null) ??
      "border-gray-300 text-gray-700 bg-gray-50";

  return (
    <div
      className="group relative cursor-pointer rounded-lg border p-3 transition-colors hover:bg-accent/30"
      onClick={() => onClickSection?.(flag.para_id)}
    >
      {/* Top row: section_ref + category + timestamp */}
      <div className="mb-1.5 flex items-center gap-1.5 pr-12">
        {flag.section_ref && (
          <Badge
            variant="secondary"
            className="cursor-pointer text-[10px] hover:bg-secondary/80"
            onClick={(e) => {
              e.stopPropagation();
              onClickSection?.(flag.para_id);
            }}
          >
            {flag.section_ref}
          </Badge>
        )}
        <Badge variant="outline" className={`text-[10px] ${badgeClasses}`}>
          {categoryLabel}
        </Badge>
        {/* TODO: Add locale preference to user settings (currently uses browser locale) */}
        {flag.timestamp && (
          <span className="ml-auto text-[10px] text-muted-foreground">
            {new Date(flag.timestamp).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Note */}
      {flag.note && (
        <p className="text-xs leading-relaxed text-foreground/80">
          {flag.note}
        </p>
      )}

      {/* Action buttons (top right) */}
      <div className="absolute right-2 top-2 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit?.(flag);
          }}
          className="rounded p-0.5 text-muted-foreground/50 hover:bg-accent hover:text-foreground"
          title="Edit flag"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(flag.para_id);
          }}
          className="rounded p-0.5 text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive"
          title="Remove flag"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FlagsTab - full flags listing with create button and management
// ---------------------------------------------------------------------------

export function FlagsTab({ paraId }: FlagsTabProps) {
  const flags = useAppStore((s) => s.flags);
  const selectParagraph = useAppStore((s) => s.selectParagraph);
  const { remove } = useFlags();

  const [flagDialogOpen, setFlagDialogOpen] = useState(false);
  const [allFlagsExpanded, setAllFlagsExpanded] = useState(true);
  const [editingFlag, setEditingFlag] = useState<Flag | null>(null);

  // Split flags into current paragraph and all others
  const { paraFlags, otherFlags } = useMemo(() => {
    const pf: Flag[] = [];
    const of: Flag[] = [];
    for (const f of flags) {
      if (f.para_id === paraId) {
        pf.push(f);
      } else {
        of.push(f);
      }
    }
    return { paraFlags: pf, otherFlags: of };
  }, [flags, paraId]);

  const handleRemove = (flagParaId: string) => {
    remove(flagParaId);
  };

  const handleClickSection = (flagParaId: string) => {
    selectParagraph(flagParaId);
    // Scroll to the element in the document
    const el = document.querySelector(`[data-para-id="${flagParaId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const handleEdit = (flag: Flag) => {
    setEditingFlag(flag);
    setFlagDialogOpen(true);
  };

  // ---- No paragraph selected: show ALL flags ----
  if (!paraId) {
    if (flags.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FlagIcon className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No flags yet.</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Select a clause and use the Flag button to mark it for review.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-2 p-1">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            All Flags ({flags.length})
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled
            className="h-7 text-xs"
            title="Select a paragraph to add a flag"
          >
            <Plus className="mr-1 h-3 w-3" />
            Add Flag
          </Button>
        </div>
        {flags.map((flag, idx) => (
          <FlagCard
            key={`${flag.para_id}-${flag.flag_type}-${idx}`}
            flag={flag}
            onRemove={handleRemove}
            onEdit={handleEdit}
            onClickSection={handleClickSection}
          />
        ))}

        {/* Shared flag dialog for editing */}
        {editingFlag && (
          <FlagDialog
            open={flagDialogOpen}
            onOpenChange={(open) => {
              setFlagDialogOpen(open);
              if (!open) setEditingFlag(null);
            }}
            paraId={editingFlag.para_id}
            defaultCategory={editingFlag.category}
            defaultNote={editingFlag.note}
          />
        )}
      </div>
    );
  }

  // ---- Paragraph selected ----
  return (
    <div className="space-y-2 p-1">
      {/* Add Flag button */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Flags
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => {
            setEditingFlag(null);
            setFlagDialogOpen(true);
          }}
        >
          <Plus className="mr-1 h-3 w-3" />
          Add Flag
        </Button>
      </div>

      {/* Flags on selected paragraph */}
      {paraFlags.length > 0 ? (
        paraFlags.map((flag, idx) => (
          <FlagCard
            key={`${flag.para_id}-${flag.flag_type}-${idx}`}
            flag={flag}
            onRemove={handleRemove}
            onEdit={handleEdit}
            onClickSection={handleClickSection}
          />
        ))
      ) : (
        <div className="rounded-lg border border-dashed p-4 text-center">
          <FlagIcon className="mx-auto mb-2 h-6 w-6 text-muted-foreground/30" />
          <p className="text-xs text-muted-foreground">
            No flags on this clause.
          </p>
        </div>
      )}

      {/* All other flags */}
      {otherFlags.length > 0 && (
        <>
          <div className="my-3 border-t" />
          <button
            onClick={() => setAllFlagsExpanded(!allFlagsExpanded)}
            className="flex w-full items-center justify-between rounded px-1 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <span>All Flags ({flags.length})</span>
            {allFlagsExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
          {allFlagsExpanded &&
            otherFlags.map((flag, idx) => (
              <FlagCard
                key={`other-${flag.para_id}-${flag.flag_type}-${idx}`}
                flag={flag}
                onRemove={handleRemove}
                onEdit={handleEdit}
                onClickSection={handleClickSection}
              />
            ))}
        </>
      )}

      {/* Flag dialog -- handles both create (new flag) and edit (existing flag) */}
      <FlagDialog
        open={flagDialogOpen}
        onOpenChange={(open) => {
          setFlagDialogOpen(open);
          if (!open) setEditingFlag(null);
        }}
        paraId={editingFlag?.para_id ?? paraId}
        defaultCategory={editingFlag?.category}
        defaultNote={editingFlag?.note}
      />
    </div>
  );
}
