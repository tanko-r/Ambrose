"use client";

import { useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { flagItem, unflagItem, updateFlag } from "@/lib/api";
import type { FlagCategory, FlagType } from "@/lib/types";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// useFlags - CRUD operations for paragraph flags
// ---------------------------------------------------------------------------

export function useFlags() {
  const sessionId = useAppStore((s) => s.sessionId);
  const flags = useAppStore((s) => s.flags);

  const create = useCallback(
    async (paraId: string, flagType: FlagType, category: FlagCategory | undefined, note: string, textExcerpt?: string) => {
      if (!sessionId) {
        toast.error("No active session");
        return null;
      }
      try {
        const response = await flagItem({
          session_id: sessionId,
          para_id: paraId,
          note,
          flag_type: flagType,
          category,
          text_excerpt: textExcerpt,
        });
        useAppStore.getState().addFlag(response.flag);
        toast.success("Flagged for review");
        return response.flag;
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to create flag"
        );
        return null;
      }
    },
    [sessionId]
  );

  const update = useCallback(
    async (flagId: string, updates: { note?: string; category?: FlagCategory; flagType?: FlagType }) => {
      if (!sessionId) {
        toast.error("No active session");
        return;
      }
      try {
        const response = await updateFlag({
          session_id: sessionId,
          flag_id: flagId,
          note: updates.note,
          category: updates.category,
          flag_type: updates.flagType,
        });
        useAppStore.getState().updateFlag(response.flag);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to update flag"
        );
      }
    },
    [sessionId]
  );

  const remove = useCallback(
    async (flagId: string) => {
      if (!sessionId) {
        toast.error("No active session");
        return;
      }
      try {
        await unflagItem({ session_id: sessionId, flag_id: flagId });
        useAppStore.getState().removeFlag(flagId);
        toast.success("Flag removed");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to remove flag"
        );
      }
    },
    [sessionId]
  );

  const getFlagsForPara = useCallback(
    (paraId: string) => {
      return flags.filter((f) => f.para_id === paraId);
    },
    [flags]
  );

  return { create, update, remove, getFlagsForPara };
}
