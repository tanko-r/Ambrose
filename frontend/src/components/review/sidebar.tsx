"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { useRevision } from "@/hooks/use-revision";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PanelRightClose,
  PanelRightOpen,
  AlertTriangle,
  Link2,
  BookOpen,
  Flag,
  Eye,
  Loader2,
} from "lucide-react";
import { RiskAccordion } from "./risk-accordion";
import { DefinitionsTab } from "./definitions-tab";
import { RelatedClausesTab } from "./related-clauses-tab";
import { FlagsTab } from "./flags-tab";

const GENERATING_VERBS = [
  "Analyzing risk exposure",
  "Reviewing clause structure",
  "Drafting protective language",
  "Cross-referencing provisions",
  "Evaluating counterparty position",
  "Identifying negotiation leverage",
  "Assessing materiality threshold",
  "Checking defined terms",
  "Calibrating revision scope",
  "Preparing redline markup",
];

function useRotatingVerb(active: boolean) {
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!active) {
      setIndex(0);
      return;
    }
    const id = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setIndex((i) => (i + 1) % GENERATING_VERBS.length);
        setFading(false);
      }, 200);
    }, 2400);
    return () => clearInterval(id);
  }, [active]);

  return { verb: GENERATING_VERBS[index], fading };
}

type SidebarTab = "risks" | "related" | "definitions" | "flags";

const TABS: { value: SidebarTab; label: string; icon: React.ReactNode }[] = [
  {
    value: "risks",
    label: "Risks",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  {
    value: "related",
    label: "Related",
    icon: <Link2 className="h-3.5 w-3.5" />,
  },
  {
    value: "definitions",
    label: "Definitions",
    icon: <BookOpen className="h-3.5 w-3.5" />,
  },
  {
    value: "flags",
    label: "Flags",
    icon: <Flag className="h-3.5 w-3.5" />,
  },
];

export function Sidebar() {
  const {
    sessionId,
    selectedParaId,
    paragraphs,
    risks,
    riskMap,
    sidebarOpen,
    toggleSidebar,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<SidebarTab>("risks");

  // Revision hook and ref for collecting included risk IDs
  const { generate, generating } = useRevision();
  const getIncludedRiskIdsRef = useRef<(() => string[]) | null>(null);
  const { verb: generatingVerb, fading: verbFading } = useRotatingVerb(generating);

  // Revision state for current paragraph
  const revisions = useAppStore((s) => s.revisions);
  const setRevisionSheetParaId = useAppStore((s) => s.setRevisionSheetParaId);
  const toggleBottomSheet = useAppStore((s) => s.toggleBottomSheet);
  const bottomSheetOpen = useAppStore((s) => s.bottomSheetOpen);
  const hasRevision = selectedParaId ? !!revisions[selectedParaId] : false;

  // Find selected paragraph
  const selectedPara = useMemo(
    () => paragraphs.find((p) => p.id === selectedParaId),
    [paragraphs, selectedParaId]
  );

  // Risks for selected paragraph
  const paraRisks = useMemo(
    () => risks.filter((r) => r.para_id === selectedParaId),
    [risks, selectedParaId]
  );

  // Reopen tab when sidebar is closed
  if (!sidebarOpen) {
    return (
      <button
        onClick={toggleSidebar}
        className="fixed right-0 top-1/2 z-40 -translate-y-1/2 rounded-l-lg border border-r-0 bg-card px-1.5 py-3 shadow-md transition-colors hover:bg-accent"
        aria-label="Open sidebar"
      >
        <PanelRightOpen className="h-4 w-4 text-muted-foreground" />
      </button>
    );
  }

  return (
    <aside className="flex h-full w-[380px] shrink-0 flex-col border-l bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Clause Analysis
          </div>
          {selectedPara ? (
            <div className="mt-1 flex items-center gap-2">
              {selectedPara.section_ref && (
                <Badge
                  variant="secondary"
                  className="shrink-0 text-[10px] px-1.5 py-0 font-semibold text-primary"
                >
                  {selectedPara.section_ref}
                </Badge>
              )}
              <span className="truncate text-sm font-semibold">
                {selectedPara.section_hierarchy?.at(-1)?.caption ||
                  selectedPara.text.slice(0, 40)}
              </span>
            </div>
          ) : (
            <div className="mt-1 text-sm text-muted-foreground">
              Select a clause
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={toggleSidebar}
        >
          <PanelRightClose className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b bg-secondary/50 px-1">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
              activeTab === tab.value
                ? "border-primary bg-card text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.value === "risks" && paraRisks.length > 0 && (
              <span className="ml-0.5 rounded-full bg-primary/10 px-1.5 text-[9px] font-bold text-primary">
                {paraRisks.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {!selectedParaId ? (
          <EmptyState message="Click a paragraph in the document to see analysis." />
        ) : activeTab === "risks" ? (
          <RiskAccordion
            risks={paraRisks}
            riskMap={riskMap}
            paraId={selectedParaId}
            onIncludedRiskIdsRef={getIncludedRiskIdsRef}
          />
        ) : activeTab === "related" ? (
          <RelatedClausesTab sessionId={sessionId} paraId={selectedParaId} />
        ) : activeTab === "definitions" ? (
          <DefinitionsTab paraId={selectedParaId} />
        ) : (
          <FlagsTab paraId={selectedParaId} />
        )}
      </div>

      {/* Footer */}
      {selectedParaId && (
        <div className="border-t px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {paraRisks.length > 0
                ? `${paraRisks.length} risk${paraRisks.length !== 1 ? "s" : ""} identified`
                : "No risks identified"}
            </span>
            <div className="flex items-center gap-1.5">
              {hasRevision && !generating && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    if (!selectedParaId) return;
                    setRevisionSheetParaId(selectedParaId);
                    if (!bottomSheetOpen) {
                      toggleBottomSheet();
                    }
                  }}
                >
                  <Eye className="mr-1 h-3 w-3" />
                  View Revision
                </Button>
              )}
              {generating ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span
                    className="transition-opacity duration-200"
                    style={{ opacity: verbFading ? 0 : 1 }}
                  >
                    {generatingVerb}...
                  </span>
                </div>
              ) : (
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  disabled={paraRisks.length === 0}
                  onClick={() => {
                    if (!selectedParaId) return;
                    const riskIds =
                      getIncludedRiskIdsRef.current?.() ??
                      paraRisks.map((r) => r.risk_id);
                    if (riskIds.length > 0) {
                      generate(selectedParaId, riskIds);
                    }
                  }}
                >
                  {hasRevision ? "Regenerate" : "Generate Revision"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

// --- Sub-components ---

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
