<purpose>
Verify phase goal achievement through goal-backward analysis AND autonomous QA testing. Check that the codebase delivers what the phase promised, not just that tasks completed.

Executed by a verification subagent spawned from execute-phase.md.

**NEW: Autonomous QA Testing Integration**
Before verifying must-haves, run autonomous QA tests to catch user-facing issues, then:
- Fix ALL critical issues automatically
- Integrate verification tests for high/medium priority issues
- Continue with standard verification flow
</purpose>

<core_principle>
**Task completion ≠ Goal achievement**

A task "create chat component" can be marked complete when the component is a placeholder. The task was done — but the goal "working chat interface" was not achieved.

Goal-backward verification:
1. What must be TRUE for the goal to be achieved?
2. What must EXIST for those truths to hold?
3. What must be WIRED for those artifacts to function?

Then verify each level against the actual codebase.

**QA-First Verification:**
Before analyzing artifacts and wiring, test the application as a user would. Catch user-facing issues that structural verification might miss (crashes, broken workflows, confusing UX). Fix critical issues immediately, then verify the fixes worked.
</core_principle>

<required_reading>
@C:/Users/david/.claude/get-shit-done/references/verification-patterns.md
@C:/Users/david/.claude/get-shit-done/templates/verification-report.md
@C:/Users/david/.claude/skills/qa-test/persona.md
@C:/Users/david/.claude/skills/qa-test/agent-prompt.md
</required_reading>

<process>

<step name="load_context" priority="first">
Load phase operation context:

```bash
INIT=$(node C:/Users/david/.claude/get-shit-done/bin/gsd-tools.js init phase-op "${PHASE_ARG}")
```

Extract from init JSON: `phase_dir`, `phase_number`, `phase_name`, `has_plans`, `plan_count`.

Then load phase details and list plans/summaries:
```bash
node C:/Users/david/.claude/get-shit-done/bin/gsd-tools.js roadmap get-phase "${phase_number}"
grep -E "^| ${phase_number}" .planning/REQUIREMENTS.md 2>/dev/null
ls "$phase_dir"/*-SUMMARY.md "$phase_dir"/*-PLAN.md 2>/dev/null
```

Extract **phase goal** from ROADMAP.md (the outcome to verify, not tasks) and **requirements** from REQUIREMENTS.md if it exists.
</step>

<step name="automated_qa_testing" priority="critical">
**Run autonomous QA testing on the completed phase**

This step executes BEFORE structural verification to catch user-facing issues that code analysis might miss.

**1. Check QA prerequisites:**

```bash
# Verify Playwright MCP tools are available
# Required tools: browser_navigate, browser_snapshot, browser_click, browser_take_screenshot,
#                 browser_fill_form, browser_press_key, browser_type, browser_console_messages

# Create screenshot directory
mkdir -p qa-reports/screenshots
```

**2. Extract app URL from PROJECT.md or phase docs:**

```bash
grep -E "http://localhost:" PROJECT.md .planning/phases/${phase_number}-*/PLAN.md 2>/dev/null | head -1
```

Common patterns: localhost:3000 (Next.js), localhost:5173 (Vite), localhost:5000 (Flask), localhost:8080

If not found, check if app is running:
```bash
curl -s http://localhost:3000 >/dev/null && echo "3000" || curl -s http://localhost:5173 >/dev/null && echo "5173"
```

**3. Extract features to test from phase docs:**

Read from phase directory:
- `PLAN.md` — what was planned
- `SUMMARY.md` — what was built
- `VERIFICATION.md` — what was previously verified (if exists)

Extract:
- UI components created/modified
- User-facing features and workflows
- API endpoints (test via UI)
- Key files under `key-files` sections

Build feature inventory list for testing.

**4. Plan test waves:**

Group features into logical waves (max 3 waves for autonomous mode):
- Wave 1: Core functionality (main feature, happy path)
- Wave 2: Interactive workflows (forms, buttons, state changes)
- Wave 3: Edge cases & polish (errors, empty states, keyboard nav)

