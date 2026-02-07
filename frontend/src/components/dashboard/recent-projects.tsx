"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { listSavedSessions, loadSession } from "@/lib/api";
import type { SavedSessionListItem, SessionStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { FileText, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";

function formatRelativeDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function statusVariant(
  status: SessionStatus
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "analyzed":
      return "default";
    case "finalized":
      return "secondary";
    default:
      return "outline";
  }
}

export function RecentProjects() {
  const router = useRouter();
  const { setSession, setView, setSavedSessions, savedSessions } =
    useAppStore();
  const [loading, setLoading] = useState(true);
  const [resuming, setResuming] = useState<string | null>(null);

  useEffect(() => {
    listSavedSessions()
      .then((res) => {
        setSavedSessions(res.sessions);
      })
      .catch(() => {
        // Non-fatal — just show empty state
      })
      .finally(() => setLoading(false));
  }, [setSavedSessions]);

  const handleResume = async (session: SavedSessionListItem) => {
    setResuming(session.session_id);
    try {
      const result = await loadSession(session.session_id);
      toast.success(`Resumed: ${result.target_filename}`);

      setSession({
        sessionId: result.session_id,
        status: result.session_status,
        targetFilename: result.target_filename,
        contractType: session.contract_type,
        representation: session.representation,
      });
      setView("review");

      router.push(`/review/${result.session_id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load session"
      );
    } finally {
      setResuming(null);
    }
  };

  // Show max 6 recent projects
  const visible = savedSessions.slice(0, 6);

  if (loading) {
    return (
      <div className="space-y-3">
        <SectionHeader />
        <div className="flex justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <SectionHeader />
      {visible.length === 0 ? (
        <p className="py-4 text-center text-sm italic text-muted-foreground">
          No saved projects yet
        </p>
      ) : (
        <div className="space-y-1">
          {visible.map((session) => (
            <button
              key={session.session_id}
              onClick={() => handleResume(session)}
              disabled={resuming !== null}
              className="group flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent disabled:opacity-50"
            >
              {resuming === session.session_id ? (
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
              ) : (
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {session.target_filename}
                  </span>
                  <Badge
                    variant={statusVariant(session.status)}
                    className="shrink-0 text-[10px] px-1.5 py-0"
                  >
                    {session.status}
                  </Badge>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatRelativeDate(session.last_modified)}</span>
                  {session.revisions_count > 0 && (
                    <>
                      <span className="text-border">·</span>
                      <span>{session.revisions_count} revisions</span>
                    </>
                  )}
                  {session.flags_count > 0 && (
                    <>
                      <span className="text-border">·</span>
                      <span>{session.flags_count} flags</span>
                    </>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionHeader() {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
      <Clock className="h-4 w-4 text-muted-foreground" />
      Recent Projects
    </div>
  );
}
