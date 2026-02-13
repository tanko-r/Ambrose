"use client";

// =============================================================================
// usePrecedent -- Precedent data loading, related clause fetching, lock, snippets
// Primary data hook for the precedent split view feature.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { getPrecedent, getPrecedentHtml, getRelatedClauses } from "@/lib/api";
import { toast } from "sonner";
import type { RelatedClause, PrecedentSnippet } from "@/lib/types";

export function usePrecedent() {
  // --- Store selectors ---
  const sessionId = useAppStore((s) => s.sessionId);
  const hasPrecedent = useAppStore((s) => s.hasPrecedent);
  const selectedParaId = useAppStore((s) => s.selectedParaId);
  const precedentHtml = useAppStore((s) => s.precedentHtml);
  const precedentFilename = useAppStore((s) => s.precedentFilename);
  const precedentParagraphs = useAppStore((s) => s.precedentParagraphs);
  const precedentSections = useAppStore((s) => s.precedentSections);
  const lockedParaId = useAppStore((s) => s.lockedParaId);
  const lockedRelatedClauses = useAppStore((s) => s.lockedRelatedClauses);
  const precedentSnippets = useAppStore((s) => s.precedentSnippets);

  const setDocument = useAppStore((s) => s.setDocument);
  const setPrecedentData = useAppStore((s) => s.setPrecedentData);
  const setLockedParaId = useAppStore((s) => s.setLockedParaId);
  const setLockedRelatedClauses = useAppStore((s) => s.setLockedRelatedClauses);
  const addPrecedentSnippetAction = useAppStore((s) => s.addPrecedentSnippet);
  const removePrecedentSnippetAction = useAppStore((s) => s.removePrecedentSnippet);
  const clearPrecedentSnippetsAction = useAppStore((s) => s.clearPrecedentSnippets);

  // --- Local state ---
  const [loading, setLoading] = useState(false);
  const [relatedClauses, setRelatedClauses] = useState<RelatedClause[]>([]);
  const [allRelatedClauses, setAllRelatedClauses] = useState<RelatedClause[]>([]);

  // Cache for related clauses keyed by paraId
  const cacheRef = useRef<Map<string, RelatedClause[]>>(new Map());

  // Track active fetch to prevent stale updates
  const fetchIdRef = useRef(0);

  // ==========================================================================
  // 1. Load precedent data on mount
  // NOTE: Uses store state check (not ref) to prevent double-fetch.
  // A ref-based guard breaks with React strict mode's double-invocation:
  // the first run sets the ref but its fetch gets cancelled by cleanup,
  // then the second run sees the ref and skips, leaving data unloaded.
  // ==========================================================================

  useEffect(() => {
    if (!sessionId || !hasPrecedent) return;

    // Already loaded — check store state (works correctly with strict mode)
    const { precedentFilename: alreadyLoaded } = useAppStore.getState();
    if (alreadyLoaded) return;

    let cancelled = false;

    async function loadPrecedent() {
      setLoading(true);
      try {
        const [data, html] = await Promise.all([
          getPrecedent(sessionId!),
          getPrecedentHtml(sessionId!),
        ]);

        if (cancelled) return;

        // Store HTML in document state (precedentHtml field)
        setDocument({ precedentHtml: html });

        // Store structured data in precedent state
        setPrecedentData({
          filename: data.filename,
          paragraphs: data.content,
          sections: data.sections,
        });
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load precedent:", err);
          toast.error(
            err instanceof Error ? err.message : "Failed to load precedent"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPrecedent();

    return () => {
      cancelled = true;
    };
  }, [sessionId, hasPrecedent, setDocument, setPrecedentData]);

  // ==========================================================================
  // 2. Fetch related clauses when selectedParaId changes
  // ==========================================================================

  useEffect(() => {
    if (!sessionId || !hasPrecedent || !selectedParaId) {
      setAllRelatedClauses([]);
      if (!lockedParaId) {
        setRelatedClauses([]);
      }
      return;
    }

    const currentFetchId = ++fetchIdRef.current;

    // Check cache first
    const cached = cacheRef.current.get(selectedParaId);
    if (cached) {
      setAllRelatedClauses(cached);
      if (!lockedParaId) {
        setRelatedClauses(cached);
      }
      return;
    }

    let cancelled = false;

    async function fetchRelated() {
      try {
        const response = await getRelatedClauses(sessionId!, selectedParaId!);
        if (cancelled || fetchIdRef.current !== currentFetchId) return;

        // Sort by similarity descending (best matches first)
        const clauses = (response.related_clauses || []).sort(
          (a, b) => b.similarity - a.similarity
        );

        cacheRef.current.set(selectedParaId!, clauses);
        setAllRelatedClauses(clauses);

        // Only update active clauses if not locked
        if (!lockedParaId) {
          setRelatedClauses(clauses);
        }
      } catch (err) {
        if (!cancelled && fetchIdRef.current === currentFetchId) {
          toast.error("Failed to load related clauses");
        }
      }
    }

    fetchRelated();

    return () => {
      cancelled = true;
    };
    // lockedParaId intentionally excluded from deps to avoid re-fetching on lock toggle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, hasPrecedent, selectedParaId]);

  // ==========================================================================
  // 3. Lock / Unlock
  // ==========================================================================

  const isLocked = lockedParaId !== null;

  const toggleLock = useCallback(() => {
    if (isLocked) {
      // Unlock: clear lock state and refresh current view
      setLockedParaId(null);
      setLockedRelatedClauses(null);

      // Refresh related clauses for the current selectedParaId by clearing cache
      const currentParaId = useAppStore.getState().selectedParaId;
      if (currentParaId) {
        cacheRef.current.delete(currentParaId);
        // The useEffect above will re-fetch since the cache entry was removed
        // Trigger by incrementing fetchIdRef
        const fetchId = ++fetchIdRef.current;

        getRelatedClauses(useAppStore.getState().sessionId!, currentParaId)
          .then((response) => {
            if (fetchIdRef.current !== fetchId) return;
            const clauses = (response.related_clauses || []).sort(
              (a, b) => b.similarity - a.similarity
            );
            cacheRef.current.set(currentParaId, clauses);
            setAllRelatedClauses(clauses);
            setRelatedClauses(clauses);
          })
          .catch(() => {
            // Silently fail -- user can retry
          });
      }
    } else {
      // Lock: freeze current view
      setLockedParaId(selectedParaId);
      setLockedRelatedClauses(relatedClauses);
    }
  }, [
    isLocked,
    selectedParaId,
    relatedClauses,
    setLockedParaId,
    setLockedRelatedClauses,
  ]);

  // When locked, active display shows locked clauses
  const activeRelatedClauses = isLocked ? (lockedRelatedClauses ?? []) : relatedClauses;

  // ==========================================================================
  // 4. Snippet queue management
  // ==========================================================================

  const addSnippet = useCallback(
    (text: string, sourceParagraphId: string, sourceSection: string) => {
      const targetParaId = useAppStore.getState().selectedParaId;
      if (!targetParaId) return;

      const snippet: PrecedentSnippet = {
        id: typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : String(Date.now()),
        text,
        sourceParagraphId,
        sourceSection,
        targetParaId,
        timestamp: new Date().toISOString(),
      };

      addPrecedentSnippetAction(snippet);
    },
    [addPrecedentSnippetAction]
  );

  const removeSnippet = useCallback(
    (snippetId: string) => {
      removePrecedentSnippetAction(snippetId);
    },
    [removePrecedentSnippetAction]
  );

  const clearSnippetsForPara = useCallback(
    (paraId: string) => {
      clearPrecedentSnippetsAction(paraId);
    },
    [clearPrecedentSnippetsAction]
  );

  const getSnippetsForPara = useCallback(
    (paraId: string) => {
      return precedentSnippets.filter((s) => s.targetParaId === paraId);
    },
    [precedentSnippets]
  );

  const snippetsForCurrentPara = selectedParaId
    ? precedentSnippets.filter((s) => s.targetParaId === selectedParaId)
    : [];

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
    loading,
    precedentHtml,
    precedentFilename,
    precedentParagraphs,
    precedentSections,
    relatedClauses: activeRelatedClauses,
    allRelatedClauses,
    isLocked,
    lockedParaId,
    toggleLock,
    addSnippet,
    removeSnippet,
    clearSnippetsForPara,
    getSnippetsForPara,
    snippetsForCurrentPara,
  };
}
