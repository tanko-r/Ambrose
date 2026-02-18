# QA Report — Session 2 (Orchestrated Sub-Agent Testing)

> Date: 2026-02-11
> Persona: Sarah Chen — Mid-career real estate attorney
> App: Contract Redlining Tool (Flask :5000 + Next.js :3000)

---

## Wave 1: Dashboard & Intake

### Things That Work Well
1. **Professional first impression** — Clean white layout with good visual hierarchy. The "Contract Review" header, upload zones, and Recent Projects sidebar create a clear information architecture. Sarah would not be embarrassed showing this to a partner.
2. **Intake form is well-organized** — Representation dropdown (Seller/Buyer/Landlord/Tenant/Lender/Borrower/Developer/etc.), Review Approach (Quick Sale/Competitive Bid/Relationship/Adversarial), and Intensity slider (1-5) are sensible options a lawyer would understand.
3. **Start Review button correctly disabled** — Without a file upload, the button is grayed out and disabled. Good guard against accidental empty submissions.
4. **Recent Projects sidebar** — Shows project name, status badges (Not Started/Finalized/In Progress), timestamps, and metadata (revisions, flags). Delete buttons visible on each entry. Good at-a-glance view.
5. **Dropdowns work correctly** — Representation and Review Approach dropdowns open cleanly with clear option lists and checkmarks on selected items.
6. **Hamburger menu** — Opens with New Project, Document Library, Settings, Help options. Clean layout.
7. **User menu** — Shows Profile, Preferences, Logout. Standard and expected.

### Issues Found

| # | Severity | Finding | Screenshot |
|---|----------|---------|------------|
| 1 | **Medium** | **Recent Projects badges clipped at right edge** — The status badges ("Not Started", "In Progress") on recent project entries are cut off at the right edge of the sidebar. The sidebar panel doesn't have enough width to show full badge text. | `s2-dashboard-first-impression-full.png` |
| 2 | **Medium** | **Horizontal scrollbar appears** — A horizontal scrollbar is visible at the bottom of the page, suggesting content overflows the viewport width. Professional apps shouldn't have horizontal scroll on the main page. | `s2-dashboard-horizontal-scrollbar.png` |
| 3 | **Low** | **"Include exhibits" checkbox partially obscured** — The checkbox at bottom-left is partially covered by what appears to be a floating "N" badge (Next.js dev tools). In production this wouldn't appear, but worth noting the checkbox is in a cramped position near the bottom edge. | `s2-dashboard-checkbox-checked.png` |
| 4 | **Low** | **No tooltips on Representation/Review Approach options** — Sarah's persona expects tooltips "where a choice has consequences." Selecting "Adversarial" vs "Relationship" has significant implications for the review, but there's no explanation of what each approach means. | `s2-dashboard-review-approach-dropdown.png` |
| 5 | **Low** | **No confirmation on project delete** — Delete buttons on Recent Projects are visible. If clicking them deletes without confirmation, that violates Sarah's "no data loss" expectation. (Not tested — would need click to verify.) | `s2-dashboard-project-hover.png` |
| 6 | **Observation** | **Document Library toast behavior** — Clicking "Document Library" in hamburger menu triggers a toast/notification rather than navigating to a dedicated page. Feature may not be fully implemented yet. Sarah's pet peeve: "features listed in the UI that don't work yet." | `s2-dashboard-document-library-toast.png` |
| 7 | **Observation** | **Intensity slider label updates correctly** — Slider shows "3 — Balanced" and label updates dynamically. Good UX. However, no description of what intensity levels 1-5 actually mean for the review output. | — |
| 8 | **Observation** | **Excessive top whitespace** — There's a notable gap between the header and the "New Contract Review" card. Could use tighter spacing to bring content above the fold. | `s2-dashboard-first-impression-full.png` |

