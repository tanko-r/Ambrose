"use client";

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import type { DefinedTerm } from "@/lib/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DefinitionsTabProps {
  paraId: string | null;
}

// ---------------------------------------------------------------------------
// DefinitionsTab - shows defined terms relevant to the selected paragraph
// ---------------------------------------------------------------------------

export function DefinitionsTab({ paraId }: DefinitionsTabProps) {
  const definedTerms = useAppStore((s) => s.definedTerms);
  const paragraphs = useAppStore((s) => s.paragraphs);

  const filteredTerms = useMemo(() => {
    if (!paraId) return [];

    const selectedPara = paragraphs.find((p) => p.id === paraId);
    const paraText = selectedPara?.text?.toLowerCase() || "";

    // Collect terms that are either:
    // 1. Defined in this paragraph (para_id matches)
    // 2. Whose term appears in the paragraph text (case-insensitive)
    const seen = new Set<string>();
    const definedHere: DefinedTerm[] = [];
    const referencedHere: DefinedTerm[] = [];

    for (const term of definedTerms) {
      const key = term.term.toLowerCase();
      if (seen.has(key)) continue;

      if (term.para_id === paraId) {
        seen.add(key);
        definedHere.push(term);
      } else if (paraText.includes(key)) {
        seen.add(key);
        referencedHere.push(term);
      }
    }

    // Sort: defined-in-para first, then alphabetical within each group
    definedHere.sort((a, b) => a.term.localeCompare(b.term));
    referencedHere.sort((a, b) => a.term.localeCompare(b.term));

    return [...definedHere, ...referencedHere];
  }, [paraId, definedTerms, paragraphs]);

  // No paragraph selected
  if (!paraId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Select a clause to see relevant definitions.
        </p>
      </div>
    );
  }

  // No terms found
  if (filteredTerms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-muted-foreground">
          No defined terms found in this clause.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filteredTerms.map((term) => (
        <div key={term.term} className="rounded-lg border p-3">
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-semibold text-primary">
              {term.term}
            </span>
            <Badge
              variant="secondary"
              className="shrink-0 text-[10px]"
            >
              {term.section_ref}
            </Badge>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {term.definition}
          </p>
        </div>
      ))}
    </div>
  );
}
