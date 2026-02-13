# Phase 7: Polish + Validation - Research

**Researched:** 2026-02-12
**Domain:** UX polish, accessibility, dark mode, keyboard shortcuts, command palette, loading states, preferences
**Confidence:** HIGH

## Summary

Phase 7 transforms the functional Next.js contract redlining app into a production-quality desktop experience. The codebase already has strong foundations: shadcn/ui (new-york style) on Radix primitives, Tailwind CSS v4, Zustand state management, sonner toasts, and a complete dark mode color palette defined in `globals.css`. The primary gaps are: (1) no theme switching mechanism (dark mode CSS exists but nothing toggles it), (2) no keyboard shortcuts or command palette, (3) no preference persistence, (4) loading/error/empty states are partially implemented but inconsistent, (5) accessibility has not been audited, and (6) compact mode toggle exists in the store but has no visual implementation.

A critical bug exists in the dark mode CSS variant: the current `@custom-variant dark (&:is(.dark *))` only matches children of `.dark`, not the `.dark` element itself. This must be fixed to `(&:where(.dark, .dark *))` for `next-themes` compatibility.

**Primary recommendation:** Install `next-themes` for theme switching, `cmdk` (via `shadcn add command`) for the command palette, and `react-hotkeys-hook` for keyboard shortcuts. These are the standard tools in the shadcn/Next.js ecosystem and all integrate cleanly with the existing stack.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Keyboard Shortcuts:**
- Common actions level (8-12 shortcuts): Essential actions + toggle panels, jump to flagged items, open dialogs
- Standard shortcuts for universal actions (Cmd/Ctrl+S save, Cmd/Ctrl+F find, arrow keys navigate)
- Command palette (Cmd/Ctrl+K) for app-specific actions with fuzzy search
- Global scope only -- shortcuts always do the same thing regardless of focus
- Help dialog (? key) showing full shortcut reference
- Inline hints in tooltips and button labels
- Dialog shortcuts: Enter submits, Esc cancels
- Document-centric: Tab cycles through document paragraphs, shortcuts jump to panels
- No keyboard shortcuts for jumping between related paragraphs in risks (mouse-based)

**Theme, Modes & Preferences:**
- Follow system preference on first load (auto-detect OS theme)
- User can override via toggle, choice persists in localStorage
- Compact mode: Card spacing only -- reduce padding/margins in sidebar cards and bottom bar. No font size changes, no icon removal
- Configurable preferences: Light/dark theme toggle, compact mode toggle, default sidebar tab, navigator panel visibility default (4-5 settings total)
- localStorage persistence (no backend sync)

**Loading States & Feedback:**
- Analysis loading (90+ seconds): Progress bar with percentage (0-100%), status text updates ("Analyzing section 3 of 12..."), real-time progress tracking
- Quick operations: Skeleton screens for all async operations (consistent pattern), avoid flash of skeleton on instant responses
- Error handling: Friendly message + expandable technical details section, auto-retry for network errors, prompt for logic errors
- Success feedback: Both inline and toast notifications. Inline status for immediate actions (button to checkmark), toast for background operations
- Empty states: Inline help text (educational), guide users to next action

**Responsive Design:**
- Desktop-only (no mobile/tablet responsive breakpoints)
- Minimum width: 1280px
- Friendly warning message on small screens ("This app requires a desktop browser. Minimum width: 1280px")

