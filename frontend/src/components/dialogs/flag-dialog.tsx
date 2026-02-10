"use client";

import { useState, useEffect } from "react";
import { useFlags } from "@/hooks/use-flags";
import type { FlagCategory } from "@/lib/types";
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
// Category color mapping for the selector buttons
// ---------------------------------------------------------------------------

const CATEGORY_DOT_COLORS: Record<FlagCategory, string> = {
  "business-decision": "bg-blue-500",
  "risk-alert": "bg-orange-500",
  "for-discussion": "bg-purple-500",
  fyi: "bg-gray-500",
};

const CATEGORY_SELECTED_BORDER: Record<FlagCategory, string> = {
  "business-decision": "border-blue-500 bg-blue-50",
  "risk-alert": "border-orange-500 bg-orange-50",
  "for-discussion": "border-purple-500 bg-purple-50",
  fyi: "border-gray-500 bg-gray-50",
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
}

// ---------------------------------------------------------------------------
// FlagDialog - Category picker + note input for flagging a paragraph
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
}: FlagDialogProps) {
  const { create } = useFlags();

  const [category, setCategory] = useState<FlagCategory>(
    defaultCategory ?? "for-discussion"
  );
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setCategory(defaultCategory ?? "for-discussion");
      setNote("");
      setSaving(false);
    }
  }, [open, defaultCategory]);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await create(paraId, category, note);
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

        {/* Category selector: 2x2 grid */}
        <div className="grid grid-cols-2 gap-2">
          {ALL_CATEGORIES.map((cat) => {
            const isSelected = category === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`flex items-center gap-2 rounded-md border-2 px-3 py-2.5 text-left text-sm transition-colors ${
                  isSelected
                    ? CATEGORY_SELECTED_BORDER[cat]
                    : "border-border hover:border-muted-foreground/30 hover:bg-accent/50"
                }`}
              >
                <span
                  className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${CATEGORY_DOT_COLORS[cat]}`}
                />
                <span className="font-medium">
                  {FLAG_CATEGORY_LABELS[cat]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Note input */}
        <Textarea
          placeholder="Add a note for the client (optional)..."
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
