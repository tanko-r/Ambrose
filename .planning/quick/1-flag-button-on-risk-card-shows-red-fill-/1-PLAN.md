# Quick Task 1: Flag button red fill when flagged

## Goal
When a risk has been flagged, the Flag button on the risk card should show as red fill instead of ghost/wireframe.

## Approach
Add an `isFlagged` boolean prop to RiskCard. The parent (RiskAccordion) receives flags from the store and checks if any flag's note starts with the risk's title. When `isFlagged` is true, the Flag button renders with red fill styling and a "Flagged" label.

## Tasks

### Task 1: Add isFlagged prop to RiskCard and style toggle
**File:** `frontend/src/components/review/risk-card.tsx`
- Add `isFlagged?: boolean` to `RiskCardProps`
- When `isFlagged` is true, render the Flag button with red fill: `variant="destructive"` and label "Flagged"
- When false, keep current ghost + "Flag" appearance

### Task 2: Pass isFlagged from RiskAccordion
**File:** `frontend/src/components/review/risk-accordion.tsx`
- Import `useAppStore` flags (already imported)
- Check flags array for each risk: a flag exists on the same `para_id` whose note starts with `risk.title`
- Pass `isFlagged` to each RiskCard

### Task 3: Verify TypeScript compilation
- Run `npx tsc --noEmit`

## Verification
- Risk card Flag button is ghost "Flag" when not flagged
- After flagging a risk, button shows red fill "Flagged"
- TypeScript compiles cleanly
