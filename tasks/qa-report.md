# QA Report — Contract Redlining App

> Generated: 2026-02-11 | Tester: Claude Code (Playwright automation)
> Branch: nextjs-migration | Servers: Flask :5000, Next.js :3000
> Screenshots: `~/user_testing/` (39 screenshots captured)
> Feature Inventory: `~/user_testing/feature-inventory.md` (~150 elements cataloged)

---

## Summary

**Total issues found: 11**
- Critical: 2
- High: 1
- Medium: 5
- Low: 3

The app is impressive for a professional legal tool — the core review workflow (risks, revisions, flags, precedent comparison) is functional and well-designed. The two critical issues are both fixable: one is a null-check crash, the other is a Flask concurrency limitation that will be resolved by production deployment (gunicorn/async workers). The medium issues are polish items that would frustrate an attorney user but don't block the workflow.

---

## Critical

### C1. "By Category" nav mode crashes the entire app
- **Section**: 2.2 Navigation Panel
- **Screenshot**: `14-by-category-crash.png`, `15-app-crash-screen.png`
- **Location**: `frontend/src/components/review/navigation-panel.tsx:489`
- **Description**: Clicking the "BY CATEGORY" tab in the navigation panel throws `TypeError: Cannot read properties of null (reading 'split')`. The error originates from `para.section_ref.split(".")[0]` in the `ByCategoryOutline` component — some paragraphs have `null` section_ref values.
- **Impact**: Complete app crash. User must navigate back to dashboard and reload the session. Any unsaved work in the review could be lost.
- **Suggested Fix**: Add null check: `const topNum = para.section_ref?.split(".")[0] || "other"`

### C2. Live analysis pipeline stuck at 0% with HTTP 500 errors
- **Section**: 4 (Analysis Overlay)
- **Screenshots**: `36-analysis-overlay.png`, `37-analysis-15s.png`, `38-analysis-60s.png`, `39-analysis-after-150s.png`
- **Description**: When uploading a new .docx and starting live analysis, the progress bar stays at 0% indefinitely. The Flask dev server is single-threaded, so while it's processing the Gemini API call, it can't respond to the frontend's polling requests. Next.js proxy gets `ECONNRESET` errors, and HTTP 500 toast errors stack up on screen.
- **Impact**: The core intake-to-analysis flow is broken in development. New users can't analyze fresh documents. (Pre-analyzed sessions via "Load Test Data" work fine.)
- **Suggested Fix**: Run Flask with `threaded=True` or use gunicorn with async workers. Alternatively, use a background task queue (Celery/RQ) for long-running Gemini calls and have the status endpoint read from a shared store.

---

## High

### H1. Session state lost on page refresh / direct URL navigation
- **Section**: 2.3 Document Viewer, general
- **Screenshots**: (observed after C1 crash recovery)
- **Description**: Navigating directly to `/review/test-sample-psa` (e.g., browser refresh, direct URL, or after crash recovery) shows "No document loaded." The Zustand store is empty on fresh page load and the review page doesn't hydrate session data from the server on mount.
- **Impact**: Any browser refresh, crash, or bookmark navigation loses the entire review context. The user must go back to the dashboard and re-enter through "Load Test Data" or their recent projects. This is especially painful after the By Category crash (C1).
- **Suggested Fix**: The review page's `useDocument` hook should detect an empty store and fetch session data from the API using the `sessionId` from the URL params. Add a `GET /api/session/{sessionId}` call on mount if `document` is null in the store.

---

## Medium

### M1. Definitions tab is always empty (non-functional)
- **Section**: 2.6 Sidebar — Definitions Tab
- **Screenshots**: `20-definitions-tab-empty.png`, `21-definitions-still-empty.png`
- **Description**: The Definitions tab always shows "No defined terms found in this clause" regardless of which paragraph is selected — even for paragraphs that explicitly define terms like "Agreement," "Seller," "Buyer," and "Effective Date" in the recitals. The feature appears completely non-functional.
- **Impact**: Attorneys rely heavily on defined terms when reviewing contracts. This tab promises a useful feature but never delivers, which erodes trust in the tool.
- **Suggested Fix**: Investigate whether the backend is returning definitions data in the analysis payload. If the data exists but isn't being passed to the component, fix the data flow. If the backend doesn't extract definitions, this may need a separate analysis step.

### M2. "+ New" button is a silent no-op from the review page
- **Section**: 1.1 Header Bar, 3.4 New Project Confirmation Dialog
- **Screenshot**: `33-new-button-noop.png`
- **Description**: Clicking the "+ New" button in the header while on the review page does nothing — no dialog, no navigation, no error. The expected behavior would be a confirmation dialog asking "Start a new project? Unsaved progress will be lost." then navigating to the dashboard.
- **Impact**: User feels the app is broken or unresponsive. They must manually navigate back to the root URL or use the hamburger menu.
- **Suggested Fix**: The `handleNewProject` handler likely checks for an active session but the check may be failing silently. Debug the handler and ensure it either shows a confirmation dialog or navigates directly.

### M3. Finalize dialog export buttons partially hidden by toast notifications
- **Section**: 3.2 Finalize & Export Dialog
- **Screenshots**: `29-finalize-dialog.png`, `30-finalize-scrolled.png`
- **Description**: When the Finalize dialog opens, success/error toasts from previous actions can overlap the bottom of the dialog where the export buttons are. The dialog itself may also need scroll handling for smaller viewports.
- **Impact**: Attorney can't easily reach the export buttons — the most important action in the entire workflow.
- **Suggested Fix**: Either dismiss existing toasts when the Finalize dialog opens, adjust toast z-index/positioning, or ensure the dialog's action buttons are always visible (e.g., sticky footer within the dialog).

