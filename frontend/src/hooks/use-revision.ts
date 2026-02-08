"use client";

// =============================================================================
// useRevision — Revision lifecycle hook
// Encapsulates generate, accept, reject, and reopen operations.
// Components call these methods; the hook manages store + API coordination.
// =============================================================================

import { useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { revise, acceptRevision, rejectRevision } from "@/lib/api";
import { extractFinalText } from "@/lib/track-changes";
import { toast } from "sonner";

export function useRevision() {
  // Subscribe to generatingRevision for reactivity
  const generating = useAppStore((s) => s.generatingRevision);

  /**
   * Generate a revision for a paragraph addressing specific risks.
   * Calls POST /api/revise and stores the result in the Zustand store.
   * Opens the bottom sheet to display the revision.
   */
  const generate = useCallback(
    async (
      paraId: string,
      riskIds: string[],
      includeRelatedIds?: string[],
      customInstruction?: string
    ) => {
      const { sessionId } = useAppStore.getState();

      if (!sessionId || riskIds.length === 0) return;

      useAppStore.getState().setGeneratingRevision(true);

      try {
        const result = await revise({
          session_id: sessionId,
          para_id: paraId,
          risk_ids: riskIds,
          include_related_ids: includeRelatedIds,
          custom_instruction: customInstruction,
        });

        // Read fresh state after async call completes
        const store = useAppStore.getState();
        console.log("[generate] API done. bottomSheetOpen:", store.bottomSheetOpen, "paraId:", paraId);

        store.setRevision(paraId, {
          original: result.original,
          revised: result.revised,
          rationale: result.rationale,
          thinking: result.thinking,
          diff_html: result.diff_html,
          related_revisions: result.related_revisions,
          accepted: false,
          timestamp: new Date().toISOString(),
        });
        console.log("[generate] setRevision done");

        store.setRevisionSheetParaId(paraId);
        console.log("[generate] setRevisionSheetParaId done");

        const freshOpen = useAppStore.getState().bottomSheetOpen;
        console.log("[generate] re-read bottomSheetOpen:", freshOpen);
        if (!freshOpen) {
          store.toggleBottomSheet();
          console.log("[generate] toggled. now:", useAppStore.getState().bottomSheetOpen);
        } else {
          console.log("[generate] sheet already open, skipping toggle");
        }

        toast.success("Revision generated");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Revision failed"
        );
      } finally {
        useAppStore.getState().setGeneratingRevision(false);
      }
    },
    []
  );

  /**
   * Accept a revision, optionally persisting user inline edits from the editor element.
   * Calls POST /api/accept and marks the revision as accepted in the store.
   */
  const accept = useCallback(
    async (paraId: string, editorElement?: HTMLElement | null) => {
      const { sessionId, revisions, setRevision } = useAppStore.getState();
      if (!sessionId) return;

      const current = revisions[paraId];

      // Persist edited HTML from the contentEditable editor if provided
      if (editorElement && current) {
        setRevision(paraId, {
          ...current,
          editedHtml: editorElement.innerHTML,
          revised: extractFinalText(editorElement),
        });
      }

      try {
        const result = await acceptRevision({
          session_id: sessionId,
          para_id: paraId,
        });

        // Re-read current state (may have been updated above)
        const latest = useAppStore.getState().revisions[paraId];
        if (latest) {
          setRevision(paraId, { ...latest, accepted: true });
        }

        if (
          result.affected_para_ids &&
          result.affected_para_ids.length > 0
        ) {
          toast.success(
            `Revision approved (${result.affected_para_ids.length} related clauses may need re-analysis)`
          );
        } else {
          toast.success("Revision approved");
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Approve failed"
        );
      }
    },
    []
  );

  /**
   * Reject a revision, removing it from the store and closing the bottom sheet.
   * Calls POST /api/reject.
   */
  const reject = useCallback(async (paraId: string) => {
    const {
      sessionId,
      removeRevision,
      bottomSheetOpen,
      toggleBottomSheet,
      setRevisionSheetParaId,
    } = useAppStore.getState();

    if (!sessionId) return;

    try {
      await rejectRevision({
        session_id: sessionId,
        para_id: paraId,
      });

      removeRevision(paraId);

      if (bottomSheetOpen) {
        toggleBottomSheet();
      }
      setRevisionSheetParaId(null);

      toast.info("Revision rejected");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Reject failed"
      );
    }
  }, []);

  /**
   * Reopen an accepted revision for further editing.
   * Synchronous, no API call. Keeps editedHtml so user continues where they left off.
   */
  const reopen = useCallback((paraId: string) => {
    const { revisions, setRevision } = useAppStore.getState();
    const current = revisions[paraId];
    if (!current) return;

    // Mark as not accepted — keep editedHtml for continuity
    setRevision(paraId, { ...current, accepted: false });

    toast.info("Revision reopened for editing");
  }, []);

  return { generate, accept, reject, reopen, generating };
}
