# QA — Stage 26: Wizard UX Correctness

## Changes Summary

### 26.1 Timezone defaults
- Browser timezone auto-detected via `Intl.DateTimeFormat().resolvedOptions().timeZone`
- Falls back to `America/Toronto` only if browser TZ not in supported list
- Previously: always hardcoded to `America/Toronto`

### 26.2 Province/region defaults
- Province derived from detected timezone (e.g., Vancouver → BC, New York → US-OTHER)
- Empty string shown as placeholder "Select province / region" when no match
- Changing timezone auto-updates province suggestion
- Previously: always hardcoded to `ON` (Ontario)

### 26.3 Job site creation correctness
- `location` field on projects writes `null` instead of `'TBD'` when address is empty
- Job site insert failure now shows a toast instead of silently failing
- Project still created even if job site insert fails (non-blocking)

### 26.4 AI risk mode save
- `handleFinish` now blocks completion if `rpc_upsert_operational_profile` fails
- Shows error toast with "Could not save preferences. Please try again."
- Previously: silently called `onComplete()` even on failure

### 26.5 UX correctness
- All three action buttons disable during `isLoading || isSubmitting`
- `handleProjectCreate` now has double-click guard (`if (isSubmitting) return`)
- `handleFinish` now has double-click guard

## Manual QA Checklist

### Fresh onboarding (Canada user)
1. Sign up → redirected to wizard
2. Timezone should auto-detect (e.g., Eastern if browser is EST)
3. Province should match timezone (e.g., ON for Toronto)
4. Change timezone to Vancouver → province updates to BC
5. Fill org name → Continue → should work
6. Create project with address → job site created
7. Create project WITHOUT address → `location` should be NULL (not "TBD")
8. AI step → select mode → "Go to Dashboard" → redirected

### Fresh onboarding (US user)
1. If browser timezone is `America/New_York`, province shows "United States (Other)"
2. User can change to any province/region

### Error handling
1. Block network → try to save AI mode → should show error toast, NOT redirect
2. Double-click "Continue" rapidly → should not create duplicate orgs
3. Refresh at step 2 → should resume at step 2

### Province placeholder
1. If timezone not in map → province shows "Select province / region" placeholder
2. User must select manually

## Files Changed
- `src/components/onboarding/WelcomeWizard.tsx`
