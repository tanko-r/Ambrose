# Quick Task 2: Toggle to hide target doc panel nav bar

## Result: COMPLETE

### Changes
**`navigation-panel.tsx`**: Changed the close button in the docked panel header from icon-only ghost button to a labeled "Hide" button with PanelLeftClose icon. Added tooltip text.

The NavigationPanel already had collapse/ghost functionality:
- **Docked mode**: Full 260px sidebar with header showing "Navigator" label and close button
- **Ghost mode** (collapsed): Hidden panel that slides in on hover from left edge trigger tab
- `toggleNavPanel()` in store toggles between these modes

The button was just hard to discover as a tiny icon-only ghost variant.

### Commit
`4703579` — feat: add visible "Hide" button to navigator panel header
