# Phase 3: Sidebar + Risk Analysis - Research

**Researched:** 2026-02-07
**Domain:** React risk accordion, analysis polling, document highlighting
**Confidence:** HIGH

## Summary

Phase 3 enhances the existing sidebar shell (built in Phase 2) with full risk accordion interaction, adds an analysis progress overlay, creates the definitions and related clauses tabs, and wires hover-based risk highlighting into the document viewer. All infrastructure is in place: the Zustand store has analysis state and incremental risk support, the API client has typed functions for all relevant endpoints, and shadcn provides Accordion, Progress, and Dialog components. The old vanilla JS implementation (~1,300 lines in sidebar.js + ~330 lines in analysis.js) provides a clear blueprint for feature parity.

The primary work is:
1. Refactoring the flat risk list in sidebar.tsx into an interactive accordion with expand/collapse, severity badges with effective severity, risk relationships, and include/exclude selection
2. Building a full-screen analysis overlay with two-stage progress, rotating legal verbs, and incremental risk display
3. Creating a `use-analysis.ts` hook for polling + store hydration
4. Adding hover/click highlighting of `highlight_text` in the document viewer
5. Filling in the Related Clauses and Definitions tabs with real data

**Primary recommendation:** Build components bottom-up (risk-card first, then accordion, then overlay), leverage existing shadcn Accordion and Progress components, and use the store's existing `addIncrementalRisks` action for streaming results during analysis.

## Standard Stack

### Core (Already Installed)
| Library | Purpose | Why Standard |
|---------|---------|--------------|
| shadcn/ui Accordion | Risk expand/collapse | Already installed, Radix-based, accessible |
| shadcn/ui Progress | Analysis progress bar | Already installed, Radix-based |
| shadcn/ui Dialog | Analysis overlay modal | Already installed (can use for full-screen overlay) |
| shadcn/ui Badge | Severity indicators | Already installed |
| shadcn/ui Tooltip | Hover info on relationships | Already installed |
| Zustand | State management | Already the store pattern |
| lucide-react | Icons | Already used throughout |

### No New Dependencies Required
All Phase 3 functionality can be built with existing packages. The old sidebar.js used vanilla DOM manipulation; the React equivalent uses shadcn Accordion + custom components.

## Architecture Patterns

### Recommended Component Structure
```
frontend/src/
  components/review/
    sidebar.tsx              # MODIFY: refactor to use sub-components
    risk-accordion.tsx       # NEW: wraps shadcn Accordion for risk list
    risk-card.tsx            # NEW: single risk item with severity, description, relationships
    related-clauses-tab.tsx  # NEW: calls getRelatedClauses API
    definitions-tab.tsx      # NEW: filters definedTerms from store
    flags-tab.tsx            # NEW: shows flags for selected paragraph (stub for Phase 6)
    analysis-overlay.tsx     # NEW: full-screen modal with progress
  hooks/
    use-analysis.ts          # NEW: triggers analysis, polls progress, hydrates store
```

### Pattern 1: Risk Accordion with shadcn
**What:** Use shadcn's Accordion component in "single" mode (one item expanded at a time) for risk cards.
**When to use:** The sidebar risk display.

```typescript
// risk-accordion.tsx
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

// shadcn Accordion supports type="single" (one open) or type="multiple" (many open)
// The old sidebar.js used single-open behavior (expandedRiskId tracking)
// Use type="single" collapsible to match the old behavior
<Accordion type="single" collapsible value={expandedRiskId} onValueChange={setExpandedRiskId}>
  {risks.map(risk => (
    <AccordionItem key={risk.risk_id} value={risk.risk_id}>
      <AccordionTrigger>
        <SeverityBadge risk={risk} riskMap={riskMap} />
        <span>{risk.title}</span>
      </AccordionTrigger>
      <AccordionContent>
        <p>{risk.description}</p>
        <RiskRelationships risk={risk} riskMap={riskMap} />
        <RiskActions risk={risk} paraId={paraId} />
      </AccordionContent>
    </AccordionItem>
  ))}
</Accordion>
```

### Pattern 2: Analysis Overlay as Fixed Portal
**What:** Full-screen overlay during analysis, rendered at the top of the component tree.
**When to use:** When `analysisStatus === 'analyzing'`.

