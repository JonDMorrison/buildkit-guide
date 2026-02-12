

# Job Cost Report

Build a new **Job Cost Report** page that aggregates labor hours and material/expense receipts per project into a single cost summary, with CSV and PDF export for bookkeepers.

---

## What It Does

The report gives PMs and bookkeepers a single view of **total project costs** broken down by:

- **Labor costs** -- time entries grouped by worker, multiplied by their bill rate
- **Material/expense costs** -- receipts grouped by category (fuel, materials, tools, etc.)
- **Combined totals** -- labor + materials = total job cost

Exportable to **CSV** (for QuickBooks/Sage import) and **PDF** (for client-facing summaries).

---

## What Gets Built

### 1. Database: Add `bill_rate` to `project_members`

A new nullable `bill_rate numeric` column on the `project_members` table. This allows each worker to have a per-project hourly rate (e.g., $65/hr for a journeyman electrician on Project A, $55/hr on Project B).

- Nullable so it doesn't break existing data
- Editable by PM/Admin via the existing Edit User Role modal

### 2. Hook: `useJobCostReport`

A new data hook (`src/hooks/useJobCostReport.ts`) that fetches and aggregates:

- **Labor section**: Queries `time_entries` (status = 'closed') joined with `profiles` (for names) and `project_members` (for bill_rate). Groups by user, calculates hours x rate = cost.
- **Materials section**: Queries `receipts` for the project, groups by category, sums amounts.
- Returns a typed `JobCostReport` object with labor rows, material rows, and grand totals.

### 3. Page: `/job-cost-report`

A new page (`src/pages/JobCostReport.tsx`) accessible to PM/Admin roles, containing:

- **Project selector** (reuses existing pattern from HoursTracking page)
- **Date range filter** (optional, to scope the report to a pay period or month)
- **Summary cards**: Total Labor Cost, Total Material Cost, Total Job Cost
- **Labor table**: Worker name, hours worked, bill rate, total cost
- **Materials table**: Category, vendor, amount, date
- **Export buttons**: CSV and PDF (reuses existing jspdf dependency)
- Workers with no bill_rate set will show hours but "$0.00" cost with a warning indicator, prompting the PM to set their rate

### 4. UI: Add bill rate to Edit User Role modal

Update `EditUserRoleModal.tsx` to include an optional "Bill Rate ($/hr)" field so PMs can set per-project rates for each team member.

### 5. Route and Navigation

- Add route `/job-cost-report` in `App.tsx`
- Add navigation link accessible to PM/Admin roles

---

## Technical Details

### New Database Column

```sql
ALTER TABLE public.project_members 
ADD COLUMN bill_rate numeric DEFAULT NULL;
```

No RLS changes needed -- existing project_members policies already control access.

### `JobCostReport` Type Shape

```typescript
interface JobCostReport {
  labor: {
    rows: Array<{
      userId: string;
      userName: string;
      hoursWorked: number;
      billRate: number | null;
      totalCost: number;
    }>;
    totalHours: number;
    totalCost: number;
  };
  materials: {
    rows: Array<{
      id: string;
      date: string;
      vendor: string | null;
      category: string;
      amount: number;
      notes: string | null;
    }>;
    totalCost: number;
  };
  grandTotal: number;
}
```

### CSV Export Format

Designed for QuickBooks-compatible import:

```
Section,Worker/Vendor,Category,Hours,Rate,Amount
Labor,John Smith,,40.0,65.00,2600.00
Labor,Jane Doe,,32.5,55.00,1787.50
Materials,,Materials,,,450.00
Materials,,Fuel,,,120.00
,,,,TOTAL,4957.50
```

### PDF Export

Uses existing `jspdf` dependency. Simple tabular layout with:
- Project name, job number, date range header
- Billing address and job site address
- Labor and materials tables
- Grand total footer

### File Changes Summary

| File | Change |
|------|--------|
| `supabase/migrations/...` | Add `bill_rate` column to `project_members` |
| `src/types/job-cost-report.ts` | New type definitions |
| `src/hooks/useJobCostReport.ts` | New data hook |
| `src/pages/JobCostReport.tsx` | New page component |
| `src/components/job-cost/JobCostExportCSV.tsx` | CSV export button |
| `src/components/job-cost/JobCostExportPDF.tsx` | PDF export button |
| `src/components/users/EditUserRoleModal.tsx` | Add bill rate field |
| `src/App.tsx` | Add route |

