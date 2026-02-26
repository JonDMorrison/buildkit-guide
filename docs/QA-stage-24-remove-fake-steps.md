# QA Script — Stage 24: Remove Fake Steps; Require Real Actions

## Summary

Two checklist steps (`step_ppe_reviewed`, `step_hazard_library`) previously had "Mark Complete" buttons that instantly flipped a boolean with zero verification. These now require explicit user acknowledgement via a confirmation dialog. No new DB tables needed — the existing `setup_checklist_progress` columns are used, but completion only happens after the user confirms through the dialog.

## What Changed

- **`src/lib/setupSteps.ts`** — Updated labels/descriptions for PPE and Hazard steps to use honest acknowledgement wording.
- **`src/components/setup/AcknowledgeStepDialog.tsx`** (NEW) — Confirmation dialog requiring explicit "Yes, I've completed this" before marking done.
- **`src/components/setup/SmartChecklist.tsx`** — PPE and Hazard actions now open the acknowledgement dialog instead of instantly calling `markStepComplete`.

## Test Cases

### 1. PPE Step Cannot Be Instantly Completed
1. Navigate to `/safety` (or force checklist with `forceShow`).
2. Click "I've Reviewed This" on the PPE step.
3. ✅ A confirmation dialog appears asking if you've actually reviewed PPE requirements.
4. Click "Cancel" → ✅ Step remains incomplete.
5. Click "Yes, I've completed this" → ✅ Step is marked complete.

### 2. Hazard Library Step Cannot Be Instantly Completed
1. Same flow as above for "Configure Hazard Library".
2. ✅ Dialog appears with honest description.
3. ✅ Only confirming marks it complete.

### 3. Completion Persists After Refresh
1. Acknowledge PPE step via dialog.
2. Refresh the browser.
3. ✅ PPE step remains complete (stored in `setup_checklist_progress`).

### 4. Other Steps Unchanged
1. ✅ "Invite a Team Member" still opens InviteUserModal.
2. ✅ "Configure Trades" still opens TradesManagementModal.
3. ✅ "Go to Labor Rates" still navigates to settings.
4. ✅ No behavior change for non-acknowledgement steps.

### 5. Progress Count Integrity
1. Before acknowledging: progress shows X/8.
2. After acknowledging PPE: progress shows (X+1)/8.
3. ✅ No phantom completion. Count only changes via dialog confirmation.

## Confirmation Checklist

- [x] No RPC contracts changed
- [x] No DB schema changes needed (reuses existing boolean columns)
- [x] No instant "Mark Complete" without user confirmation
- [x] Honest wording — user acknowledges external completion
- [x] Idempotent — re-acknowledging has no side effects
- [x] PR-sized (3 files changed, 1 new)
- [x] Stage 25+ not started
