---
phase: quick-8
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/review/breadcrumb-bar.tsx
  - frontend/src/components/review/risk-report.tsx
  - frontend/src/app/review/[sessionId]/page.tsx
  - frontend/src/components/layout/header.tsx
  - frontend/src/app/globals.css
autonomous: true
must_haves:
  truths:
    - "Breadcrumb bar appears below header when a paragraph is selected, showing section hierarchy"
    - "Back/forward buttons navigate through focus history"
    - "Clicking a breadcrumb crumb navigates to the first paragraph in that section"
    - "Risk report overlay shows all risks grouped by section with severity counts"
    - "Print button in risk report triggers window.print() with clean layout"
    - "Export Risk Report menu item appears in header hamburger dropdown"
  artifacts:
    - path: "frontend/src/components/review/breadcrumb-bar.tsx"
      provides: "Breadcrumb navigation bar with back/forward and section hierarchy"
    - path: "frontend/src/components/review/risk-report.tsx"
      provides: "Full-screen risk analysis report overlay"
  key_links:
    - from: "breadcrumb-bar.tsx"
      to: "store.ts"
      via: "useAppStore selectors for selectedParaId, paragraphs, focusHistory, goBackInHistory, goForwardInHistory, selectParagraph"
    - from: "risk-report.tsx"
      to: "store.ts"
      via: "useAppStore selectors for risks, paragraphs, analysisSummary, targetFilename"
    - from: "page.tsx"
      to: "breadcrumb-bar.tsx"
      via: "import and render between Header and main content div"
    - from: "header.tsx"
      to: "page.tsx"
      via: "onExportRiskReport callback prop triggers risk report visibility"
---

<objective>
Add a breadcrumb navigation bar with back/forward buttons for clause history, and a full-screen risk analysis print/export overlay accessible from the header menu.

Purpose: Improve document navigation (breadcrumbs show where you are in section hierarchy, back/forward for clause history) and enable printing/exporting the complete risk analysis report.

Output: Two new components, wiring into review page and header.
</objective>

<context>
@frontend/src/app/review/[sessionId]/page.tsx
@frontend/src/components/layout/header.tsx
@frontend/src/lib/store.ts
@frontend/src/lib/types.ts
@frontend/src/app/globals.css
@frontend/src/components/review/risk-card.tsx (for SeverityBadge export reference)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create breadcrumb bar component and wire into review page</name>
  <files>
    frontend/src/components/review/breadcrumb-bar.tsx
    frontend/src/app/review/[sessionId]/page.tsx
  </files>
  <action>
Create `frontend/src/components/review/breadcrumb-bar.tsx` (~60-70 lines):

1. Import `useAppStore` from `@/lib/store`, `ChevronLeft`, `ChevronRight`, `ChevronRight` (as separator) from `lucide-react`, `Button` from `@/components/ui/button`.

2. Read from store:
   - `selectedParaId` - current selected paragraph
   - `paragraphs` - full paragraph list (to find the selected one and look up section hierarchy)
   - `focusHistory` - array of para IDs
   - `focusHistoryIndex` - current position (-1 means at head)
   - `goBackInHistory` - action
   - `goForwardInHistory` - action
   - `selectParagraph` - action

3. If `selectedParaId` is null, return null (hidden when nothing selected).

4. Find the selected paragraph: `paragraphs.find(p => p.id === selectedParaId)`. If not found, return null.

5. Compute button disabled states:
   - Back disabled: `focusHistory.length <= 1` (only one or zero items)
   - Forward disabled: `focusHistoryIndex === -1` (already at head, meaning latest)

6. Build breadcrumb trail from `selectedParagraph.section_hierarchy` (array of `{ number, caption, level }`). Each crumb is clickable — on click, find the first paragraph in `paragraphs` whose `section_ref` starts with that hierarchy item's `number`, then call `selectParagraph(thatParaId)`.

7. Layout: `<div className="no-print flex h-8 shrink-0 items-center gap-1 border-b bg-muted/40 px-3 text-xs text-muted-foreground">`:
   - Back button: ghost variant, h-6 w-6, ChevronLeft icon h-3.5 w-3.5, disabled state
   - Forward button: same with ChevronRight
   - Vertical separator: `<div className="mx-1 h-4 w-px bg-border" />`
   - Breadcrumb crumbs: map over `section_hierarchy`, each is a `<button className="hover:text-foreground hover:underline transition-colors">` showing `item.number` + (if caption exists) ` ${item.caption}`. Between crumbs, render a ChevronRight h-3 w-3 separator icon.
   - After the hierarchy crumbs, if the paragraph has its own `section_ref` that differs from the last hierarchy item, show it as the final crumb (non-clickable, text-foreground font-medium).

Wire into review page (`page.tsx`):
- Import `BreadcrumbBar` from `@/components/review/breadcrumb-bar`
- Insert `<BreadcrumbBar />` after the `<Header onNewProject={handleNewProject} />` line and before the finalized project banner conditional. It should be INSIDE the outer `div.flex.h-screen.flex-col` but before the `{status === "finalized" && ...}` block (line 147).
  </action>
  <verify>
Run `cd frontend && npx tsc --noEmit` to confirm no type errors. Visually verify in browser: select a paragraph in review view, confirm breadcrumb bar appears with section hierarchy and back/forward buttons. Click back after navigating between 2+ paragraphs.
  </verify>
  <done>
