"use client";

import { useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { flagItem, unflagItem } from "@/lib/api";
import type { FlagCategory, FlagType } from "@/lib/types";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// useFlags - CRUD operations for paragraph flags
// ---------------------------------------------------------------------------

export function useFlags() {
  const sessionId = useAppStore((s) => s.sessionId);
  const flags = useAppStore((s) => s.flags);

  const create = useCallback(
    async (paraId: string, flagType: FlagType, category: FlagCategory | undefined, note: string) => {
      if (!sessionId) {
        toast.error("No active session");
        return;
      }
      try {
        const response = await flagItem({
          session_id: sessionId,
          para_id: paraId,
          note,
          flag_type: flagType,
          category,
        });
        useAppStore.getState().addFlag(response.flag);
        toast.success("Flagged for review");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to create flag"
        );
      }
    },
    [sessionId]
  );

  const remove = useCallback(
    async (paraId: string) => {
      if (!sessionId) {
        toast.error("No active session");
        return;
      }
      try {
        await unflagItem({ session_id: sessionId, para_id: paraId });
        useAppStore.getState().removeFlag(paraId);
        toast.success("Flag removed");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to remove flag"
        );
      }
    },
    [sessionId]
  );

  const getFlagForPara = useCallback(
    (paraId: string) => {
      return flags.find((f) => f.para_id === paraId) ?? null;
    },
    [flags]
  );

  return { create, remove, getFlagForPara };
}
