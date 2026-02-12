

# Fix: Project Overview Access and Settings Gear Placement

## What Melissa Reported

1. **"Where is Project Overview?"** — There's no link to it from the dashboard or the bottom tab bar. Users can't find it without already knowing it exists.
2. **"The gear was better near the search bar"** — Moving the settings gear inline next to "+ Add" and "Tasks" made it blend in and feel confusing. She preferred it up top near the search bar where it was more visible and intuitive.

---

## Solution

### 1. Add a "Project" button to the Dashboard header

Add a new button next to "+ Add" and "Tasks" in the dashboard header that navigates to `/project-overview?projectId=...`. This gives users one-tap access to view/edit/delete the current project without cluttering the tab bar (which already has 10 items).

The button will be styled as a blue outline button labeled "Project" with an external-link or building icon, sitting alongside the existing action buttons. This matches Melissa's suggestion of "another blue block labelled 'edit' beside + Add --> Tasks."

**File:** `src/pages/Dashboard.tsx` (lines 554-563)

Add before the "+ Add" button:
```tsx
<Button 
  onClick={() => navigate(`/project-overview?projectId=${currentProjectId}`)} 
  size="sm" 
  variant="outline"
  className="border-primary text-primary hover:bg-primary/10 px-3 w-fit"
>
  <Building2 className="h-4 w-4 mr-1" /> Project
</Button>
```

### 2. Move the settings gear back to the TopNav

Remove `DashboardCustomizer` from the dashboard header's button row and place it inside the `TopNav` component, positioned between the search icon and the notifications bell. This is only shown when the user is on the `/dashboard` route.

**File:** `src/components/TopNav.tsx`
- Import `DashboardCustomizer` and the dashboard layout hook
- Detect if current route is `/dashboard` using `useLocation`
- Render the gear icon inline in the TopNav's right-side flex container, between Search and Notifications
- Pass down the same props (isEditMode, hiddenWidgets, etc.)

**File:** `src/pages/Dashboard.tsx`
- Remove the `DashboardCustomizer` from the header button group (line 546-553)
- Lift the dashboard layout state so TopNav can access it (via context or props through Layout)

### Alternative: Simpler approach (recommended)

Instead of lifting state, keep `DashboardCustomizer` in Dashboard.tsx but render it in a **fixed position near the top-right**, just left of the search button. Use a portal or absolute positioning within the nav height. This avoids prop-drilling through Layout.

Specifically:
- Render `DashboardCustomizer` as a fixed-position element at `top-[12px] right-[calc(theme(spacing.2)+theme(spacing.10)*3)]` (accounting for Search + Notifications + Avatar)
- Only show the gear icon (not edit mode buttons) in this position; edit mode controls stay inline in the dashboard header

**Revised simpler approach:**
- Move just the gear trigger button back to fixed position near the top bar
- Keep the edit mode Save/Reset/Cancel buttons inline in the dashboard content area where they make sense contextually

---

## Summary of Changes

| Change | File | Effort |
|--------|------|--------|
| Add "Project" button to dashboard header | `src/pages/Dashboard.tsx` | Small |
| Move settings gear back near top bar | `src/pages/Dashboard.tsx` | Small |

## Technical Details

**Dashboard header button row (lines 545-564) will become:**

```
[Gear icon - fixed near top bar]

[Project button] [+ Add button] [Tasks button]
```

**Settings gear positioning:**
- Move `DashboardCustomizer` (when not in edit mode) to render with `fixed top-3 right-[120px] z-40` positioning, placing it visually in the top nav bar near the search icon
- When in edit mode, the Save/Reset/Cancel buttons render inline in the dashboard header area as they do now
- This restores Melissa's preferred location while keeping the edit controls contextually near the widgets

