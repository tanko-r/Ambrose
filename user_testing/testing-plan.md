# QA Testing Plan — Orchestrated Sub-Agent Approach

> Version: 1.0 | Created: 2026-02-11
> App: Contract Redlining Tool (Flask :5000 + Next.js :3000)

---

## Persona: "Sarah Chen"

**Role:** Mid-career real estate attorney, 8 years experience at a mid-size firm
**Tech profile:** Tech-savvy — uses document automation tools, comfortable with web apps, has opinions about UX. Not a developer, but knows when software is fighting her.
**Work style:** Methodical reviewer. Reads every clause. Flags items for her paralegal and client separately. Expects the tool to keep up with her pace, not slow her down.
**Expectations:**
- Professional appearance — she'd be embarrassed if a partner saw a toy-looking tool on her screen
- Predictable behavior — clicking something twice should do the same thing twice
- Clear feedback — if something is loading, say so. If something failed, say why.
- Efficient workflow — she bills in 6-minute increments. Every unnecessary click costs money.
- Trust signals — severity labels should mean something. Risk descriptions should sound like a lawyer wrote them.
- Keyboard shortcuts — she keeps her hands on the keyboard when possible
- No data loss — if she spent 20 minutes reviewing, a crash shouldn't erase that work

**Pet peeves:**
- Buttons that do nothing (no feedback = broken)
- Features listed in the UI that don't work yet (ship it or hide it)
- Having to re-do work because of navigation issues
- Inconsistent visual language (is red "danger" or "deletion"?)
- Tooltips/descriptions missing where a choice has consequences
- Nonintuitive workflows
- Laggy interface

**Gets Excited By:**
- Feeling like a product magically saves drudgery effort that often eats up her day.
- Tools that make her look good in front of her client
- Spotting legal issues that she might have missed
- Out-arguing opposing counsel

---

## Pre-Requisites

1. Flask backend running on :5000
2. Next.js frontend running on :3000
3. Playwright MCP tools loaded (browser_navigate, browser_snapshot, browser_click, browser_take_screenshot, browser_fill_form, browser_press_key, browser_type, browser_hover, browser_select_option, browser_run_code, browser_console_messages)
4. Test data available via "Load Test Data" button on dashboard
5. Screenshot output directory: `C:/Users/david/Documents/claude-redlining/user_testing/screenshots/`

## Scope Exclusions

- **Skip live analysis pipeline** (uploading new .docx + Gemini API analysis) — known broken due to Flask single-threaded concurrency
- Focus on pre-analyzed session testing only

---

## Sub-Agent Architecture

### Orchestrator Responsibilities
1. Load Playwright MCP tools (browser_navigate, browser_snapshot, browser_click, browser_take_screenshot, browser_fill_form, browser_press_key, browser_type, browser_hover, browser_select_option, browser_run_code, browser_console_messages)
2. Navigate to http://localhost:3000, click "Load Test Data", wait for redirect to `/review/test-sample-psa`
3. Dispatch sub-agents in waves (independent sections run in parallel within each wave)
4. After each wave completes, read agent output and append findings to `user_testing/qa-report-s2.md`
5. Between waves, verify the app is still on the review page (recover if a crash occurred)
6. After all waves, compile the final report with persona commentary

### Important: Shared Browser State
All sub-agents share the same Playwright browser instance. This means:
- **Wave 1 (dashboard)** tests the dashboard, then must navigate back to `/review/test-sample-psa` and re-load test data before Wave 2 starts
- **Within a wave**, parallel agents can conflict if they click different things simultaneously — the orchestrator should run agents **sequentially within each wave** unless using separate browser tabs
- **Alternative**: Run agents sequentially but in focused bursts — each agent gets the browser, does its testing, returns findings, then the next agent takes over
- **Recovery**: If any agent crashes the app (e.g., By Category bug), the orchestrator must navigate to `/`, click "Load Test Data", and wait for the review page before dispatching the next agent

### Wave 1: Dashboard & Intake (1 agent)
**Agent: dashboard-tester**
- Test the landing page from Sarah's perspective
- Evaluate: first impression, professional appearance, layout balance
- Test: intake form UX (dropdowns, slider, upload zones, button states)
- Test: recent projects sidebar (list, badges, delete, empty state)
- Test: header navigation (hamburger menu, user menu, + New button)
- Persona lens: "Would Sarah trust this tool at first glance? Can she set up a review in under 60 seconds?"

### Wave 2: Review Page Core (run sequentially — shared browser)

**Agent: document-viewer-tester**
- Test: document rendering fidelity, paragraph selection, visual states
- Test: risk borders, revision markers, flag icons in margin
- Test: text selection → flag tooltip behavior
- Test: scrolling performance, hover states
- Persona lens: "Does the document look like a real contract? Can Sarah click into any paragraph intuitively?"

**Agent: navigation-panel-tester**
- Test: panel open/close/ghost modes
- Test: LINEAR mode — outline accuracy, click-to-navigate
- Test: BY RISK mode — severity grouping, collapse/expand
- Test: BY CATEGORY mode — (known crash, document behavior)
- Test: search/filter, progress counter, severity indicators
- Persona lens: "Can Sarah efficiently jump between clauses? Does the progress counter motivate her?"

