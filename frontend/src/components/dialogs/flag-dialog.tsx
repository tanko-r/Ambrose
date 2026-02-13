"use client";

import { useState, useEffect } from "react";
import { useFlags } from "@/hooks/use-flags";
import type { FlagCategory, FlagType } from "@/lib/types";
import { FLAG_CATEGORY_LABELS } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Category pill colors
// ---------------------------------------------------------------------------

const CATEGORY_PILL_CLASSES: Record<FlagCategory, { active: string; inactive: string }> = {
  "business-decision": {
    active: "bg-blue-100 text-blue-800 border-blue-300",
    inactive: "text-muted-foreground hover:bg-accent",
  },
  "risk-alert": {
    active: "bg-orange-100 text-orange-800 border-orange-300",
    inactive: "text-muted-foreground hover:bg-accent",
  },
  "for-discussion": {
    active: "bg-purple-100 text-purple-800 border-purple-300",
    inactive: "text-muted-foreground hover:bg-accent",
  },
  fyi: {
    active: "bg-gray-100 text-gray-800 border-gray-300",
    inactive: "text-muted-foreground hover:bg-accent",
  },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FlagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paraId: string;
  sectionRef?: string;
  defaultCategory?: FlagCategory;
  defaultNote?: string;
  defaultFlagType?: FlagType;
}

// ---------------------------------------------------------------------------
// FlagDialog - Type toggle (Attorney/Client) + category pills + note
// ---------------------------------------------------------------------------

const ALL_CATEGORIES: FlagCategory[] = [
  "business-decision",
  "risk-alert",
  "for-discussion",
  "fyi",
];

export function FlagDialog({
  open,
  onOpenChange,
  paraId,
  sectionRef,
  defaultCategory,
  defaultNote,
  defaultFlagType,
}: FlagDialogProps) {
  const { create } = useFlags();

  const [flagType, setFlagType] = useState<FlagType>(defaultFlagType ?? "client");
  const [category, setCategory] = useState<FlagCategory>(
    defaultCategory ?? "for-discussion"
  );
  const [note, setNote] = useState(defaultNote ?? "");
  const [saving, setSaving] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setFlagType(defaultFlagType ?? "client");
      setCategory(defaultCategory ?? "for-discussion");
      setNote(defaultNote ?? "");
      setSaving(false);
    }
  }, [open, defaultCategory, defaultNote, defaultFlagType]);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await create(
        paraId,
        flagType,
        flagType === "client" ? category : undefined,
        note
      );
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Flag for Review</DialogTitle>
          {sectionRef && (
            <DialogDescription>Section: {sectionRef}</DialogDescription>
          )}
        </DialogHeader>

        {/* Flag type toggle: Attorney / Client */}
        <div className="flex rounded-lg border bg-secondary/50 p-0.5">
          <button
            type="button"
            onClick={() => setFlagType("attorney")}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              flagType === "attorney"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Attorney
          </button>
          <button
            type="button"
            onClick={() => setFlagType("client")}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              flagType === "client"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Client
          </button>
        </div>

        {/* Category pills — only for client flags */}
        {flagType === "client" && (
          <div className="flex gap-1">
            {ALL_CATEGORIES.map((cat) => {
              const isSelected = category === cat;
              const classes = CATEGORY_PILL_CLASSES[cat];
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
                    isSelected ? classes.active : `border-transparent ${classes.inactive}`
                  }`}
                >
                  {FLAG_CATEGORY_LABELS[cat]}
                </button>
              );
            })}
          </div>
        )}

        {/* Note input */}
        <Textarea
          placeholder={
            flagType === "attorney"
              ? "Add a note (optional)..."
              : "Add a note for the client (optional)..."
          }
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Add Flag
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
