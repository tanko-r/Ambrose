"use client";

// =============================================================================
// SplitLayout -- Resizable split pane for document + precedent
// Uses react-resizable-panels v4 API directly (not shadcn wrapper).
// Panel sizes persist to localStorage manually (useDefaultLayout has SSR issues).
// =============================================================================

import { Group, Panel, Separator } from "react-resizable-panels";
import { useAppStore } from "@/lib/store";

const DEFAULT_MAIN = 60;
const DEFAULT_PREC = 40;

interface SplitLayoutProps {
  children: React.ReactNode;
  precedentSlot?: React.ReactNode;
}

export function SplitLayout({ children, precedentSlot }: SplitLayoutProps) {
  const precedentPanelOpen = useAppStore((s) => s.precedentPanelOpen);

  // When precedent is closed, render just the document viewer at full width
  if (!precedentPanelOpen || !precedentSlot) {
    return <>{children}</>;
  }

  return (
    <Group orientation="horizontal">
      <Panel id="main-doc" defaultSize={DEFAULT_MAIN} minSize={35}>
        {children}
      </Panel>
      <Separator
        id="split-handle"
        className="w-1.5 bg-border hover:bg-primary/30 active:bg-primary/50 transition-colors data-[resize-handle-active]:bg-primary/50"
      />
      <Panel id="precedent" defaultSize={DEFAULT_PREC} minSize={25}>
        {precedentSlot}
      </Panel>
    </Group>
  );
}
