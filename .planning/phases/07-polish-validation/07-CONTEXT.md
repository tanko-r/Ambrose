# Phase 7: Polish + Validation - Context

**Gathered:** 2026-02-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver production-quality UX polish, accessibility compliance, and visual parity with the original Flask app for the Next.js contract redlining application. This is a desktop-only, single-user app. Multi-user features and mobile responsiveness are explicitly out of scope.

</domain>

<decisions>
## Implementation Decisions

### Keyboard Shortcuts

**Scope:**
- Common actions level (8-12 shortcuts): Essential actions + toggle panels, jump to flagged items, open dialogs
- Minimal global shortcuts, lean heavily on command palette for everything else

**Style & Implementation:**
- Standard shortcuts for universal actions (Cmd/Ctrl+S save, Cmd/Ctrl+F find, arrow keys navigate)
- Command palette (⌘K / Ctrl+K) for app-specific actions with fuzzy search
- Global scope only — shortcuts always do the same thing regardless of focus (not context-aware)

**Discoverability:**
- Help dialog (? key) showing full shortcut reference
- Inline hints in tooltips and button labels
- Command palette lists all actions with shortcuts (search-driven discovery)

**Keyboard-Only Navigation:**
- Document-centric: Tab cycles through document paragraphs, shortcuts jump to panels (sidebar, bottom sheet)
- No keyboard shortcuts for jumping between related paragraphs in risks (mouse-based)
- Dialog shortcuts: Enter submits, Esc cancels (universal convention)

### Theme, Modes & Preferences

**Light/Dark Mode:**
- Follow system preference on first load (auto-detect OS theme)
- User can override via toggle, choice persists in localStorage

**Compact Mode:**
- Card spacing only — reduce padding/margins in sidebar cards and bottom bar
- No font size changes, no icon removal — minimal visual change

**Configurable Preferences:**
- Light/dark theme toggle
- Compact mode toggle
- Default sidebar tab (risks/revisions/flags/related)
- Navigator panel visibility default
- Total: 4-5 settings

**Persistence:**
- localStorage (per-browser persistence)
- No backend sync in Phase 7 (single-user app)

### Loading States & Feedback

**Analysis Loading (90+ second operations):**
- Progress bar with percentage (0-100%)
- Status text updates ("Analyzing section 3 of 12...")
- Real-time progress tracking

**Quick Operations:**
- Skeleton screens for all async operations (consistent pattern)
- Avoid flash of skeleton on instant responses

**Error Handling:**
- Hybrid tone: Friendly message + expandable technical details section
- Error recovery: Claude decides based on failure type (auto-retry for network, prompt for logic errors)

**Success Feedback:**
- Both inline and toast notifications
- Inline status for immediate actions (button → checkmark)
- Toast notifications for background operations ("Export complete")

**Empty States:**
- Inline help text (educational)
- Example: "Upload a contract to get started. Looking for precedent clauses? Add those too."
- Guide users to next action without heavy CTAs

### Responsive Design & Device Support

**Target Platform:**
- Desktop-only (no mobile/tablet responsive breakpoints)
- Minimum width: 1280px

**Mobile/Tablet Handling:**
- Friendly warning message on small screens
- "This app requires a desktop browser. Minimum width: 1280px"
- Does not block access completely, but sets expectations

### Accessibility Compliance

**WCAG Target:**
- Claude's discretion — whatever avoids introducing accessibility issues
- Likely WCAG 2.1 Level AA (industry standard)

**Screen Readers:**
- Generic ARIA compliance
- Claude decides on specific reader testing vs generic approach

**Focus Indicators:**
- Match shadcn/ui default styling
- Consistent with design system

**Validation Method:**
- Automated tools only (axe-core or Lighthouse accessibility audit)
- Fix all reported issues before phase completion

### Claude's Discretion

- Specific WCAG conformance level (A, AA, or AAA)
- Screen reader testing strategy (generic vs platform-specific)
- Error retry strategy (auto vs manual based on failure type)
- Exact keyboard shortcut assignments (which actions get which keys)
- Progress bar visual design
- Skeleton screen patterns and timing
- Toast notification positioning and auto-dismiss duration

</decisions>

<specifics>
## Specific Ideas

**Keyboard Philosophy:**
- "Limit shortcuts to essentials and rely on the palette" — user prefers command palette over memorizing many shortcuts

**Desktop-First Workflow:**
- User is a real estate attorney working primarily from desktop
- Contract review is not a mobile workflow

**Error Context:**
- Users are "lawyers comfortable with tech" — hybrid error messages serve both technical understanding and user-friendliness

</specifics>

<deferred>
## Deferred Ideas

**User Accounts & Authentication** — Future phase (post-v1.1)
- Multi-user support with authentication
- Backend preference sync across devices/browsers
- User-specific projects and settings
- This is a new capability requiring its own phase with auth, database, and session management

</deferred>

---

*Phase: 07-polish-validation*
*Context gathered: 2026-02-12*
