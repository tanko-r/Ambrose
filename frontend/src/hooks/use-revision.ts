"use client";

// =============================================================================
// useRevision — Revision lifecycle hook
// Encapsulates generate, accept, reject, reopen, and stop operations.
// Components call these methods; the hook manages store + API coordination.
// =============================================================================

import { useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { revise, acceptRevision, rejectRevision, unacceptRevision } from "@/lib/api";
import { extractFinalText } from "@/lib/track-changes";
import { toast } from "sonner";

// Module-scoped AbortController so all consumers of useRevision share
// the same cancellation handle for the current in-flight generation.
let abortController: AbortController | null = null;

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

      // Abort any existing in-flight generation
      abortController?.abort();

      // Create a new controller for this request
      const controller = new AbortController();
      abortController = controller;

      useAppStore.getState().setGeneratingRevision(true);

      try {
        const result = await revise(
          {
            session_id: sessionId,
            para_id: paraId,
            risk_ids: riskIds,
            include_related_ids: includeRelatedIds,
            custom_instruction: customInstruction,
          },
          controller.signal
        );

        const store = useAppStore.getState();

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
        store.setRevisionSheetParaId(paraId);

        const freshOpen = useAppStore.getState().bottomSheetOpen;
        if (!freshOpen) {
          store.toggleBottomSheet();
        }

        toast.success("Revision generated");
      } catch (err) {
        // If the request was aborted (user clicked Stop), exit silently
        if (controller.signal.aborted) {
          return;
        }
        toast.error(
          err instanceof Error ? err.message : "Revision failed"
        );
      } finally {
        // Only reset state if this controller is still the active one
        // (i.e., not replaced by a newer generate call)
        if (abortController === controller) {
          useAppStore.getState().setGeneratingRevision(false);
          abortController = null;
        }
      }
    },
    []
  );

  /**
   * Stop the current in-flight revision generation.
   * Aborts the fetch and resets generatingRevision to false.
   */
  const stopGeneration = useCallback(() => {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    useAppStore.getState().setGeneratingRevision(false);
  }, []);

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
        // Read the latest state which may include edits
        const latestBeforeApi = useAppStore.getState().revisions[paraId];

        const result = await acceptRevision({
          session_id: sessionId,
          para_id: paraId,
          revised: latestBeforeApi?.revised,
          diff_html: latestBeforeApi?.editedHtml || latestBeforeApi?.diff_html,
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
   * Syncs to backend via POST /api/unaccept. Keeps editedHtml for continuity.
   */
  const reopen = useCallback(async (paraId: string) => {
    const { sessionId, revisions, setRevision } = useAppStore.getState();
    const current = revisions[paraId];
    if (!current || !sessionId) return;

    // Optimistically update frontend immediately
    setRevision(paraId, { ...current, accepted: false });

    try {
      await unacceptRevision({ session_id: sessionId, para_id: paraId });
      toast.info("Revision reopened for editing");
    } catch (err) {
      // Revert on failure
      setRevision(paraId, { ...current, accepted: true });
      toast.error(err instanceof Error ? err.message : "Failed to reopen revision");
    }
  }, []);

  return { generate, accept, reject, reopen, generating, stopGeneration };
}
