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

  // Auto-start analysis when document finishes loading and analysis hasn't run
  useEffect(() => {
    if (!loading && sessionId && analysisStatus === "not_started") {
      startAnalysis();
    }
  }, [loading, sessionId, analysisStatus, startAnalysis]);

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <Header />

      {/* Main content area: nav + document + sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Navigation panel */}
        <NavigationPanel />

        {/* Center: Document viewer */}
        <DocumentViewer loading={loading} />

        {/* Right: Analysis sidebar */}
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
