"use client";

import { useState, useCallback, useMemo } from "react";
import type { Risk, RiskMap } from "@/lib/types";
import { Accordion } from "@/components/ui/accordion";
import { RiskCard } from "./risk-card";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RiskAccordionProps {
  risks: Risk[];
  riskMap: RiskMap | null;
  paraId: string;
}

// ---------------------------------------------------------------------------
// RiskAccordion — wraps RiskCards in shadcn Accordion (single-expand)
// ---------------------------------------------------------------------------

export function RiskAccordion({ risks, riskMap, paraId }: RiskAccordionProps) {
  // Local state: which risk is expanded (single-expand behavior)
  const [expandedRiskId, setExpandedRiskId] = useState<string | undefined>(
    undefined,
  );

  // Local state: include/exclude per risk — defaults all to included
  const [riskInclusions, setRiskInclusions] = useState<Record<string, boolean>>(
    {},
  );

  // Toggle include/exclude for a risk
  const handleToggleInclude = useCallback((riskId: string) => {
    setRiskInclusions((prev) => ({
      ...prev,
      [riskId]: prev[riskId] === undefined ? false : !prev[riskId],
    }));
  }, []);

  // No-op hover/focus handlers — Plan 04 (Wave 2) will wire these to the store
  const handleHover = useCallback((_riskId: string | null) => {
    // Will be connected to store.setHoveredRiskId in Plan 04
  }, []);

  const handleFocus = useCallback((_riskId: string) => {
    // Will be connected to store.setFocusedRiskId in Plan 04
  }, []);

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
