
# Estimate Accuracy Learning Engine

## Overview

Two new pages -- **Project Estimate Accuracy** (per-project deep dive) and **Portfolio Insights** (cross-project analysis) -- powered entirely by the existing RPC functions (`project_variance_summary`, `project_actual_costs`, `project_invoicing_summary`, `project_portfolio_report`). No new tables or migrations required.

## Navigation

Add a new "Insights" tab to the bottom navigation bar in `useNavigationTabs.tsx`, visible to `all` and `office` tiers (Admin, PM, Foreman, Accounting/HR). Route: `/insights`. Icon: `TrendingUp` from lucide-react.

A project-level "Estimate Accuracy" view will be accessible from a secondary route `/insights/project` (with `?projectId=...` param), or navigated to from the portfolio table.

## New Files

### 1. `src/hooks/useEstimateAccuracy.ts`

Custom hook that calls the RPC functions:
- `project_variance_summary(p_project_id)` -- returns planned vs actual for all cost types
- `project_actual_costs(p_project_id)` -- for detailed actuals
- `project_invoicing_summary(p_project_id)` -- for contract/invoicing progress

Returns typed data with loading/error states. Uses `useEffect` + `useState` pattern matching `useJobCostReport`.

### 2. `src/hooks/usePortfolioInsights.ts`

Calls `project_portfolio_report(p_org_id, p_status_filter)` using the user's current organization ID (from `useOrganization` hook). Supports optional status filter. Returns array of project rows.

### 3. `src/pages/Insights.tsx` (Portfolio Insights -- default route)

**Layout**: Follows existing page patterns (`Layout` wrapper, `SectionHeader`, project selector, loading skeletons, empty states).

**Sections**:

a) **Filters bar**: Organization is automatic. Status filter dropdown (all / awarded / in_progress / completed / potential / didnt_get). Date range filters are visual-only for future snapshot-based filtering (disabled with tooltip "Coming soon with weekly snapshots").

b) **Portfolio KPI cards** (computed from portfolio report data):
   - Total Contract Value (sum across projects)
   - Total Actual Cost (sum)  
   - Average Margin % (weighted average)
   - Projects Over Budget (count where actual > planned)

c) **Worst Variance Leaderboard**: Table sorted by `total_cost_delta` descending (biggest overruns first). Columns: Job #, Project Name, Status, Planned Cost, Actual Cost, Delta ($), Delta (%), Margin %. Color-coded: red for negative margin, green for positive.

d) **Most Inaccurate Cost Category**: A simple summary showing which cost type (labor/material/machine) has the largest aggregate variance across the portfolio. Computed client-side from the portfolio data.

e) **Trend Chart placeholder**: A card with message "Weekly variance trends will be available once snapshot collection is enabled." This is where `project_financial_snapshots` will plug in later.

f) **Export CSV button**: Exports the full portfolio table as CSV (same pattern as `JobCostExportCSV`).

### 4. `src/pages/ProjectEstimateAccuracy.tsx` (Per-Project Deep Dive)

**Layout**: Same `Layout` + `SectionHeader` pattern. Project selector at top (same as JobCostReport).

**Sections**:

a) **KPI Cards Row** (6 cards, 3-col grid on desktop):
   - Planned Cost vs Actual Cost (with delta badge showing over/under)
   - Planned Labor Hours vs Actual Hours
   - Planned Materials vs Actual Materials
   - Planned Machine vs Actual Machine
   - Contract Value and Profit (planned vs actual)
   - Margin % (planned vs actual)

   Each card shows: planned value, actual value, delta (colored green if under budget, red/amber if over). If contract_value is 0, profit/margin cards show "No contract value set".

b) **Variance Breakdown Table by Cost Type**:
   | Category | Planned | Actual | Delta ($) | Delta (%) |
   Rows: Labor Hours, Labor Cost, Material, Machine, Other, Total.
   Delta % = `(actual - planned) / planned * 100`, guarded against zero.

c) **Missing Cost Rate Warning**: If `actual_labor_hours > 0` but `actual_labor_cost === 0`, show an alert: "Some workers may not have cost rates configured. Labor cost may be understated."

d) **Scope Item Variance Table** (if scope items exist):
   Fetches `project_scope_items` with their `planned_hours` and `planned_total`, then for each scope item that has a linked task (`scope_item_id`), fetches actual hours from `time_entries` via the task assignments. Columns: Scope Item, Planned Hours, Actual Hours, Delta, Planned Cost, Status.

   This is computed client-side by:
   1. Fetching scope items for the project
   2. Fetching tasks with `scope_item_id IS NOT NULL` and their time entries
   3. Joining them client-side

e) **Export CSV button** for the variance breakdown.

### 5. `src/components/insights/VarianceCard.tsx`

Reusable KPI card component:
```
Props: label, planned, actual, unit ('$' | 'h' | '%'), unavailableMessage?
```
Shows planned/actual values with a colored delta badge. Uses `formatCurrency` / `formatNumber` from `src/lib/formatters.ts`.

### 6. `src/components/insights/PortfolioExportCSV.tsx`

CSV export for the portfolio report table. Same pattern as `JobCostExportCSV`.

## Modified Files

### `src/hooks/useNavigationTabs.tsx`
Add after "Invoicing" entry:
```typescript
{ name: "Insights", path: "/insights", icon: TrendingUp, tiers: ['all', 'office'] },
```

### `src/App.tsx`
Add two new lazy-loaded routes:
```typescript
const Insights = lazy(() => import("./pages/Insights"));
const ProjectEstimateAccuracy = lazy(() => import("./pages/ProjectEstimateAccuracy"));
```
With `<ProtectedRoute>` wrappers at `/insights` and `/insights/project`.

## Access Control

- Visible to: Admin, PM, Foreman, Accounting/HR (tiers `all` + `office`)
- Uses `useAuthRole` + `useOrganizationRole` for access checks (same pattern as HoursTracking page)
- RPC functions already enforce org membership server-side via `SECURITY DEFINER`

## Edge Cases Handled

- **No budget row**: All planned values show as 0; variance = "0 - actual" (shows actual as the overrun)
- **contract_value = 0**: Profit and margin cards display "No contract value" instead of misleading zeros
- **Missing cost_rate**: Warning alert shown; labor cost shown as potentially understated
- **No projects**: Empty state with message
- **No time entries / receipts**: Zero values shown cleanly
- **Division by zero**: All percentage calculations guarded with `|| 0` fallback

## Technical Notes

- No new database tables or migrations needed -- everything computed from existing RPC functions
- The scope-item-level variance view does require a client-side join (scope items + tasks + time_entries), but this is bounded by the number of scope items per project (typically tens, not hundreds)
- Portfolio report may be slow for orgs with 100+ projects; acceptable for now, mitigated later with the snapshot table
- Recharts is already installed and can be used for the trend chart when snapshots are added
