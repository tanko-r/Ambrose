"use client";

import { useEffect, useState, useCallback } from "react";
import { listTrash, restoreSession } from "@/lib/api";
import type { TrashedSession } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, RotateCcw, FileText } from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysUntil(isoString: string): number {
  const expires = new Date(isoString).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((expires - now) / 86400000));
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TrashListProps {
  onRestore: () => void;
}

// ---------------------------------------------------------------------------
// TrashList — View listing deleted sessions with restore capability
// ---------------------------------------------------------------------------

export function TrashList({ onRestore }: TrashListProps) {
  const [sessions, setSessions] = useState<TrashedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);

  const fetchTrash = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listTrash();
      setSessions(data);
    } catch {
      toast.error("Failed to load trash");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrash();
  }, [fetchTrash]);

  const handleRestore = async (sessionId: string) => {
    setRestoring(sessionId);
    try {
      await restoreSession(sessionId);
      toast.success("Session restored");
      onRestore();
      await fetchTrash();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to restore session"
      );
    } finally {
      setRestoring(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <Trash2 className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No sessions in trash</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {sessions.map((session) => {
        const days = daysUntil(session.expires_at);
        const isExpiringSoon = days <= 7;

        return (
          <div
            key={session.session_id}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-accent"
          >
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {session.target_filename ?? "Untitled"}
              </p>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                {session.contract_type && (
                  <>
                    <span className="capitalize">{session.contract_type}</span>
                    <span className="text-border">&middot;</span>
                  </>
                )}
                <span>Deleted {formatDate(session.deleted_at)}</span>
                <span className="text-border">&middot;</span>
                <span
                  className={
                    isExpiringSoon ? "font-medium text-orange-600" : ""
                  }
                >
                  {days === 0
                    ? "Expires today"
                    : `Expires in ${days} day${days === 1 ? "" : "s"}`}
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRestore(session.session_id)}
              disabled={restoring !== null}
              className="shrink-0 gap-1.5 text-xs"
            >
              {restoring === session.session_id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RotateCcw className="h-3 w-3" />
              )}
              Restore
            </Button>
          </div>
        );
      })}
    </div>
  );
}