**Agent: sidebar-tabs-tester**
- Test: RISKS tab — severity badges, accordion expand, include/exclude toggle, flag from risk
- Test: RELATED tab — precedent matches, click-to-open, caching, empty states
- Test: DEFINITIONS tab — (known empty, document behavior)
- Test: FLAGS tab — flag cards, category badges, edit/delete, empty state
- Persona lens: "Does the risk analysis read like a lawyer wrote it? Can Sarah flag things without losing her place?"

### Wave 3: Interactive Features (run sequentially — shared browser)

**Agent: revision-workflow-tester**
- Test: Generate Revision button states
- Test: Bottom sheet — open, track changes display, rationale
- Test: Approve/Reject/Reset/Reopen lifecycle
- Test: Sheet resize (snap heights), persist edits across paragraphs
- Test: Sidebar footer buttons
- Persona lens: "Is the revision workflow intuitive? Can Sarah approve 10 revisions in 5 minutes?"

**Agent: precedent-panel-tester**
- Test: Opening from Related tab
- Test: Split resize, default ratio
- Test: Precedent HTML rendering, lock/unlock
- Test: Navigator panel (search, filter, position modes)
- Test: Close behavior (X button, Escape key)
- Persona lens: "Can Sarah compare her contract against precedent side-by-side without losing context?"

### Wave 4: Dialogs & Cross-cutting (run sequentially — shared browser)

**Agent: dialogs-tester**
- Test: Flag dialog — Attorney/Client toggle, category pills, save/cancel
- Test: Finalize dialog — stats, revision accordion, author input, export options
- Test: Transmittal dialog — email content, copy/send buttons
- Test: New Project confirmation from review page
- Persona lens: "Are these dialogs self-explanatory? Can Sarah finalize and export without reading a manual?"

**Agent: cross-cutting-tester**
- Test: Bottom bar — progress, navigation, button states, tooltips
- Test: Toast notifications — frequency, clarity, stacking
- Test: Keyboard accessibility — tab order, Enter submits
- Test: Error recovery — what happens after a crash? Can Sarah get back to work?
- Test: State persistence — does data survive navigation?
- Persona lens: "Does the app feel solid and predictable? Are there rough edges that would erode Sarah's trust?"

---

## Sub-Agent Prompt Template

Each sub-agent receives this preamble plus its specific scope:

```
You are QA-testing a contract redlining web app through the eyes of "Sarah Chen" —
a mid-career real estate attorney (8 years), tech-savvy and discerning. She expects
professional polish, predictable behavior, clear feedback, and efficient workflows.
She bills in 6-minute increments so every unnecessary click costs money. She'd be
embarrassed if a partner saw a toy-looking tool on her screen.

Her pet peeves: buttons that do nothing, features that don't work yet but are visible,
having to redo work after navigation/crashes, inconsistent visual language, and missing
tooltips where choices have consequences.

Your scope: [SECTION DESCRIPTION]

Instructions:
1. Use Playwright MCP tools to interact with the app at http://localhost:3000
2. The app should already be on the review page with test data loaded at
   /review/test-sample-psa. If you see "No document loaded", navigate to
   http://localhost:3000, click "Load Test Data", and wait for the redirect.
3. Take screenshots of notable findings. Save to:
   C:/Users/david/Documents/claude-redlining/user_testing/screenshots/s2-[agent]-[name].png
4. For each issue found, record:
   - What you tested
   - What happened vs. what Sarah would expect
   - Severity: Critical / High / Medium / Low / Observation
   - Screenshot filename
5. Also note things that work WELL — Sarah notices quality too.
6. Return a structured list of ALL findings.

IMPORTANT: When browser_snapshot returns a very large result (>100K chars), it will be
saved to a file. Use Grep to search that file for specific elements rather than reading
the whole thing. Alternatively, use browser_run_code to query specific DOM elements.

DO NOT modify any code. This is read-only testing.
```

---

## Output

### Per Sub-Agent
Each agent returns a structured findings list with severity, description, and screenshot references.

### Incremental Writes
After each wave, the orchestrator appends findings to:
`user_testing/qa-report-s2.md`

This ensures findings are persisted even if the orchestrator runs out of context.

### Final Report
After all waves complete, the orchestrator adds a summary section to the report with:
- Total issues by severity
- Top 5 issues Sarah would notice first
- Things Sarah would appreciate
- Comparison with session 1 findings (if applicable)

All files live under `C:\Users\david\Documents\claude-redlining\user_testing\`:
```
user_testing/
├── testing-plan.md          ← this file
├── qa-report-s2.md          ← findings from this test run
├── feature-inventory.md     ← (copy from session 1 if needed)
└── screenshots/
    ├── s2-dashboard-*.png
    ├── s2-document-*.png
    ├── s2-nav-*.png
    ├── s2-sidebar-*.png
    ├── s2-revision-*.png
    ├── s2-precedent-*.png
    ├── s2-dialogs-*.png
    └── s2-crosscutting-*.png
```