Each wave contains 1-2 test scopes (sub-agents).

**5. Execute QA testing waves:**

For each wave, dispatch sub-agents using Task tool:
```
subagent_type: general-purpose
model: sonnet (cost-effective for QA)
```

Load persona from `@C:/Users/david/.claude/skills/qa-test/persona.md` and agent template from `@C:/Users/david/.claude/skills/qa-test/agent-prompt.md`.

Fill template parameters:
- `{AGENT_NAME}`: descriptive like `core-features-tester`, `workflows-tester`
- `{SCOPE}`: specific features for this agent to test
- `{APP_URL}`: the detected app URL
- `{SCREENSHOT_DIR}`: `qa-reports/screenshots`

**6. Write QA working file:**

Create `qa-reports/qa-working-${phase_number}.md` with:
- Session header (phase number, app URL, date)
- Wave plan and status
- Agent results as they complete (positives, issues, verdict)
- Running totals by severity

Update this file after EACH agent completes to preserve findings across context resets.

**7. Generate QA report:**

After all waves complete, compile final report from working file to:
`qa-reports/qa-report-phase-${phase_number}.md`

Include:
- Wave-by-wave findings
- Issue totals by severity
- Top issues summary
- Overall assessment in Sarah Chen's voice

Set `QA_REPORT_PATH` for next steps.
</step>

<step name="parse_qa_results">
**Extract actionable issues from QA report**

Read the QA report from `$QA_REPORT_PATH`.

Parse issue tables to extract:

```bash
# Extract all critical issues
grep -E "^\| [0-9]+ \| \*\*Critical\*\*" "$QA_REPORT_PATH" > critical-issues.txt

# Extract all high issues
grep -E "^\| [0-9]+ \| \*\*High\*\*" "$QA_REPORT_PATH" > high-issues.txt

# Extract all medium issues
grep -E "^\| [0-9]+ \| \*\*Medium\*\*" "$QA_REPORT_PATH" > medium-issues.txt
```

For each issue, extract:
- Issue number
- Title (bold text before em dash)
- Description (after em dash)
- Screenshot filename (for evidence)

Build structured lists:
- `CRITICAL_ISSUES[]` — must fix immediately
- `HIGH_ISSUES[]` — integrate verification tests
- `MEDIUM_ISSUES[]` — integrate verification tests

Count totals:
```bash
CRITICAL_COUNT=$(wc -l < critical-issues.txt)
HIGH_COUNT=$(wc -l < high-issues.txt)
MEDIUM_COUNT=$(wc -l < medium-issues.txt)
```
</step>

<step name="fix_critical_issues">
**Automatically fix ALL critical issues found by QA**

If `CRITICAL_COUNT` > 0:

For each critical issue:

1. **Analyze the issue:**
   - Read the issue description and screenshot
   - Identify root cause (crash, data loss, broken feature)
   - Determine which files need modification

2. **Generate fix plan:**
   - Objective: Fix [issue title]
   - Tasks:
     * Read affected files
     * Implement fix (specific changes needed)
     * Test that fix works (re-run failing scenario)
   - Success criteria: Issue no longer reproducible

3. **Execute fix immediately:**
   - Make necessary code changes
   - Test using Playwright browser tools to verify fix
   - If fix doesn't work, iterate until resolved
   - If fix requires extensive refactoring, document as blocker and continue with other issues

4. **Document the fix:**
   - Add to `${phase_dir}/${phase_number}-QA-FIXES.md`:
     ```markdown
     ## Critical Issue #N: [Title]
     **Problem:** [Description]
     **Root Cause:** [What was wrong]
     **Fix Applied:** [What was changed]
     **Files Modified:** [List]
     **Verification:** [How we confirmed it works]
     ```

5. **Commit the fix:**
   ```bash
   git add [modified files]
   git commit -m "fix(phase-${phase_number}): [issue title]

   Resolves critical QA finding from automated verification.

   Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
   ```

