"use client";

import { useMemo, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  List,
  AlertTriangle,
  Flag,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  Check,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Paragraph, Severity } from "@/lib/types";

interface NavigationPanelProps {
  width?: number;
}

export function NavigationPanel({ width = 260 }: NavigationPanelProps) {
  const {
    paragraphs,
    risks,
    revisions,
    flags,
    selectedParaId,
    selectParagraph,
    navPanelOpen,
    toggleNavPanel,
  } = useAppStore();

  const [search, setSearch] = useState("");
  const [showRisksOnly, setShowRisksOnly] = useState(false);
  const [showFlagsOnly, setShowFlagsOnly] = useState(false);

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
    const map = new Map<string, typeof risks>();
    for (const risk of risks) {
      const existing = map.get(risk.para_id) || [];
      existing.push(risk);
      map.set(risk.para_id, existing);
    }
    return map;
  }, [risks]);

  // Flagged paragraph IDs
  const flaggedParaIds = useMemo(
    () => new Set(flags.map((f) => f.para_id)),
    [flags]
  );

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

  // Numbered paragraphs only (structural items — like Word's nav pane)
  const numberedParas = useMemo(
    () => contentParas.filter((p) => p.is_numbered !== false),
    [contentParas]
  );

  // Search-filtered numbered paragraphs
  const searchFilteredNumbered = useMemo(() => {
    if (!search.trim()) return numberedParas;
    const q = search.toLowerCase();
    return numberedParas.filter(
      (p) =>
        (p.text ?? "").toLowerCase().includes(q) ||
        (p.section_ref ?? "").toLowerCase().includes(q)
    );
  }, [numberedParas, search]);

  // Risk/flag filter toggles applied
  const finalFilteredParas = useMemo(() => {
    let result = searchFilteredNumbered;
    if (showRisksOnly) {
      result = result.filter((p) => risksByPara.has(p.id));
    }
    if (showFlagsOnly) {
      result = result.filter((p) => flaggedParaIds.has(p.id));
    }
    return result;
  }, [searchFilteredNumbered, showRisksOnly, showFlagsOnly, risksByPara, flaggedParaIds]);

  // Progress stats
  const riskyParas = numberedParas.filter((p) => risksByPara.has(p.id));
  const reviewedCount = riskyParas.filter((p) => isReviewed(p.id)).length;

  const handleJump = (paraId: string) => {
    selectParagraph(paraId);
  };

  // Shared nav content (used in both open and ghost modes)
  const navContent = (
    <>
      {/* Header: close button + search + filter toggles */}
      <div className="flex items-center gap-1.5 border-b px-2 py-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground"
          onClick={() => { setGhostVisible(false); toggleNavPanel(); }}
          title={navPanelOpen ? "Hide navigator" : "Dock navigator"}
        >
          <PanelLeftClose className="h-3.5 w-3.5" />
        </Button>
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter clauses..."
            className="h-7 pl-7 text-xs"
          />
        </div>
        <button
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors ${
            showRisksOnly
              ? "bg-severity-high/15 text-severity-high hover:bg-severity-high/25"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
          onClick={() => setShowRisksOnly((v) => !v)}
          title={showRisksOnly ? "Show all clauses" : "Show only clauses with risks"}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
        </button>
        <button
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors ${
            showFlagsOnly
              ? "bg-primary/15 text-primary hover:bg-primary/25"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
          onClick={() => setShowFlagsOnly((v) => !v)}
          title={showFlagsOnly ? "Show all clauses" : "Show only flagged clauses"}
        >
          <Flag className="h-3.5 w-3.5" />
        </button>
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
        ) : (
          <LinearOutline
            paragraphs={finalFilteredParas}
            selectedParaId={selectedParaId}
            maxSeverity={maxSeverity}
            isReviewed={isReviewed}
            onJump={handleJump}
          />
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Reopen tab — when ghost visible, sits inside ghost panel aligned with header close button */}
      {!navPanelOpen && (
        <button
          onClick={toggleNavPanel}
          onMouseEnter={() => { clearGhostTimeout(); setGhostVisible(true); }}
          onMouseLeave={startGhostHide}
          className={`fixed z-40 transition-all duration-200 ease-out ${
            ghostVisible
              ? "left-2 top-[64px] rounded bg-accent/80 p-1.5 hover:bg-accent"
              : "left-0 top-[64px] rounded-r-lg border border-l-0 bg-card px-1.5 py-3 shadow-md hover:bg-accent"
          }`}
          aria-label="Open navigator"
        >
          <PanelLeftOpen className="h-4 w-4 text-muted-foreground" />
        </button>
      )}

      {/* Ghost slide-in panel (hover preview when closed) */}
      {!navPanelOpen && (
        <div
          className={`fixed left-0 top-14 bottom-0 z-30 border-r bg-muted/80 backdrop-blur-md shadow-xl transition-transform duration-200 ease-out ${
            ghostVisible ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{ width }}
          onMouseEnter={clearGhostTimeout}
          onMouseLeave={startGhostHide}
        >
          <nav aria-label="Document navigator" className="flex h-full flex-col">
            {navContent}
          </nav>
        </div>
      )}

      {/* Docked nav panel with animated width */}
      <div
        className="shrink-0 overflow-hidden border-r bg-muted/70"
        style={{ width: navPanelOpen ? width : 0 }}
      >
        <nav aria-label="Document navigator" className="flex h-full flex-col" style={{ width }}>
          {navContent}
        </nav>
      </div>
    </>
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
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Build a tree from the flat paragraph list
  type TreeNode = { para: Paragraph; children: TreeNode[] };

  const tree = useMemo(() => {
    const roots: TreeNode[] = [];
    const stack: TreeNode[] = [];

    for (const para of paragraphs) {
      const level = para.indent_level ?? 0;
      const node: TreeNode = { para, children: [] };

      // Pop stack until we find a parent at a lower level
      while (stack.length > 0 && (stack[stack.length - 1].para.indent_level ?? 0) >= level) {
        stack.pop();
      }

      if (stack.length === 0) {
        roots.push(node);
      } else {
        stack[stack.length - 1].children.push(node);
      }
      stack.push(node);
    }
    return roots;
  }, [paragraphs]);

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderNode = (node: TreeNode, depth: number) => {
    const { para, children } = node;
    const hasChildren = children.length > 0;
    const isNodeCollapsed = collapsed.has(para.id);

    return (
      <div key={para.id}>
        <div className="flex items-center" style={{ marginLeft: `${depth * 12}px` }}>
          {hasChildren ? (
            <button
              onClick={() => toggleCollapse(para.id)}
              className="flex h-4 w-2.5 shrink-0 items-center justify-center text-[8px] text-muted-foreground/70 hover:text-foreground"
              aria-label={isNodeCollapsed ? "Expand section" : "Collapse section"}
            >
              <span className={`transition-transform ${isNodeCollapsed ? "-rotate-90" : ""}`}>
                ▼
              </span>
            </button>
          ) : (
            <span className="w-2.5 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <OutlineItem
              paraId={para.id}
              sectionRef={para.section_ref}
              caption={para.caption || para.text?.slice(0, 40)}
              severity={maxSeverity(para.id)}
              reviewed={isReviewed(para.id)}
              selected={para.id === selectedParaId}
              onJump={onJump}
            />
          </div>
        </div>
        {hasChildren && !isNodeCollapsed && children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="space-y-px">
      {tree.map((node) => renderNode(node, 0))}
    </div>
  );
}

function OutlineItem({
  paraId,
  sectionRef,
  caption,
  severity,
  reviewed,
  selected,
  onJump,
}: {
  paraId: string;
  sectionRef: string;
  caption: string;
  severity: Severity | null;
  reviewed: boolean;
  selected: boolean;
  onJump: (id: string) => void;
}) {
  const severityBorderClass = severity
    ? {
        critical: "border-l-2 border-l-severity-critical",
        high: "border-l-2 border-l-severity-high",
        medium: "border-l-2 border-l-severity-medium",
        low: "border-l-2 border-l-severity-low",
        info: "border-l-2 border-l-transparent",
      }[severity]
    : "border-l-2 border-l-transparent";

  return (
    <button
      onClick={() => onJump(paraId)}
      className={`flex w-full items-center rounded px-1 py-0.5 text-left text-[11px] leading-tight transition-colors ${
        selected
          ? "bg-primary/10 text-foreground ring-1 ring-primary/30"
          : "text-foreground hover:bg-accent"
      } ${reviewed ? "opacity-55" : ""} ${severityBorderClass}`}
    >
      <span className="shrink-0 pr-1.5 font-semibold tabular-nums text-muted-foreground text-[10px]">
        {sectionRef || "—"}
      </span>
      <span className="flex-1 truncate">{caption}</span>
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
