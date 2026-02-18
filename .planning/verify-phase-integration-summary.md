# Verify-Phase QA Integration Summary

## Overview

Modified `verify-phase.md` to integrate autonomous QA testing BEFORE structural verification. The workflow now:

1. **Runs QA tests automatically** (no user prompts)
2. **Fixes ALL critical issues** found by QA
3. **Integrates verification tests** for high/medium priority issues
4. **Continues with standard verification** (artifacts, wiring, must-haves)

## New Steps Added

### 1. `automated_qa_testing` (after `load_context`, before `establish_must_haves`)

**What it does:**
- Checks Playwright MCP prerequisites
- Extracts app URL from PROJECT.md or phase docs
- Builds feature inventory from PLAN.md, SUMMARY.md
- Plans test waves (max 3 waves, 1-2 agents per wave)
- Dispatches sub-agents using Sarah Chen persona
- Writes working file (`qa-reports/qa-working-${phase_number}.md`)
- Generates final QA report (`qa-reports/qa-report-phase-${phase_number}.md`)

**Key features:**
- **Fully autonomous** - no AskUserQuestion calls
- **Uses sonnet model** for cost efficiency (5x cheaper than opus)
- **Preserves findings** via working file across context resets
- **Tests only current phase** (scoped automatically)

### 2. `parse_qa_results` (after `automated_qa_testing`)

**What it does:**
- Reads QA report from `$QA_REPORT_PATH`
- Extracts issues by severity (critical, high, medium)
- Builds structured lists for processing
- Counts issues by severity

**Outputs:**
- `CRITICAL_ISSUES[]` - issues to fix immediately
- `HIGH_ISSUES[]` - issues to convert to verification tests
- `MEDIUM_ISSUES[]` - issues to convert to verification tests
- Issue counts for reporting

### 3. `fix_critical_issues` (after `parse_qa_results`)

**What it does:**
For each critical issue:
1. Analyzes issue (description + screenshot)
2. Generates fix plan (objective, tasks, success criteria)
3. **Executes fix immediately** (code changes + testing)
4. Documents fix in `${phase_dir}/${phase_number}-QA-FIXES.md`
5. Commits fix with descriptive message

After all fixes:
- **Re-runs QA testing** to verify fixes worked
- Updates QA report with verification results
- **Iterates until no critical issues remain**

**Key features:**
- **Zero user input required**
- **Verifies fixes work** before moving on
- **Documents all fixes** for traceability
- **Commits atomically** per fix

### 4. `integrate_verification_tests` (after `fix_critical_issues`)

**What it does:**
For each high/medium issue:
1. Analyzes if testable programmatically
2. Creates verification test specification (truths, artifacts, key_links)
3. Adds to `must_haves` structure for automated verification
4. Documents in `${phase_dir}/${phase_number}-QA-VERIFICATION-TESTS.md`

For issues needing human judgment:
- Adds to `human_verification` list with clear instructions

**Key features:**
- **Prevents regression** - QA issues become automated checks
- **Merges with plan-derived must_haves** - verified together
- **Separates automated vs human verification**

## Modified Steps

### `establish_must_haves`

**Added:** Merges QA-derived must_haves with plan-derived must_haves

Now includes:
- Must_haves from PLAN frontmatter (original)
- Must_haves derived from phase goal (original)
- **Must_haves created from QA high/medium issues** (NEW)

### `determine_status`

**Added:** QA score calculation and critical issue check

New status logic:
- **passed:** All truths verified + no critical QA issues
- **gaps_found:** Any gaps OR unfixed critical issues
- **human_needed:** Automated checks pass + human items remain

New scoring:
- Verification score: `verified_truths / total_truths` (original)
- **QA score:** `(total_issues - critical_issues) / total_issues` (NEW)

### `create_report`

**Added:** QA Testing Results section in VERIFICATION.md

New section includes:
- Link to full QA report
- Issue summary table (count by severity + status)
- Critical fixes applied (with commit references)
- Verification tests integrated (list of high/med issues now covered)

## File Outputs

### New Files Created by Modified Workflow

1. **`qa-reports/qa-working-${phase_number}.md`** - Working file during QA session
   - Session state (wave plan, agent results, running totals)
   - Survives context resets and compaction
   - Updated after each agent completes

2. **`qa-reports/qa-report-phase-${phase_number}.md`** - Final QA report
   - Wave-by-wave findings
   - Issue tables with severity and screenshots
   - Sarah Chen's verdicts
   - Overall assessment

