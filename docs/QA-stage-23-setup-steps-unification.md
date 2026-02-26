# QA Script — Stage 23: Single Source of Truth for Setup Steps

## Summary

Created `src/lib/setupSteps.ts` as the canonical registry of 8 post-onboarding setup steps.
Both `useSmartChecklist` and `useSetupProgress` now derive step lists and counts from this registry.
Previously, the progress bar counted 15 steps while the checklist only showed 8 → "ghost step" mismatch is eliminated.

## What Changed

- **`src/lib/setupSteps.ts`** (NEW) — Canonical `SETUP_STEPS` array and `SETUP_STEP_KEYS` list.
- **`src/components/setup/useSmartChecklist.ts`** — Derives from registry instead of hardcoded `ALL_ITEMS`.
- **`src/hooks/useSetupProgress.tsx`** — Progress calculation uses `SETUP_STEP_KEYS` (8 steps) instead of hardcoded 15-step array.
- **`src/components/setup/SmartChecklist.tsx`** — Updated type imports.

## Test Cases

### 1. Progress Bar Matches Checklist Count
1. Log in as an admin with an active organization.
2. Navigate to `/dashboard`.
3. If SmartChecklist is visible, note the "X% done" and item count.
4. ✅ `totalCount` matches the number of distinct steps in the checklist (8 max).
5. ✅ No "100%" shown when items are still visible, and no "50%" when most items are done.

### 2. Complete a Step — Both Update
1. Open the checklist on the dashboard.
2. Complete "Invite a Team Member" (click Invite → send invite).
3. ✅ The item disappears from the checklist.
4. ✅ The progress percentage increases by exactly 1/8 (~12.5%).

### 3. Context Filtering Still Works
1. Navigate to `/safety`.
2. ✅ Safety-specific steps (PPE, Hazard Library) appear if incomplete.
3. Navigate to `/dashboard`.
4. ✅ Dashboard steps (Invite, Assign, Trades) appear if incomplete.
5. ✅ Safety steps are NOT shown on dashboard.

### 4. Refresh Consistency
1. Note progress percentage on dashboard.
2. Refresh the browser.
3. ✅ Same percentage and same steps displayed.

### 5. All-Context Mode (/setup)
1. Navigate to `/setup` (if available) or use `forceShow` prop.
2. ✅ All 8 step types are available (minus completed ones).

### 6. Onboarding-Only Steps Are Hidden
1. ✅ Steps like "org_created", "timezone_set", "first_project" never appear in the checklist UI.
2. ✅ These steps do NOT affect the progress percentage.

## Confirmation Checklist

- [x] No RPC contracts changed
- [x] No DB schema changes
- [x] Canonical registry has exactly 8 steps matching existing UI
- [x] `useSetupProgress` and `useSmartChecklist` use same step list
- [x] Ghost steps eliminated (progress denominator = checklist total)
- [x] Step completion detectors unchanged (same DB queries)
- [x] Deterministic ordering preserved
- [x] PR-sized change (4 files touched, 1 new)
