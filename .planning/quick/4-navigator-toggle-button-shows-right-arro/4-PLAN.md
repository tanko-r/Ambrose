# Quick Task 4: Navigator toggle button shows right arrow and "Show" when hidden

## Task
When the navigator panel is in ghost mode (hidden), the slide-out trigger tab should show:
- A right-pointing arrow icon (`PanelLeftOpen`) instead of `PanelLeft`
- "Show" text next to the icon (matching how docked state shows "Hide")

## Changes
1. Import `PanelLeftOpen` from lucide-react
2. Replace `PanelLeft` icon with `PanelLeftOpen` in the ghost trigger tab
3. Add "Show" text span next to the icon

## File
- `frontend/src/components/review/navigation-panel.tsx`