3. **`qa-reports/screenshots/*.png`** - Visual evidence
   - Screenshot per finding
   - Naming: `[agent-name]-[descriptive-name].png`

4. **`${phase_dir}/${phase_number}-QA-FIXES.md`** - Critical fix documentation
   - Problem, root cause, fix applied
   - Files modified, verification steps
   - Commit references

5. **`${phase_dir}/${phase_number}-QA-VERIFICATION-TESTS.md`** - Verification test specs
   - High/medium issues converted to tests
   - Scenario, expected outcome, test methodology
   - Artifact checks, wiring checks, runtime checks

### Modified Files

6. **`${phase_dir}/${phase_number}-VERIFICATION.md`** - Enhanced verification report
   - Now includes QA Testing Results section
   - Links to QA report and fix documentation
   - QA score alongside verification score

## Integration Points

### With execute-phase.md

The `execute-phase` orchestrator spawns `gsd-verifier` agent which runs this workflow.

**No changes needed** to execute-phase - it already calls verify-phase and handles status routing:
- `passed` → update roadmap, continue to next phase
- `gaps_found` → execute fix plans, re-verify
- `human_needed` → present to user

### With qa-test skill

The modified workflow **inlines QA testing logic** rather than calling the qa-test skill via Skill tool.

**Why:** qa-test has user interaction points (scope proposal, wave approval) that need to be bypassed for autonomous operation. Inlining allows full control.

**Reuses from qa-test:**
- `persona.md` - Sarah Chen persona definition
- `agent-prompt.md` - Sub-agent prompt template
- Severity scale, finding format, working file protocol

## Configuration

### Prerequisites

**Required Playwright MCP tools:**
- `browser_navigate`, `browser_snapshot`, `browser_click`
- `browser_take_screenshot`, `browser_fill_form`, `browser_press_key`
- `browser_type`, `browser_hover`, `browser_select_option`
- `browser_run_code`, `browser_console_messages`

**App requirements:**
- App must be running on localhost (auto-detected port)
- App URL documented in PROJECT.md or phase PLAN.md
- App accessible via HTTP (no auth required for testing, or auth can be bypassed)

### Cost Optimization

**Model selection:**
- QA sub-agents use **sonnet** (not opus)
- ~5x cheaper for testing workloads
- Sufficient for browser interaction and finding documentation

**Wave planning:**
- Max 3 waves per phase
- 1-2 agents per wave
- Minimizes cost while covering key functionality

## Testing the Integration

To test the modified workflow:

1. **Ensure prerequisites:**
   ```bash
   # Verify Playwright MCP is loaded
   # Check app is running
   curl http://localhost:3000
   ```

2. **Run on a completed phase:**
   ```bash
   # From project root
   /gsd:verify-phase 7
   ```

3. **Verify outputs:**
   - Check `qa-reports/qa-report-phase-7.md` exists
   - Check `qa-reports/qa-working-7.md` exists
   - If critical issues found, check `phases/7-*/7-QA-FIXES.md`
   - Check `phases/7-*/7-VERIFICATION.md` has QA section

4. **Verify critical fixes:**
   - Check git log for fix commits
   - Verify fixed issues no longer reproducible

5. **Verify verification tests:**
   - Check `phases/7-*/7-QA-VERIFICATION-TESTS.md`
   - Verify must_haves in verification report include QA-derived tests

## Next Steps

### To Deploy

1. **Backup current verify-phase.md:**
   ```bash
   cp C:/Users/david/.claude/get-shit-done/workflows/verify-phase.md \
      C:/Users/david/.claude/get-shit-done/workflows/verify-phase.md.backup
   ```

2. **Copy modified workflow:**
   ```bash
   cp .planning/verify-phase-modified.md \
      C:/Users/david/.claude/get-shit-done/workflows/verify-phase.md
   ```

3. **Test on a phase:**
   Run `/gsd:verify-phase N` on a recently completed phase

4. **If issues found:**
   - Revert: `cp verify-phase.md.backup verify-phase.md`
   - Document issues
   - Iterate on modified version

### To Improve

**Future enhancements:**
- Extract autonomous QA logic into separate `autonomous-qa.md` workflow
- Add configuration for wave count and agent count per wave
- Support for authenticated apps (login automation)
- Integration with CI/CD (run QA tests on every phase completion automatically)
- Metrics tracking (QA score trend over time)
