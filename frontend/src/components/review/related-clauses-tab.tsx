"use client";

import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { getRelatedClauses } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowRight, FileText } from "lucide-react";
import type { RelatedClause } from "@/lib/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RelatedClausesTabProps {
  sessionId: string | null;
  paraId: string | null;
}

// ---------------------------------------------------------------------------
// RelatedClausesTab - fetches and displays precedent clauses for selected para
// ---------------------------------------------------------------------------

export function RelatedClausesTab({
  sessionId,
  paraId,
}: RelatedClausesTabProps) {
  const hasPrecedent = useAppStore((s) => s.hasPrecedent);
  const openPrecedentPanel = useAppStore((s) => s.openPrecedentPanel);
  const setPrecedentScrollTarget = useAppStore((s) => s.setPrecedentScrollTarget);

  const [relatedClauses, setRelatedClauses] = useState<RelatedClause[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cache to avoid re-fetching for the same paraId
  const cacheRef = useRef<Map<string, RelatedClause[]>>(new Map());

  useEffect(() => {
    // Reset state when paraId is cleared
    if (!paraId || !hasPrecedent || !sessionId) {
      setRelatedClauses([]);
      setLoading(false);
      setError(null);
      return;
    }

    // Check cache first
    const cached = cacheRef.current.get(paraId);
    if (cached) {
      setRelatedClauses(cached);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    async function fetchRelated() {
      setLoading(true);
      setError(null);

      try {
        const response = await getRelatedClauses(sessionId!, paraId!);
        if (!cancelled) {
          const clauses = response.related_clauses || [];
          cacheRef.current.set(paraId!, clauses);
          setRelatedClauses(clauses);
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Failed to load related clauses";
          setError(message);
          toast.error("Failed to load related clauses");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchRelated();

    return () => {
      cancelled = true;
    };
  }, [paraId, sessionId, hasPrecedent]);

  // No paragraph selected
  if (!paraId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Select a clause to see related clauses from the precedent.
        </p>
      </div>
    );
  }

  // No precedent uploaded
  if (!hasPrecedent) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-muted-foreground">
          No precedent document uploaded. Upload a precedent in the intake form
          to see related clauses.
        </p>
      </div>
    );
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  const handleClauseClick = (clauseParaId: string) => {
    setPrecedentScrollTarget(clauseParaId);
    openPrecedentPanel();
  };

  // No results -- show "Open Precedent" link
  if (relatedClauses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-muted-foreground mb-3">
          No related clauses found in precedent document.
        </p>
        <button
          onClick={() => openPrecedentPanel()}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <FileText className="h-3.5 w-3.5" />
          Open Precedent
        </button>
      </div>
    );
  }

  // Clause cards (clickable, no similarity percentages)
  return (
    <div className="space-y-2">
      {relatedClauses.map((clause) => (
        <button
          key={clause.para_id}
          onClick={() => handleClauseClick(clause.para_id)}
          className="w-full rounded-lg border p-3 text-left transition-colors hover:border-primary/30 hover:bg-accent/50 cursor-pointer group"
        >
          <div className="mb-1 flex items-center justify-between">
            <Badge variant="secondary" className="text-[10px]">
              {clause.section_ref}
            </Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground line-clamp-3">
            {clause.text}
          </p>
        </button>
      ))}
    </div>
  );
}
