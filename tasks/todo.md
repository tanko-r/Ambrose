# Next.js Migration - Progress Tracker

## Phase 0: Scaffolding + Foundation ✅
- [x] Create Next.js app (TypeScript, Tailwind, ESLint, App Router, src dir)
- [x] Install shadcn/ui (16 components: button, input, textarea, select, slider, dropdown-menu, separator, badge, tabs, tooltip, skeleton, accordion, progress, dialog, sheet, alert-dialog)
- [x] Install zustand, react-resizable-panels, sonner, geist
- [x] Configure next.config.ts rewrites to proxy /api/* to Flask :5000
- [x] Add flask-cors to Flask server.py + requirements.txt
- [x] Set up Geist font in layout.tsx (already done by create-next-app)
- [x] Set up Tailwind design tokens (Vercel aesthetic: pure white bg, blue #2563eb primary, cool neutral borders, severity colors)
- [x] Create lib/types.ts — TypeScript interfaces for ALL API request/response shapes
- [x] Create lib/api.ts — Typed API client with functions for every endpoint
- [x] Create lib/store.ts — Zustand store skeleton (replaces AppState)
- [x] Create directory structure for components/layout, dashboard, review, dialogs, hooks, styles
- [x] Create review/[sessionId]/page.tsx placeholder route
- [x] Verify: TypeScript compiles clean (tsc --noEmit passes)
- [x] Verify: Next.js production build passes

## Phase 1: Core Layout + Intake ✅
- [x] header.tsx with shadcn DropdownMenu for app/user menus (white bg, 1px border)
- [x] intake-form.tsx with file upload drag-and-drop, all form fields
- [x] recent-projects.tsx listing saved sessions with resume
- [x] new-project-dialog.tsx (save/discard confirmation via AlertDialog)
- [x] page.tsx (dashboard) composing header + intake + recent projects
- [x] Verify: TypeScript + Next.js build pass cleanly

## Phase 2: Document Viewer + Navigation Panel ✅
- [x] use-document.ts hook — loads document data + HTML in parallel
- [x] document-viewer.tsx — HTML rendering via dangerouslySetInnerHTML, click handlers, selection/risk/revision/flag state classes, skeleton loading, plain-text fallback
- [x] navigation-panel.tsx — collapsible, Linear/By Risk/By Category outline modes, search filter, progress counter, severity indicators
- [x] sidebar.tsx — tabs (Risks/Related/Definitions/Flags), severity badges, risk cards, empty states, generate revision button
- [x] bottom-bar.tsx — progress, severity summary pills, prev/next risk navigation, finalize button skeleton
- [x] review/[sessionId]/page.tsx — 3-panel layout (nav + document + sidebar) + bottom bar + header
- [x] Verify: tsc --noEmit + next build pass clean

## Phase 3: Sidebar + Risk Analysis
- [ ] risk-accordion.tsx + risk-card.tsx
- [ ] related-clauses.tsx, definitions-tab.tsx, flags-tab.tsx
- [ ] analysis-overlay.tsx — full-screen progress
- [ ] use-analysis.ts hook — poll progress, update store
- [ ] Risk hover highlighting
- [ ] Verify: Start review, see analysis progress, click paragraphs to see risks

## Phase 4: Revision Bottom Sheet + Track Changes Editor
- [ ] bottom-sheet.tsx — draggable bottom panel
- [ ] revision-sheet.tsx — diff display, accept/reject
- [ ] track-changes-editor.tsx — contenteditable wrapper
- [ ] lib/track-changes.ts — port from revision.js
- [ ] use-revision.ts hook
- [ ] Verify: Generate revision, edit inline, accept/reject

## Phase 5: Precedent Split View
- [ ] precedent-panel.tsx
- [ ] precedent-navigator.tsx
- [ ] react-resizable-panels integration
- [ ] use-precedent.ts hook
- [ ] Verify: Open precedent view, resize panes, related clauses

## Phase 6: Dialogs + Finalization
- [ ] flag-dialog.tsx
- [ ] finalize-dialog.tsx
- [ ] transmittal-dialog.tsx
- [ ] new-project-dialog.tsx
- [ ] use-flags.ts hook
- [ ] Verify: Flag, finalize, download, transmittal

## Phase 7: Polish + Validation
- [ ] Keyboard shortcuts
- [ ] Light/dark mode toggle
- [ ] Compact mode
- [ ] LocalStorage preferences
- [ ] Bottom bar risk filters + prev/next
- [ ] Loading/error/empty states
- [ ] Responsive behavior
- [ ] Accessibility audit (WCAG 2.2 AA)
- [ ] Visual parity check
- [ ] Design token audit

## Post-Migration: UX Polish (from 2026-02-09 session)
- [ ] Full-width document rendering — backend `.document-preview` CSS has `padding: 0.75in` and library emits `body { padding: 72pt; margin: 0 auto }` that leaks into host page. Fix is in html_renderer.py (scope library `body` selectors to `.document-preview`, reduce padding) + delete cached .rendered.html/.precedent.html files. Frontend paper card wrappers already removed (no more `max-w-3xl mx-auto`).
- [ ] Ghost navigator for precedent panel — implemented (hover trigger top-right, frosted glass slide-in, 300ms dismiss delay). Needs visual verification after full-width fix lands.
- [ ] Ghost navigator for target doc nav panel — implemented (same pattern, left side). Needs visual verification.
- [ ] Split pane sizing — localStorage persistence removed, always resets to 60/40. Verify behavior.
- [ ] Sidebar auto-close on related clause click — implemented (toggleSidebar when clicking related clause in precedent tab).
- [ ] Restore nav + sidebar on precedent close — implemented (closePrecedentPanel sets navPanelOpen/sidebarOpen to true).
- [ ] Navigator mode: overlay renamed to ghost, overlay button removed, match highlighting added (bg-primary/[0.06]).

## Phase 8: Cleanup + Cutover
- [ ] Archive app/static/ to _archived/
- [ ] Remove Flask send_from_directory for index.html
- [ ] Dev startup script (both servers)
- [ ] Update README
