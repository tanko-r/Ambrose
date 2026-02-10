"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import type { Risk, RiskMap } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { Accordion } from "@/components/ui/accordion";
import { RiskCard } from "./risk-card";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RiskAccordionProps {
  risks: Risk[];
  riskMap: RiskMap | null;
  paraId: string;
  /** Ref callback: parent can read included risk IDs at generation time */
  onIncludedRiskIdsRef?: React.MutableRefObject<(() => string[]) | null>;
  /** Called when user clicks Flag on a risk card */
  onFlag?: (riskId: string, riskTitle: string, riskDescription: string) => void;
}

// ---------------------------------------------------------------------------
// RiskAccordion — wraps RiskCards in shadcn Accordion (single-expand)
// ---------------------------------------------------------------------------

export function RiskAccordion({ risks, riskMap, paraId, onIncludedRiskIdsRef, onFlag }: RiskAccordionProps) {
  const setHoveredRiskId = useAppStore((s) => s.setHoveredRiskId);
  const setFocusedRiskId = useAppStore((s) => s.setFocusedRiskId);
  const flags = useAppStore((s) => s.flags);

  // Build a set of flagged risk titles for the current paragraph
  const flaggedRiskTitles = useMemo(() => {
    const titles = new Set<string>();
    for (const flag of flags) {
      if (flag.para_id === paraId && flag.note) {
        // Flags created from risk cards have note format: "riskTitle: riskDescription"
        const colonIdx = flag.note.indexOf(":");
        if (colonIdx > 0) {
          titles.add(flag.note.slice(0, colonIdx));
        }
      }
    }
    return titles;
  }, [flags, paraId]);

  // Local state: which risk is expanded (single-expand behavior)
  const [expandedRiskId, setExpandedRiskId] = useState<string | undefined>(
    undefined,
  );

  // Local state: include/exclude per risk — defaults all to included
  const [riskInclusions, setRiskInclusions] = useState<Record<string, boolean>>(
    {},
  );

  // Expose a getter for included risk IDs to the parent via ref
  const getIncludedRiskIds = useCallback(() => {
    return risks
      .filter((r) => riskInclusions[r.risk_id] === undefined || riskInclusions[r.risk_id])
      .map((r) => r.risk_id);
  }, [risks, riskInclusions]);

  useEffect(() => {
    if (onIncludedRiskIdsRef) {
      onIncludedRiskIdsRef.current = getIncludedRiskIds;
    }
  }, [onIncludedRiskIdsRef, getIncludedRiskIds]);

  // Toggle include/exclude for a risk
  const handleToggleInclude = useCallback((riskId: string) => {
    setRiskInclusions((prev) => ({
      ...prev,
      [riskId]: prev[riskId] === undefined ? false : !prev[riskId],
    }));
  }, []);

  // Hover handler — highlights risk text in document viewer
  const handleHover = useCallback(
    (riskId: string | null) => {
      setHoveredRiskId(riskId);
    },
    [setHoveredRiskId],
  );

  // Focus handler — locks highlight on click (toggle behavior in store)
  const handleFocus = useCallback(
    (riskId: string) => {
      setFocusedRiskId(riskId);
    },
    [setFocusedRiskId],
  );

  // Cleanup: clear hovered risk when paraId changes or component unmounts
  useEffect(() => {
    return () => {
      setHoveredRiskId(null);
    };
  }, [paraId, setHoveredRiskId]);

  // Count included risks (default = included)
  const includedCount = useMemo(() => {
    return risks.filter(
      (r) => riskInclusions[r.risk_id] === undefined || riskInclusions[r.risk_id],
    ).length;
  }, [risks, riskInclusions]);

  if (risks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-muted-foreground">
          No risks identified for this clause.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Accordion with single-expand */}
      <Accordion
        type="single"
        collapsible
        value={expandedRiskId}
        onValueChange={setExpandedRiskId}
        className="space-y-2"
      >
        {risks.map((risk) => (
          <RiskCard
            key={risk.risk_id}
            risk={risk}
            riskMap={riskMap}
            paraId={paraId}
            isIncluded={
              riskInclusions[risk.risk_id] === undefined
                ? true
                : riskInclusions[risk.risk_id]
            }
            onToggleInclude={handleToggleInclude}
            onHover={handleHover}
            onFocus={handleFocus}
            onFlag={onFlag}
            isFlagged={flaggedRiskTitles.has(risk.title)}
          />
        ))}
      </Accordion>

      {/* Footer: selection count */}
      <div className="border-t pt-2 text-center text-xs text-muted-foreground">
        {includedCount} of {risks.length} risk{risks.length !== 1 ? "s" : ""}{" "}
        selected for revision
      </div>
    </div>
  );
}
