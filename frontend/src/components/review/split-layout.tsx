"use client";

// =============================================================================
// SplitLayout -- Resizable split pane for document + precedent
// Uses react-resizable-panels v4 API directly (not shadcn wrapper).
// Panel sizes persist to localStorage via useDefaultLayout.
// =============================================================================

import { Group, Panel, Separator, useDefaultLayout } from "react-resizable-panels";
import { useAppStore } from "@/lib/store";

interface SplitLayoutProps {
  children: React.ReactNode;
  precedentSlot?: React.ReactNode;
}

export function SplitLayout({ children, precedentSlot }: SplitLayoutProps) {
  const precedentPanelOpen = useAppStore((s) => s.precedentPanelOpen);

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "precedent-split",
    storage: typeof window !== "undefined" ? localStorage : undefined,
  });

  // When precedent is closed, render just the document viewer at full width
  if (!precedentPanelOpen || !precedentSlot) {
    return <>{children}</>;
  }

  return (
    <Group
      orientation="horizontal"
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
    >
      <Panel id="main-doc" defaultSize="60%" minSize="35%">
        {children}
      </Panel>
      <Separator
        id="split-handle"
        className="w-1.5 bg-border hover:bg-primary/30 active:bg-primary/50 transition-colors data-[resize-handle-active]:bg-primary/50"
      />
      <Panel id="precedent" defaultSize="40%" minSize="25%">
        {precedentSlot}
      </Panel>
    </Group>
  );
}
