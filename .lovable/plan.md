

# Budget-to-Execution Intelligence: Database Functions

## Overview

Create 4 Postgres functions that provide single-source-of-truth reporting for planned vs actual costs, invoicing progress, variance analysis, and portfolio-level reporting. All functions use SECURITY DEFINER with explicit org membership checks inside.

## What Gets Created

### 1. `project_actual_costs(p_project_id uuid)` -- Returns TABLE
Aggregates real spend from `time_entries` and `receipts`:
- **Labor**: joins `time_entries` (closed, with `duration_hours`) to `project_members` to get `cost_rate` and `bill_rate` per user. Handles missing `cost_rate` (defaults to 0) and missing membership (excludes those entries from cost calc but still counts hours).
- **Materials/Machine/Other**: sums `receipts.amount` grouped by `cost_type`, filtered to the project.
- Returns: `actual_labor_hours`, `actual_labor_cost`, `actual_labor_billable`, `actual_material_cost`, `actual_machine_cost`, `actual_other_cost`, `actual_total_cost` -- all rounded to 2 decimals.

### 2. `project_invoicing_summary(p_project_id uuid)` -- Returns TABLE
Pulls `contract_value` from `project_budgets` (COALESCE 0 if no budget row exists), sums `invoices.total` excluding `status = 'void'`:
- `contract_value`, `invoiced_amount`, `remainder_to_invoice`
- `billed_percentage`, `current_percent_to_bill` -- uses `NULLIF(contract_value, 0)` to avoid divide-by-zero, returns 0 when no contract value.

### 3. `project_variance_summary(p_project_id uuid)` -- Returns TABLE
Combines budget data from `project_budgets` with actuals from `project_actual_costs()`:
- Planned vs actual for labor hours, material, machine, other -- with delta columns.
- `planned_total_cost` = sum of all planned costs from budget.
- Profit = `contract_value - total_cost` (both planned and actual).
- Margin % = `profit / contract_value * 100` (guarded against zero).

### 4. `project_portfolio_report(p_org_id uuid, p_status_filter text DEFAULT NULL)` -- Returns SETOF rows
One row per project in the org:
- `job_number`, `customer_name`, `project_name`, `status`
- Status category mapping: `awarded/potential/completed/didnt_get/in_progress/not_started` etc.
- All variance + invoicing fields per project via lateral joins to the 3 functions above.
- Filters by `p_status_filter` if provided, excludes `is_deleted = true`.

## Technical Details

### Security Model
All 4 functions use `SECURITY DEFINER` with `SET search_path = public`. Each function:
- Accepts a project_id or org_id parameter
- Internally verifies `is_org_member(auth.uid(), organization_id)` by looking up the project's org
- Raises exception if the caller is not an org member
- The portfolio function checks org membership directly

### Performance Strategy
- Use CTEs for labor and receipt aggregation (single pass each)
- The portfolio function uses `LATERAL` joins to call per-project functions, which is clean but acceptable since the number of projects per org is bounded (tens to low hundreds)
- Existing indexes already cover the hot paths: `idx_time_entries_project_checkin`, `idx_receipts_project_id`, `idx_receipts_cost_type`
- One new index: `invoices(project_id)` for the invoicing summary aggregation (currently missing)

### Edge Cases Handled
- **No budget row**: All planned values default to 0; variance = 0 - actual
- **No time entries**: Labor hours/cost = 0
- **No receipts**: Material/machine/other = 0
- **cost_rate = 0**: Treated as zero cost (common for new members not yet configured)
- **contract_value = 0**: All percentage calculations return 0 (no divide-by-zero)
- **Void invoices**: Excluded from all calculations
- **Draft invoices**: Included in invoiced_amount (they represent committed work); can be excluded if needed by adding status filter

### SQL Artifacts
1. `project_actual_costs` function
2. `project_invoicing_summary` function  
3. `project_variance_summary` function
4. `project_portfolio_report` function
5. Index: `idx_invoices_project_id ON invoices(project_id)`
6. Index: `idx_invoices_status ON invoices(status)` (for void exclusion)

### Verification Queries (post-migration)
```sql
-- Test actual costs for a project
SELECT * FROM project_actual_costs('some-project-uuid');

-- Test invoicing summary
SELECT * FROM project_invoicing_summary('some-project-uuid');

-- Test variance
SELECT * FROM project_variance_summary('some-project-uuid');

-- Test portfolio report (all statuses)
SELECT * FROM project_portfolio_report('some-org-uuid');

-- Test portfolio report (awarded only)
SELECT * FROM project_portfolio_report('some-org-uuid', 'awarded');
```

## Files Changed
- **Database migration only** -- no application code changes in this step
- Single SQL migration with all 4 functions + 2 indexes

