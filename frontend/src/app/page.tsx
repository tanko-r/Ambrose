"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { Header } from "@/components/layout/header";
import { IntakeForm } from "@/components/dashboard/intake-form";
import { RecentProjects } from "@/components/dashboard/recent-projects";
import { NewProjectDialog } from "@/components/dialogs/new-project-dialog";

export default function DashboardPage() {
  const sessionId = useAppStore((s) => s.sessionId);
  const resetSession = useAppStore((s) => s.resetSession);
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  const handleNewProject = () => {
    // If there's an active session, show the dialog
    // Otherwise just reset directly (already on dashboard)
    if (sessionId) {
      setNewProjectOpen(true);
    } else {
      resetSession();
    }
  };

  return (
    <>
      <Header onNewProject={handleNewProject} />
      <main className="mx-auto max-w-5xl px-6 pt-20 pb-12">
        <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
          {/* Center: intake form card */}
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <IntakeForm />
          </div>

          {/* Sidebar: recent projects */}
          <aside className="space-y-6">
            <div className="rounded-xl border bg-card p-4">
              <RecentProjects />
            </div>
          </aside>
        </div>
      </main>

      <NewProjectDialog
        open={newProjectOpen}
        onOpenChange={setNewProjectOpen}
      />
    </>
  );
}