After all critical fixes:
- Re-run QA testing on the same scope to verify fixes worked
- Update QA report with verification results
- If new critical issues found, iterate until none remain
</step>

<step name="integrate_verification_tests">
**Create verification tests for high and medium priority issues**

For each high/medium issue that was NOT fixed (we fixed criticals only):

1. **Analyze issue for testability:**
   - Can this be verified programmatically? (API response, DOM state, console errors)
   - Or does it need human judgment? (visual polish, UX feel)

2. **For programmatically testable issues, create verification test:**

   Add to `must_haves` structure:
   ```json
   {
     "truths": [
       "User sees clear error message when [scenario]"
     ],
     "artifacts": [
       "ErrorBoundary component with user-friendly messages",
       "Toast notification system for errors"
     ],
     "key_links": [
       {
         "from": "API error response",
         "to": "Toast notification",
         "via": "error handler in fetch wrapper"
       }
     ]
   }
   ```

3. **Document in verification plan:**

   Create/update `${phase_dir}/${phase_number}-QA-VERIFICATION-TESTS.md`:
   ```markdown
   ## High Priority Issue #N: [Title]
   **Scenario:** [How to reproduce]
   **Expected:** [What should happen]
   **Test:**
   - Artifact check: Verify [component/file] exists and contains [pattern]
   - Wiring check: Verify [connection] between [A] and [B]
   - Runtime check: Execute [scenario] via browser tools, assert [outcome]

   ## Medium Priority Issue #M: [Title]
   [Same structure]
   ```

4. **Add to must_haves for this phase:**

   Merge QA-derived must_haves with plan-derived must_haves so they're verified together in later steps.

**For issues needing human judgment:**