```typescript
// analysis-overlay.tsx
// Render as a fixed overlay (not inside the layout flex), using Dialog or custom portal
// The old implementation used position: fixed with z-index
// For Next.js, use a portal or render at the page level

export function AnalysisOverlay() {
  const { analysisStatus, analysisPercent, analysisStage, stageDisplay } = useAppStore();
  if (analysisStatus !== 'analyzing') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border bg-card p-8 shadow-2xl">
        {/* Two-stage indicator */}
        {/* Progress bar */}
        {/* Rotating verb */}
        {/* Stage display text */}
      </div>
    </div>
  );
}
```

### Pattern 3: Polling Hook with Cleanup
**What:** A custom hook that starts analysis, polls progress at 1-second intervals, and hydrates the store with incremental results.
**When to use:** After the review page loads and analysis hasn't been completed.

```typescript
// use-analysis.ts
export function useAnalysis(sessionId: string | null) {
  const { setAnalysis, setAnalysisProgress, addIncrementalRisks } = useAppStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastApiCallIdRef = useRef(0);

  const startAnalysis = useCallback(async () => {
    if (!sessionId) return;
    setAnalysisProgress({ analysisStatus: 'analyzing', ... });

    // Start polling at 1s interval
    intervalRef.current = setInterval(async () => {
      const progress = await getAnalysisProgress(sessionId, {
        includeRisks: true,
        lastApiCallId: lastApiCallIdRef.current
      });

      setAnalysisProgress({
        analysisStatus: progress.status,
        analysisStage: progress.stage ?? null,
        analysisPercent: progress.percent,
        stageDisplay: progress.stage_display ?? null,
      });

      if (progress.incremental_risks?.length) {
        addIncrementalRisks(progress.incremental_risks);
      }

      if (progress.status === 'complete') {
        clearInterval(intervalRef.current!);
        // Fetch full analysis result
        const result = await getAnalysis(sessionId);
        setAnalysis({
          risks: result.risk_inventory,
          conceptMap: result.concept_map,
          riskMap: result.risk_map,
          summary: result.summary,
          analysisStatus: 'complete',
          analysisStage: 'complete',
          analysisPercent: 100,
        });
      }
    }, 1000);

    // Trigger analysis (this is the long-running call)
    try {
      const result = await getAnalysis(sessionId);
      // If we get here before polling catches completion:
      clearInterval(intervalRef.current!);
      setAnalysis({ ... });
    } catch (err) { ... }
  }, [sessionId]);

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  return { startAnalysis };
}
```

### Pattern 4: Document Highlight via CSS Classes
**What:** Adding and removing CSS highlight classes on `[data-para-id]` elements for risk hover highlighting.
**When to use:** When user hovers over or clicks a risk card in the sidebar.

The document viewer already has a `containerRef` and `updateParagraphStates()` that applies classes like `selected`, `has-risk`, etc. The highlight_text highlighting requires a different approach: finding text within the paragraph's innerHTML and wrapping it in a `<mark>` element.

```typescript
// In document-viewer.tsx or a new utility
function highlightTextInParagraph(containerRef: RefObject<HTMLDivElement>, paraId: string, text: string) {
  const container = containerRef.current;
  if (!container || !text) return;

  const paraEl = container.querySelector(`[data-para-id="${paraId}"]`);
  if (!paraEl) return;

  // Use TreeWalker to find text nodes and wrap matching text
  // This is what the old highlightProblematicText() did
}
```