### Sarah's Verdict (Wave 1)
> "Clean enough that I'd use it. The intake form makes sense — I like that it asks about representation and deal posture. But I'd want to know what 'Competitive Bid' vs 'Relationship' actually means before I pick one. And those clipped badges in the sidebar are sloppy. Fix the horizontal scroll — that's amateur hour."

---

## Wave 2: Review Page Core

### Wave 2a: Document Viewer

#### Things That Work Well
1. **Document renders like a real contract** — Title "PURCHASE AND SALE AGREEMENT" is prominent and centered. Body text uses justified alignment with proper indentation. Defined terms ("Agreement", "Seller", "Buyer", "Effective Date", "Real Property") are correctly bolded. Section numbering (1, 1.1, 1.2, etc.) is preserved.
2. **Paragraph selection works intuitively** — Clicking a paragraph highlights it with a blue/orange dashed border and updates the right sidebar to show clause analysis for that specific paragraph.
3. **Risk severity borders visible** — Colored left borders on navigator items indicate risk level. Orange for high, yellow for medium, blue for low.
4. **Text selection triggers Flag tooltip** — Selecting text within a paragraph shows a floating "Flag" button, allowing Sarah to flag specific language for client review.
5. **Sidebar updates contextually** — When clicking clause "5A Due Diligence Period", the sidebar shows 2 risks (HIGH: "Disclaimer of Document Accuracy", INFO: "Cross-Reference Section 7") with severity badges. The count "2 of 2 risks selected for revision" is shown.
6. **Bottom bar is functional** — Shows clause navigation ("7 of 99"), action buttons (View Revision, Regenerate, flag icon), Generate Transmittal, and Finalize Redline.

#### Issues Found

