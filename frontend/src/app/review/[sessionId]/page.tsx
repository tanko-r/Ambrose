"use client";

import { use, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { useDocument } from "@/hooks/use-document";
import { useAnalysis } from "@/hooks/use-analysis";
import { NavigationPanel } from "@/components/review/navigation-panel";
import { DocumentViewer } from "@/components/review/document-viewer";
import { Sidebar } from "@/components/review/sidebar";
import { BottomBar } from "@/components/review/bottom-bar";
import { RevisionSheet } from "@/components/review/revision-sheet";
import { Header } from "@/components/layout/header";
import { AnalysisOverlay } from "@/components/review/analysis-overlay";
import { SplitLayout } from "@/components/review/split-layout";
import { PrecedentPanel } from "@/components/review/precedent-panel";
import type { NavigatorPosition } from "@/lib/types";

export default function ReviewPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);

  // Set session ID in store and load document
  const setSession = useAppStore((s) => s.setSession);
  if (sessionId && !useAppStore.getState().sessionId) {
    setSession({ sessionId });
  }

  const { loading } = useDocument(sessionId);
  const { startAnalysis } = useAnalysis(sessionId);
  const analysisStatus = useAppStore((s) => s.analysisStatus);

  // Read precedentScrollTarget for initial scroll when opening from Related tab
  const precedentScrollTarget = useAppStore((s) => s.precedentScrollTarget);

  // Auto-start analysis when document finishes loading and analysis hasn't run
  useEffect(() => {
    if (!loading && sessionId && analysisStatus === "not_started") {
      startAnalysis();
    }
  }, [loading, sessionId, analysisStatus, startAnalysis]);

  // Initialize navigatorPosition from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("precedent-navigator-position");
    if (
      saved &&
      ["right-sidebar", "bottom-drawer", "overlay"].includes(saved)
    ) {
      useAppStore.getState().setNavigatorPosition(saved as NavigatorPosition);
    }
  }, []);

  // Persist navigatorPosition changes to localStorage
  useEffect(() => {
    let prev = useAppStore.getState().navigatorPosition;
    const unsub = useAppStore.subscribe((state) => {
      if (state.navigatorPosition !== prev) {
        prev = state.navigatorPosition;
        localStorage.setItem("precedent-navigator-position", state.navigatorPosition);
      }
    });
    return unsub;
  }, []);

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <Header />

      {/* Main content area: nav + document + sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Navigation panel */}
        <NavigationPanel />

        {/* Center: Document viewer + precedent split */}
        <SplitLayout
          precedentSlot={
            <PrecedentPanel
              initialScrollTarget={precedentScrollTarget ?? undefined}
            />
          }
        >
          <DocumentViewer loading={loading} />
        </SplitLayout>

        {/* Right: Analysis sidebar (outside split layout) */}
        <Sidebar />
      </div>

      {/* Revision bottom sheet (non-modal, renders over document area) */}
      <RevisionSheet />

      {/* Bottom toolbar */}
      <BottomBar />

      {/* Analysis progress overlay (renders only during analysis) */}
      <AnalysisOverlay />
    </div>
  );
}