**Accessibility:**
- WCAG 2.1 Level AA target (or similar -- Claude's discretion on exact level)
- Generic ARIA compliance
- Focus indicators: Match shadcn/ui default styling
- Validation: Automated tools only (axe-core or Lighthouse)

### Claude's Discretion

- Specific WCAG conformance level (A, AA, or AAA)
- Screen reader testing strategy (generic vs platform-specific)
- Error retry strategy (auto vs manual based on failure type)
- Exact keyboard shortcut assignments (which actions get which keys)
- Progress bar visual design
- Skeleton screen patterns and timing
- Toast notification positioning and auto-dismiss duration

### Deferred Ideas (OUT OF SCOPE)

**User Accounts & Authentication** -- Future phase (post-v1.1)
- Multi-user support with authentication
- Backend preference sync across devices/browsers
- User-specific projects and settings

</user_constraints>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next-themes | ^0.4.6 | Dark/light mode switching with system detection | Official shadcn recommendation; handles SSR hydration, localStorage persistence, system preference detection |
| cmdk | ^1.1.1 | Command palette (Cmd/Ctrl+K) | Powers command palettes in Linear, Raycast; shadcn has a built-in Command component wrapping it |
| react-hotkeys-hook | ^5.x | Keyboard shortcut management | 7M+ weekly downloads; hook-based API matches React patterns; scoping, modifier keys, sequential shortcuts |
| @axe-core/react | ^4.x | Development-time accessibility auditing | Industry standard automated a11y checker; outputs violations to Chrome DevTools console |

### Supporting (already installed, leveraged for Phase 7)

| Library | Version | Purpose | How Used in Phase 7 |
|---------|---------|---------|---------------------|
| sonner | ^2.0.7 | Toast notifications | Already installed; needs `theme` prop wired to next-themes for dark mode support |
| zustand | ^5.0.11 | State management | Already installed; add preferences slice with localStorage middleware |
| lucide-react | ^0.563.0 | Icons | Already installed; icons for shortcuts, settings, theme toggle |
| radix-ui | ^1.4.3 | Accessible primitives | Already installed; Dialog for settings, Tooltip for shortcut hints |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| next-themes | Manual CSS class toggle | next-themes handles SSR hydration, flash prevention, system detection -- not worth hand-rolling |
| react-hotkeys-hook | Vanilla `useEffect` + `addEventListener` | Missing modifier normalization (Cmd vs Ctrl), scope management, sequential keys |
| cmdk | Custom dialog + filter | cmdk gives fuzzy search, keyboard navigation, composable API for free |
| @axe-core/react | Lighthouse CLI only | @axe-core/react catches issues during development; Lighthouse is for final validation |

**Installation:**
```bash
cd frontend
npm install next-themes react-hotkeys-hook
npx shadcn@latest add command
npm install --save-dev @axe-core/react
```

Note: `cmdk` will be pulled in automatically as a dependency of shadcn's Command component.

## Architecture Patterns

### Recommended Project Structure

New files and modifications for Phase 7:

```
frontend/src/
├── app/
│   ├── layout.tsx              # MODIFY: Add ThemeProvider wrapper, suppressHydrationWarning
│   └── globals.css             # MODIFY: Fix @custom-variant dark, add dark mode document styles
├── components/
│   ├── layout/
│   │   └── header.tsx          # MODIFY: Add theme toggle, settings button, shortcut hints
│   ├── providers/
│   │   └── theme-provider.tsx  # NEW: next-themes ThemeProvider wrapper (shadcn pattern)
│   ├── command-palette.tsx     # NEW: Cmd/Ctrl+K command palette
│   ├── keyboard-help.tsx       # NEW: ? key help dialog showing shortcuts
│   ├── settings-dialog.tsx     # NEW: Preferences dialog (theme, compact, defaults)
│   ├── small-screen-warning.tsx # NEW: Warning overlay for < 1280px viewports
│   ├── error-boundary.tsx      # NEW: React error boundary with friendly UI
│   └── review/
│       ├── sidebar.tsx         # MODIFY: Compact mode spacing, empty states
│       ├── bottom-bar.tsx      # MODIFY: Compact mode spacing, filter buttons
│       ├── risk-card.tsx       # MODIFY: Compact mode spacing
│       ├── document-viewer.tsx # MODIFY: Dark mode document styles, skeleton timing
│       └── analysis-overlay.tsx # MODIFY: Already has progress bar (keep as-is)
├── hooks/
│   ├── use-keyboard-shortcuts.ts # NEW: Global keyboard shortcut registration
│   └── use-preferences.ts     # NEW: localStorage preferences with Zustand persist
└── lib/
    └── store.ts                # MODIFY: Add preferences slice with persist middleware
```

### Pattern 1: ThemeProvider Setup (next-themes + Tailwind v4)

**What:** Wrap the app in ThemeProvider to enable dark/light mode switching with system preference detection.

**Key detail:** The existing `@custom-variant dark (&:is(.dark *))` in globals.css is BUGGY. It only matches descendants of `.dark`, not the `.dark` element itself. This means CSS variables defined on `:root` and `.dark` work (because they're on the HTML element), but any utility class like `dark:bg-red-500` applied directly to the `<body>` or `<html>` element won't match. Must fix to `(&:where(.dark, .dark *))`.

**Example:**
```typescript
// components/providers/theme-provider.tsx
"use client"
import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}

// app/layout.tsx -- key changes:
// 1. Add suppressHydrationWarning to <html>
// 2. Wrap children in ThemeProvider
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="bottom-right" richColors theme={/* from useTheme() -- see note */} />
        </ThemeProvider>
      </body>
    </html>
  )
}
```

**Sonner dark mode note:** The `<Toaster>` from sonner needs the `theme` prop to match the current theme. Since `layout.tsx` is a Server Component, you cannot call `useTheme()` there. Two solutions: (a) move `<Toaster>` into a client component wrapper, or (b) use sonner's `theme="system"` prop which auto-detects without needing next-themes. Option (b) is simpler and sufficient since we follow system preference.

### Pattern 2: Command Palette (cmdk via shadcn)

**What:** A Cmd/Ctrl+K triggered command palette for app-wide actions with fuzzy search.

**When to use:** For app-specific actions that don't warrant dedicated keyboard shortcuts.

**Example:**
```typescript
// components/command-palette.tsx
"use client"
import { useEffect, useState } from "react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { useAppStore } from "@/lib/store"

export function CommandPalette() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          <CommandItem>Toggle Navigator Panel</CommandItem>
          <CommandItem>Toggle Sidebar</CommandItem>
          <CommandItem>Jump to Next Risk</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem>Generate Revision</CommandItem>
          <CommandItem>Flag Current Clause</CommandItem>
          <CommandItem>Finalize Redline</CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
```

### Pattern 3: Keyboard Shortcuts with react-hotkeys-hook

**What:** Register global keyboard shortcuts that dispatch store actions.

**Example:**
```typescript
// hooks/use-keyboard-shortcuts.ts
"use client"
import { useHotkeys } from "react-hotkeys-hook"
import { useAppStore } from "@/lib/store"

export function useKeyboardShortcuts() {
  const store = useAppStore()

  // Navigation
  useHotkeys("mod+k", (e) => { e.preventDefault(); /* open command palette */ }, { enableOnFormTags: false })
  useHotkeys("[", () => store.toggleNavPanel(), { enableOnFormTags: false })
  useHotkeys("]", () => store.toggleSidebar(), { enableOnFormTags: false })
  useHotkeys("j", () => { /* next risk paragraph */ }, { enableOnFormTags: false })
  useHotkeys("k", () => { /* prev risk paragraph */ }, { enableOnFormTags: false })
  useHotkeys("shift+?", () => { /* open help dialog */ }, { enableOnFormTags: false })
  useHotkeys("escape", () => { /* close current panel/dialog */ })
}
```

**Key detail:** `enableOnFormTags: false` prevents shortcuts from firing when user is typing in inputs/textareas. This is critical for a document review app where the user edits revision text.

### Pattern 4: Preferences Persistence with Zustand + localStorage

**What:** Store user preferences (theme, compact mode, default sidebar tab, navigator visibility) in localStorage.

**Implementation approach:** Use a separate Zustand slice with manual localStorage sync (not `zustand/middleware/persist`) because the main store already has complex state that should NOT be persisted. Manual sync is cleaner and avoids serialization issues.

**Example:**
```typescript
// In store.ts, add preferences interface:
interface Preferences {
  theme: 'light' | 'dark' | 'system'
  compactMode: boolean
  defaultSidebarTab: 'risks' | 'related' | 'definitions' | 'flags'
  navPanelVisibleDefault: boolean
}

const PREFS_KEY = 'ambrose-preferences'

function loadPreferences(): Partial<Preferences> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function savePreferences(prefs: Preferences) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}
```

### Pattern 5: Skeleton Screen Timing (Avoid Flash)

**What:** Prevent skeleton screens from flashing for instant responses.

**Implementation:** Use a minimum delay before showing skeletons. If the data loads within ~200ms, skip the skeleton entirely.

**Example:**
```typescript
function useDelayedLoading(isLoading: boolean, delay = 200) {
  const [showSkeleton, setShowSkeleton] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      setShowSkeleton(false)
      return
    }
    const timer = setTimeout(() => setShowSkeleton(true), delay)
    return () => clearTimeout(timer)
  }, [isLoading, delay])

  return showSkeleton
}
```

### Anti-Patterns to Avoid

- **Hand-rolling dark mode toggle without next-themes:** Causes flash of unstyled content on page load, doesn't handle SSR hydration correctly, misses system preference detection.
- **Using `prefers-color-scheme` media query directly in Tailwind v4:** Conflicts with user override toggle. next-themes + class-based approach is the correct pattern.
- **Putting all keyboard shortcuts in a single `useEffect`:** Use `react-hotkeys-hook` for proper modifier normalization (Cmd on Mac, Ctrl on Windows), scope management, and cleanup.
- **useRef-based "loaded" guards in effects:** React strict mode runs effects twice, causing data to never load. Use store state checks instead (documented in MEMORY.md).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dark mode toggle with SSR | Manual class toggling + localStorage | next-themes | Handles hydration mismatch, system preference, flash prevention |
| Command palette | Custom dialog + filter input | shadcn Command (cmdk) | Fuzzy search, keyboard navigation, composable items, accessible |
| Keyboard shortcuts | `document.addEventListener('keydown')` | react-hotkeys-hook | Modifier normalization (Cmd/Ctrl), scope isolation, form tag protection |
| Accessibility audit | Manual ARIA review | @axe-core/react + Lighthouse | 80+ automated rules, deduplication, CI-ready |
| Toast positioning/stacking | Custom notification system | sonner (already installed) | Already integrated, supports dark mode, stacking, rich content |

**Key insight:** Every major feature in Phase 7 has a battle-tested library. The risk of hand-rolling is subtle bugs (hydration flash, keyboard conflicts on non-US layouts, ARIA violations) that only appear in edge cases.

## Common Pitfalls

### Pitfall 1: Dark Mode Variant Bug (ALREADY EXISTS IN CODEBASE)

**What goes wrong:** The current `@custom-variant dark (&:is(.dark *))` in `globals.css` line 5 only matches *children* of `.dark`, not the `.dark` element itself. This means `dark:` utility classes won't apply to the `<html>` or `<body>` element.
**Why it happens:** Tailwind v4 changed how dark mode is configured. The `:is()` pseudo-class doesn't match the element itself, only descendants.
**How to avoid:** Change to `@custom-variant dark (&:where(.dark, .dark *))` which matches both the `.dark` element AND its descendants. The `:where()` has zero specificity, avoiding cascade issues.
**Warning signs:** Dark mode "mostly works" (CSS variables change correctly) but utility classes like `dark:bg-background` on `<body>` don't apply.

### Pitfall 2: Sonner Toaster Theme Mismatch

**What goes wrong:** Toasts stay in light mode when app switches to dark mode, or vice versa.
**Why it happens:** `<Toaster>` is rendered in the Server Component `layout.tsx` where `useTheme()` can't be called.
**How to avoid:** Either (a) wrap `<Toaster>` in a Client Component that reads theme, or (b) set `theme="system"` on Toaster which auto-detects.
**Warning signs:** Toasts have white background in dark mode.

### Pitfall 3: Keyboard Shortcuts Firing During Text Input

**What goes wrong:** Pressing "?" to type in a text field opens the help dialog. Pressing "j"/"k" while editing revision text navigates paragraphs.
**Why it happens:** Global shortcuts that don't exclude form elements.
**How to avoid:** Use `react-hotkeys-hook` with `enableOnFormTags: false` for single-character shortcuts. Multi-key shortcuts (Cmd/Ctrl+K) are naturally safe because modifier keys aren't typed.
**Warning signs:** User can't type certain characters in the revision editor or search fields.

### Pitfall 4: Compact Mode Causing Layout Shifts

**What goes wrong:** Toggling compact mode causes content to jump/reflow, disrupting the user's scroll position in the document.
**Why it happens:** Reducing padding/margins changes element heights, shifting scroll positions.
**How to avoid:** Scope compact mode changes to non-critical spacing only (card padding, gap between items). Do NOT change line heights, font sizes, or element widths. Use CSS transitions on padding changes.
**Warning signs:** Document scroll position jumps when compact mode is toggled.

### Pitfall 5: next-themes Hydration Warning

**What goes wrong:** Console warning: "Extra attributes from the server: class, style" on `<html>` element.
**Why it happens:** next-themes adds the `class="dark"` attribute on the client after SSR, causing a hydration mismatch.
**How to avoid:** Add `suppressHydrationWarning` to the `<html>` tag in `layout.tsx`. This is documented in the next-themes README and the shadcn dark mode guide.
**Warning signs:** Yellow warning in browser console on every page load.

### Pitfall 6: Document Viewer Dark Mode Colors

**What goes wrong:** The document HTML rendered via `dangerouslySetInnerHTML` has hardcoded light-mode colors that look terrible in dark mode (black text on dark background, white track-changes highlights invisible).
**Why it happens:** The Flask backend generates HTML with inline styles and CSS classes designed for light mode. The document-container CSS in globals.css uses hardcoded oklch colors.
**How to avoid:** Add `.dark .document-container` overrides in globals.css. Override specific problematic colors: paragraph hover state, selection highlight, risk indicators, track changes red/blue, flag icons. Keep the core document text using CSS variables so it inherits.
**Warning signs:** Document text becomes invisible or unreadable in dark mode.

## Code Examples

### Theme Toggle Button (header.tsx)

```typescript
"use client"
import { useTheme } from "next-themes"
import { Sun, Moon, Monitor } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ThemeToggle() {
  const { setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" /> Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" /> Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor className="mr-2 h-4 w-4" /> System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

### Small Screen Warning

```typescript
// components/small-screen-warning.tsx
"use client"
import { useEffect, useState } from "react"

const MIN_WIDTH = 1280

export function SmallScreenWarning() {
  const [isSmall, setIsSmall] = useState(false)

  useEffect(() => {
    const check = () => setIsSmall(window.innerWidth < MIN_WIDTH)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  if (!isSmall) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm p-8">
      <div className="max-w-md text-center">
        <h2 className="text-lg font-semibold mb-2">Desktop Browser Required</h2>
        <p className="text-muted-foreground text-sm">
          This app requires a desktop browser with a minimum width of 1280px.
          Please resize your window or switch to a desktop device.
        </p>
        <p className="text-muted-foreground text-xs mt-4">
          Current width: {typeof window !== 'undefined' ? window.innerWidth : '?'}px
        </p>
      </div>
    </div>
  )
}
```

### Compact Mode CSS Pattern

```css
/* Compact mode -- applied when .compact class is on body or a wrapper */
/* Only affects padding/margins on cards and bottom bar per user decision */
.compact .risk-card { padding: 0.5rem 0.75rem; }  /* from 0.75rem 1rem */
.compact .flag-card { padding: 0.5rem 0.75rem; }
.compact .sidebar-content { gap: 0.25rem; }         /* from 0.5rem */
.compact .bottom-bar { padding: 0.25rem 1rem; }     /* from 0.5rem 1rem */
```

Alternatively, use Tailwind's group variant:
```tsx
<div className={cn("p-4", compactMode && "p-2")}>
```

### Accessibility Setup (@axe-core/react in development only)

```typescript
// In app/layout.tsx or a dev-only component:
if (process.env.NODE_ENV === 'development') {
  import('@axe-core/react').then((axe) => {
    import('react-dom').then((ReactDOM) => {
      axe.default(React, ReactDOM, 1000)
    })
  })
}
```

This outputs accessibility violations to the Chrome DevTools console during development. No production overhead.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `darkMode: "class"` in tailwind.config.js | `@custom-variant dark` in globals.css | Tailwind v4 (2025) | Config-less dark mode; must define variant in CSS |
| `react-axe` package | `@axe-core/react` | 2023 | react-axe deprecated; @axe-core/react is the official replacement |
| `cmdk` v0.x with flat API | `cmdk` v1.x with CommandList wrapper | 2024 | Breaking change: CommandGroup must be inside CommandList |
| Manual `prefers-color-scheme` detection | `next-themes` with `enableSystem` | next-themes 0.4+ | Automatic system preference + user override + SSR-safe |

**Deprecated/outdated:**
- `react-axe`: Deprecated in favor of `@axe-core/react`. The old package is no longer maintained.
- `tailwind.config.js` darkMode: Tailwind v4 removed config file; use CSS-based `@custom-variant` instead.

## Recommended Keyboard Shortcuts (Claude's Discretion)

Based on research into common desktop app patterns (VS Code, Linear, Notion, Raycast):

| Shortcut | Action | Context |
|----------|--------|---------|
| `Cmd/Ctrl+K` | Open command palette | Global |
| `?` or `Shift+/` | Open keyboard shortcuts help | Global (not in inputs) |
| `[` | Toggle navigator panel | Global (not in inputs) |
| `]` | Toggle analysis sidebar | Global (not in inputs) |
| `J` | Next risk paragraph | Global (not in inputs) |
| `K` | Previous risk paragraph | Global (not in inputs) |
| `F` | Flag current paragraph | Global (not in inputs) |
| `G` | Generate revision for current paragraph | Global (not in inputs) |
| `Enter` | Accept revision (when revision sheet open) | Revision context |
| `Escape` | Close current dialog/panel/sheet | Global |
| `Cmd/Ctrl+,` | Open settings/preferences | Global |
| `Cmd/Ctrl+\` | Toggle bottom revision sheet | Global |

Total: 12 shortcuts. Strikes the balance between "enough to be useful" and "few enough to memorize."

## Recommended Error Handling Strategy (Claude's Discretion)

**Auto-retry for:**
- Network errors (fetch failures, timeouts): Retry up to 3 times with exponential backoff (1s, 2s, 4s)
- API 500/503 errors: Retry once after 2 seconds

**Prompt user for:**
- API 400/422 errors (validation): Show friendly message + expandable details
- API 401/403 errors: Should not occur (single-user, no auth) but show "Session expired" if it does
- Analysis failures: Show error with "Retry Analysis" button

**Error display pattern:**
```tsx
<div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
  <p className="text-sm font-medium text-destructive">Something went wrong</p>
  <p className="text-sm text-muted-foreground mt-1">{friendlyMessage}</p>
  <details className="mt-2">
    <summary className="text-xs text-muted-foreground cursor-pointer">Technical details</summary>
    <pre className="mt-1 text-xs text-muted-foreground bg-muted p-2 rounded overflow-x-auto">
      {error.message}
      {error.stack}
    </pre>
  </details>
</div>
```

## Recommended WCAG Level (Claude's Discretion)

**WCAG 2.1 Level AA.** Rationale:
- Level A is too basic (misses color contrast, resize text, focus visible)
- Level AAA is impractical (requires sign language interpretation, very specific contrast ratios)
- Level AA is the industry standard and legally defensible
- shadcn/ui components already meet most AA requirements out of the box (focus indicators, ARIA attributes, keyboard navigation)
- The main gaps are: missing ARIA labels on custom elements, color contrast on severity badges, and focus management in the command palette

## Open Questions

1. **Document HTML dark mode colors**
   - What we know: The Flask backend generates HTML with some hardcoded colors. The document-container CSS uses oklch values that assume light mode.
   - What's unclear: How many inline styles in the generated HTML need dark mode overrides? Are there images or SVGs with hardcoded colors?
   - Recommendation: Audit the generated HTML during implementation. Add `.dark .document-container` overrides for known problematic selectors. Use `filter: invert(1)` as a last resort for embedded images.

2. **Existing Phase 6 QA bugs**
   - What we know: The Phase 6 QA report (2026-02-12) found 24 issues including 7 High severity. Some affect areas Phase 7 will touch (flags tab, finalize dialog, text selection).
   - What's unclear: Will Phase 7 fix these or leave them for a separate bug-fix pass?
   - Recommendation: Phase 7 should NOT attempt to fix Phase 6 bugs. Those are separate scope. Phase 7 adds new capabilities (dark mode, shortcuts, preferences). Phase 6 bugs should be tracked and fixed independently.

3. **Bottom bar filter buttons**
   - What we know: Success criteria #5 says "Bottom bar has working filters to show/hide revisions, flags, and risks."
   - What's unclear: The current bottom bar shows severity counts and navigation but no filter toggles.
   - Recommendation: Add filter toggle buttons (small pill buttons) to the bottom bar that filter the navigator panel view. This is new functionality, not just polish.

## Sources

### Primary (HIGH confidence)
- shadcn/ui Command component docs: https://ui.shadcn.com/docs/components/radix/command
- shadcn/ui dark mode Next.js guide: https://ui.shadcn.com/docs/dark-mode/next
- Tailwind CSS v4 dark mode docs: https://tailwindcss.com/docs/dark-mode
- next-themes GitHub: https://github.com/pacocoursey/next-themes
- react-hotkeys-hook docs: https://react-hotkeys-hook.vercel.app/
- @axe-core/react npm: https://www.npmjs.com/package/@axe-core/react

### Secondary (MEDIUM confidence)
- Tailwind v4 + next-themes integration guide (verified against official docs): https://www.sujalvanjare.com/blog/dark-mode-nextjs15-tailwind-v4
- cmdk GitHub: https://github.com/dip/cmdk

### Tertiary (LOW confidence)
- None; all findings verified against primary or secondary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via official docs, npm, and shadcn integration guides
- Architecture: HIGH - Patterns follow established shadcn/Next.js conventions observed in codebase
- Pitfalls: HIGH - Dark mode variant bug confirmed by reading actual globals.css; other pitfalls from official docs
- Keyboard shortcuts: MEDIUM - Shortcut assignments are recommendations based on common patterns, not verified with user

**Research date:** 2026-02-12
**Valid until:** 2026-03-12 (stable stack, no fast-moving dependencies)
