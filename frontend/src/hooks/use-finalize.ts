import { useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { finalizePreview, finalize, downloadFile } from "@/lib/api";
import type { FinalizePreviewResponse, FinalizeResponse } from "@/lib/types";
import { toast } from "sonner";

export function useFinalize() {
  const sessionId = useAppStore((s) => s.sessionId);

  const fetchPreview = useCallback(async (): Promise<FinalizePreviewResponse | null> => {
    if (!sessionId) {
      toast.error("No active session");
      return null;
    }
    try {
      return await finalizePreview({ session_id: sessionId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load preview");
      return null;
    }
  }, [sessionId]);

  const doExport = useCallback(
    async (authorName: string): Promise<FinalizeResponse | null> => {
      if (!sessionId) {
        toast.error("No active session");
        return null;
      }
      try {
        const result = await finalize({
          session_id: sessionId,
          author_name: authorName || undefined,
        });
        useAppStore.getState().setSession({ status: "finalized" });
        return result;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Export failed");
        return null;
      }
    },
    [sessionId]
  );

  const download = useCallback(
    async (type: "track_changes" | "clean", filename?: string) => {
      if (!sessionId) {
        toast.error("No active session");
        return;
      }
      try {
        const blob = await downloadFile(sessionId, type);
        const targetFilename =
          filename || useAppStore.getState().targetFilename || "document";
        const defaultFilename = `${targetFilename.replace(/\.docx$/i, "")}_${type}.docx`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = defaultFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success("Download started");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Download failed");
      }
    },
    [sessionId]
  );

  return { fetchPreview, doExport, download };
}
