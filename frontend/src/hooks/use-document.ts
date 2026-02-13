"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { getDocument, getDocumentHtml, loadSession } from "@/lib/api";
import { toast } from "sonner";

/**
 * Hook that loads document data + HTML for a given session.
 * Updates the Zustand store with paragraphs, sections, exhibits, etc.
 */
export function useDocument(sessionId: string | null) {
  const setDocument = useAppStore((s) => s.setDocument);
  const setSession = useAppStore((s) => s.setSession);
  const setFlags = useAppStore((s) => s.setFlags);
  const setRevisions = useAppStore((s) => s.setRevisions);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sessionId) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch document data and HTML in parallel
      // If session not in memory, try loading from disk first
      let doc;
      let html: string | null;
      try {
        [doc, html] = await Promise.all([
          getDocument(sessionId),
          getDocumentHtml(sessionId).catch(() => null),
        ]);
      } catch {
        // Session may be on disk but not in memory — load it first
        await loadSession(sessionId);
        [doc, html] = await Promise.all([
          getDocument(sessionId),
          getDocumentHtml(sessionId).catch(() => null),
        ]);
      }

      setDocument({
        paragraphs: doc.content,
        sections: doc.sections,
        exhibits: doc.exhibits,
        definedTerms: doc.defined_terms,
        documentHtml: html,
      });

      setSession({
        targetFilename: doc.filename,
        hasPrecedent: doc.has_precedent ?? false,
      });

      // Load flags and revisions from document response
      if (doc.flags) setFlags(doc.flags);
      if (doc.revisions) setRevisions(doc.revisions);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load document";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [sessionId, setDocument, setSession, setFlags, setRevisions]);

  useEffect(() => {
    load();
  }, [load]);

  return { loading, error, reload: load };
}