### Anti-Patterns to Avoid
- **Re-rendering the entire accordion on every hover:** The old sidebar.js re-rendered full HTML on every state change. In React, use local state for expanded/hovered risk ID and let React handle minimal re-renders.
- **Polling without cleanup:** Always clear intervals on unmount and on completion. The old code had `clearInterval` in multiple error paths; the hook pattern with `useEffect` cleanup is cleaner.
- **Direct DOM manipulation for highlights in React:** While document-viewer.tsx already uses `dangerouslySetInnerHTML`, highlight operations should use refs and the existing `useEffect` pattern rather than fighting React's render cycle.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accordion expand/collapse | Custom expand state + animation | shadcn Accordion (type="single" collapsible) | Already installed, handles animation, a11y, keyboard nav |
| Progress bar | Custom div width animation | shadcn Progress | Already installed, proper ARIA roles |
| Overlay backdrop | Custom fixed div | Tailwind `fixed inset-0 bg-background/80 backdrop-blur-sm` | Standard pattern, no component needed |
| Text search/highlight in DOM | Custom regex replacement | TreeWalker API + Range API | Browser-native, handles nested nodes correctly |
| Polling interval management | Manual setInterval/clearInterval | Custom hook with useRef + useEffect cleanup | React lifecycle handles cleanup automatically |

## Common Pitfalls

### Pitfall 1: Race condition between polling and getAnalysis response
**What goes wrong:** `getAnalysis()` triggers the analysis AND returns the result. Polling starts simultaneously. When getAnalysis resolves, polling may also detect completion, causing duplicate state updates.
**Why it happens:** The Flask endpoint `/api/analysis/<session_id>` blocks until analysis completes (it triggers analysis if not done). Meanwhile polling hits `/api/analysis/<session_id>/progress`.
**How to avoid:** Use a flag to track whether the full result has been received. When getAnalysis resolves successfully, clear the poll interval immediately. When polling detects `status: 'complete'`, only fetch full results if getAnalysis hasn't already returned.
**Warning signs:** Double toast notifications, flickering UI on completion.

### Pitfall 2: Stale closure in polling interval
**What goes wrong:** The interval callback captures stale values of `sessionId` or `lastApiCallId`.
**Why it happens:** JavaScript closures capture the value at creation time.
**How to avoid:** Use refs (`useRef`) for values that change during polling (like `lastApiCallIdRef`). Only use state for values that should trigger re-renders.
**Warning signs:** Polling sends wrong session ID or always sends `lastApiCallId=0`.

### Pitfall 3: Highlight text not found in HTML-rendered document
**What goes wrong:** `highlight_text` from the API is plain text, but the document viewer renders complex HTML. Text matching fails because the HTML has tags, entities, or whitespace differences.
**Why it happens:** The backend stores plain text excerpts, but the frontend renders styled HTML from `getDocumentHtml()`.
**How to avoid:** Use a TreeWalker to iterate text nodes within the paragraph element. Normalize whitespace before comparison. Match partial text (first 50 chars) as fallback, exactly like the old `highlightProblematicText()` function did.
**Warning signs:** Hovering over risks does nothing, or highlights wrong text.

### Pitfall 4: Accordion re-mount loses expand state
**What goes wrong:** When the user selects a different paragraph and then comes back, the accordion resets to all-collapsed.
**Why it happens:** The expanded risk ID is stored in component local state that resets on unmount/remount.
**How to avoid:** Store `expandedRiskId` either in the Zustand store or keyed by `paraId` in a ref. The old sidebar.js used a module-level `expandedRiskId` variable. In React, a ref or store property works.
**Warning signs:** User expands a risk, clicks another paragraph, clicks back, risk is collapsed.

### Pitfall 5: Analysis overlay doesn't render above all content
**What goes wrong:** The overlay appears behind the sidebar or header.
**Why it happens:** CSS stacking context issues with `overflow: hidden` on parent containers.
**How to avoid:** Render the overlay at the page level (in `review/[sessionId]/page.tsx`), not inside the sidebar or document viewer. Use `z-50` which is higher than any existing z-index in the layout.
**Warning signs:** Overlay is partially hidden or doesn't cover the full viewport.

### Pitfall 6: Related clauses tab makes API call on every paragraph click
**What goes wrong:** Excessive API calls slow down the UI.
**Why it happens:** The Related tab calls `getRelatedClauses()` every time the selected paragraph changes.
**How to avoid:** Only fetch related clauses when the Related tab is active AND the paragraph changes. Cache results by paraId (use a local Map or state object). The old sidebar.js didn't have this tab as a separate concern.
**Warning signs:** Network tab shows many `/api/precedent/<id>/related/<paraId>` calls.

## Existing State Analysis

