"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { getAnalysis, getAnalysisProgress } from "@/lib/api";
import { toast } from "sonner";

/**
 * Hook that triggers analysis, polls progress at 1-second intervals,
 * and hydrates the Zustand store with incremental and final results.
 *
 * Race condition prevention:
 * - completedRef: prevents duplicate hydration when both polling and getAnalysis detect completion
 * - lastApiCallIdRef: tracks API call pagination for incremental risk delivery
 * - intervalRef: ensures cleanup on unmount or completion
 */
export function useAnalysis(sessionId: string | null) {
  const setAnalysis = useAppStore((s) => s.setAnalysis);
  const setAnalysisProgress = useAppStore((s) => s.setAnalysisProgress);
  const addIncrementalRisks = useAppStore((s) => s.addIncrementalRisks);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastApiCallIdRef = useRef(0);
  const completedRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (!sessionId) return;

    intervalRef.current = setInterval(async () => {
      // If analysis already completed via getAnalysis(), skip polling
      if (completedRef.current) {
        stopPolling();
        return;
      }

      try {
        const progress = await getAnalysisProgress(sessionId, {
          includeRisks: true,
          lastApiCallId: lastApiCallIdRef.current,
        });

        // Update API call tracking for pagination
        if (progress.api_calls?.length) {
          const maxId = Math.max(...progress.api_calls.map((c) => c.id));
          lastApiCallIdRef.current = maxId + 1;
        }

        setAnalysisProgress({
          analysisStatus: progress.status,
          analysisStage: progress.stage ?? null,
          analysisPercent: progress.percent,
          stageDisplay: progress.stage_display ?? null,
        });

        // Add any incremental risks that arrived since last poll
        if (progress.incremental_risks?.length) {
          addIncrementalRisks(progress.incremental_risks);
        }

        // Polling detected completion — stop, but don't hydrate full results
        // (getAnalysis will handle that, or already has via completedRef)
        if (progress.status === "complete") {
          stopPolling();
        }
      } catch {
        // Silently continue polling on transient errors
      }
    }, 1000);
  }, [sessionId, setAnalysisProgress, addIncrementalRisks, stopPolling]);

  const startAnalysis = useCallback(async () => {
    if (!sessionId || completedRef.current) return;

    setIsAnalyzing(true);
    completedRef.current = false;
    lastApiCallIdRef.current = 0;

    // Initialize progress state
    setAnalysisProgress({
      analysisStatus: "analyzing",
      analysisStage: "initial_analysis",
      analysisPercent: 0,
      stageDisplay: "Starting analysis...",
    });

    // Start polling for incremental updates
    startPolling();

    try {
      // This call blocks until analysis is complete on the backend
      const result = await getAnalysis(sessionId);

      // getAnalysis resolved — stop polling and hydrate full results
      stopPolling();
      completedRef.current = true;

      setAnalysis({
        risks: result.risk_inventory,
        conceptMap: result.concept_map,
        riskMap: result.risk_map,
        summary: result.summary,
        analysisStatus: "complete",
        analysisStage: "complete",
        analysisPercent: 100,
        stageDisplay: "Analysis complete",
      });

      toast.success("Analysis complete");
    } catch (err) {
      stopPolling();
      completedRef.current = false;

      const msg =
        err instanceof Error ? err.message : "Analysis failed";
      toast.error(msg);

      // Reset analysis state so user can retry
      setAnalysisProgress({
        analysisStatus: "not_started",
        analysisStage: null,
        analysisPercent: 0,
        stageDisplay: null,
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [
    sessionId,
    setAnalysis,
    setAnalysisProgress,
    startPolling,
    stopPolling,
  ]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  return { startAnalysis, isAnalyzing };
}
