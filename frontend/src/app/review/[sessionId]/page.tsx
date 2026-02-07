"use client";

import { use } from "react";
import { useAppStore } from "@/lib/store";
import { useDocument } from "@/hooks/use-document";
import { NavigationPanel } from "@/components/review/navigation-panel";
import { DocumentViewer } from "@/components/review/document-viewer";
import { Sidebar } from "@/components/review/sidebar";
import { BottomBar } from "@/components/review/bottom-bar";
import { Header } from "@/components/layout/header";

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

      {/* Bottom toolbar */}
      <BottomBar />
    </div>
  );
}