### Store Actions Already Available
| Action | Signature | Ready? |
|--------|-----------|--------|
| `setAnalysis` | `(analysis: Partial<AnalysisState>) => void` | Yes |
| `setAnalysisProgress` | `(progress: Pick<...>) => void` | Yes |
| `addIncrementalRisks` | `(risks: Risk[]) => void` | Yes, deduplicates by risk_id |
| `selectParagraph` | `(paraId: string \| null) => void` | Yes |

### Store State Already Available
| Property | Type | Used By |
|----------|------|---------|
| `risks` | `Risk[]` | sidebar.tsx, bottom-bar.tsx, document-viewer.tsx |
| `conceptMap` | `ConceptMap \| null` | Not yet used |
| `riskMap` | `RiskMap \| null` | Not yet used (needed for effective severity) |
| `analysisStatus` | `AnalysisStatus` | Not yet used |
| `analysisStage` | `AnalysisStage \| null` | Not yet used |
| `analysisPercent` | `number` | Not yet used |
| `stageDisplay` | `string \| null` | Not yet used |
| `definedTerms` | `DefinedTerm[]` | Loaded by use-document.ts, not displayed |

### What Needs to Be Added to Store
| Item | Why |
|------|-----|
| `hoveredRiskId` | To coordinate hover highlighting between sidebar and document viewer |
| `focusedRiskId` | To lock highlighting when a risk is clicked (not just hovered) |

### API Functions Already Available
| Function | Endpoint | Ready? |
|----------|----------|--------|
| `getAnalysis(sessionId)` | `GET /api/analysis/<id>` | Yes |
| `getAnalysisProgress(sessionId, opts)` | `GET /api/analysis/<id>/progress` | Yes, supports includeRisks + lastApiCallId |
| `getRelatedClauses(sessionId, paraId)` | `GET /api/precedent/<id>/related/<paraId>` | Yes |
| `getDocument(sessionId)` | `GET /api/document/<id>` | Yes, returns defined_terms |

### CSS Classes Already Applied by document-viewer.tsx
| Class | When Applied | Visual Effect Needed |
|-------|-------------|---------------------|
| `selected` | paraId === selectedParaId | Blue outline/bg (needs CSS in globals.css) |
| `has-risk` | risk exists for paraId | Left border indicator (needs CSS) |
| `has-revision` | revision exists, not accepted | Red-tinted bg (needs CSS) |
| `revision-accepted` | revision accepted | Green-tinted bg (needs CSS) |
| `flagged` | flag exists for paraId | Flag indicator (needs CSS) |

**Important:** These classes are toggled by `updateParagraphStates()` but there are NO CSS rules in globals.css for them yet (only `.track-changes-insert/delete` and basic `.document-container` styles). Phase 3 needs to add the CSS for these classes.

### shadcn Components Available
All needed components are installed: Accordion, Progress, Badge, Dialog, Tooltip, Sheet, Skeleton.

## Code Examples

### Risk Card with Effective Severity (from old sidebar.js patterns)

```typescript
// risk-card.tsx
interface RiskCardProps {
  risk: Risk;
  riskMap: RiskMap | null;
  paraId: string;
  isAddressed: boolean;
  onHover: (riskId: string | null) => void;
  onFocus: (riskId: string) => void;
}

function SeverityBadgeWithEffective({ risk, riskMap }: { risk: Risk; riskMap: RiskMap | null }) {
  // Check if riskMap has effective severity different from base
  const riskData = riskMap?.[risk.para_id]?.find(r => r.risk_id === risk.risk_id);

  if (riskData?.effective_severity && riskData.effective_severity !== riskData.base_severity) {
    return (
      <div className="flex items-center gap-1">
        <SeverityBadge severity={riskData.base_severity} />
        <span className="text-xs text-muted-foreground">-></span>
        <SeverityBadge severity={riskData.effective_severity} />
      </div>
    );
  }

  return <SeverityBadge severity={risk.severity} />;
}
```

### Risk Relationships Display (from old sidebar.js)

