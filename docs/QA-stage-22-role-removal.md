# QA Script — Stage 22: Role Selection Removal

## Summary

The cosmetic "role selection" screen (old Step 1) has been removed from the onboarding wizard.
The wizard is now 3 steps: Organization → Project → AI Mode.
Old persisted `onboarding_step` values are migrated in-memory during rehydration.

## Test Cases

### 1. Fresh New User — Full Flow
1. Sign up with a new account.
2. Wizard opens at Step 1 of 3 (Organization).
3. Enter company name, timezone, province → Continue.
4. Step 2 of 3 (Project) appears.
5. Enter project details → Create & Continue (or Skip).
6. Step 3 of 3 (AI Mode) appears.
7. Select mode → Go to Dashboard.
8. ✅ User lands on dashboard. No role selection screen appeared.

### 2. Refresh Mid-Wizard
1. Start onboarding, complete Step 1 (Org created).
2. Refresh the browser.
3. ✅ Wizard resumes at Step 2 (Project). Org is not recreated.

### 3. Back Button Stress
1. Complete Step 1 → arrive at Step 2.
2. Click Back → Step 1 shows (org name filled).
3. Click Continue again → ✅ No duplicate org created. Advances to Step 2.
4. Complete Step 2 → Step 3. Click Back → Step 2.
5. Click Continue → ✅ No duplicate project. Advances to Step 3.

### 4. Existing User with Old Step Values
- User with `onboarding_step=2` (old Org step) → resumes at new Step 1 (Org).
- User with `onboarding_step=3` (old Project step) → resumes at new Step 2 (Project).
- User with `onboarding_step=4` (old AI step) → resumes at new Step 3 (AI).
- ✅ No crash. No skipped steps. Migration is transparent.

### 5. Double-Click Protection
1. On Step 1, fill in org name and rapidly click Continue twice.
2. ✅ Only one org is created. `isSubmitting` guard prevents duplicates.

### 6. Persistence Failure
1. Simulate network failure on profile update.
2. ✅ Wizard does NOT advance. Toast error shown. User can retry.

## Confirmation Checklist

- [x] No RPC contracts changed
- [x] No existing role/permission tables modified
- [x] Org creator still gets `admin` membership via `rpc_onboarding_ensure_org`
- [x] Route/page/query gates unchanged
- [x] Deterministic step migration (no randomness)
- [x] Dead code removed (Role type, roles array, selectedRole state, unused icons)
- [x] Change is PR-sized (single file modified + QA doc)
