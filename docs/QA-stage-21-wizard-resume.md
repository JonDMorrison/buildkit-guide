# QA Script — Stage 21: Wizard Resume + Refresh Safety

## Prerequisites
- A fresh user account (or one with `has_onboarded = false`)
- Access to the database to verify rows

---

## Test 1: New User End-to-End
1. Sign up / log in as new user
2. Arrive at `/welcome` → Step 1
3. Select a role → click Continue
4. **Verify**: `profiles.onboarding_step = 2` in DB
5. Enter org name → click Continue
6. **Verify**: `profiles.onboarding_step = 3` AND `profiles.onboarding_org_id` is set
7. Enter project name → click Create & Continue
8. **Verify**: `profiles.onboarding_step = 4` AND `profiles.onboarding_project_id` is set
9. Select AI mode → click Go to Dashboard
10. **Verify**: `profiles.has_onboarded = true`
11. **Verify**: User lands on `/dashboard`

## Test 2: Refresh at Each Step
1. Complete Step 1 → arrive at Step 2
2. **Refresh the browser**
3. **Expected**: Wizard resumes at Step 2 (not Step 1)
4. Complete Step 2 → arrive at Step 3
5. **Refresh the browser**
6. **Expected**: Wizard resumes at Step 3, org is NOT re-created
7. Complete Step 3 → arrive at Step 4
8. **Refresh the browser**
9. **Expected**: Wizard resumes at Step 4, project is NOT re-created

## Test 3: Back Button Stress
1. Go through Step 1 → Step 2 → Step 3
2. Click Back to Step 2
3. Click Continue (org already exists)
4. **Expected**: No duplicate org created, wizard advances to Step 3
5. Click Back to Step 2 again, then forward again
6. **Expected**: Same org, same behavior, no errors

## Test 4: Double-Click Submit
1. On Step 2, rapidly double-click Continue
2. **Expected**: Only one org created (isSubmitting guard prevents second call)
3. On Step 3, rapidly double-click Create & Continue
4. **Expected**: Only one project created

## Test 5: Existing Org Membership
1. User already belongs to an org (via invite acceptance)
2. Navigate to `/welcome`
3. **Expected**: `orgCreated` is rehydrated from existing membership
4. On Step 2, org creation RPC uses `already_existed` path
5. **Expected**: No new org created

## Test 6: Slug Collision
1. User A creates org "Acme Construction"
2. User B creates org "Acme Construction"
3. **Expected**: User B gets slug `acme-construction-2` (deterministic)
4. **Verify**: Both orgs exist with unique slugs

## Test 7: Persistence Failure Handling
1. Simulate network error on profile update (e.g., disconnect network briefly)
2. Click Continue on Step 1
3. **Expected**: Error toast shown, wizard stays on Step 1
4. Reconnect network, retry
5. **Expected**: Succeeds normally

## Test 8: Already-Onboarded User
1. User with `has_onboarded = true` navigates to `/welcome`
2. **Expected**: Redirected to `/dashboard` immediately (Welcome.tsx gate)
3. **Verify**: No wizard shown

---

## Final Confirmation Checklist

- [ ] No existing RPC contracts were modified
- [ ] No margin/volatility/snapshot engines touched
- [ ] Route gating patterns (ProtectedRoute) unchanged
- [ ] Deterministic slug conflict resolution preserved
- [ ] Change set is PR-sized (3 files changed + 1 migration + 1 QA doc)
- [ ] Wizard resumes correctly after refresh at every step
- [ ] No duplicate orgs or projects on back/refresh/double-click
