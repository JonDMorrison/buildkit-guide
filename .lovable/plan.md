

# UI Polish Plan -- Consistent, Refined Look Across the App

## Problem
The app has two distinct visual tiers:
1. **Polished pages** (Dashboard, Executive) use `DashboardLayout`, `DashboardHeader`, `DashboardSection`, `DashboardGrid`, and `DashboardCard` -- producing a cohesive, modern feel with consistent spacing, card animations, and section rhythm.
2. **Everything else** (Time Tracking, Invoicing, Receipts, Safety, Documents, Drawings, Deficiencies, Change Orders, User Management, Hours Tracking, etc.) use raw `<Layout>` with ad-hoc `<h1>`, inconsistent padding, bare `<Card>` components, and no section structure.

This creates a jarring experience when navigating between pages.

## Strategy
Rather than a ground-up redesign, the plan is **incremental uplift** -- migrating pages to use the shared dashboard primitives, plus a handful of global polish touches.

---

## Phase 1: Global Polish (affects all pages)

### 1a. Softer card base
Update `src/components/ui/card.tsx` to add a subtle `shadow-elevation-1` and `transition-shadow` to the base `Card` so all cards across the app get a slight depth lift without hover jank.

### 1b. TopNav refinement
- Reduce the oversized logo (`h-24`) to `h-10` / `h-8 on mobile` -- the current size is disproportionate and wastes vertical space.
- Add a subtle bottom gradient line (1px) instead of the invisible `border-b-0` for better visual separation.

### 1c. Sidebar polish
- Add a subtle `opacity-60` gradient wash to the sidebar background for more depth.
- Slightly increase the nav item padding for a less cramped feel.

### 1d. Section title consistency
The `DashboardSection` title style (`text-[11px] uppercase tracking-widest`) is effective. Add a reusable `PageHeader` component that wraps the common pattern of title + subtitle + actions, so non-dashboard pages get the same visual quality without importing the full dashboard system.

---

## Phase 2: Page-Level Migrations (high-traffic pages first)

### 2a. Time Tracking (`src/pages/TimeTracking.tsx`)
- Wrap in `DashboardLayout` instead of raw `<Layout>` with manual padding.
- Replace the ad-hoc `<h1>` + `<p>` header with `DashboardHeader`.
- Group the check-in card, recent entries, and requests into `DashboardSection` blocks.

### 2b. Invoicing (`src/pages/Invoicing.tsx`)
- Swap `<Layout>` for `DashboardLayout`.
- Swap `SectionHeader` for `DashboardHeader`.
- Wrap the metrics strip and tabs in `DashboardSection`.

### 2c. Hours Tracking (`src/pages/HoursTracking.tsx`)
- Same pattern: `DashboardLayout` + `DashboardHeader`.

### 2d. Receipts (`src/pages/Receipts.tsx`)
- Same pattern: `DashboardLayout` + `DashboardHeader`.

### 2e. Safety, Documents, Drawings, Deficiencies, Change Orders
- Same migration: swap to `DashboardLayout` + `DashboardHeader` for the page shell.

### 2f. User Management (`src/pages/UserManagement.tsx`)
- Wrap in `DashboardLayout` + `DashboardHeader`.

---

## Phase 3: Micro-polish

### 3a. Empty states
The `EmptyState` component is solid but underused. Audit pages that show plain "No data" text and replace with the proper `EmptyState` component for visual consistency.

### 3b. Loading skeletons
Pages that show a raw `<Loader2>` spinner should use skeleton cards (the `DashboardCard` loading state) for a less jarring loading experience.

### 3c. Badge consistency
Standardize status badges across Invoicing, Tasks, and Deficiencies to use the `status-*` color tokens from the design system instead of ad-hoc color classes.

---

## Files Modified

| File | Change |
|------|--------|
| `src/components/ui/card.tsx` | Add subtle shadow + transition to base Card |
| `src/components/TopNav.tsx` | Reduce logo size, add bottom border gradient |
| `src/components/sidebar/NavItem.tsx` | Slightly increase padding |
| `src/components/sidebar/NavSection.tsx` | Minor spacing tweak |
| `src/pages/TimeTracking.tsx` | Migrate to DashboardLayout + DashboardHeader |
| `src/pages/Invoicing.tsx` | Migrate to DashboardLayout + DashboardHeader |
| `src/pages/HoursTracking.tsx` | Migrate to DashboardLayout + DashboardHeader |
| `src/pages/Receipts.tsx` | Migrate to DashboardLayout + DashboardHeader |
| `src/pages/Safety.tsx` | Migrate to DashboardLayout + DashboardHeader |
| `src/pages/Documents.tsx` | Migrate to DashboardLayout + DashboardHeader |
| `src/pages/Drawings.tsx` | Migrate to DashboardLayout + DashboardHeader |
| `src/pages/Deficiencies.tsx` | Migrate to DashboardLayout + DashboardHeader |
| `src/pages/ChangeOrders.tsx` | Migrate to DashboardLayout + DashboardHeader |
| `src/pages/UserManagement.tsx` | Migrate to DashboardLayout + DashboardHeader |

## No Backend Changes
All changes are purely frontend styling and layout wrapper swaps. No database, RPC, or edge function changes.

## Risks
- **Low risk.** Each page migration is a wrapper swap (Layout to DashboardLayout) and header replacement. Content and logic remain untouched.
- The `DashboardLayout` adds consistent `py-6 pb-24` padding and `max-w-screen-2xl` constraint, which may slightly change the feel of pages that previously went full-width. This is intentional -- constrained width improves readability.
- Pages with heavy custom layouts (Invoicing tabs, Task kanban) keep their internal structure; only the outer shell changes.

