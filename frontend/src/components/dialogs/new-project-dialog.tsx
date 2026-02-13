"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { saveSession } from "@/lib/api";
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

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// NewProjectDialog - Auto-save + confirmation with "Don't show again"
// ---------------------------------------------------------------------------

const SKIP_CONFIRM_KEY = "new-project-skip-confirm";

export function NewProjectDialog({
  open,
  onOpenChange,
}: NewProjectDialogProps) {
  const router = useRouter();
  const { sessionId, revisions, flags, resetSession, setSession } =
    useAppStore();
  const [saving, setSaving] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // Quick save and navigate without showing dialog
  const quickSaveAndGo = useCallback(async () => {
    if (sessionId) {
      try {
        await saveSession(sessionId);
        toast.success("Session saved");
      } catch {
        // Best effort save
      }
    }
    // Snapshot intake settings before reset
    const state = useAppStore.getState();
    const prevRep = state.representation;
    const prevApp = state.approach;
    const prevAgg = state.aggressiveness;

    resetSession();

    // Restore carried-over settings
    setSession({
      representation: prevRep,
      approach: prevApp,
      aggressiveness: prevAgg,
    });

    onOpenChange(false);
    router.push("/");
  }, [sessionId, resetSession, setSession, onOpenChange, router]);

  // On open, check skip preference
  useEffect(() => {
    if (!open) return;

    const skipConfirm = localStorage.getItem(SKIP_CONFIRM_KEY) === "true";
    if (skipConfirm && sessionId) {
      // Skip dialog entirely: auto-save and navigate
      quickSaveAndGo();
    }
  }, [open, sessionId, quickSaveAndGo]);

  const handleContinue = async () => {
    // Persist "Don't show again" preference
    if (dontShowAgain) {
      localStorage.setItem(SKIP_CONFIRM_KEY, "true");
    }

    setSaving(true);
    try {
      if (sessionId) {
        await saveSession(sessionId);
        toast.success("Session saved");
      }

      // Snapshot intake settings before reset
      const state = useAppStore.getState();
      const prevRep = state.representation;
      const prevApp = state.approach;
      const prevAgg = state.aggressiveness;

      resetSession();

      // Restore carried-over settings
      setSession({
        representation: prevRep,
        approach: prevApp,
        aggressiveness: prevAgg,
      });

      onOpenChange(false);
      router.push("/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // Compute work stats from store directly
  const revisionCount = Object.keys(revisions).length;
  const flagCount = flags.length;
  const hasWork = revisionCount > 0 || flagCount > 0;

  // If skip preference is set and we triggered quickSaveAndGo, don't render dialog
  const skipConfirm =
    typeof window !== "undefined" &&
    localStorage.getItem(SKIP_CONFIRM_KEY) === "true";
  if (skipConfirm && open) {
    return null;
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Start New Project?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>
              <p>Current work will be saved automatically.</p>
              {hasWork && (
                <p className="mt-1 text-xs">
                  {revisionCount} revision{revisionCount !== 1 ? "s" : ""},{" "}
                  {flagCount} flag{flagCount !== 1 ? "s" : ""} will be saved.
                </p>
              )}
              <label className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                Don&apos;t show this again
              </label>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleContinue} disabled={saving}>
            {saving && (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            )}
            Continue
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
