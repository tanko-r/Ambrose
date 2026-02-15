---
phase: quick-3
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/layout/header.tsx
  - frontend/src/app/review/[sessionId]/page.tsx
  - frontend/src/components/review/sidebar.tsx
autonomous: true
must_haves:
  truths:
    - "App fills exactly the viewport height with no page-level scrollbar"
    - "Header is visible at the top and does not overlap any content below it"
    - "Bottom bar is fully visible without scrolling"
    - "Document viewer, sidebar, and navigation panel scroll internally only"
    - "Sidebar overlay in precedent mode still aligns correctly below the header"
  artifacts:
    - path: "frontend/src/components/layout/header.tsx"
      provides: "Header as static flex child instead of fixed-position overlay"
    - path: "frontend/src/app/review/[sessionId]/page.tsx"
      provides: "Correct h-screen flex column layout"
  key_links:
    - from: "page.tsx flex layout"
      to: "header.tsx"
      via: "Header participates in flex flow (not fixed)"
      pattern: "flex h-screen flex-col"
---

<objective>
Fix the review page layout so the app renders fullscreen within the viewport without any page-level scrolling. Currently the header uses `position: fixed` which removes it from flex flow, causing content to render behind it (top portion hidden) and the bottom bar / sidebar buttons to extend below the viewport fold.

Purpose: Eliminate the need for page-level scrolling; all scrolling should be internal to content panels (document viewer, navigation panel, sidebar).
Output: All layout files updated so the app fits precisely within 100vh.
</objective>

<execution_context>
@C:/Users/david/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/david/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@frontend/src/components/layout/header.tsx
@frontend/src/app/review/[sessionId]/page.tsx
@frontend/src/components/review/sidebar.tsx
@frontend/src/components/review/bottom-bar.tsx
@frontend/src/components/review/split-layout.tsx
@frontend/src/components/review/document-viewer.tsx
@frontend/src/components/review/navigation-panel.tsx
@frontend/src/components/review/revision-sheet.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Convert Header from fixed positioning to static flex child</name>
  <files>frontend/src/components/layout/header.tsx</files>
  <action>
In `header.tsx` line 39, the header element uses:
```
className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between border-b bg-background px-4"
```

Change it to a normal flex child that participates in the parent's `flex h-screen flex-col` layout:
```
className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4 z-40"
```

Key changes:
- Remove `fixed inset-x-0 top-0` (no longer position:fixed)
- Remove `z-50` and use `z-40` (still above panels but doesn't need to be highest)
- Add `shrink-0` to prevent flex shrinking
- Keep `h-14` (56px height), `border-b`, `bg-background`, `px-4`, and the flex items layout

The header will now occupy its natural 56px in the flex column, pushing the main content area below it rather than overlapping.
  </action>
  <verify>
Run `npm run build --prefix frontend` (or equivalent) to confirm no build errors. Then visually inspect in browser: header should sit at top, content should start directly below it without any gap or overlap.
  </verify>
  <done>Header renders as a static flex child at the top of the viewport, taking exactly h-14 of vertical space. No content is hidden behind it.</done>
</task>

<task type="auto">
  <name>Task 2: Fix sidebar overlay top offset and ensure all panels fit in viewport</name>
  <files>
    frontend/src/components/review/sidebar.tsx
    frontend/src/app/review/[sessionId]/page.tsx
  </files>
  <action>
**sidebar.tsx** -- The sidebar overlay (precedent mode) at line 413 uses `top-[49px]` which was a hardcoded offset for the old fixed header. Since the header is now in-flow within the flex layout, the overlay sidebar should align to the top of the main content area, not a pixel offset from the viewport top.

Change line 413 from:
```
<aside className="fixed top-[49px] right-0 bottom-0 z-40 flex w-[380px] flex-col border-l bg-card shadow-[-8px_0_24px_rgba(0,0,0,0.12)]">
```
to:
```
<aside className="fixed top-14 right-0 bottom-0 z-40 flex w-[380px] flex-col border-l bg-card shadow-[-8px_0_24px_rgba(0,0,0,0.12)]">
```

Using `top-14` (Tailwind for 3.5rem = 56px) matches the header's `h-14` exactly. This keeps the overlay sidebar below the header. Note: even though the header is no longer `fixed`, the sidebar overlay still needs to know where the header ends in viewport terms. Since the page uses `h-screen` and the header is the first child with `h-14`, the header always occupies the top 56px of the viewport. So `top-14` is correct.

**page.tsx** -- The existing layout structure is already correct:
```jsx
<div className="flex h-screen flex-col">
  <Header />                           {/* h-14 shrink-0 */}
  {/* optional finalized banner */}
  <div className="flex flex-1 overflow-hidden">  {/* main content */}
    <NavigationPanel />
    <SplitLayout>...</SplitLayout>
    <Sidebar />
  </div>
  <RevisionSheet />                    {/* fixed overlay, fine */}
  <BottomBar />                        {/* h-11 shrink-0 */}
</div>
```

Verify page.tsx has `overflow-hidden` on the body or no extra margin/padding on `html`/`body` that could cause page scroll. The existing `h-screen` + `flex-col` with `overflow-hidden` on the middle section should constrain everything. No changes needed to page.tsx unless the build/visual test reveals an issue.

If there is still page-level scroll after the header fix, add `overflow-hidden` to the outermost div in page.tsx:
```
<div className="flex h-screen flex-col overflow-hidden">
```
This ensures nothing ever escapes the viewport bounds.
  </action>
  <verify>
1. Run `npm run build --prefix frontend` to confirm no build errors.
2. Open the app in browser at the review page.
3. Verify: no page-level scrollbar appears (document.documentElement.scrollHeight === window.innerHeight).
4. Verify: header is fully visible at top, bottom bar is fully visible at bottom without scrolling.
5. Verify: document viewer scrolls internally when content exceeds its panel height.
6. Verify: sidebar scrolls internally for long risk lists.
7. Verify: when precedent panel is open and sidebar is in overlay mode, the overlay sidebar starts right below the header (no gap, no overlap).
  </verify>
  <done>
The entire app fits within the viewport with zero page-level scrolling. Header occupies the top 56px, bottom bar occupies the bottom 44px, and the middle content area fills the remaining space with internal scrolling only. Sidebar overlay in precedent mode aligns correctly below the header.
  </done>
</task>

</tasks>

<verification>
- Open the review page with a loaded document
- Confirm no vertical scrollbar on the page itself (only inside document viewer, nav panel, sidebar)
- Confirm header is visible and not overlapping content
- Confirm bottom bar buttons (Finalize Redline, Generate Transmittal, prev/next nav) are all visible without scrolling
- Confirm sidebar footer buttons (Generate Revision, Flag, View Revision) are visible without scrolling
- Open precedent panel and confirm sidebar overlay is positioned correctly
- Resize browser window to various heights and confirm layout remains viewport-contained
</verification>

<success_criteria>
1. Zero page-level scrolling at any reasonable viewport size (>= 600px height)
2. Header visible at top with no content hidden behind it
3. Bottom bar fully visible at bottom edge of viewport
4. All interactive buttons in sidebar footer and bottom bar are accessible without scrolling the page
5. Internal scroll areas (document viewer, sidebar content, nav panel outline) still scroll independently
</success_criteria>

<output>
After completion, create `.planning/quick/3-fix-layout-so-app-renders-fullscreen-wit/3-SUMMARY.md`
</output>
