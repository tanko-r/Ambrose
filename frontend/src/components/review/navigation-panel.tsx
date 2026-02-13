"use client";

import { useMemo, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  List,
  AlertTriangle,
  LayoutGrid,
  Search,
  PanelLeftClose,
  PanelLeft,
  PanelLeftOpen,
  Check,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Paragraph, Risk, Severity } from "@/lib/types";

type ReviewMode = "linear" | "by-risk" | "by-category";

const REVIEW_MODES: { value: ReviewMode; label: string; icon: React.ReactNode }[] = [
  { value: "linear", label: "Linear", icon: <List className="h-3.5 w-3.5" /> },
  {
    value: "by-risk",
    label: "By Risk",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  {
    value: "by-category",
    label: "By Category",
    icon: <LayoutGrid className="h-3.5 w-3.5" />,
  },
];

export function NavigationPanel() {
  const {
    paragraphs,
    sections,
    risks,
    revisions,
    flags,
    selectedParaId,
    selectParagraph,
    navPanelOpen,
    toggleNavPanel,
    reviewMode,
    setReviewMode,
    showRisks,
    showRevisions,
    showFlags,
  } = useAppStore();

  const [search, setSearch] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set()
  );

  // Ghost hover state (when panel is closed)
  const [ghostVisible, setGhostVisible] = useState(false);
  const ghostTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearGhostTimeout = () => {
    if (ghostTimeoutRef.current) {
      clearTimeout(ghostTimeoutRef.current);
      ghostTimeoutRef.current = null;
    }
  };

  const startGhostHide = () => {
    ghostTimeoutRef.current = setTimeout(() => {
      setGhostVisible(false);
      ghostTimeoutRef.current = null;
    }, 300);
  };

  // Risk lookup by paragraph
  const risksByPara = useMemo(() => {
    const map = new Map<string, Risk[]>();
    for (const risk of risks) {
      const existing = map.get(risk.para_id) || [];
      existing.push(risk);
      map.set(risk.para_id, existing);
    }
    return map;
  }, [risks]);

  // Max severity for a paragraph
  const maxSeverity = (paraId: string): Severity | null => {
    const paraRisks = risksByPara.get(paraId);
    if (!paraRisks?.length) return null;
    const order: Severity[] = ["critical", "high", "medium", "low", "info"];
    for (const sev of order) {
      if (paraRisks.some((r) => r.severity === sev)) return sev;
    }
    return null;
  };

  // Reviewed = has accepted revision
  const isReviewed = (paraId: string) =>
    revisions[paraId]?.accepted === true;

  // Paragraphs only (no headings/tables)
  const contentParas = useMemo(
    () => paragraphs.filter((p) => p.type === "paragraph"),
    [paragraphs]
  );

  // Filtered by search
  const searchFilteredParas = useMemo(() => {
    if (!search.trim()) return contentParas;
    const q = search.toLowerCase();
    return contentParas.filter(
      (p) =>
        p.text.toLowerCase().includes(q) ||
        p.section_ref.toLowerCase().includes(q)
    );
  }, [contentParas, search]);

  // Filtered by bottom bar filter toggles (risks, revisions, flags)
  const flaggedParaIds = useMemo(
    () => new Set(flags.map((f) => f.para_id)),
    [flags]
  );
  const revisedParaIds = useMemo(
    () => new Set(Object.keys(revisions)),
    [revisions]
  );

  const filteredParas = useMemo(() => {
    const anyFilterActive = showRisks || showRevisions || showFlags;
    // Safety fallback: if all filters off, show everything
    if (!anyFilterActive) return searchFilteredParas;

    return searchFilteredParas.filter((p) => {
      if (showRisks && risksByPara.has(p.id)) return true;
      if (showRevisions && revisedParaIds.has(p.id)) return true;
      if (showFlags && flaggedParaIds.has(p.id)) return true;
      return false;
    });
  }, [searchFilteredParas, showRisks, showRevisions, showFlags, risksByPara, revisedParaIds, flaggedParaIds]);

  // Progress stats
  const riskyParas = contentParas.filter((p) => risksByPara.has(p.id));
  const reviewedCount = riskyParas.filter((p) => isReviewed(p.id)).length;

  const handleJump = (paraId: string) => {
    selectParagraph(paraId);
  };

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  if (!navPanelOpen) {
    return (
      <div className="relative shrink-0" style={{ width: 0 }}>
        {/* Top-left trigger tab */}
        <div
          className="absolute left-0 top-2 z-20 flex items-center"
          onMouseEnter={() => { clearGhostTimeout(); setGhostVisible(true); }}
          onMouseLeave={startGhostHide}
        >
          <div className="rounded-r-md border border-l-0 bg-card px-1.5 py-1 shadow-sm cursor-pointer text-muted-foreground hover:text-foreground transition-colors" title="Show navigator" role="button" aria-label="Show document navigator">
            <PanelLeftOpen className="h-3.5 w-3.5" />
          </div>
        </div>
        {/* Ghost slide-in panel */}
        <div
          className={`absolute left-0 top-0 bottom-0 z-30 w-[260px] border-r bg-card/80 backdrop-blur-md shadow-xl transition-transform duration-200 ease-out ${
            ghostVisible ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{ height: "100vh" }}
          onMouseEnter={clearGhostTimeout}
          onMouseLeave={startGhostHide}
        >
          <aside role="navigation" aria-label="Document navigator" className="flex h-full flex-col">
            {/* Header — click to dock */}
            <div className="flex items-center justify-between border-b px-3 py-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Navigator
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-[10px] text-muted-foreground"
                onClick={() => { setGhostVisible(false); toggleNavPanel(); }}
                title="Dock navigator"
              >
                <PanelLeftOpen className="h-3.5 w-3.5" />
                Show
              </Button>
            </div>

            {/* Review mode selector */}
            <div className="flex gap-1 border-b px-2 py-2">
              {REVIEW_MODES.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => setReviewMode(mode.value)}
                  className={`flex flex-1 flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[10px] font-medium uppercase tracking-wider transition-colors ${
                    reviewMode === mode.value
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {mode.icon}
                  {mode.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="border-b px-2 py-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter clauses..."
                  className="h-7 pl-7 text-xs"
                />
              </div>
            </div>

            {/* Progress */}
            {riskyParas.length > 0 && (
              <div className="flex items-center gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
                <span>
                  Reviewed:{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {reviewedCount}/{riskyParas.length}
                  </span>
                </span>
              </div>
            )}

            {/* Outline */}
            <div className="flex-1 overflow-y-auto px-1 py-1">
              {contentParas.length === 0 ? (
                <NavigatorEmptyState />
              ) : reviewMode === "linear" ? (
                <LinearOutline
                  paragraphs={filteredParas}
                  selectedParaId={selectedParaId}
                  maxSeverity={maxSeverity}
                  isReviewed={isReviewed}
                  onJump={handleJump}
                />
              ) : reviewMode === "by-risk" ? (
                <ByRiskOutline
                  paragraphs={contentParas}
                  risksByPara={risksByPara}
                  selectedParaId={selectedParaId}
                  isReviewed={isReviewed}
                  onJump={handleJump}
                />
              ) : (
                <ByCategoryOutline
                  paragraphs={filteredParas}
                  sections={sections}
                  selectedParaId={selectedParaId}
                  maxSeverity={maxSeverity}
                  isReviewed={isReviewed}
                  collapsedCategories={collapsedCategories}
                  toggleCategory={toggleCategory}
                  onJump={handleJump}
                />
              )}
            </div>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <aside role="navigation" aria-label="Document navigator" className="flex h-full w-[260px] shrink-0 flex-col border-r bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Navigator
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-[10px] text-muted-foreground"
          onClick={toggleNavPanel}
          title="Hide navigator (ghost mode)"
        >
          <PanelLeftClose className="h-3.5 w-3.5" />
          Hide
        </Button>
      </div>

      {/* Review mode selector */}
      <div className="flex gap-1 border-b px-2 py-2">
        {REVIEW_MODES.map((mode) => (
          <button
            key={mode.value}
            onClick={() => setReviewMode(mode.value)}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[10px] font-medium uppercase tracking-wider transition-colors ${
              reviewMode === mode.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            {mode.icon}
            {mode.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="border-b px-2 py-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter clauses..."
            className="h-7 pl-7 text-xs"
          />
        </div>
      </div>

      {/* Progress */}
      {riskyParas.length > 0 && (
        <div className="flex items-center gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
          <span>
            Reviewed:{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {reviewedCount}/{riskyParas.length}
            </span>
          </span>
        </div>
      )}

      {/* Outline */}
      <div className="flex-1 overflow-y-auto px-1 py-1">
        {contentParas.length === 0 ? (
          <p className="p-4 text-center text-xs italic text-muted-foreground">
            Load a document to see outline
          </p>
        ) : reviewMode === "linear" ? (
          <LinearOutline
            paragraphs={filteredParas}
            selectedParaId={selectedParaId}
            maxSeverity={maxSeverity}
            isReviewed={isReviewed}
            onJump={handleJump}
          />
        ) : reviewMode === "by-risk" ? (
          <ByRiskOutline
            paragraphs={contentParas}
            risksByPara={risksByPara}
            selectedParaId={selectedParaId}
            isReviewed={isReviewed}
            onJump={handleJump}
          />
        ) : (
          <ByCategoryOutline
            paragraphs={filteredParas}
            sections={sections}
            selectedParaId={selectedParaId}
            maxSeverity={maxSeverity}
            isReviewed={isReviewed}
            collapsedCategories={collapsedCategories}
            toggleCategory={toggleCategory}
            onJump={handleJump}
          />
        )}
      </div>
    </aside>
  );
}

// --- Sub-components ---

function LinearOutline({
  paragraphs,
  selectedParaId,
  maxSeverity,
  isReviewed,
  onJump,
}: {
  paragraphs: Paragraph[];
  selectedParaId: string | null;
  maxSeverity: (id: string) => Severity | null;
  isReviewed: (id: string) => boolean;
  onJump: (id: string) => void;
}) {
  return (
    <div className="space-y-px">
      {paragraphs.map((para) => {
        const sev = maxSeverity(para.id);
        const level = (para.section_ref?.match(/\./g) || []).length;

        return (
          <OutlineItem
            key={para.id}
            paraId={para.id}
            sectionRef={para.section_ref}
            text={para.text}
            severity={sev}
            reviewed={isReviewed(para.id)}
            selected={para.id === selectedParaId}
            level={level}
            onJump={onJump}
          />
        );
      })}
    </div>
  );
}

function ByRiskOutline({
  paragraphs,
  risksByPara,
  selectedParaId,
  isReviewed,
  onJump,
}: {
  paragraphs: Paragraph[];
  risksByPara: Map<string, Risk[]>;
  selectedParaId: string | null;
  isReviewed: (id: string) => boolean;
  onJump: (id: string) => void;
}) {
  const groups: { label: string; severity: Severity; paras: Paragraph[] }[] = [
    { label: "Critical", severity: "critical", paras: [] },
    { label: "High", severity: "high", paras: [] },
    { label: "Medium", severity: "medium", paras: [] },
    { label: "Low", severity: "low", paras: [] },
  ];

  for (const para of paragraphs) {
    const paraRisks = risksByPara.get(para.id);
    if (!paraRisks?.length) continue;
    const maxSev = paraRisks.reduce<Severity>((acc, r) => {
      const order: Severity[] = ["critical", "high", "medium", "low", "info"];
      return order.indexOf(r.severity) < order.indexOf(acc) ? r.severity : acc;
    }, "info");
    const group = groups.find((g) => g.severity === maxSev);
    if (group) group.paras.push(para);
  }

  return (
    <div className="space-y-3 py-1">
      {groups
        .filter((g) => g.paras.length > 0)
        .map((group) => (
          <div key={group.severity}>
            <div className="mb-1 flex items-center gap-2 px-2">
              <SeverityDot severity={group.severity} />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label} ({group.paras.length})
              </span>
            </div>
            <div className="space-y-px">
              {group.paras.slice(0, 10).map((para) => (
                <OutlineItem
                  key={para.id}
                  paraId={para.id}
                  sectionRef={para.section_ref}
                  text={para.text}
                  severity={group.severity}
                  reviewed={isReviewed(para.id)}
                  selected={para.id === selectedParaId}
                  level={0}
                  onJump={onJump}
                />
              ))}
              {group.paras.length > 10 && (
                <div className="px-2 py-1 text-[10px] text-muted-foreground">
                  +{group.paras.length - 10} more
                </div>
              )}
            </div>
          </div>
        ))}
    </div>
  );
}

function ByCategoryOutline({
  paragraphs,
  sections,
  selectedParaId,
  maxSeverity,
  isReviewed,
  collapsedCategories,
  toggleCategory,
  onJump,
}: {
  paragraphs: Paragraph[];
  sections: { id: string; number: string; caption: string; level: number }[];
  selectedParaId: string | null;
  maxSeverity: (id: string) => Severity | null;
  isReviewed: (id: string) => boolean;
  collapsedCategories: Set<string>;
  toggleCategory: (cat: string) => void;
  onJump: (id: string) => void;
}) {
  // Group by top-level section
  const topSections = sections.filter((s) => s.level === 0 || s.level === 1);
  const groups = new Map<string, { caption: string; paras: Paragraph[] }>();

  for (const para of paragraphs) {
    const topNum = para.section_ref.split(".")[0] || "other";
    if (!groups.has(topNum)) {
      const sec = topSections.find((s) => s.number.startsWith(topNum));
      groups.set(topNum, {
        caption: sec?.caption || `Section ${topNum}`,
        paras: [],
      });
    }
    groups.get(topNum)!.paras.push(para);
  }

  return (
    <div className="space-y-1 py-1">
      {Array.from(groups.entries()).map(([key, { caption, paras }]) => {
        const collapsed = collapsedCategories.has(key);
        return (
          <div key={key}>
            <button
              onClick={() => toggleCategory(key)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent"
            >
              <span
                className={`text-[10px] transition-transform ${collapsed ? "-rotate-90" : ""}`}
              >
                ▼
              </span>
              <span className="truncate">
                {key}. {caption}
              </span>
              <span className="ml-auto text-[10px] tabular-nums">
                {paras.length}
              </span>
            </button>
            {!collapsed && (
              <div className="space-y-px pl-2">
                {paras.map((para) => (
                  <OutlineItem
                    key={para.id}
                    paraId={para.id}
                    sectionRef={para.section_ref}
                    text={para.text}
                    severity={maxSeverity(para.id)}
                    reviewed={isReviewed(para.id)}
                    selected={para.id === selectedParaId}
                    level={0}
                    onJump={onJump}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function OutlineItem({
  paraId,
  sectionRef,
  text,
  severity,
  reviewed,
  selected,
  level,
  onJump,
}: {
  paraId: string;
  sectionRef: string;
  text: string;
  severity: Severity | null;
  reviewed: boolean;
  selected: boolean;
  level: number;
  onJump: (id: string) => void;
}) {
  const severityBorderClass = severity
    ? {
        critical: "border-l-2 border-l-severity-critical",
        high: "border-l-2 border-l-severity-high",
        medium: "border-l-2 border-l-severity-medium",
        low: "border-l-2 border-l-severity-low",
        info: "",
      }[severity]
    : "";

  return (
    <button
      onClick={() => onJump(paraId)}
      className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs transition-colors ${
        selected
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-foreground hover:bg-accent"
      } ${reviewed ? "opacity-55" : ""} ${severityBorderClass}`}
      style={{ paddingLeft: `${8 + level * 8}px` }}
    >
      <span className="min-w-[36px] shrink-0 font-semibold tabular-nums text-muted-foreground">
        {sectionRef || "—"}
      </span>
      <span className="flex-1 truncate">{text.slice(0, 50)}</span>
      {reviewed && (
        <Check className="ml-auto h-3 w-3 shrink-0 text-green-500" />
      )}
    </button>
  );
}

function NavigatorEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
      <List className="h-5 w-5 text-muted-foreground/60" />
      <p className="max-w-[200px] text-xs text-muted-foreground">
        No document loaded. Start by uploading a contract.
      </p>
    </div>
  );
}

export function NavigatorSkeleton() {
  return (
    <div className="space-y-1.5 p-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  );
}

function SeverityDot({ severity }: { severity: Severity }) {
  const colorClass = {
    critical: "bg-severity-critical",
    high: "bg-severity-high",
    medium: "bg-severity-medium",
    low: "bg-severity-low",
    info: "bg-severity-info",
  }[severity];

  return <span className={`inline-block h-2 w-2 rounded-full ${colorClass}`} />;
}