```typescript
// Mitigated by / Amplified by display
function RiskRelationships({ risk, riskMap }: { risk: Risk; riskMap: RiskMap | null }) {
  const riskData = riskMap?.[risk.para_id]?.find(r => r.risk_id === risk.risk_id);
  if (!riskData) return null;

  const mitigators = riskData.mitigated_by || [];
  const amplifiers = riskData.amplified_by || [];

  if (mitigators.length === 0 && amplifiers.length === 0) return null;

  return (
    <div className="mt-2 space-y-1 text-xs">
      {mitigators.length > 0 && (
        <div className="flex items-start gap-1.5">
          <span className="font-medium text-green-600">Mitigated by:</span>
          <span className="text-muted-foreground">
            {mitigators.map(m => m.ref).join(", ")}
          </span>
        </div>
      )}
      {amplifiers.length > 0 && (
        <div className="flex items-start gap-1.5">
          <span className="font-medium text-red-600">Amplified by:</span>
          <span className="text-muted-foreground">
            {amplifiers.map(a => a.ref).join(", ")}
          </span>
        </div>
      )}
    </div>
  );
}
```

### Analysis Polling Hook Pattern

```typescript
// use-analysis.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { getAnalysis, getAnalysisProgress } from "@/lib/api";

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
      try {
        const progress = await getAnalysisProgress(sessionId, {
          includeRisks: true,
          lastApiCallId: lastApiCallIdRef.current,
        });

        // Update API call tracking
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

        if (progress.incremental_risks?.length) {
          addIncrementalRisks(progress.incremental_risks);
        }

        if (progress.status === "complete") {
          stopPolling();
        }
      } catch {
        // Silently continue polling on error
      }
    }, 1000);
  }, [sessionId, setAnalysisProgress, addIncrementalRisks, stopPolling]);

  const startAnalysis = useCallback(async () => {
    if (!sessionId || completedRef.current) return;
    setIsAnalyzing(true);
    completedRef.current = false;
    lastApiCallIdRef.current = 0;

    setAnalysisProgress({
      analysisStatus: "analyzing",
      analysisStage: "initial_analysis",
      analysisPercent: 0,
      stageDisplay: "Starting analysis...",
    });

    startPolling();

    try {
      // This blocks until analysis is complete
      const result = await getAnalysis(sessionId);
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
    } catch (err) {
      stopPolling();
      setAnalysisProgress({
        analysisStatus: "not_started",
        analysisStage: null,
        analysisPercent: 0,
        stageDisplay: null,
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [sessionId, setAnalysis, setAnalysisProgress, startPolling, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  return { startAnalysis, isAnalyzing };
}
```

### Rotating Legal Verbs (port from analysis.js)

```typescript
// Legal-themed analysis verbs from old analysis.js
const ANALYSIS_VERBS = [
  "Reading the fine print...",
  "Briefing...",
  "Arguing both sides...",
  "Thinking aggressively...",
  "Finding the loopholes...",
  "Protecting your interests...",
  "Channeling senior partner energy...",
  "Billable hours accumulating...",
  "Citing precedent...",
  "Drafting counterarguments...",
  "Playing devil's advocate...",
  "Reviewing for gotchas...",
  "Checking the defined terms...",
  "Lawyering...",
  "Cross-referencing...",
  "Due diligence-ing...",
  "Risk-assessing...",
  "Zealously advocating...",
  "Preparing the markup...",
];

// Rotate every 2.5 seconds with fade transition
function useRotatingVerb(active: boolean) {
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setIndex(i => (i + 1) % ANALYSIS_VERBS.length);
        setFading(false);
      }, 200);
    }, 2500);
    return () => clearInterval(interval);
  }, [active]);

  return { verb: ANALYSIS_VERBS[index], fading };
}
```

### Document Highlight CSS (to add to globals.css)

