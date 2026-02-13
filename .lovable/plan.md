

# Responsive Navigation: Desktop Sidebar + Mobile Bottom Bar

## What Changes

On screens 768px and wider (desktop/tablet), the bottom navigation bar moves to a collapsible left sidebar. On mobile (below 768px), the existing bottom tab bar stays exactly as it is today -- optimized for field use with large tap targets.

## How It Works

```text
Desktop (md+)              Mobile (<768px)
+--------+-----------+     +------------------+
|Sidebar | Content   |     | TopNav           |
|        |           |     +------------------+
| Dash   |           |     | Content          |
| Tasks  |           |     |                  |
| Time   |           |     |                  |
| Hours  |           |     +------------------+
| ...    |           |     | Bottom TabBar    |
+--------+-----------+     +------------------+
```

## Technical Plan

### 1. Create `src/components/AppSidebar.tsx`
- New component using the existing Shadcn `Sidebar` primitives (`Sidebar`, `SidebarContent`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`)
- Reuses the **exact same** `tabs` array and tier-filtering logic currently in `TabBar.tsx`
- Extract the shared tab config and tier logic into a new hook or shared constant so both components stay in sync
- Uses `NavLink` for active-route highlighting
- Collapsible to icon-only mode via `SidebarTrigger`
- Shows tooltips on collapsed icons
- Only renders on desktop (the Shadcn `Sidebar` component already handles this -- it renders as a Sheet overlay on mobile which we won't use)

### 2. Create `src/hooks/useNavigationTabs.tsx`
- Extract the shared logic from `TabBar.tsx`: the `tabs` config array, the `navTier` computation, the `visibleTabs` filtering, and the loading state
- Both `TabBar` and `AppSidebar` import from this single source of truth
- Prevents the tab list and role logic from drifting out of sync

### 3. Modify `src/components/TabBar.tsx`
- Import `useNavigationTabs` instead of duplicating tier logic
- Add `hidden md:hidden` -- hide the bottom bar on desktop (md+), show only on mobile
- Actually: the TabBar should simply not render on desktop. Add `useIsMobile()` check: if not mobile, return `null`

### 4. Modify `src/components/Layout.tsx`
- Wrap content in `SidebarProvider`
- Add `AppSidebar` to the layout
- Add `SidebarTrigger` to the `TopNav` area (visible only on desktop)
- Remove the `pb-tab-bar` bottom padding on desktop since the bottom bar won't be there
- Structure becomes:

```text
<SidebarProvider>
  <div className="flex min-h-screen w-full">
    <AppSidebar />        <!-- desktop only -->
    <div className="flex flex-col flex-1">
      <TopNav />          <!-- includes SidebarTrigger on desktop -->
      <Breadcrumbs />
      <main>...</main>
    </div>
  </div>
  <TabBar />              <!-- mobile only -->
</SidebarProvider>
```

### 5. Modify `src/components/TopNav.tsx`
- On desktop, add a `SidebarTrigger` button (hamburger/panel icon) to the left side of the top nav bar
- Only show it on md+ screens
- This lets users collapse/expand the sidebar

### 6. Adjust CSS spacing
- `pb-tab-bar` on `<main>` should only apply on mobile: change to `pb-tab-bar md:pb-0`
- The sidebar width is handled by the Shadcn sidebar CSS variables (16rem expanded, 3rem collapsed)

### Files Created
- `src/components/AppSidebar.tsx` -- Desktop sidebar navigation
- `src/hooks/useNavigationTabs.tsx` -- Shared tab config and role-filtering logic

### Files Modified
- `src/components/Layout.tsx` -- Add SidebarProvider + AppSidebar wrapper
- `src/components/TabBar.tsx` -- Hide on desktop, use shared hook
- `src/components/TopNav.tsx` -- Add SidebarTrigger on desktop

### Files Unchanged
- All role hooks, page guards, and route definitions remain untouched
- The Shadcn sidebar component (`src/components/ui/sidebar.tsx`) is used as-is

