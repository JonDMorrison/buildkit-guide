
# Additional UX Issues Found (Similar to Melissa's Feedback)

Based on a thorough audit of the codebase and live mobile testing, here are additional problems that a user like Melissa would encounter:

---

## Issue 1: Tab Bar Labels Overlap on Mobile

**Problem:** On mobile (390px), all 10 tab labels ("Dashboard", "Tasks", "Hours", "Lookahead", "Manpower", "Drawings", "Deficiencies", "Safety", "Receipts", "Time") render in a single row with `flex-1` sizing. The labels visibly collide and truncate into each other (e.g., "LookaheadManpowerDrawingsDeficienciesSafety" runs together as seen in the screenshot).

**Fix:** Make the tab bar horizontally scrollable on mobile with `overflow-x-auto` and give each tab a `min-w-[64px]` instead of relying on `flex-1` to squeeze all 10 tabs into ~390px. This is the standard mobile pattern (similar to Instagram, YouTube, etc.).

**File:** `src/components/TabBar.tsx`

---

## Issue 2: AI Button Still Overlaps Receipts Tab on Mobile

**Problem:** The AI floating button is positioned at `bottom-[calc(var(--tab-bar-height)+16px)] right-4`. While it no longer covers the Receipts icon directly, it sits very close to the tab bar and can obscure content at the bottom of pages. On pages with bottom-anchored content (like Receipts list items), it blocks interaction.

**Fix:** Increase the bottom offset to `bottom-[calc(var(--tab-bar-height)+24px)]` and reduce the button size on mobile from `h-14 w-14` to `h-12 w-12`.

**File:** `src/components/ai-assist/AIAssistButton.tsx`

---

## Issue 3: Dashboard Settings Gear Uses Fixed Positioning That Breaks on Different Screen Sizes

**Problem:** The settings gear is positioned with `fixed top-0 right-[120px] sm:right-[160px] z-40`. This hardcoded pixel offset doesn't account for varying TopNav content widths (e.g., notification badge count changing width, different avatar sizes). On some screen widths, it still overlaps the search icon or notification bell.

**Fix:** Instead of using fixed positioning with pixel offsets, move the DashboardCustomizer settings gear *into* the TopNav's flex container (or into the dashboard header area next to the "Add" and "Tasks" buttons), eliminating the overlap entirely.

**File:** `src/pages/Dashboard.tsx`

---

## Issue 4: No Way to Delete a Project (Only Archive)

**Problem:** Melissa asked about editing *and deleting* a project. The app only supports "Archive" via the Project Overview page's three-dot menu. There's no actual delete option. For a user who created a test project or made a mistake, archiving feels incomplete -- they'd expect to be able to permanently remove it.

**Fix:** Add a "Delete Project" option to the dropdown menu (with a confirmation dialog that warns about permanent data loss). Gate it behind an admin/owner permission check. Keep "Archive" as the soft-delete default.

**File:** `src/pages/ProjectOverview.tsx`

---

## Issue 5: Receipts Page Loses Project Context When Navigating Away and Back

**Problem:** Navigating to `/receipts` shows "No Project Selected" even though a project was selected on the dashboard. The `useCurrentProject` hook persists project ID via URL params, but the Receipts page doesn't read from the same source, requiring the user to re-select a project.

**Fix:** Ensure the Receipts page reads `currentProjectId` from the same `useCurrentProject` hook used by the Dashboard, so project context carries across page navigations.

**File:** `src/pages/Receipts.tsx`

---

## Issue 6: Global Search Doesn't Show Results When Not Logged In / No Project Selected

**Problem:** The `useGlobalSearch` hook queries data scoped to the current project. If no project is selected (which happens on several pages), search returns nothing with no explanation to the user.

**Fix:** When no project is selected, show a hint message: "Select a project first to search within it" instead of the generic "No results found."

**File:** `src/components/GlobalSearchModal.tsx`

---

## Summary of Changes

| # | Issue | File(s) | Effort |
|---|-------|---------|--------|
| 1 | Tab bar label overlap on mobile | `TabBar.tsx` | Small |
| 2 | AI button proximity to tab bar | `AIAssistButton.tsx` | Small |
| 3 | Settings gear fixed positioning | `Dashboard.tsx` | Medium |
| 4 | No project delete option | `ProjectOverview.tsx` | Medium |
| 5 | Receipts loses project context | `Receipts.tsx` | Small |
| 6 | Search empty state when no project | `GlobalSearchModal.tsx` | Small |

---

## Technical Details

**Tab Bar Fix (Issue 1):**
- Change the nav container from `flex` with `flex-1` children to `overflow-x-auto` with `min-w-[64px]` per tab
- Add `scrollbar-hide` class to prevent visible scrollbar
- Keep current active state styling

**Settings Gear Fix (Issue 3):**
- Remove the `fixed top-0 right-[120px]` wrapper from Dashboard.tsx
- Place the `DashboardCustomizer` inline in the dashboard header, next to the "Add" and "Tasks" buttons

**Project Delete (Issue 4):**
- Add a new `DropdownMenuItem` for "Delete Project" with a `Trash2` icon
- Add a second `AlertDialog` for delete confirmation with stronger warning language
- Implement `handleDeleteProject` that cascades deletes or checks for dependent data first
- Gate behind `canManageProject` permission