Add to `human_verification` list with clear test instructions:
- Issue reference (QA report issue #N)
- Scenario to test
- Expected outcome
- Why it needs human eyes (visual, UX feel, subjective quality)
</step>

<step name="establish_must_haves">
**Option A: Must-haves in PLAN frontmatter**

Use gsd-tools to extract must_haves from each PLAN:

```bash
for plan in "$PHASE_DIR"/*-PLAN.md; do
  MUST_HAVES=$(node C:/Users/david/.claude/get-shit-done/bin/gsd-tools.js frontmatter get "$plan" --field must_haves)
  echo "=== $plan ===" && echo "$MUST_HAVES"
done
```

Returns JSON: `{ truths: [...], artifacts: [...], key_links: [...] }`

Aggregate all must_haves across plans for phase-level verification.

**Option B: Derive from phase goal**

If no must_haves in frontmatter (MUST_HAVES returns error or empty):
1. State the goal from ROADMAP.md
2. Derive **truths** (3-7 observable behaviors, each testable)
3. Derive **artifacts** (concrete file paths for each truth)
4. Derive **key links** (critical wiring where stubs hide)
5. Document derived must-haves before proceeding

**Merge with QA-derived must_haves:**

Combine must_haves from PLAN frontmatter with must_haves created in `integrate_verification_tests` step. QA-derived must_haves ensure user-facing issues are verified, plan-derived must_haves ensure structural completeness.
</step>

<step name="verify_truths">
For each observable truth, determine if the codebase enables it.

**Status:** ✓ VERIFIED (all supporting artifacts pass) | ✗ FAILED (artifact missing/stub/unwired) | ? UNCERTAIN (needs human)

For each truth: identify supporting artifacts → check artifact status → check wiring → determine truth status.

**Example:** Truth "User can see existing messages" depends on Chat.tsx (renders), /api/chat GET (provides), Message model (schema). If Chat.tsx is a stub or API returns hardcoded [] → FAILED. If all exist, are substantive, and connected → VERIFIED.
</step>

<step name="verify_artifacts">
Use gsd-tools for artifact verification against must_haves in each PLAN:

```bash
for plan in "$PHASE_DIR"/*-PLAN.md; do
  ARTIFACT_RESULT=$(node C:/Users/david/.claude/get-shit-done/bin/gsd-tools.js verify artifacts "$plan")
  echo "=== $plan ===" && echo "$ARTIFACT_RESULT"
done
```

Parse JSON result: `{ all_passed, passed, total, artifacts: [{path, exists, issues, passed}] }`

**Artifact status from result:**
- `exists=false` → MISSING
- `issues` not empty → STUB (check issues for "Only N lines" or "Missing pattern")
- `passed=true` → VERIFIED (Levels 1-2 pass)

**Level 3 — Wired (manual check for artifacts that pass Levels 1-2):**
```bash
grep -r "import.*$artifact_name" src/ --include="*.ts" --include="*.tsx"  # IMPORTED
grep -r "$artifact_name" src/ --include="*.ts" --include="*.tsx" | grep -v "import"  # USED
```
WIRED = imported AND used. ORPHANED = exists but not imported/used.

| Exists | Substantive | Wired | Status |
|--------|-------------|-------|--------|
| ✓ | ✓ | ✓ | ✓ VERIFIED |
| ✓ | ✓ | ✗ | ⚠️ ORPHANED |
| ✓ | ✗ | - | ✗ STUB |
| ✗ | - | - | ✗ MISSING |
</step>

<step name="verify_wiring">
Use gsd-tools for key link verification against must_haves in each PLAN:

```bash
for plan in "$PHASE_DIR"/*-PLAN.md; do
  LINKS_RESULT=$(node C:/Users/david/.claude/get-shit-done/bin/gsd-tools.js verify key-links "$plan")
  echo "=== $plan ===" && echo "$LINKS_RESULT"
done
```

Parse JSON result: `{ all_verified, verified, total, links: [{from, to, via, verified, detail}] }`

**Link status from result:**
- `verified=true` → WIRED
- `verified=false` with "not found" → NOT_WIRED
- `verified=false` with "Pattern not found" → PARTIAL

**Fallback patterns (if key_links not in must_haves):**

| Pattern | Check | Status |
|---------|-------|--------|
| Component → API | fetch/axios call to API path, response used (await/.then/setState) | WIRED / PARTIAL (call but unused response) / NOT_WIRED |
| API → Database | Prisma/DB query on model, result returned via res.json() | WIRED / PARTIAL (query but not returned) / NOT_WIRED |
| Form → Handler | onSubmit with real implementation (fetch/axios/mutate/dispatch), not console.log/empty | WIRED / STUB (log-only/empty) / NOT_WIRED |
| State → Render | useState variable appears in JSX (`{stateVar}` or `{stateVar.property}`) | WIRED / NOT_WIRED |

Record status and evidence for each key link.
</step>

<step name="verify_requirements">
If REQUIREMENTS.md exists:
```bash
grep -E "Phase ${PHASE_NUM}" .planning/REQUIREMENTS.md 2>/dev/null
```

For each requirement: parse description → identify supporting truths/artifacts → status: ✓ SATISFIED / ✗ BLOCKED / ? NEEDS HUMAN.
</step>

<step name="scan_antipatterns">
Extract files modified in this phase from SUMMARY.md, scan each:

| Pattern | Search | Severity |
|---------|--------|----------|
| TODO/FIXME/XXX/HACK | `grep -n -E "TODO\|FIXME\|XXX\|HACK"` | ⚠️ Warning |
| Placeholder content | `grep -n -iE "placeholder\|coming soon\|will be here"` | 🛑 Blocker |
| Empty returns | `grep -n -E "return null\|return \{\}\|return \[\]\|=> \{\}"` | ⚠️ Warning |
| Log-only functions | Functions containing only console.log | ⚠️ Warning |

Categorize: 🛑 Blocker (prevents goal) | ⚠️ Warning (incomplete) | ℹ️ Info (notable).
</step>

<step name="identify_human_verification">
**Always needs human:** Visual appearance, user flow completion, real-time behavior (WebSocket/SSE), external service integration, performance feel, error message clarity.

**Needs human if uncertain:** Complex wiring grep can't trace, dynamic state-dependent behavior, edge cases.

**Add QA issues needing human judgment** (from integrate_verification_tests step).

Format each as: Test Name → What to do → Expected result → Why can't verify programmatically.
</step>

<step name="determine_status">
**passed:** All truths VERIFIED, all artifacts pass levels 1-3, all key links WIRED, no blocker anti-patterns, no critical QA issues remain.

**gaps_found:** Any truth FAILED, artifact MISSING/STUB, key link NOT_WIRED, blocker found, OR unfixed critical QA issues.

**human_needed:** All automated checks pass but human verification items remain.

**Score:** `verified_truths / total_truths`

**QA score:** `(total_issues - critical_issues) / total_issues` — percentage of non-critical issues (critical issues MUST be 0 for passed status)
</step>

<step name="generate_fix_plans">
If gaps_found:

1. **Cluster related gaps:** API stub + component unwired → "Wire frontend to backend". Multiple missing → "Complete core implementation". Wiring only → "Connect existing components".

2. **Generate plan per cluster:** Objective, 2-3 tasks (files/action/verify each), re-verify step. Keep focused: single concern per plan.

3. **Order by dependency:** Fix missing → fix stubs → fix wiring → verify.

**Note:** Critical QA issues were already fixed in `fix_critical_issues` step. These plans are for structural gaps found during artifact/wiring verification.
</step>

<step name="create_report">
```bash
REPORT_PATH="$PHASE_DIR/${PHASE_NUM}-VERIFICATION.md"
```

Fill template sections:
- Frontmatter (phase/timestamp/status/score/qa_score)
- **QA Testing Results** (NEW section: link to QA report, critical fixes applied, high/med issues tracked)
- Goal achievement
- Artifact table
- Wiring table
- Requirements coverage
- Anti-patterns
- Human verification
- Gaps summary
- Fix plans (if gaps_found)
- Metadata

See C:/Users/david/.claude/get-shit-done/templates/verification-report.md for complete template.

**New QA section format:**
```markdown
## QA Testing Results

**Report:** [`qa-report-phase-${phase_number}.md`](../../qa-reports/qa-report-phase-${phase_number}.md)

### Issue Summary
| Severity | Count | Status |
|----------|-------|--------|
| Critical | ${CRITICAL_COUNT} | ✓ All fixed (see QA-FIXES.md) |
| High | ${HIGH_COUNT} | Verification tests integrated |
| Medium | ${MEDIUM_COUNT} | Verification tests integrated |
| Low | ${LOW_COUNT} | Documented for future improvement |

### Critical Fixes Applied
[List of critical issues fixed with commit references]

### Verification Tests Integrated
[List of high/medium issues now covered by must_haves verification]
```
</step>

<step name="return_to_orchestrator">
Return status (`passed` | `gaps_found` | `human_needed`), score (N/M must-haves), QA score, report path.

If gaps_found: list gaps + recommended fix plan names.
If human_needed: list items requiring human testing.

Orchestrator routes: `passed` → update_roadmap | `gaps_found` → create/execute fixes, re-verify | `human_needed` → present to user.
</step>

</process>

<success_criteria>
- [ ] Must-haves established (from frontmatter or derived)
- [ ] **QA testing completed autonomously** (NEW)
- [ ] **All critical QA issues fixed and verified** (NEW)
- [ ] **Verification tests integrated for high/med QA issues** (NEW)
- [ ] All truths verified with status and evidence
- [ ] All artifacts checked at all three levels
- [ ] All key links verified
- [ ] Requirements coverage assessed (if applicable)
- [ ] Anti-patterns scanned and categorized
- [ ] Human verification items identified (including QA items)
- [ ] Overall status determined (including QA score)
- [ ] Fix plans generated (if gaps_found)
- [ ] VERIFICATION.md created with complete report including QA section
- [ ] Results returned to orchestrator
</success_criteria>
