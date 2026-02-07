"use client";

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Flag } from "lucide-react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FlagsTabProps {
  paraId: string | null;
}

// ---------------------------------------------------------------------------
// FlagsTab - shows flags on the selected paragraph
// ---------------------------------------------------------------------------

export function FlagsTab({ paraId }: FlagsTabProps) {
  const flags = useAppStore((s) => s.flags);

  const paraFlags = useMemo(
    () => flags.filter((f) => f.para_id === paraId),
    [flags, paraId]
  );

  // No paragraph selected
  if (!paraId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Select a clause to see flags.
        </p>
      </div>
    );
  }

  // No flags on this paragraph
  if (paraFlags.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Flag className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          No flags on this clause.
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Use the Flag button to mark clauses for client or attorney review.
        </p>
        <p className="mt-3 text-[10px] text-muted-foreground/50">
          Full flagging UI available in Phase 6.
        </p>
      </div>
    );
  }

  // Render existing flags
  return (
    <div className="space-y-2">
      {paraFlags.map((flag, idx) => (
        <div key={`${flag.para_id}-${flag.flag_type}-${idx}`} className="rounded-lg border p-3">
          <div className="mb-1 flex items-center gap-2">
            <Badge
              variant="outline"
              className={
                flag.flag_type === "client"
                  ? "border-blue-300 text-blue-700 text-[10px]"
                  : "border-amber-300 text-amber-700 text-[10px]"
              }
            >
              {flag.flag_type === "client" ? "Client Review" : "Attorney Review"}
            </Badge>
            {flag.timestamp && (
              <span className="text-[10px] text-muted-foreground">
                {new Date(flag.timestamp).toLocaleDateString()}
              </span>
            )}
          </div>
          {flag.note && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {flag.note}
            </p>
          )}
          {flag.text_excerpt && (
            <p className="mt-1 text-[10px] italic text-muted-foreground/70 line-clamp-2">
              &ldquo;{flag.text_excerpt}&rdquo;
            </p>
          )}
        </div>
      ))}
      <p className="pt-2 text-center text-[10px] text-muted-foreground/50">
        Full flagging UI available in Phase 6.
      </p>
    </div>
  );
}