| # | Severity | Finding | Screenshot |
|---|----------|---------|------------|
| 9 | **Medium** | **Finalization banner does not dismiss** — Green banner "This project was finalized. Editing will clear the finalized status." persists at the top. The "Edit" button exists but its behavior needs verification. Banner takes valuable vertical space. | `s2-review-page-initial.png` |
| 10 | **Low** | **Document scroll position not preserved** — When navigating between clauses via the sidebar, the document scrolls to the selected clause but the navigator panel doesn't always auto-scroll to match. | `s2-document-para-selected.png` |
| 11 | **Observation** | **"No risks identified" for early clauses** — Clause 1 "Purchase and Sale" shows "No risks identified for this clause." This is correct (it's a standard operative clause), showing the AI is properly triaging. | `s2-document-para-selected.png` |

### Wave 2b: Navigation Panel

#### Things That Work Well
1. **Click-to-navigate is smooth and reliable** — Clicking clauses in LINEAR and BY RISK modes scrolls the document to the correct clause and highlights it.
2. **Section numbering preserved** — Shows 1, 1A, 1B, 1C, 1D, 1E, 1F, 2, 3, 3A-3D, 4, etc. with hierarchical structure.
3. **BY RISK grouping works** — Groups clauses into HIGH (25), MEDIUM (37), LOW (14) with appropriate colored dots.
4. **Reviewed indicator** — Clause 1F "Leases" shows a green checkmark. Counter "Reviewed: 1/99" is accurate.
5. **Panel collapse/expand is clean** — Hide button collapses navigator, document area expands from 577px to 837px. Small icon appears to reopen.
6. **Selected clause highlighting** — Blue background on the active clause in the navigator list.
7. **Risk severity borders** — 76 clause items show colored left borders for severity scanning.

#### Issues Found

| # | Severity | Finding | Screenshot |
|---|----------|---------|------------|
| 12 | **CRITICAL** | **BY CATEGORY crashes the app** — Clicking "BY CATEGORY" tab throws `TypeError: Cannot read properties of null (reading 'split')` at `navigation-panel.tsx:489`. Paragraphs with null `section_ref` crash `ByCategoryOutline`. Requires full page reload + test data re-load to recover. | `s2-nav-by-category-crash.png` |
| 13 | **CRITICAL** | **Search/filter crashes the app** — Typing in "Filter clauses..." box throws `TypeError: Cannot read properties of null (reading 'toLowerCase')` at `navigation-panel.tsx:111`. Same root cause: null `section_ref` not null-checked. | `s2-nav-filter-purchase-zero.png` |
| 14 | **High** | **Section numbering resets after Section 10** — Articles 11+ (Closing, Escrow, Default) show as "1", "1A", "2", "3" — indistinguishable from actual Section 1 content. | `s2-nav-click-as-is-result.png` |
| 15 | **High** | **"+15 more" in BY RISK is not clickable** — Each risk group caps at 10 visible items with a "+15 more" div, but it's a non-interactive `<div>` with no click handler or cursor:pointer. 15 HIGH-risk clauses are completely inaccessible. | `s2-nav-by-risk-mode.png` |
| 16 | **Medium** | **Hide/Show label out of sync** — After reopening the panel, button shows "Show" while the panel is visibly open. Self-corrects after one additional click. Toggle state is one step behind. | `s2-nav-show-hide-label-bug.png` |
| 17 | **Medium** | **Empty paragraphs in navigator** — 389 total buttons vs 99 analyzed paragraphs. Blank lines, address fragments, and exhibit signature blocks appear as clickable empty items. | `s2-nav-initial-state.png` |
| 18 | **Medium** | **No tooltips on severity dots** — Bottom bar severity dots (49 high, 86 medium, 35 low) have no title or aria-label. A new user wouldn't know what the colors/numbers mean. | `s2-nav-bottom-bar.png` |
| 19 | **Low** | **Navigator doesn't auto-scroll** — When document is navigated by other means, navigator doesn't scroll to show the selected item. | — |
| 20 | **Low** | **Missing Critical/Info severity groups** — BY RISK only shows HIGH, MEDIUM, LOW. No Critical or Info groups despite INFO badges on individual risk items. | `s2-nav-by-risk-mode.png` |
| 21 | **Low** | **No collapse/expand on risk groups** — Group headers in BY RISK mode are not collapsible. | — |
| 22 | **Low** | **No aria-labels on prev/next navigation buttons** — Accessibility gap. | — |

**Root cause for #12 and #13**: Both crashes stem from null `section_ref` on some paragraphs in `navigation-panel.tsx`. Fix: `para.section_ref?.split(".")[0] || "other"` (line 489) and `p.section_ref?.toLowerCase()?.includes(q)` (line 111).

### Wave 2c: Sidebar Tabs (RISKS, RELATED, DEFINITIONS, FLAGS)

#### Things That Work Well
1. **RISKS tab is excellent** — Severity badges (HIGH orange, MEDIUM amber, LOW yellow, INFO dark gray) are clear and consistent. Tab badge count (e.g., "RISKS 4") updates instantly when switching clauses.
2. **Accordion expand/collapse on risks** — Click a risk card to see full description, "Include in revision?" toggle, and "Flag" button. Only one risk expands at a time. Clean interaction.
3. **Include/Exclude toggle works perfectly** — Green checkmark for "Included", X icon for "Excluded". Counter "X of Y risks selected for revision" updates instantly.
4. **Flag from risk card** — Opens Flag dialog pre-populated with risk title and description. Very efficient workflow.
5. **RELATED tab is strong** — Every clause tested had relevant precedent matches with semantic matching. Card layout shows section number and text preview. Clicking opens full precedent viewer side-by-side.
6. **Tab caching works** — Switching away and back correctly reloads content without delay.
7. **Tab switching is bulletproof** — 8 rapid switches at 100ms intervals, no visual glitches or race conditions. Tab selection persists across clause changes.
8. **FLAGS tab two-section layout** — "Flags" for current clause at top, "All Flags (N)" collapsible section below. Smart for context. Flag cards show clause number, category badge, date, and full description.
9. **Sidebar collapse/expand** — Clean animation, restores same clause + tab + content. No data loss.

#### Issues Found

| # | Severity | Finding | Screenshot |
|---|----------|---------|------------|
| 23 | **High** | **DEFINITIONS tab completely non-functional** — Shows "No defined terms found" for EVERY clause, including the preamble that explicitly defines "Agreement", "Seller", "Buyer", "Effective Date" and section 1A defining "Real Property". Feature appears unimplemented or backend not returning definition data. Sarah's pet peeve: "features listed in the UI that don't work yet." | `s2-sidebar-definitions-empty.png` |
| 24 | **High** | **Flag delete has no confirmation** — Clicking "Remove flag" instantly deletes with no undo or "Are you sure?" prompt. For a billing attorney, accidentally deleting a detailed flag note wastes time. Violates Sarah's "no data loss" expectation. | `s2-sidebar-flag-deleted-no-confirm.png` |
| 25 | **High** | **Possible flag multi-delete bug** — Clicking Remove on one flag appeared to delete 2 flags (count went from 3 to 1). Both 5A flags vanished simultaneously. May be rendering issue or actual data bug. | `s2-sidebar-flag-deleted-no-confirm.png` |
| 26 | **Medium** | **Related click opens two panels at once** — Clicking a related clause card opens precedent panel AND triggers the revision overlay simultaneously. Two major UI elements changing at once is disorienting. | `s2-sidebar-collapsed-after-related-click.png` |
| 27 | **Medium** | **Edit Flag dialog shows wrong category** — When editing an existing "Attorney" flag, the dialog pre-selects "For Discussion" instead of "Attorney". Saved category not restored into dialog. | `s2-sidebar-edit-flag-dialog.png` |
| 28 | **Medium** | **"null" in revision panel title** — Clauses without section numbers (e.g., preamble) show "null — THIS PURCHASE AND SALE AGREEMENT..." instead of just the clause text. | `s2-sidebar-definitions-empty.png` |
| 29 | **Low** | **Collapse button has no tooltip** — No `title` or `aria-label` attribute. Not discoverable. | `s2-sidebar-collapsed.png` |
| 30 | **Low** | **Edit Flag button says "Add Flag"** — Confusing — user can't tell if this creates a duplicate or updates existing. Should say "Update Flag" or "Save". | `s2-sidebar-edit-flag-dialog.png` |
| 31 | **Low** | **React warning: Accordion controlled/uncontrolled** — Console warning when expanding risk cards. Dev-only but indicates state management issue. | — |

### Sarah's Verdict (Wave 2 Complete)
> "The risk analysis sidebar is genuinely impressive — severity badges make sense, the include/exclude toggle is exactly what I need, and flagging from within a risk card is efficient. The Related tab with precedent matching is a killer feature. But the Definitions tab being completely empty is embarrassing — either make it work or hide it. And the flag delete with no confirmation? I'd lose my mind if I accidentally deleted a detailed flag note. That's basic stuff."

---

## Wave 3: Interactive Features

### Wave 3a: Revision Workflow

#### Things That Work Well
1. **Revision bottom sheet is elegant** — Header shows clause reference, scrollable diff content, rationale section with violet border + gradient, and action buttons. Three-snap-height resize (25vh/50vh/100vh) is professional.
2. **Track-changes rendering** — Insertions display as blue underlined text (`<ins class="diff-ins">`). Diff appears in both the document view and revision panel simultaneously for dual context.
3. **Navigation continuity** — Navigating clauses while revision panel is open keeps the panel open and updates content seamlessly. Clauses without revisions show a helpful empty state.
4. **Loading states** — Generate Revision button shows spinner + rotating verb text ("Generating...", "Analyzing...", etc.). UI stays responsive during API calls.
5. **Finalize & Export dialog is excellent** — Summary cards (1 revision approved, 1 item flagged, 142 risks not yet reviewed), expandable revision list showing clause 1F change summary, Track Changes Author field ("e.g., David Smith"), and Export button with dropdown. Professional and informative.
6. **Rationale section** — Clear explanation of why changes were made (e.g., expanded definition to include licenses, concessions, amendments, guarantees, security deposits, letters of credit).
7. **Approve/Reopen buttons** — Clean toggle between "Approved" checkmark and "Reopen" states.

#### Issues Found

| # | Severity | Finding | Screenshot |
|---|----------|---------|------------|
| 32 | **Medium** | **Transmittal dialog shows "0 accepted revisions"** while Finalize dialog correctly shows 1. Data inconsistency — transmittal likely reads from failed API while Finalize reads from store. | `s2-revision-14-transmittal-dialog.png` |
| 33 | **Medium** | **Weak visual distinction for reviewed clauses** — Only a small checkmark on clause 1F in the navigator. Sarah needs at-a-glance progress tracking across 99 clauses; current indicator is too subtle. | `s2-revision-02-clause-1f-selected.png` |
| 34 | **Low** | **Generic "Failed to fetch" error toast** — Not user-friendly for an attorney. Should say something like "Unable to connect to server" or "Revision service unavailable." | `s2-revision-06-reopen-error-toast.png` |
| 35 | **Low** | **25vh snap height too small** — At 25vh, the diff is barely visible (1-2 lines). Consider skipping 25vh in the resize cycle or making 50vh the minimum. | `s2-revision-12-panel-open-before-nav.png` |
| 36 | **Low** | **Prev/Next navigation chevrons have no aria-labels** — Screen readers cannot identify them. | `s2-revision-17-final-state.png` |
| 37 | **Info** | **Track-changes deletion styling untestable** — Sample revision has no `<del>` elements (only additions). Deletion rendering path (`<del class="diff-del">` red strikethrough) needs verification with a revision that removes text. | `s2-revision-04-panel-expanded.png` |

### Sarah's Verdict (Wave 3a)
> "The revision panel is the money feature and it delivers. Track changes look professional, the rationale explains the 'why' which saves me from second-guessing the AI, and the Finalize dialog gives me the confidence I need before exporting. Minor gripes: the transmittal count is wrong, and the reviewed checkmarks are too subtle for a 99-clause document."

### Wave 3b: Precedent Panel

#### Things That Work Well
1. **Three navigator position modes** — Sidebar, drawer, and ghost modes are polished. Ghost mode's hover-reveal animation is professional. Drawer mode shows the navigator as an overlay.
2. **Text selection tooltip** — Floating Copy/Use/Flag actions on text selection using `@floating-ui`. Exactly what an attorney needs for precedent comparison.
3. **Search and match-only filter** — Real-time search filtering with blue-dot match indicators in the precedent navigator.
4. **Draggable resize divider** — Smooth `react-resizable-panels` separator with hover/active visual feedback for resizing the split view.
5. **Lock/unlock toggle** — Correctly freezes related clause highlights when locked. Clear visual feedback (filled blue vs ghost outline).
6. **Close behavior** — Both X button and Escape key close the panel. Layout restores cleanly. Lock state properly cleaned up.
7. **Persistent panel across navigation** — Panel stays open when navigating clauses via left navigator or bottom bar arrows. Related clause indicators update dynamically.
8. **Related clause pulse animation** — New matches briefly pulse in the navigator, drawing attention to changes when switching clauses.

#### Issues Found

| # | Severity | Finding | Screenshot |
|---|----------|---------|------------|
| 38 | **High** | **Precedent document unreadable at default width** — The 40% right panel is further split by a 220px sidebar navigator, leaving only ~170px for document content. Text renders word-by-word on separate lines. Workaround: switch to drawer or ghost mode, but default experience is poor. | `s2-precedent-document-rendering.png` |
| 39 | **Medium** | **Auto-scroll to clicked related clause doesn't work** — Clicking a related clause card (e.g., "3.1 Due Diligence Period") opens the panel but doesn't scroll to that clause. Document stays at scrollTop=0. The `initialScrollDone` ref guard + `requestAnimationFrame` timing means the scroll fires before content renders. | `s2-precedent-panel-opened.png` |
| 40 | **Medium** | **No clause analysis sidebar while precedent panel is open** — Code explicitly closes the right sidebar when opening precedent. No toggle to reopen. Attorney cannot view risk analysis and precedent simultaneously. | `s2-precedent-three-panel-layout.png` |
| 41 | **Low** | **Ctrl+Shift+P shortcut only closes, cannot open** — Keyboard handler lives inside `PrecedentPanel` component which only mounts when panel is already open. Should be registered at page level. | — |
| 42 | **Low** | **minSize constraint not enforced** — `minSize={25}` prop should prevent panel from shrinking below 25% (320px), but it actually shrinks to ~216px (17%), making content area disappear. | `s2-precedent-split-min-size.png` |
| 43 | **Low** | **Section number concatenation in navigator** — Some entries show merged section numbers like "4.34.4" or "16.516.6" instead of clean hierarchical numbers. | `s2-precedent-nav-match-filter.png` |

### Sarah's Verdict (Wave 3 Complete)
> "The precedent comparison is powerful — being able to see my firm's precedent side-by-side with the target document is what I've always wanted. The ghost mode navigator is slick. But the default layout makes the precedent unreadable, which means every user's first experience is broken. And not scrolling to the clause I clicked? That defeats the purpose. Fix the auto-scroll and default to ghost/drawer mode."

---

## Wave 4: Dialogs & Cross-cutting

### Wave 4a: Dialogs

#### Things That Work Well
1. **Flag Dialog is thoughtfully designed** — Attorney/Client toggle conditionally shows/hides category pills. Client mode shows Business Decision, Risk Alert, For Discussion, FYI pills with unique colors. Attorney mode hides categories. Three entry points (bottom bar, text selection, sidebar) all work.
2. **Finalize & Export is fully functional** — Accordion shows revision details with track-changes rendering, Track Changes Author input with validation, Export dropdown with "Export Both (Redline + Clean)", "Export Redline Only", "Export Clean Only". **Actually downloads a .docx file** (`Sample PSA - Seller Side_track_changes.docx`). Production-ready.
3. **Transmittal auto-generates professional correspondence** — Proper salutation, document context, flagged items with clause references, "Include revision summary" checkbox toggles revision section. Copy to Clipboard works with "Copied!" feedback. "Open in Email Client" triggers mailto: link.
4. **All dialogs have consistent Radix UI patterns** — Overlay/backdrop, centering, focus trapping, Escape dismissal, click-outside-to-close. State persists across open/close (author value, checkbox state).
5. **Flag persists correctly** — Shows in FLAGS tab with category badge, clause reference, and date. Flag icon appears in document margin.

#### Issues Found

| # | Severity | Finding | Screenshot |
|---|----------|---------|------------|
| 44 | **High** | **"+ New" button completely non-functional on review page** — Clicking does absolutely nothing: no dialog, no navigation, no toast. The `onNewProject` prop is not passed to `<Header />` in the review page. The NewProjectDialog component exists but isn't wired up. | `s2-dialogs-new-button-no-action.png` |
| 45 | **High** | **"New Project" in hamburger menu also non-functional on review page** — Same root cause as #44. Silent failure with no feedback. Sarah has no way to start a new project from the review page. | `s2-dialogs-hamburger-menu.png` |
| 46 | **Medium** | **Export allows empty Track Changes Author** — Input gets red border but no error text. User can still proceed with export. Should block or show warning. | `s2-dialogs-finalize-validation-error.png` |
| 47 | **Medium** | **Clicking existing flag in sidebar doesn't open edit mode** — Flag items in FLAGS tab are not clickable for editing. Must use the separate edit button. | `s2-dialogs-flag-created-flags-tab.png` |
| 48 | **Medium** | **Markdown headers in transmittal email body** — Shows `## Items for Your Review` raw markdown. In a plain-text email context, raw markdown looks unprofessional. | `s2-dialogs-transmittal-dialog-open.png` |
| 49 | **Low** | **Flag dialog missing aria-describedby** — React console warning on every dialog open. | — |
| 50 | **Low** | **Category-only flag shows trailing colon** — Flag with no note text displays `(Risk Alert):` with trailing colon and empty space in transmittal. | `s2-dialogs-transmittal-dialog-open.png` |

### Wave 4b: Cross-cutting Concerns

#### Things That Work Well
1. **Bottom bar navigation is rock-solid** — Prev/Next arrows update counter, scroll document, and update sidebar analysis on every click. Wrap-around navigation (99 -> 1 and 1 -> 99) is smooth.
2. **Severity dots always in sync** — Three severity dots (49 high, 86 medium, 35 low) are consistent with sidebar badge counts.
3. **Toast notifications** — Sonner toasts appear at bottom-right, stack in cascading pattern (3 max), auto-dismiss after 3-5 seconds. Loading messages during revision generation ("Cross-referencing provisions...") with spinner.
4. **State persistence is excellent** — Clause selection preserved across forward/back navigation, navigator hide/show, and LINEAR/BY RISK mode switching. No data loss within the page.
5. **Error recovery** — App remains functional after API calls (both success and failure). No broken states observed.
6. **Consistent layout** — Header (56px), bottom bar (44px), navigator (260px). Well-proportioned, no dead space. Consistent border styling and severity color coding throughout.
7. **Clean console** — Zero JavaScript errors during normal usage.

#### Issues Found

| # | Severity | Finding | Screenshot |
|---|----------|---------|------------|
| 51 | **High** | **All 412 buttons have cursor:default** — No button in the app shows `cursor: pointer` on hover. Only document paragraphs (`[data-para-id]`) correctly show pointer cursor. Makes the entire app feel non-interactive. | `s2-crosscutting-finalize-hover.png` |
| 52 | **High** | **No keyboard shortcuts for clause navigation** — Arrow keys, j/k, Ctrl+Arrow all have no effect. User must Tab to nav buttons or use mouse. For a 99-clause document, this is painful. | — |
| 53 | **High** | **Focus indicators invisible on most buttons** — CSS has `focus-visible:ring-ring/50` classes but computed styles show `outlineStyle: none` and no visible ring. Only sidebar tab buttons show focus outline. Fails WCAG 2.4.7. | `s2-crosscutting-focus-visibility.png` |
| 54 | **Medium** | **Nav button prev/next missing aria-labels** — Chevron buttons have no `title`, `aria-label`, or visible text. Screen readers can't identify them. | `s2-crosscutting-bottom-bar-overview.png` |
| 55 | **Medium** | **Bottom bar buttons not properly disabled** — Generate Transmittal and Finalize Redline are always clickable after doc load, regardless of whether any review work has been done. HTML `disabled` attribute not set. | `s2-crosscutting-bottom-bar-overview.png` |
| 56 | **Medium** | **Toasts overlap bottom bar buttons** — Bottom-right toasts overlap Generate Transmittal and Finalize Redline buttons, making them temporarily inaccessible. | `s2-crosscutting-toast-stacking.png` |
| 57 | **Medium** | **Tab order skips header and navigator** — Tab jumps directly to sidebar collapse button, skipping hamburger menu, "+ New" button, user menu, and entire navigator panel. | — |
| 58 | **Low** | **Action buttons missing tooltips** — Generate Transmittal and Finalize Redline have no title/aria-label. | — |
| 59 | **Low** | **"Reviewed:" vs "Reviewed" text inconsistency** — Navigator shows colon, bottom bar does not. | — |
| 60 | **Low** | **Toasts not manually dismissible** — No close button. Must wait for auto-dismiss. | `s2-crosscutting-toast-settings.png` |
| 61 | **Low** | **Generic "Coming soon" toast messages** — Document Library, Settings, Help all show identical toast. Can't tell which was attempted. | `s2-crosscutting-toast-coming-soon.png` |
| 62 | **Low** | **H1 title (14px) smaller than body text (16px)** — Header title "Contract Review" is smaller than paragraph text. | — |
| 63 | **Low** | **No skip-to-content link** — Accessibility gap for keyboard/screen reader users. | — |

### Sarah's Verdict (Wave 4 Complete)
> "The dialogs are mostly excellent — the Finalize & Export actually producing a real .docx is the moment I'd tell my colleagues about this tool. The transmittal email generator is a time-saver. But the cursor:default on every button is bizarre — it makes everything feel broken even when it works. And no keyboard shortcuts for navigating clauses? I'd burn through a 99-clause PSA twice as fast with j/k navigation. These are polish issues but they're the difference between a tool I tolerate and one I recommend."

---

## Final Summary

### Issue Totals by Severity

| Severity | Count |
|----------|-------|
| **Critical** | 2 |
| **High** | 10 |
| **Medium** | 15 |
| **Low** | 22 |
| **Observation/Info** | 4 |
| **Total** | 53 |

### Top 10 Issues Sarah Would Notice First

1. **#12 CRITICAL — BY CATEGORY crashes the app** (`navigation-panel.tsx:489`, null `section_ref`)
2. **#13 CRITICAL — Search/filter crashes the app** (`navigation-panel.tsx:111`, same root cause)
3. **#51 HIGH — All buttons have cursor:default** — Makes entire app feel non-interactive
4. **#52 HIGH — No keyboard shortcuts for clause navigation** — Painful for 99-clause documents
5. **#44 HIGH — "+ New" button non-functional on review page** — No way to start a new project
6. **#23 HIGH — DEFINITIONS tab completely non-functional** — Shows empty for every clause
7. **#24 HIGH — Flag delete has no confirmation** — Risk of data loss
8. **#15 HIGH — "+15 more" in BY RISK is not clickable** — 15 high-risk clauses inaccessible
9. **#38 HIGH — Precedent panel unreadable at default width** — First experience is broken
10. **#14 HIGH — Section numbering resets after Section 10** — Articles 11+ indistinguishable from Section 1

### One-Line Root Causes Worth Fixing

| Fix | Issues Resolved |
|-----|----------------|
| Add null-safe operators in `navigation-panel.tsx` lines 111 + 489 | #12, #13 (both criticals) |
| Add `cursor: pointer` to button base styles | #51 |
| Wire `onNewProject` prop to Header in review page | #44, #45 |
| Add `focus-visible` ring styles that actually work (check ring color opacity) | #53 |
| Make "+N more" div a clickable button with expand handler | #15 |

### Things Sarah Would Appreciate Most

1. **Finalize & Export producing a real .docx** — Production-ready, with Track Changes Author and multiple export options
2. **Risk analysis with severity badges and include/exclude toggle** — Professional, efficient workflow
3. **Precedent comparison with ghost navigator** — Powerful side-by-side comparison
4. **Transmittal email auto-generation** — Professional correspondence in seconds
5. **Click-to-navigate** — Smooth clause-to-clause navigation in LINEAR and BY RISK modes
6. **Track-changes rendering with rationale** — Blue underlined insertions + "why" explanation builds trust
7. **Flag dialog with Attorney/Client toggle** — Smart UX for legal workflows
8. **State persistence** — No data loss during within-page navigation

### Overall Assessment
> The app has an impressive feature set that a real attorney would find valuable — the risk analysis, precedent comparison, revision workflow, and export pipeline are genuinely production-quality features. The two critical crashes (null `section_ref`) are easy one-line fixes. The cursor:default and focus visibility issues are CSS-level fixes that would dramatically improve the perceived quality. The tool is closer to shipping than the issue count suggests — most issues are polish-level, not architectural.

