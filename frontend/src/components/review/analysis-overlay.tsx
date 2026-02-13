"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { Progress } from "@/components/ui/progress";
import { Loader2, Check, Circle } from "lucide-react";
import type { AnalysisStage } from "@/lib/types";

// ---------------------------------------------------------------------------
// Rotating legal-themed verbs for the analysis overlay
// ---------------------------------------------------------------------------

const ANALYSIS_VERBS = [
  "Reading the fine print...",
  "Briefing...",
  "Arguing both sides...",
  "Thinking aggressively...",
  "Finding the loopholes...",
  "Protecting your interests...",
  "Channeling senior partner energy...",
  "Billable hours accumulating...",
  "Citing precedent...",
  "Drafting counterarguments...",
  "Playing devil's advocate...",
  "Reviewing for gotchas...",
  "Checking the defined terms...",
  "Lawyering...",
  "Cross-referencing...",
  "Due diligence-ing...",
  "Risk-assessing...",
  "Zealously advocating...",
  "Preparing the markup...",
];

function useRotatingVerb(active: boolean) {
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!active) return;

    const interval = setInterval(() => {
      setFading(true);
      const timeout = setTimeout(() => {
        setIndex((prev) => (prev + 1) % ANALYSIS_VERBS.length);
        setFading(false);
      }, 200);
      return () => clearTimeout(timeout);
    }, 2500);

    return () => clearInterval(interval);
  }, [active]);

  return { verb: ANALYSIS_VERBS[index], fading };
}

// ---------------------------------------------------------------------------
// Stage icon helper
// ---------------------------------------------------------------------------

function StageIcon({
  stage,
  activeWhen,
  completeWhen,
}: {
  stage: AnalysisStage | null;
  activeWhen: AnalysisStage[];
  completeWhen: AnalysisStage[];
}) {
  if (stage && completeWhen.includes(stage)) {
    return <Check className="h-4 w-4 text-green-600" />;
  }
  if (stage && activeWhen.includes(stage)) {
    return <Loader2 className="h-4 w-4 animate-spin" />;
  }
  return <Circle className="h-3 w-3 text-muted-foreground" />;
}

// ---------------------------------------------------------------------------
// AnalysisOverlay
// ---------------------------------------------------------------------------

export function AnalysisOverlay() {
  const analysisStatus = useAppStore((s) => s.analysisStatus);
  const analysisStage = useAppStore((s) => s.analysisStage);
  const analysisPercent = useAppStore((s) => s.analysisPercent);
  const stageDisplay = useAppStore((s) => s.stageDisplay);

  const { verb, fading } = useRotatingVerb(analysisStatus === "analyzing");

  if (analysisStatus !== "analyzing") return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border bg-card p-8 shadow-2xl">
        {/* Title */}
        <h2 className="text-lg font-semibold text-center mb-6">
          Analyzing Document
        </h2>

        {/* Two-stage indicator */}
        <div className="flex items-center justify-center gap-8 mb-6">
          <div className="flex items-center gap-2">
            <StageIcon
              stage={analysisStage}
              activeWhen={["initial_analysis"]}
              completeWhen={["parallel_batches", "complete"]}
            />
            <span
              className={`text-sm ${
                analysisStage === "initial_analysis"
                  ? "text-foreground font-medium"
                  : analysisStage === "parallel_batches" ||
                      analysisStage === "complete"
                    ? "text-green-600"
                    : "text-muted-foreground"
              }`}
            >
              Initial Analysis
            </span>
          </div>

          <div className="flex items-center gap-2">
            <StageIcon
              stage={analysisStage}
              activeWhen={["parallel_batches"]}
              completeWhen={["complete"]}
            />
            <span
              className={`text-sm ${
                analysisStage === "parallel_batches"
                  ? "text-foreground font-medium"
                  : analysisStage === "complete"
                    ? "text-green-600"
                    : "text-muted-foreground"
              }`}
            >
              Parallel Batches
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <Progress value={analysisPercent} className="mb-1" />
        <p className="text-xs text-muted-foreground text-right">
          {analysisPercent}%
        </p>

        {/* Stage display */}
        {stageDisplay && (
          <p className="text-sm text-muted-foreground text-center mt-2">
            {stageDisplay}
          </p>
        )}

        {/* Rotating legal verb */}
        <p
          className={`text-sm text-muted-foreground italic text-center mt-4 transition-opacity duration-200 ${
            fading ? "opacity-0" : "opacity-100"
          }`}
        >
          {verb}
        </p>
      </div>
    </div>
  );
}