```css
/* Document paragraph state styles - for [data-para-id] elements */
@layer components {
  .document-container [data-para-id] {
    cursor: pointer;
    border-radius: 4px;
    border: 2px solid transparent;
    transition: background-color 150ms, border-color 150ms, box-shadow 150ms;
  }

  .document-container [data-para-id]:hover {
    background-color: oklch(0.97 0.003 264 / 0.5);
  }

  .document-container [data-para-id].selected {
    background-color: oklch(0.95 0.02 264 / 0.3);
    border-color: oklch(0.546 0.215 264);
    box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.05);
  }

  .document-container [data-para-id].has-risk {
    box-shadow: inset 3px 0 0 oklch(0.705 0.213 47.604);
  }

  .document-container [data-para-id].has-revision {
    background-color: oklch(0.98 0.01 27 / 0.3);
    border-color: oklch(0.85 0.1 27 / 0.5);
  }

  .document-container [data-para-id].revision-accepted {
    background-color: oklch(0.97 0.02 155 / 0.2);
    border-color: oklch(0.7 0.15 155 / 0.3);
  }

  .document-container [data-para-id].flagged {
    box-shadow: inset -3px 0 0 oklch(0.795 0.184 86.047);
  }

  /* Risk text highlighting */
  .risk-highlight {
    background: linear-gradient(180deg, transparent 60%, oklch(0.85 0.1 27 / 0.5) 60%);
    padding: 0 2px;
  }

  .risk-highlight-active {
    background: oklch(0.9 0.08 27 / 0.4);
    outline: 2px solid oklch(0.577 0.245 27.325);
    outline-offset: 1px;
    border-radius: 2px;
  }
}
```

## Key Implementation Details

### How the Old Sidebar Works (sidebar.js, 1,290 lines)
1. **Risk accordion:** Single-expand behavior tracked by `expandedRiskId`. Each risk has header (severity badge + title + chevron), body (description + relationships + actions), and include/exclude toggles.
2. **Risk selection:** Each risk can be included/excluded from revision generation. State tracked in `riskSelectionState` map keyed by `${paraId}_${riskId}`.
3. **Hover highlighting:** `mouseover` on `.risk-item` calls `highlightProblematicText()` which finds text in the paragraph and wraps it in `<span class="highlight-risk-active">`.
4. **Click focusing:** Clicking a risk "locks" the highlight (via `focusRisk()`). Clicking again unlocks it.
5. **Footer:** Shows "X of Y risks selected" and "Generate Revision" button.
6. **Related clauses:** Inside each expanded risk, shows related clause cards with section refs.
7. **Severity badge:** Shows effective severity arrow (e.g., "HIGH -> MEDIUM") when mitigators exist.

### How the Old Analysis Overlay Works (analysis.js, 333 lines)
1. **Two-stage indicator:** "Initial Analysis" and "Parallel Batches" with dot/checkmark states.
2. **Progress bar:** 0-100% width animation.
3. **Rotating verbs:** Cycles through 30+ legal-themed messages every 2.5s with fade.
4. **Polling:** 1-second interval calling `/api/analysis/<id>/progress?include_risks=true`.
5. **Incremental risks:** As risks arrive during analysis, they're displayed as cards in the sidebar.
6. **API call logging:** Progress response includes API calls which are logged to browser console.
7. **Completion:** Brief 1.5s pause showing "Analysis complete!" before hiding overlay.

### Analysis Response Shape (from routes.py)
```typescript
// GET /api/analysis/<sessionId> returns AnalysisResponse:
{
  risk_inventory: Risk[];        // Full list of all risks
  concept_map: ConceptMap;       // Document structure map
  risk_map: RiskMap;             // Risks keyed by para_id with relationships
  summary: AnalysisSummary;      // { total_risks, critical, high, medium, low }
  document_map?: object;         // Optional
  analysis_method?: string;      // 'claude' or 'regex_fallback'
}

// GET /api/analysis/<sessionId>/progress returns AnalysisProgressResponse:
{
  status: 'not_started' | 'analyzing' | 'complete';
  stage?: 'initial_analysis' | 'parallel_batches' | 'complete';
  percent: number;
  stage_display?: string;           // e.g. "Parallel analysis: 3/6 batches [45s]"
  stage_elapsed_display?: string;   // e.g. "1m 23s"
  elapsed_display?: string;
  initial_analysis_duration_display?: string;
  current_batch?: number;
  total_batches?: number;
  incremental_risks?: Risk[];       // Only when include_risks=true
  api_calls?: ApiCall[];            // For browser console logging
}
```

