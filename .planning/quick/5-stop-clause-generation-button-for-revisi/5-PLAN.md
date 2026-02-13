---
phase: quick-5
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/hooks/use-revision.ts
  - frontend/src/components/review/sidebar.tsx
autonomous: true

must_haves:
  truths:
    - "User sees a Stop button while revision is generating"
    - "Clicking Stop cancels the in-flight request and returns to idle state"
    - "After stopping, user can immediately request a new generation"
  artifacts:
    - path: "frontend/src/hooks/use-revision.ts"
      provides: "AbortController-based cancellation in generate(), stopGeneration() method"
    - path: "frontend/src/components/review/sidebar.tsx"
      provides: "Stop button rendered during generation state"
  key_links:
    - from: "frontend/src/components/review/sidebar.tsx"
      to: "frontend/src/hooks/use-revision.ts"
      via: "stopGeneration callback from useRevision hook"
      pattern: "stopGeneration"
---

<objective>
Add a "Stop" button that appears while a clause revision is being generated, allowing the user to cancel the operation mid-flight and return to an idle state.

Purpose: When Gemini is slow or the user changes their mind, they should not be forced to wait for generation to complete. This is a frontend-only cancellation using AbortController -- aborting the fetch discards the response; no backend cancel endpoint is needed since the backend revise endpoint is a single synchronous Gemini API call that will simply complete and its response will be ignored.

Output: Modified use-revision hook with abort support, Stop button in sidebar generation area.
</objective>

<execution_context>
@C:/Users/david/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/david/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@frontend/src/hooks/use-revision.ts
@frontend/src/components/review/sidebar.tsx
@frontend/src/lib/store.ts
@frontend/src/lib/api.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add AbortController cancellation to use-revision hook</name>
  <files>frontend/src/hooks/use-revision.ts</files>
  <action>
Add abort support to the `generate` function in `useRevision`:

1. Add a module-level `AbortController` ref (outside the hook, since useRevision is called from multiple components but they share the same conceptual operation). Use a module-scoped `let abortController: AbortController | null = null;` pattern.

2. In the `generate` function:
   - Before starting, abort any existing controller: `abortController?.abort()`
   - Create a new `AbortController`: `abortController = new AbortController()`
   - Pass `abortController.signal` to the `revise()` API call. This requires updating the call to pass the signal.

3. Modify `frontend/src/lib/api.ts` -- update the `revise` function to accept an optional `signal?: AbortSignal` parameter and pass it to the fetch options. Specifically:
   ```typescript
   export async function revise(data: ReviseRequest, signal?: AbortSignal): Promise<ReviseResponse> {
     return request(`${FLASK_DIRECT}/api/revise`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify(data),
       signal,
     });
   }
   ```

4. In the `generate` function's catch block, check for abort: if `err` is an `AbortError` (check `err instanceof DOMException && err.name === 'AbortError'` or `signal.aborted`), do NOT show an error toast -- just silently exit. The finally block will still run and reset `generatingRevision`.

5. In the finally block, only set `generatingRevision(false)` if the current controller matches (i.e., wasn't replaced by a new generate call): `if (abortController === controller) { ... setGeneratingRevision(false); abortController = null; }`

6. Add a `stopGeneration` callback:
   ```typescript
   const stopGeneration = useCallback(() => {
     if (abortController) {
       abortController.abort();
       abortController = null;
     }
     useAppStore.getState().setGeneratingRevision(false);
   }, []);
   ```

7. Return `stopGeneration` from the hook alongside existing returns: `return { generate, accept, reject, reopen, generating, stopGeneration };`
  </action>
  <verify>Run `cd C:/Users/david/Documents/claude-redlining/frontend && npx tsc --noEmit` -- no type errors in modified files.</verify>
  <done>
    - `useRevision` hook exposes `stopGeneration` method
    - `revise` API function accepts optional `AbortSignal`
    - Aborting does not produce error toast
    - `generatingRevision` resets to false on abort
  </done>
</task>

<task type="auto">
  <name>Task 2: Add Stop button to sidebar generation UI</name>
  <files>frontend/src/components/review/sidebar.tsx</files>
  <action>
Replace the spinner-only generating state in sidebar.tsx (around line 372-381) with a spinner + Stop button:

1. Destructure `stopGeneration` from the `useRevision()` call on line 118:
   ```typescript
   const { generate, generating, stopGeneration } = useRevision();
   ```

2. Import `Square` (or `StopCircle`) from lucide-react for the stop icon. `Square` is the standard "stop" icon.

3. Replace the generating block (lines 372-381) from:
   ```tsx
   <div className="flex items-center gap-2 text-xs text-muted-foreground">
     <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
     <span ...>{generatingVerb}...</span>
   </div>
   ```
   To:
   ```tsx
   <div className="flex items-center gap-2">
     <div className="flex items-center gap-2 text-xs text-muted-foreground">
       <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
       <span
         className="transition-opacity duration-200"
         style={{ opacity: verbFading ? 0 : 1 }}
       >
         {generatingVerb}...
       </span>
     </div>
     <Button
       variant="outline"
       size="sm"
       className="h-7 text-xs"
       onClick={stopGeneration}
       aria-label="Stop generating revision"
     >
       <Square className="size-3 fill-current" />
       Stop
     </Button>
   </div>
   ```

   The `fill-current` class on the Square icon makes it a filled square (standard stop icon appearance). The button uses outline variant to visually differentiate from the primary Generate button.
  </action>
  <verify>Run `cd C:/Users/david/Documents/claude-redlining/frontend && npx tsc --noEmit` -- no type errors. Then run `npm run build` to confirm the build passes.</verify>
  <done>
    - Stop button appears next to spinner text while generating
    - Clicking Stop calls stopGeneration which aborts the fetch and resets state
    - After stopping, the "Generate Revision" / "Regenerate" button reappears
    - No visual regressions in sidebar layout
  </done>
</task>

</tasks>

<verification>
1. `cd C:/Users/david/Documents/claude-redlining/frontend && npx tsc --noEmit` passes
2. `cd C:/Users/david/Documents/claude-redlining/frontend && npm run build` passes
3. Manual test: Start dev servers, select a paragraph with risks, click Generate Revision, observe Stop button appears, click Stop, confirm generation cancels and button returns to normal state
</verification>

<success_criteria>
- Stop button visible during revision generation in the sidebar
- Clicking Stop cancels the API request and resets generatingRevision to false
- No error toast shown when user cancels
- User can immediately generate a new revision after stopping
- TypeScript compiles without errors
</success_criteria>

<output>
After completion, create `.planning/quick/5-stop-clause-generation-button-for-revisi/5-SUMMARY.md`
</output>
