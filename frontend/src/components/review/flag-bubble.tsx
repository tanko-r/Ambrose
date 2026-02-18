"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useFlags } from "@/hooks/use-flags";
import type { FlagCategory, FlagType, Flag } from "@/lib/types";
import { FLAG_CATEGORY_LABELS } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, X, Trash2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Category pill colors (compact version)
// ---------------------------------------------------------------------------

const CATEGORY_PILL_CLASSES: Record<
  FlagCategory,
  { active: string; inactive: string }
> = {
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

const ALL_CATEGORIES: FlagCategory[] = [
  "business-decision",
  "risk-alert",
  "for-discussion",
  "fyi",
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FlagBubbleProps {
  paraId: string;
  textExcerpt: string;
  /** Viewport coordinates: top of selection, right edge of document panel */
  anchorRect: { top: number; right: number };
  onClose: () => void;
  initialFlag?: Flag;
}

// ---------------------------------------------------------------------------
// FlagBubble — Word-style comment bubble positioned to the right of selection
// ---------------------------------------------------------------------------

export function FlagBubble({
  paraId,
  textExcerpt,
  anchorRect,
  onClose,
  initialFlag,
}: FlagBubbleProps) {
  const { create, update, remove } = useFlags();
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  const [flagType, setFlagType] = useState<FlagType>(initialFlag?.flag_type ?? "client");
  const [category, setCategory] = useState<FlagCategory>(initialFlag?.category ?? "for-discussion");
  const [note, setNote] = useState(initialFlag?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [localFlagId, setLocalFlagId] = useState<string | null>(initialFlag?.id ?? null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // SSR guard — only render portal after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-save logic
  useEffect(() => {
    if (!mounted) return;

    // Don't auto-save if values haven't changed from initial/local
    // (This check needs to be careful about new flags)
    const isNew = !localFlagId;
    
    if (!isNew && initialFlag && note === initialFlag.note && category === initialFlag.category && flagType === initialFlag.flag_type) {
        return;
    }

    // Don't auto-save if note is empty for a NEW flag
    if (isNew && !note.trim()) {
        return;
    }

    const timer = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        if (localFlagId) {
          await update(localFlagId, {
            note,
            category: flagType === "client" ? category : undefined,
            flagType,
          });
        } else {
          const newFlag = await create(
            paraId,
            flagType,
            flagType === "client" ? category : undefined,
            note,
            textExcerpt
          );
          if (newFlag) {
            setLocalFlagId(newFlag.id);
          }
        }
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (err) {
        setSaveStatus('error');
      }
    }, 1000); // 1s debounce for auto-save

    return () => clearTimeout(timer);
  }, [note, category, flagType, localFlagId, initialFlag, mounted, update, create, paraId, textExcerpt]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [onClose]);

  // Close on click outside (delayed to avoid catching the Flag button click)
  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (
        bubbleRef.current &&
        !bubbleRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener("pointerdown", handlePointerDown);
    }, 80);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [onClose]);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      if (localFlagId) {
        await update(localFlagId, {
          note,
          category: flagType === "client" ? category : undefined,
          flagType,
        });
      } else {
        await create(
          paraId,
          flagType,
          flagType === "client" ? category : undefined,
          note,
          textExcerpt
        );
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  // Position: anchored to right edge of document panel, at selection height.
  // Clamp vertically so the bubble stays within the viewport.
  const bubbleHeight = 280; // approximate max height
  const top = Math.max(
    8,
    Math.min(anchorRect.top, window.innerHeight - bubbleHeight - 8)
  );
  const left = anchorRect.right + 16;

  // If the bubble would overflow the right edge of the viewport, flip to left
  const bubbleWidth = 280;
  const flipped = left + bubbleWidth > window.innerWidth - 8;
  const finalLeft = flipped
    ? anchorRect.right - bubbleWidth - 16
    : left;

  return createPortal(
    <div
      ref={bubbleRef}
      role="dialog"
      aria-label="Flag for review"
      style={{
        position: "fixed",
        top,
        left: finalLeft,
        zIndex: 9999,
      }}
      className="w-[280px] rounded-lg border bg-card shadow-xl animate-in fade-in slide-in-from-left-2 duration-150"
      onMouseDown={(e) => {
        // Prevent focus theft — clicking bubble chrome (buttons, pills, header)
        // should not steal focus from the document, preserving the browser
        // text selection highlight. The textarea handles its own focus.
        if ((e.target as HTMLElement).tagName !== "TEXTAREA") {
          e.preventDefault();
        }
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">
            {localFlagId ? "Flag Detail" : "Flag for Review"}
            </span>
            {saveStatus !== 'idle' && (
                <span className="text-[10px] text-muted-foreground animate-pulse">
                    {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Error saving'}
                </span>
            )}
        </div>
        <div className="flex items-center gap-1">
            {localFlagId && (
                <button
                    onClick={() => {
                        remove(localFlagId);
                        onClose();
                    }}
                    className="rounded-sm p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Remove flag"
                    title="Remove flag"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
            )}
            <button
            onClick={onClose}
            className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="Close"
            >
            <X className="h-3.5 w-3.5" />
            </button>
        </div>
      </div>

      <div className="space-y-2.5 px-3 py-2.5">
        {/* Flag type toggle: Attorney / Client */}
        <div className="flex rounded-md border bg-secondary/50 p-0.5">
          <button
            type="button"
            onClick={() => setFlagType("attorney")}
            className={`flex-1 rounded px-2 py-1 text-[11px] font-semibold transition-colors ${
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
            className={`flex-1 rounded px-2 py-1 text-[11px] font-semibold transition-colors ${
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
          <div className="flex flex-wrap gap-1">
            {ALL_CATEGORIES.map((cat) => {
              const isSelected = category === cat;
              const classes = CATEGORY_PILL_CLASSES[cat];
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                    isSelected
                      ? classes.active
                      : `border-transparent ${classes.inactive}`
                  }`}
                >
                  {FLAG_CATEGORY_LABELS[cat]}
                </button>
              );
            })}
          </div>
        )}

        {/* Note */}
        <Textarea
          placeholder={
            flagType === "attorney"
              ? "Add a note..."
              : "Note for client..."
          }
          rows={2}
          className="text-xs resize-none"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {/* Actions */}
        <div className="flex justify-end gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={saving}
            className="h-7 px-2 text-xs"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={saving}
            className="h-7 px-3 text-xs"
          >
            {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            {localFlagId ? "Update" : "Save"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