### RiskMap Structure (from types.ts)
```typescript
// RiskMap is keyed by para_id
interface RiskMap {
  [para_id: string]: RiskMapEntry[];
}

interface RiskMapEntry {
  risk_id: string;
  clause: string;
  para_id: string;
  title: string;
  description: string;
  base_severity: Severity;
  effective_severity?: Severity;  // After considering mitigators/amplifiers
  mitigated_by?: RiskRelationship[];
  amplified_by?: RiskRelationship[];
  triggers?: string[];
}
```

### Definitions Tab Data Source
The `definedTerms` array is already loaded by `use-document.ts` from `doc.defined_terms`. Each term has:
```typescript
interface DefinedTerm {
  term: string;          // e.g. "Seller"
  definition: string;    // e.g. "XYZ Corp, a Delaware corporation"
  section_ref: string;   // e.g. "1.1"
  para_id: string;       // Links to paragraph
}
```
The definitions tab should show terms relevant to the selected paragraph. Strategy: Show all defined terms that appear in the selected paragraph's text, plus any terms defined in that paragraph.

### Related Clauses Tab Data Source
Uses `getRelatedClauses(sessionId, paraId)` which returns precedent document clauses that relate to the current paragraph via TF-IDF similarity. Only available when a precedent document was uploaded.

## Open Questions

1. **Include/exclude risk selection for Phase 3 or Phase 4?**
   - The old sidebar.js has include/exclude toggles that feed into revision generation. Since revision generation is Phase 4, the toggles could be deferred. However, the UI is part of the risk card, so building the toggle UI now (even if the "Generate Revision" button remains disabled) makes sense for visual completeness.
   - Recommendation: Build the toggle UI in Phase 3, wire the generate action in Phase 4.

2. **Where to render the analysis overlay?**
   - Options: (a) Inside `review/[sessionId]/page.tsx` alongside other components, (b) In a React portal at document.body level
   - Recommendation: Option (a) is simpler and sufficient given `z-50` + `fixed inset-0` positioning. Portals add complexity without benefit here.

3. **Should hover highlighting work in HTML mode only?**
   - The document viewer has two render paths: HTML mode (dangerouslySetInnerHTML) and fallback (React-rendered paragraphs). The fallback mode already has inline click handlers. Highlighting in HTML mode requires DOM manipulation via refs; in fallback mode it could use React state.
   - Recommendation: Implement highlighting for HTML mode only (the primary path). The fallback mode is a degraded experience anyway.

## Sources

### Primary (HIGH confidence)
- `frontend/src/components/review/sidebar.tsx` - Current sidebar implementation (230 lines)
- `frontend/src/lib/store.ts` - Zustand store with analysis state (237 lines)
- `frontend/src/lib/types.ts` - All TypeScript interfaces (479 lines)
- `frontend/src/lib/api.ts` - API client with analysis functions (312 lines)
- `frontend/src/components/review/document-viewer.tsx` - Document rendering + state classes (183 lines)
- `frontend/src/hooks/use-document.ts` - Document loading hook pattern (63 lines)
- `frontend/src/app/review/[sessionId]/page.tsx` - Review page layout (49 lines)
- `frontend/src/app/globals.css` - Design tokens + CSS variables (192 lines)
- `frontend/src/components/ui/accordion.tsx` - shadcn Accordion (67 lines)
- `frontend/src/components/ui/progress.tsx` - shadcn Progress (32 lines)
- `app/api/routes.py` lines 324-520 - Analysis endpoints, response shapes
- `app/api/routes.py` lines 1357-1408 - Related clauses endpoint
- `app/static/js/sidebar.js` - Old risk accordion implementation (1,290 lines)
- `app/static/js/analysis.js` - Old analysis overlay + polling (333 lines)
- `app/static/js/document.js` - Old highlight/focus implementation
- `app/static/css/main.css` - Old CSS for highlights, analysis overlay
- `app/static/index.html` - Old analysis overlay HTML structure

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All components already installed, no new dependencies
- Architecture: HIGH - Clear patterns from old implementation + React/shadcn idioms
- Pitfalls: HIGH - Derived from actual codebase analysis and known React patterns
- Code examples: HIGH - Based on reading actual source files, not hypothetical

**Research date:** 2026-02-07
**Valid until:** 2026-03-07 (stable - internal project, no external dependency changes expected)
