"use client";

// =============================================================================
// PrecedentNavigator -- Hierarchical paragraph list with search, match filter,
// position modes, and pulse highlights for the precedent document.
// =============================================================================

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  Filter,
  PanelRight,
  PanelBottom,
  X,
} from "lucide-react";
import type { Paragraph, Section, NavigatorPosition } from "@/lib/types";

interface PrecedentNavigatorProps {
  onNavigate: (paraId: string) => void;
  relatedParaIds: Set<string>;
  pulsingParaIds: Set<string>;
}

export function PrecedentNavigator({
  onNavigate,
  relatedParaIds,
  pulsingParaIds,
}: PrecedentNavigatorProps) {
  const precedentParagraphs = useAppStore((s) => s.precedentParagraphs);
  const precedentSections = useAppStore((s) => s.precedentSections);
  const navigatorPosition = useAppStore((s) => s.navigatorPosition);
  const setNavigatorPosition = useAppStore((s) => s.setNavigatorPosition);

  const [search, setSearch] = useState("");
  const [matchOnly, setMatchOnly] = useState(false);

  // =========================================================================
  // Build hierarchical tree from sections and paragraphs
  // =========================================================================

  const items = useMemo(() => {
    type NavItem = {
      id: string;
      type: "section" | "paragraph" | "heading";
      text: string;
      sectionNumber: string;
      caption: string;
      level: number;
      paraId: string | null;
    };

    const result: NavItem[] = [];

    // Build a map of section by id for quick lookup
    const sectionMap = new Map<string, Section>();
    for (const sec of precedentSections) {
      sectionMap.set(sec.id, sec);
    }

    // Build a map of paragraph IDs to their parent section
    const paraToSection = new Map<string, Section>();
    for (const sec of precedentSections) {
      for (const pid of sec.paragraph_ids ?? []) {
        paraToSection.set(pid, sec);
      }
    }

    // Track sections that have already been added as headers
    const addedSections = new Set<string>();

    for (const para of precedentParagraphs) {
      // Add section header if we haven't yet
      const parentSection = paraToSection.get(para.id);
      if (parentSection && !addedSections.has(parentSection.id)) {
        addedSections.add(parentSection.id);
        result.push({
          id: `section-${parentSection.id}`,
          type: "section",
          text: parentSection.caption || `Section ${parentSection.number}`,
          sectionNumber: parentSection.number,
          caption: parentSection.caption,
          level: parentSection.level,
          paraId: null,
        });
      }

      if (para.type === "heading") {
        result.push({
          id: para.id,
          type: "heading",
          text: para.text,
          sectionNumber: para.section_ref || "",
          caption: para.text,
          level: (para.section_hierarchy?.length || 1) - 1,
          paraId: para.id,
        });
      } else if (para.type === "paragraph") {
        // Caption: use section_hierarchy caption if available, else first ~60 chars
        const lastHierarchy =
          para.section_hierarchy?.[para.section_hierarchy.length - 1];
        const caption =
          lastHierarchy?.caption ||
          (para.text.length > 60
            ? para.text.slice(0, 60) + "..."
            : para.text);

        const level = para.section_hierarchy?.length
          ? para.section_hierarchy.length - 1
          : 0;

        result.push({
          id: para.id,
          type: "paragraph",
          text: para.text,
          sectionNumber: para.section_ref || "",
          caption,
          level,
          paraId: para.id,
        });
      }
    }

    return result;
  }, [precedentParagraphs, precedentSections]);

  // =========================================================================
  // Filter items by search and match-only toggle
  // =========================================================================

  const filteredItems = useMemo(() => {
    let filtered = items;

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.text.toLowerCase().includes(q) ||
          item.caption.toLowerCase().includes(q) ||
          item.sectionNumber.toLowerCase().includes(q)
      );
    }

    // Match-only filter
    if (matchOnly) {
      filtered = filtered.filter(
        (item) =>
          item.type === "section" ||
          (item.paraId && relatedParaIds.has(item.paraId))
      );
    }

    return filtered;
  }, [items, search, matchOnly, relatedParaIds]);

  // =========================================================================
  // Position mode toggle
  // =========================================================================

  const POSITION_MODES: {
    value: NavigatorPosition;
    icon: React.ReactNode;
    label: string;
  }[] = [
    {
      value: "right-sidebar",
      icon: <PanelRight className="h-3 w-3" />,
      label: "Sidebar",
    },
    {
      value: "bottom-drawer",
      icon: <PanelBottom className="h-3 w-3" />,
      label: "Drawer",
    },
  ];

  // =========================================================================
  // Empty state
  // =========================================================================

  if (precedentParagraphs.length === 0) {
    return (
      <div className="flex items-center justify-center p-4">
        <p className="text-xs italic text-muted-foreground">
          No precedent document loaded
        </p>
      </div>
    );
  }

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="flex h-full flex-col">
      {/* Header with position toggle */}
      <div className="flex items-center justify-between border-b px-2 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Navigator
        </span>
        <div className="flex items-center gap-0.5">
          {POSITION_MODES.map((mode) => (
            <button
              key={mode.value}
              onClick={() => setNavigatorPosition(mode.value)}
              className={`rounded p-1 transition-colors ${
                navigatorPosition === mode.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
              title={mode.label}
            >
              {mode.icon}
            </button>
          ))}
          {/* Close navigator → ghost mode */}
          <button
            onClick={() => setNavigatorPosition("ghost")}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Hide navigator"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Search + match filter */}
      <div className="flex items-center gap-1 border-b px-2 py-1.5">
        <div className="relative flex-1">
          <Search className="absolute left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="h-6 pl-6 text-[11px]"
          />
        </div>
        <Button
          variant={matchOnly ? "default" : "ghost"}
          size="icon-xs"
          onClick={() => setMatchOnly(!matchOnly)}
          title={matchOnly ? "Show all" : "Show matches only"}
        >
          <Filter className="h-3 w-3" />
        </Button>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto px-1 py-1">
        {filteredItems.length === 0 ? (
          <p className="p-3 text-center text-[11px] italic text-muted-foreground">
            {search.trim() || matchOnly
              ? "No matching clauses"
              : "No paragraphs found"}
          </p>
        ) : (
          <div className="space-y-px">
            {filteredItems.map((item) => {
              if (item.type === "section") {
                return (
                  <div
                    key={item.id}
                    className="px-1 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                    style={{ paddingLeft: `${4 + item.level * 12}px` }}
                  >
                    {item.sectionNumber && `${item.sectionNumber}. `}
                    {item.caption}
                  </div>
                );
              }

              const isMatch = item.paraId && relatedParaIds.has(item.paraId);
              const isPulsing = item.paraId && pulsingParaIds.has(item.paraId);

              return (
                <button
                  key={item.id}
                  onClick={() => item.paraId && onNavigate(item.paraId)}
                  className={`flex w-full items-center gap-1 rounded px-1.5 py-1 text-left text-xs transition-colors hover:bg-accent ${
                    isMatch ? "nav-match-dot bg-primary/[0.06]" : ""
                  } ${isPulsing ? "pulse-highlight" : ""}`}
                  style={{ paddingLeft: `${4 + item.level * 12}px` }}
                  onAnimationEnd={
                    isPulsing
                      ? (e) => {
                          (e.currentTarget as HTMLElement).classList.remove(
                            "pulse-highlight"
                          );
                        }
                      : undefined
                  }
                >
                  {item.sectionNumber && (
                    <span className="min-w-[28px] shrink-0 text-[10px] font-semibold tabular-nums text-muted-foreground">
                      {item.sectionNumber}
                    </span>
                  )}
                  <span className="flex-1 truncate text-[11px]">
                    {item.type === "heading" ? item.text : item.caption}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