### M4. Review Approach dropdown has no descriptions or tooltips
- **Section**: 1.2 Intake Form
- **Screenshot**: `03-review-approach-dropdown.png`
- **Description**: The four review approaches (Quick Sale, Competitive Bid, Relationship, Adversarial) are listed without any description of what they mean or how they affect the analysis. An attorney unfamiliar with the tool won't know which to pick.
- **Impact**: Users may choose incorrectly, leading to inappropriately aggressive or passive analysis results.
- **Suggested Fix**: Add brief descriptions below each option (e.g., "Quick Sale — Light touch, focus on deal-breakers only") or add tooltips. The intake form's other controls (representation, intensity slider) do a good job explaining themselves.

### M5. Analysis progress bar never updates from 0%
- **Section**: 4 (Analysis Overlay)
- **Screenshot**: `37-analysis-15s.png`
- **Description**: Even if the Flask concurrency issue (C2) is resolved, the progress bar appears to not receive real progress updates — it stays at 0% throughout. The timer and stage text update, but the actual percentage doesn't increment.
- **Impact**: Without progress feedback, users don't know if the analysis is 10% or 90% done. Combined with the long wait time (Gemini API calls), this creates anxiety that the tool is broken.
- **Suggested Fix**: Verify the analysis status endpoint returns incremental progress values (not just 0/100). The frontend polling logic should map batch completion to percentage progress.

---

## Low

### L1. Accordion "uncontrolled to controlled" React warning
- **Section**: 2.4 Sidebar — Risks Tab
- **Description**: Browser console shows: `"Accordion is changing from uncontrolled to controlled. Decide between using a controlled or uncontrolled Accordion component for the lifetime of the component."` This appears when expanding risk cards.
- **Impact**: No user-visible effect, but indicates a React state management issue that could cause subtle bugs.
- **Suggested Fix**: Set an explicit initial `value` prop on the Accordion component (e.g., `value=""` or `value={undefined}`) to keep it consistently controlled or uncontrolled.

### L2. Missing aria-label/Description on Flag Dialog
- **Section**: 3.1 Flag Dialog
- **Screenshot**: `28-flag-dialog.png`
- **Description**: Console shows accessibility warnings: `"Missing Description or aria-label"` for the Flag Dialog. Screen readers won't be able to announce the dialog purpose.
- **Impact**: Accessibility issue for screen reader users.
- **Suggested Fix**: Add `aria-describedby` or `DialogDescription` to the Flag Dialog component, per shadcn/ui dialog pattern.

### L3. Horizontal scrollbar visible on document viewer
- **Section**: 2.3 Document Viewer
- **Description**: A horizontal scrollbar is visible at the bottom of the document viewer panel. The content doesn't appear to overflow, so this may be a CSS issue.
- **Impact**: Minor visual distraction. Could be confusing if the user thinks they're missing content.
- **Suggested Fix**: Add `overflow-x: hidden` to the document viewer container if the content doesn't need horizontal scroll.

---

## UX Observations (Not Bugs)

These are observations about the overall experience, not actionable bugs:

1. **Professional appearance**: The app looks polished and professional — appropriate for a legal tool. Color scheme is clean, typography is readable.
2. **Revision workflow is strong**: The track-changes editor with green insertions/red deletions, rationale boxes, and approve/reject/reset controls is well-designed and intuitive.
3. **Precedent panel is powerful**: The split-view comparison with navigator is a standout feature. The hierarchical outline with filter toggle is genuinely useful.
4. **Flag system works well**: All three flagging paths (text selection, sidebar button, risk card button) work correctly. The Attorney/Client distinction with category pills is thoughtful.
5. **Transmittal email is excellent**: The auto-generated email content is professional, well-structured, and appropriate for attorney-to-client communication.
6. **Bottom bar navigation is intuitive**: Prev/Next through risk paragraphs with severity pills gives good progress awareness.
7. **Loading states are consistent**: Skeleton loaders appear in Related tab, spinner states on buttons — feels polished.
8. **Toast notifications**: Generally appropriate — not excessive. Success/error feedback is timely.

---

## Test Coverage Summary

| Section | Tested | Issues Found |
|---------|--------|-------------|
| 1. Dashboard & First Impressions | Yes | 0 |
| 2. Intake Form | Yes | M4 |
| 3. Recent Projects | Yes | 0 |
| 4. Review Page Layout | Yes | H1 |
| 5. Document Viewer | Yes | L3 |
| 6. Navigation Panel | Yes | C1 |
| 7. Risks Tab | Yes | L1 |
| 8. Related Tab | Yes | 0 |
| 9. Definitions Tab | Yes | M1 |
| 10. Flags Tab | Yes | 0 |
| 11. Revision Sheet | Yes | 0 |
| 12. Precedent Panel | Yes | 0 |
| 13. Flagging System | Yes | L2 |
| 14. Bottom Bar | Yes | 0 |
| 15. Finalize Dialog | Yes | M3 |
| 16. Transmittal Dialog | Yes | 0 |
| 17. Header & Global Nav | Yes | M2 |
| 18. Live Analysis Pipeline | Yes | C2, M5 |
| 19. Cross-cutting UX | Yes | 0 |

**All 19 sections tested. 39 screenshots captured as evidence.**
