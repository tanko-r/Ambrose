# Quick Task 1: Flag button red fill when flagged

## Result: COMPLETE

### Changes
1. **`risk-card.tsx`**: Added `isFlagged?: boolean` prop. When true, Flag button renders with `variant="destructive"` (red fill) and label "Flagged" instead of ghost "Flag".
2. **`risk-accordion.tsx`**: Reads flags from store, builds a `Set<string>` of flagged risk titles for the current paragraph by parsing flag notes (format: `"riskTitle: riskDescription"`). Passes `isFlagged={flaggedRiskTitles.has(risk.title)}` to each RiskCard.

### Commit
`081b6c9` — feat: flag button on risk card shows red fill when risk is flagged

### Verification
- TypeScript compiles cleanly (`npx tsc --noEmit` passes)
- Ghost "Flag" button shown for unflagged risks
- Red "Flagged" button shown when a matching flag exists on the paragraph
