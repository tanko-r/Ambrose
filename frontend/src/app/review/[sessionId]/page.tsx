"use client";

import { use, useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { useDocument } from "@/hooks/use-document";
import { useAnalysis } from "@/hooks/use-analysis";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { NavigationPanel } from "@/components/review/navigation-panel";
import { DocumentViewer } from "@/components/review/document-viewer";
import { Sidebar } from "@/components/review/sidebar";
import { BottomBar } from "@/components/review/bottom-bar";
import { RevisionSheet } from "@/components/review/revision-sheet";
import { Header } from "@/components/layout/header";
import { AnalysisOverlay } from "@/components/review/analysis-overlay";
import { SplitLayout } from "@/components/review/split-layout";
import { PrecedentPanel } from "@/components/review/precedent-panel";
import { CommandPalette } from "@/components/command-palette";
import { KeyboardHelp } from "@/components/keyboard-help";
import type { NavigatorPosition } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import Link from "next/link";

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

  const { loading, error: documentError } = useDocument(sessionId);
  const { startAnalysis } = useAnalysis(sessionId);
  const analysisStatus = useAppStore((s) => s.analysisStatus);

  // Read precedentScrollTarget for initial scroll when opening from Related tab
  const precedentScrollTarget = useAppStore((s) => s.precedentScrollTarget);

  // Read session status for finalized banner
  const status = useAppStore((s) => s.status);

  // Command palette + keyboard help dialog state
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Register keyboard shortcuts
  useKeyboardShortcuts({
    openCommandPalette: () => setCmdPaletteOpen(true),
    openHelpDialog: () => setHelpOpen(true),
    openSettings: () => window.dispatchEvent(new CustomEvent("command:open-settings")),
  });

  // Auto-start analysis when document finishes loading and analysis hasn't run
  useEffect(() => {
    if (!loading && !documentError && sessionId && analysisStatus === "not_started") {
      startAnalysis();
    }
  }, [loading, documentError, sessionId, analysisStatus, startAnalysis]);

  // Auto-collapse left nav panel when precedent panel opens (reclaim space)
  const precedentPanelOpen = useAppStore((s) => s.precedentPanelOpen);
  useEffect(() => {
    if (precedentPanelOpen) {
      const { navPanelOpen, toggleNavPanel } = useAppStore.getState();
      if (navPanelOpen) toggleNavPanel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [precedentPanelOpen]);

  // Initialize navigatorPosition from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("precedent-navigator-position");
    if (
      saved &&
      ["right-sidebar", "bottom-drawer", "ghost"].includes(saved)
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

  const compactMode = useAppStore((s) => s.compactMode);

  // Show error page when session/document fails to load
  if (documentError && !loading) {
    return (
      <div className="flex h-screen flex-col overflow-hidden">
        <Header />
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive" />
            <h2 className="text-lg font-semibold">Session Not Found</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              {documentError}
            </p>
            <Button asChild variant="outline">
              <Link href="/">Back to Home</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen flex-col overflow-hidden${compactMode ? " compact" : ""}`}>
      {/* Header */}
      <Header />

      {/* Finalized project banner */}
      {status === "finalized" && (
        <div className="flex items-center justify-between border-b bg-green-50 px-6 py-2">
          <div className="flex items-center gap-2 text-sm text-green-800">
            <CheckCircle2 className="h-4 w-4" />
            <span>
              This project was finalized. Editing will clear the finalized
              status.
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => setSession({ status: "analyzed" })}
          >
            Edit
          </Button>
        </div>
      )}

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

      {/* Command palette (Cmd/Ctrl+K) */}
      <CommandPalette open={cmdPaletteOpen} onOpenChange={setCmdPaletteOpen} />

      {/* Keyboard shortcuts help dialog (? key) */}
      <KeyboardHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}
