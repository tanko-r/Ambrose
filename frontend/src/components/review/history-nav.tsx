"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const HOVER_OPEN_MS = 200;
const HOVER_CLOSE_MS = 150;

function NavButton({
  direction,
  disabled,
  items,
  getLabel,
  onStep,
  onJump,
}: {
  direction: "back" | "forward";
  disabled: boolean;
  items: { id: string; index: number }[];
  getLabel: (paraId: string) => string;
  onStep: () => void;
  onJump: (index: number) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Suppress re-open after click until mouse fully leaves
  const suppressRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  }, []);

  const startOpen = useCallback(() => {
    if (disabled || items.length === 0 || suppressRef.current) return;
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    if (!menuOpen) {
      openTimer.current = setTimeout(() => setMenuOpen(true), HOVER_OPEN_MS);
    }
  }, [disabled, items.length, menuOpen]);

  const startClose = useCallback(() => {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
    closeTimer.current = setTimeout(() => setMenuOpen(false), HOVER_CLOSE_MS);
  }, []);

  // Close menu on scroll
  useEffect(() => {
    if (!menuOpen) return;
    const handleScroll = () => setMenuOpen(false);
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [menuOpen]);

  const Icon = direction === "back" ? ChevronLeft : ChevronRight;

  return (
    <div
      className="relative"
      onMouseEnter={startOpen}
      onMouseLeave={() => {
        startClose();
        suppressRef.current = false;
      }}
    >
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        disabled={disabled}
        onClick={() => {
          clearTimers();
          setMenuOpen(false);
          suppressRef.current = true;
          onStep();
        }}
        aria-label={
          direction === "back"
            ? "Go back in clause history"
            : "Go forward in clause history"
        }
      >
        <Icon className="h-3.5 w-3.5" />
      </Button>

      {menuOpen && items.length > 0 && (
        <div
          className={`absolute top-full ${direction === "back" ? "left-0" : "left-[-30px]"} mt-1 min-w-[180px] max-h-80 overflow-y-auto rounded-md border bg-popover p-1 shadow-md animate-in fade-in-0 zoom-in-95`}
          onMouseEnter={() => {
            if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
          }}
          onMouseLeave={startClose}
        >
          {items.map((item) => (
            <button
              key={`${direction}-${item.index}`}
              onClick={() => {
                setMenuOpen(false);
                suppressRef.current = true;
                onJump(item.index);
              }}
              className="flex w-full items-center rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <span className="truncate">{getLabel(item.id)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function HistoryNav() {
  const paragraphs = useAppStore((s) => s.paragraphs);
  const focusHistory = useAppStore((s) => s.focusHistory);
  const focusHistoryIndex = useAppStore((s) => s.focusHistoryIndex);
  const goBackInHistory = useAppStore((s) => s.goBackInHistory);
  const goForwardInHistory = useAppStore((s) => s.goForwardInHistory);
  const goToHistoryIndex = useAppStore((s) => s.goToHistoryIndex);

  if (focusHistory.length <= 1) return null;

  const currentPos =
    focusHistoryIndex === -1 ? focusHistory.length - 1 : focusHistoryIndex;
  const backDisabled = currentPos <= 0;
  const forwardDisabled = focusHistoryIndex === -1;

  const getLabel = (paraId: string) => {
    const p = paragraphs.find((p) => p.id === paraId);
    if (!p) return paraId;
    const ref = p.section_ref || "";
    const caption =
      p.section_hierarchy?.length
        ? p.section_hierarchy[p.section_hierarchy.length - 1].caption
        : "";
    if (ref && caption) return `${ref} ${caption}`;
    if (ref) return ref;
    if (caption) return caption;
    const text = p.text?.slice(0, 40) || paraId;
    return text.length >= 40 ? text + "\u2026" : text;
  };

  const backItems = focusHistory
    .slice(0, currentPos)
    .map((id, i) => ({ id, index: i }))
    .reverse();

  const forwardItems = focusHistory
    .slice(currentPos + 1)
    .map((id, i) => ({ id, index: currentPos + 1 + i }));

  return (
    <div className="no-print sticky top-0 z-30 h-0 overflow-visible">
      <div className="mt-2 flex w-fit items-center gap-0.5 rounded-lg border bg-card/60 backdrop-blur-sm shadow-sm transition-opacity hover:bg-card hover:shadow-md opacity-50 hover:opacity-100">
        <NavButton
          direction="back"
          disabled={backDisabled}
          items={backItems}
          getLabel={getLabel}
          onStep={goBackInHistory}
          onJump={goToHistoryIndex}
        />
        <div className="h-4 w-px bg-border" />
        <NavButton
          direction="forward"
          disabled={forwardDisabled}
          items={forwardItems}
          getLabel={getLabel}
          onStep={goForwardInHistory}
          onJump={goToHistoryIndex}
        />
      </div>
    </div>
  );
}
