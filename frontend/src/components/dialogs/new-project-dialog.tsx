"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { saveSession, discardSession, getSessionInfo } from "@/lib/api";
import type { SessionInfoResponse } from "@/lib/types";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewProjectDialog({ open, onOpenChange }: NewProjectDialogProps) {
  const router = useRouter();
  const { sessionId, resetSession } = useAppStore();
  const [info, setInfo] = useState<SessionInfoResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Fetch session info when dialog opens
  const handleOpenChange = async (nextOpen: boolean) => {
    if (nextOpen && sessionId) {
      try {
        const data = await getSessionInfo(sessionId);
        setInfo(data);
        setLoaded(true);
      } catch {
        // Session might not exist — just show generic dialog
        setInfo(null);
        setLoaded(true);
      }
    } else if (!nextOpen) {
      setLoaded(false);
      setInfo(null);
    }
    onOpenChange(nextOpen);
  };

  const goToDashboard = () => {
    resetSession();
    onOpenChange(false);
    router.push("/");
  };

  const handleSave = async () => {
    if (!sessionId) return;
    setSaving(true);
    try {
      await saveSession(sessionId);
      toast.success("Session saved");
      goToDashboard();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = async () => {
    if (!sessionId) return;
    setDiscarding(true);
    try {
      await discardSession(sessionId);
      toast.success("Session discarded");
    } catch {
      // Discard best-effort
    } finally {
      setDiscarding(false);
      goToDashboard();
    }
  };

  const hasWork =
    info &&
    (info.stats.total_revisions > 0 || info.stats.total_flags > 0);

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Start New Project?</AlertDialogTitle>
          <AlertDialogDescription>
            {!loaded ? (
              "Checking current session..."
            ) : !hasWork ? (
              "This will close your current session and start fresh."
            ) : (
              <>
                You have unsaved work on{" "}
                <span className="font-medium text-foreground">
                  {info?.target_filename}
                </span>
                :
                <ul className="mt-2 list-inside list-disc text-sm">
                  {(info?.stats.accepted_revisions ?? 0) > 0 && (
                    <li>{info?.stats.accepted_revisions} accepted revisions</li>
                  )}
                  {(info?.stats.pending_revisions ?? 0) > 0 && (
                    <li>{info?.stats.pending_revisions} pending revisions</li>
                  )}
                  {(info?.stats.client_flags ?? 0) > 0 && (
                    <li>{info?.stats.client_flags} client flags</li>
                  )}
                  {(info?.stats.attorney_flags ?? 0) > 0 && (
                    <li>{info?.stats.attorney_flags} attorney flags</li>
                  )}
                </ul>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving || discarding}
          >
            Cancel
          </Button>
          {hasWork ? (
            <>
              <Button
                variant="destructive"
                onClick={handleDiscard}
                disabled={saving || discarding}
              >
                {discarding && (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                )}
                Discard
              </Button>
              <Button onClick={handleSave} disabled={saving || discarding}>
                {saving && (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                )}
                Save & Close
              </Button>
            </>
          ) : (
            <Button onClick={goToDashboard}>Continue</Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
