

# Role-Based UX Audit -- Findings and Fixes

## Audit Summary

After tracing every page, hook, and navigation path, I found **5 inconsistencies** where role enforcement is missing or misaligned with the TabBar tier system. The TabBar correctly hides tabs, but if a user navigates directly to a URL (bookmark, back button, shared link), several pages render full content without checking permissions.

---

## Issues Found

### Issue 1: HoursTracking -- No Access Control
**File:** `src/pages/HoursTracking.tsx`
**Problem:** Zero role checks. Any authenticated user can visit `/hours-tracking` and see all project hours data, even field workers and external trades.
**Fix:** Add `useAuthRole` + loading guard + `NoAccess` fallback. Only Admin, PM, Foreman, and Office/Accounting roles should access this page.

### Issue 2: Drawings -- No Access Guard
**File:** `src/pages/Drawings.tsx`
**Problem:** The upload button is gated by `can('upload_documents')`, but the page itself renders the full drawing list to anyone -- including external trades who shouldn't see project drawings at all.
**Fix:** Add role check. Only Tier 1 (all) roles should see Drawings. Show `NoAccess` for field/minimal tier users.

### Issue 3: Deficiencies -- No Access Guard
**File:** `src/pages/Deficiencies.tsx`
**Problem:** The create button is gated, but the full deficiency list renders for everyone. External trades and internal workers shouldn't see the deficiency management page.
**Fix:** Add role check matching the TabBar tier -- only Tier 1 (all) roles. Show `NoAccess` for others.

### Issue 4: Invoicing -- Global Admin Blind Spot
**File:** `src/pages/Invoicing.tsx`
**Problem:** Access check is `orgRole === "admin" || orgRole === "pm"`. A user who is a **global admin** (via `user_roles` table) but has no org membership would be blocked. This is inconsistent with every other page that checks `isGlobalAdmin`.
**Fix:** Add `isGlobalAdmin` from `useProjectRole` or `useUserRole` to the `canAccess` check so global admins always pass.

### Issue 5: Dashboard Direct URL Access
**File:** `src/pages/Dashboard.tsx`
**Problem:** Dashboard is only in `all` and `office` tiers in the TabBar, meaning field workers and external trades don't see the tab. But if they navigate to `/dashboard` directly (bookmark, shared link), they see the full dashboard with potentially sensitive project metrics.
**Fix:** Add a lightweight role guard that redirects field/minimal tier users to `/tasks` if they hit `/dashboard` directly. This way the Dashboard remains the correct landing page for management and office roles, while field users land on their appropriate home.

---

## No Issues Found (Already Correct)

These pages already have proper guards:
- **Safety.tsx** -- Checks `canViewSafety` with loading guard, allows workers for Right-to-Refuse
- **Receipts.tsx** -- Checks `canView` with `roleLoading` guard
- **JobCostReport.tsx** -- Checks `hasAccess` with `roleLoading` guard
- **Lookahead.tsx** -- Checks `canViewLookahead` with loading guard
- **Manpower.tsx** -- Checks `canRequestManpower` with `roleLoading` guard
- **DailyLogs.tsx** -- Checks `canViewLogs` with loading guard
- **AuditLog.tsx** -- Checks `isAdmin` with `roleLoading` guard
- **TimesheetPeriods.tsx** -- Checks `canApproveTimesheets`
- **TimeRequestsReview.tsx** -- Checks `canReviewRequests`
- **TabBar.tsx** -- Tier system is correct and consistent

---

## Implementation Plan

### Step 1: Fix HoursTracking.tsx
- Import `useAuthRole`, `NoAccess`, and add loading spinner
- Add access check: `isAdmin || isPM() || isForeman()` or accounting role
- Show `NoAccess` for unauthorized users, with loading guard to prevent flash

### Step 2: Fix Drawings.tsx
- Import `NoAccess` and add `roleLoading` check from `useAuthRole`
- Add access check: only Tier 1 roles (Admin, PM, Foreman)
- Show `NoAccess` for field workers and external trades

### Step 3: Fix Deficiencies.tsx
- Add access guard using existing `roleLoading` and `isAdmin`/`isPM`/`isForeman` checks
- Show `NoAccess` for workers and external trades

### Step 4: Fix Invoicing.tsx
- Import `useUserRole` or use existing `useProjectRole` to check `isGlobalAdmin`
- Update `canAccess` from `orgRole === "admin" || orgRole === "pm"` to also include `isGlobalAdmin`

### Step 5: Fix Dashboard.tsx
- Add role tier check from `useAuthRole`
- If user is field/minimal tier, redirect to `/tasks` using `Navigate`
- Add loading guard to prevent flash during redirect

---

## Technical Details

All fixes follow the **exact same pattern** already established in Safety.tsx, Receipts.tsx, and JobCostReport.tsx:

```text
1. Check roleLoading --> show spinner
2. Check access --> show NoAccess if unauthorized
3. Render page content if authorized
```

No database changes, no new hooks, no new components needed. Pure frontend guards using existing infrastructure.

### Files Modified
- `src/pages/HoursTracking.tsx` -- Add role guard
- `src/pages/Drawings.tsx` -- Add role guard
- `src/pages/Deficiencies.tsx` -- Add role guard
- `src/pages/Invoicing.tsx` -- Fix global admin check
- `src/pages/Dashboard.tsx` -- Add redirect for unauthorized tiers

### Files Unchanged
- `src/components/TabBar.tsx` -- Already correct
- `src/components/NoAccess.tsx` -- Already correct
- All hooks -- No changes needed