Breadcrumb bar renders below header when paragraph selected, hides when none selected. Back/forward buttons navigate focus history. Clicking a breadcrumb crumb jumps to first paragraph in that section. Bar has `no-print` class.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create risk report overlay and wire into header menu</name>
  <files>
    frontend/src/components/review/risk-report.tsx
    frontend/src/components/layout/header.tsx
    frontend/src/app/review/[sessionId]/page.tsx
    frontend/src/app/globals.css
  </files>
  <action>
**A. Create `frontend/src/components/review/risk-report.tsx` (~140-160 lines):**

Props: `{ open: boolean; onClose: () => void }`

1. Import `useAppStore`, `SeverityBadge` from `@/components/review/risk-card` (ensure it's exported — check and add `export` if needed), `X`, `Printer` from `lucide-react`, `Button` from `@/components/ui/button`.

2. Read from store: `risks`, `paragraphs`, `analysisSummary`, `targetFilename`, `sections`.

3. If `!open`, return null.

4. Build section-grouped risks:
   - For each risk, find its paragraph via `paragraphs.find(p => p.id === risk.para_id)`.
   - Group risks by the paragraph's top-level section (first item in `section_hierarchy`, or `section_ref` if no hierarchy). Use the section number + caption as the group label.
   - Sort groups by section number. Within each group, sort by severity (critical first).

5. Render full-screen overlay:
   ```
   <div className="risk-report-overlay fixed inset-0 z-50 overflow-auto bg-white dark:bg-background print:relative print:z-auto">
   ```

   Inside:
   - **Header bar** (no-print): `<div className="no-print sticky top-0 flex items-center justify-between border-b bg-white dark:bg-background px-6 py-3">` with title "Risk Analysis Report", print button (Printer icon, calls `window.print()`), close button (X icon, calls `onClose`).

   - **Report content** (`max-w-4xl mx-auto px-8 py-6`):
     a. **Title**: Document name (`targetFilename`), date (`new Date().toLocaleDateString()`).
     b. **Summary table**: A simple grid/table showing severity counts from `analysisSummary`: Critical, High, Medium, Low, Total. Use colored left-border or SeverityBadge for each row. Style with `border rounded-lg` table.
     c. **Section-by-section risks**: For each section group, render:
        - Section heading: `<h3 className="text-base font-semibold border-b pb-1 mb-3 mt-6">{sectionNumber} {sectionCaption}</h3>`
        - Risk list: For each risk in the group, render a card-like div with:
          - SeverityBadge + risk title on one line
          - Description text below (text-sm text-muted-foreground)
          - If `highlight_text` exists, show it in a `<blockquote>` with italic styling
          - Risk type badge: "Risk" or "Opportunity" as a small pill

**B. Wire into header and review page:**

In `header.tsx`:
- Add a new prop: `onExportRiskReport?: () => void`
- Add a new DropdownMenuItem in the hamburger menu (after "Document Library", before the separator):
  ```
  <DropdownMenuItem onClick={onExportRiskReport}>
    <FileText className="mr-2 h-4 w-4" />
    Export Risk Report
  </DropdownMenuItem>
  ```
  Import `FileText` from lucide-react. Only show this menu item when `view === "review"`.

In `page.tsx`:
- Add `const [riskReportOpen, setRiskReportOpen] = useState(false);`
- Pass `onExportRiskReport={() => setRiskReportOpen(true)}` to `<Header>`
- Import and render `<RiskReport open={riskReportOpen} onClose={() => setRiskReportOpen(false)} />` after `<AnalysisOverlay />` (around line 210).

**C. Add print CSS in `globals.css`:**

Expand the existing `@media print` block (line 601-604) to include:

```css
@media print {
  .no-print {
    display: none !important;
  }

  /* Risk report print styles */
  .risk-report-overlay {
    position: relative !important;
    z-index: auto !important;
    overflow: visible !important;
  }

  body * {
    visibility: hidden;
  }

  .risk-report-overlay,
  .risk-report-overlay * {
    visibility: visible !important;
  }
}
```

Note: The `body * / visibility` trick ensures only the report prints when the overlay is open. However, since the `.no-print` class already hides header/nav/sidebar, a simpler approach may suffice — use judgment. The key requirement is that `window.print()` from the report overlay produces a clean report without app chrome.
  </action>
  <verify>
Run `cd frontend && npx tsc --noEmit` for type checking. In browser: open hamburger menu on review page, click "Export Risk Report", verify overlay appears with summary table and grouped risks. Click Print to confirm print preview shows clean layout. Click Close to dismiss.
  </verify>
  <done>
Risk report overlay opens from header menu, displays summary counts and all risks grouped by section with severity badges. Print produces clean document. Close button dismisses overlay. Menu item only appears in review view.
  </done>
</task>

</tasks>

<verification>
1. `cd frontend && npx tsc --noEmit` passes with no errors
2. Breadcrumb bar: select paragraph -> bar appears with hierarchy crumbs and nav buttons
3. Breadcrumb bar: navigate 3+ paragraphs, back button returns to previous, forward returns
4. Breadcrumb bar: click a hierarchy crumb, jumps to first paragraph in that section
5. Breadcrumb bar: deselect paragraph -> bar hidden
6. Risk report: hamburger menu -> Export Risk Report -> overlay appears
7. Risk report: summary table shows correct counts matching analysis summary
8. Risk report: risks grouped by section, each with severity badge and description
9. Risk report: Print button -> clean print preview
10. Risk report: Close button -> overlay dismissed
</verification>

<success_criteria>
- Breadcrumb bar renders contextually with section hierarchy and functional back/forward navigation
- Risk report overlay is accessible from header menu and produces a printable risk analysis document
- Both features integrate cleanly without breaking existing review page layout
- No TypeScript errors
</success_criteria>
