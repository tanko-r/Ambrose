"use client";

import { useAppStore } from "@/lib/store";
import { SeverityBadge } from "@/components/review/risk-card";
import { X, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Risk } from "@/lib/types";

interface RiskReportProps {
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Severity sort order for grouping within sections
// ---------------------------------------------------------------------------

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

// ---------------------------------------------------------------------------
// Section group type
// ---------------------------------------------------------------------------

interface SectionGroup {
  label: string;
  sectionNumber: string;
  risks: Risk[];
}

// ---------------------------------------------------------------------------
// RiskReport overlay
// ---------------------------------------------------------------------------

export function RiskReport({ open, onClose }: RiskReportProps) {
  const risks = useAppStore((s) => s.risks);
  const paragraphs = useAppStore((s) => s.paragraphs);
  const summary = useAppStore((s) => s.summary);
  const targetFilename = useAppStore((s) => s.targetFilename);

  if (!open) return null;

  // Build section-grouped risks
  const groupMap = new Map<string, SectionGroup>();

  for (const risk of risks) {
    const para = paragraphs.find((p) => p.id === risk.para_id);

    let sectionNumber = risk.section_ref || "Unknown";
    let sectionLabel = sectionNumber;

    if (para) {
      if (para.section_hierarchy && para.section_hierarchy.length > 0) {
        // Use the top-level section (first item)
        const top = para.section_hierarchy[0];
        sectionNumber = top.number;
        sectionLabel = top.caption
          ? `${top.number} ${top.caption}`
          : top.number;
      } else if (para.section_ref) {
        sectionNumber = para.section_ref;
        sectionLabel = para.section_ref;
      }
    }

    if (!groupMap.has(sectionNumber)) {
      groupMap.set(sectionNumber, {
        label: sectionLabel,
        sectionNumber,
        risks: [],
      });
    }
    groupMap.get(sectionNumber)!.risks.push(risk);
  }

  // Sort groups by section number, then sort risks within each group by severity
  const groups: SectionGroup[] = Array.from(groupMap.values())
    .sort((a, b) => {
      // Natural sort for section numbers like "1", "1.1", "10"
      const aParts = a.sectionNumber.split(".").map(Number);
      const bParts = b.sectionNumber.split(".").map(Number);
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const av = aParts[i] ?? 0;
        const bv = bParts[i] ?? 0;
        if (av !== bv) return av - bv;
      }
      return 0;
    })
    .map((group) => ({
      ...group,
      risks: [...group.risks].sort(
        (a, b) =>
          (SEVERITY_ORDER[a.severity] ?? 99) -
          (SEVERITY_ORDER[b.severity] ?? 99),
      ),
    }));

  const handlePrint = () => {
    window.print();
  };

  const reportDate = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="risk-report-overlay fixed inset-0 z-50 overflow-auto bg-white dark:bg-background print:relative print:z-auto">
      {/* Header bar — hidden in print */}
      <div className="no-print sticky top-0 flex items-center justify-between border-b bg-white dark:bg-background px-6 py-3 z-10">
        <h2 className="text-sm font-semibold">Risk Analysis Report</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={handlePrint}
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
            aria-label="Close risk report"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Report content */}
      <div className="max-w-4xl mx-auto px-8 py-6">
        {/* Document title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">
            Risk Analysis Report
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {targetFilename ?? "Untitled Document"} &mdash; {reportDate}
          </p>
        </div>

        {/* Summary table */}
        {summary && (
          <div className="mb-8 rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-2 text-left font-semibold text-foreground">
                    Severity
                  </th>
                  <th className="px-4 py-2 text-right font-semibold text-foreground">
                    Count
                  </th>
                </tr>
              </thead>
              <tbody>
                {(["critical", "high", "medium", "low"] as const).map(
                  (sev) => (
                    <tr key={sev} className="border-b last:border-0">
                      <td className="px-4 py-2">
                        <SeverityBadge severity={sev} />
                      </td>
                      <td className="px-4 py-2 text-right font-medium">
                        {summary[sev] ?? 0}
                      </td>
                    </tr>
                  ),
                )}
                <tr className="bg-muted/20 font-semibold">
                  <td className="px-4 py-2">Total</td>
                  <td className="px-4 py-2 text-right">
                    {summary.total_risks ?? risks.length}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Section-by-section risks */}
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No risks identified. Run analysis to generate the report.
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.sectionNumber} className="mb-6">
              <h3 className="text-base font-semibold border-b pb-1 mb-3 mt-6">
                {group.label}
              </h3>

              <div className="space-y-4">
                {group.risks.map((risk) => (
                  <div
                    key={risk.risk_id}
                    className="rounded-lg border p-4 space-y-2"
                  >
                    {/* Header row: severity badge + title + type badge */}
                    <div className="flex items-start gap-2 flex-wrap">
                      <SeverityBadge severity={risk.severity} />
                      <span className="font-medium text-sm flex-1 min-w-0">
                        {risk.title}
                      </span>
                      <span
                        className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium border ${
                          risk.type === "opportunity"
                            ? "border-green-300 text-green-700"
                            : "border-red-300 text-red-700"
                        }`}
                      >
                        {risk.type === "opportunity" ? "Opportunity" : "Risk"}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {risk.description}
                    </p>

                    {/* Highlight text */}
                    {risk.highlight_text && (
                      <blockquote className="border-l-2 border-amber-400 bg-amber-50 pl-3 py-1.5 pr-2 text-xs italic text-amber-900/80">
                        &ldquo;{risk.highlight_text}&rdquo;
                      </blockquote>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
