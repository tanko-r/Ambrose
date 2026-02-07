"use client";

import type { Risk, RiskMap, RiskMapEntry, Severity } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  ArrowRight,
  Check,
  X,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RiskCardProps {
  risk: Risk;
  riskMap: RiskMap | null;
  paraId: string;
  isIncluded: boolean;
  onToggleInclude: (riskId: string) => void;
  onHover: (riskId: string | null) => void;
  onFocus: (riskId: string) => void;
}

// ---------------------------------------------------------------------------
// Severity helpers
// ---------------------------------------------------------------------------

const SEVERITY_CLASSES: Record<string, string> = {
  critical: "bg-severity-critical text-white",
  high: "bg-severity-high text-white",
  medium: "bg-severity-medium text-foreground",
  low: "bg-severity-low text-white",
  info: "bg-severity-info text-white",
};

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
        SEVERITY_CLASSES[severity] || SEVERITY_CLASSES.info,
      )}
    >
      {severity}
    </span>
  );
}

// ---------------------------------------------------------------------------
// SeverityBadgeWithEffective — shows BASE -> EFFECTIVE when mitigators exist
// ---------------------------------------------------------------------------

function SeverityBadgeWithEffective({
  risk,
  riskMap,
}: {
  risk: Risk;
  riskMap: RiskMap | null;
}) {
  const riskData = riskMap?.[risk.para_id]?.find(
    (r) => r.risk_id === risk.risk_id,
  );

  if (
    riskData?.effective_severity &&
    riskData.effective_severity !== riskData.base_severity
  ) {
    return (
      <div className="flex items-center gap-1">
        <SeverityBadge severity={riskData.base_severity} />
        <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        <SeverityBadge severity={riskData.effective_severity} />
      </div>
    );
  }

  return <SeverityBadge severity={risk.severity} />;
}

// ---------------------------------------------------------------------------
// Risk type badge (risk vs opportunity)
// ---------------------------------------------------------------------------

function TypeBadge({ type }: { type: "risk" | "opportunity" }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "ml-auto shrink-0 text-[9px] px-1.5 py-0 font-medium",
        type === "opportunity"
          ? "border-green-300 text-green-700"
          : "border-red-300 text-red-700",
      )}
    >
      {type === "opportunity" ? "Opportunity" : "Risk"}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Risk relationships — mitigated by / amplified by
// ---------------------------------------------------------------------------

function RiskRelationships({
  risk,
  riskMap,
}: {
  risk: Risk;
  riskMap: RiskMap | null;
}) {
  const riskData = riskMap?.[risk.para_id]?.find(
    (r) => r.risk_id === risk.risk_id,
  );

  // Fall back to risk-level data if riskMap not available
  const mitigators = riskData?.mitigated_by || risk.mitigated_by || [];
  const amplifiers = riskData?.amplified_by || risk.amplified_by || [];

  if (mitigators.length === 0 && amplifiers.length === 0) return null;

  return (
    <div className="mt-2.5 space-y-1.5 text-xs">
      {mitigators.length > 0 && (
        <div className="flex items-start gap-1.5">
          <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-green-600" />
          <div>
            <span className="font-medium text-green-600">Mitigated by: </span>
            <span className="text-muted-foreground">
              {mitigators.map((m) => m.ref).join(", ")}
            </span>
          </div>
        </div>
      )}
      {amplifiers.length > 0 && (
        <div className="flex items-start gap-1.5">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-red-600" />
          <div>
            <span className="font-medium text-red-600">Amplified by: </span>
            <span className="text-muted-foreground">
              {amplifiers.map((a) => a.ref).join(", ")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Include/Exclude toggle button
// ---------------------------------------------------------------------------

function IncludeToggle({
  isIncluded,
  onToggle,
}: {
  isIncluded: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      variant={isIncluded ? "default" : "outline"}
      size="sm"
      className="h-6 gap-1 text-[10px] px-2"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      {isIncluded ? (
        <>
          <Check className="h-3 w-3" />
          Included
        </>
      ) : (
        <>
          <X className="h-3 w-3" />
          Excluded
        </>
      )}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// RiskCard — single risk inside AccordionItem
// ---------------------------------------------------------------------------

export function RiskCard({
  risk,
  riskMap,
  paraId,
  isIncluded,
  onToggleInclude,
  onHover,
  onFocus,
}: RiskCardProps) {
  return (
    <AccordionItem
      value={risk.risk_id}
      className="rounded-lg border px-3 py-0 transition-colors hover:bg-accent/30"
      onMouseEnter={() => onHover(risk.risk_id)}
      onMouseLeave={() => onHover(null)}
    >
      <AccordionTrigger
        className="gap-2 py-2.5 hover:no-underline [&>svg]:h-3.5 [&>svg]:w-3.5"
        onClick={() => onFocus(risk.risk_id)}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <SeverityBadgeWithEffective risk={risk} riskMap={riskMap} />
          <span className="min-w-0 truncate text-xs font-medium">
            {risk.title}
          </span>
          <TypeBadge type={risk.type} />
        </div>
      </AccordionTrigger>

      <AccordionContent className="pb-3 pt-0">
        {/* Description */}
        <p className="text-xs leading-relaxed text-muted-foreground">
          {risk.description}
        </p>

        {/* Highlight text excerpt */}
        {risk.highlight_text && (
          <div className="mt-2.5 rounded border-l-2 border-amber-400 bg-amber-50 px-2.5 py-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-amber-700">
              Relevant language
            </p>
            <p className="mt-0.5 text-xs italic text-amber-900/80">
              &ldquo;{risk.highlight_text}&rdquo;
            </p>
          </div>
        )}

        {/* Relationships */}
        <RiskRelationships risk={risk} riskMap={riskMap} />

        {/* Include / Exclude toggle */}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            Include in revision?
          </span>
          <IncludeToggle
            isIncluded={isIncluded}
            onToggle={() => onToggleInclude(risk.risk_id)}
          />
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
