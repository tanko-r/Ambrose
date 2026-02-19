"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { getAnalysis, getAnalysisProgress, startAnalysisJob } from "@/lib/api";
import { toast } from "sonner";

/**
 * Hook that triggers analysis via non-blocking POST+poll pattern, polls progress
 * at 1-second intervals, and hydrates the Zustand store with incremental and final results.
 *
 * Pattern (Railway-safe — no long-held HTTP connections):
 * 1. POST /api/analysis/{sessionId}/start → returns 202 + job_id immediately
 * 2. Poll GET /api/analysis/{sessionId}/progress every 1s for status + incremental risks
 * 3. When polling detects completion, fetch full results via GET /api/analysis/{sessionId}
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

  const startPolling = useCallback(
    (onComplete: () => Promise<void>) => {
      if (!sessionId) return;

      intervalRef.current = setInterval(async () => {
        // If analysis already completed, skip polling
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

          // Polling detected completion — stop and fetch full results
          if (progress.status === "complete") {
            stopPolling();
            if (!completedRef.current) {
              completedRef.current = true;
              await onComplete();
            }
          }
        } catch {
          // Silently continue polling on transient errors
        }
      }, 1000);
    },
    [sessionId, setAnalysisProgress, addIncrementalRisks, stopPolling]
  );

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

    try {
      // POST /start — returns 202 immediately with job_id (never blocks)
      const startResult = await startAnalysisJob(sessionId);

      // If analysis was already complete on the server, hydrate results immediately
      if (startResult.status === "already_complete") {
        const result = await getAnalysis(sessionId);
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
        setIsAnalyzing(false);
        return;
      }

      // Callback invoked by polling when backend signals completion
      const handleComplete = async () => {
        try {
          const result = await getAnalysis(sessionId);
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
          const msg = err instanceof Error ? err.message : "Failed to load analysis results";
          toast.error(msg);
          setAnalysisProgress({
            analysisStatus: "not_started",
            analysisStage: null,
            analysisPercent: 0,
            stageDisplay: null,
          });
        } finally {
          setIsAnalyzing(false);
        }
      };

      // Start polling — will call handleComplete when backend reports status=complete
      startPolling(handleComplete);
    } catch (err) {
      stopPolling();
      completedRef.current = false;

      const msg = err instanceof Error ? err.message : "Failed to start analysis";
      toast.error(msg);

      // Reset analysis state so user can retry
      setAnalysisProgress({
        analysisStatus: "not_started",
        analysisStage: null,
        analysisPercent: 0,
        stageDisplay: null,
      });
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
