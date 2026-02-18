

## Financial Integrity Override System (Soft Gating)

This feature adds soft friction modals at three financial checkpoints. When a project's financial integrity is not "clean", users see a warning modal with the option to acknowledge the issues and continue, logging their override reason for audit purposes.

---

### 1. Database Migration

**New table: `financial_integrity_overrides`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | default gen_random_uuid() |
| organization_id | uuid NOT NULL | FK to organizations |
| project_id | uuid NOT NULL | FK to projects |
| triggered_at | timestamptz | default now() |
| triggered_by | uuid NOT NULL | FK to auth.users |
| checkpoint | text NOT NULL | CHECK IN ('pm_approval','invoice_send','project_close') |
| integrity_status | text NOT NULL | |
| integrity_score | integer NOT NULL | |
| blockers | jsonb NOT NULL | |
| override_reason | text NOT NULL | |
| created_at | timestamptz | default now() |

- RLS enabled + FORCE ROW LEVEL SECURITY
- SELECT policy: org-scoped via `has_org_membership(organization_id)`
- No INSERT/UPDATE/DELETE policies for authenticated role (writes go through RPC only)

**New RPC: `rpc_log_financial_override`**

SECURITY DEFINER function that:
1. Validates caller has org membership via `has_project_access`
2. Validates caller role is admin or project_manager
3. Validates `p_checkpoint` is one of the three allowed values
4. Calls `estimate_variance_summary(p_project_id)` to fetch current integrity state
5. Inserts a row into `financial_integrity_overrides`
6. Returns `true`

---

### 2. Frontend: Reusable Modal Component

**New file: `src/components/FinancialIntegrityGate.tsx`**

A reusable dialog component that encapsulates the entire soft-friction flow:

```text
Props:
  - projectId: string
  - checkpoint: 'pm_approval' | 'invoice_send' | 'project_close'
  - onProceed: () => void          -- called after clean pass or successful override
  - onCancel: () => void
  - trigger: () => void            -- imperative open method via ref or state
```

**Modal behavior:**
1. When triggered, fetches integrity via existing `useProjectIntegrity` hook
2. If status is `clean` -- calls `onProceed()` immediately (no modal shown)
3. If `needs_attention` or `blocked` -- shows the warning modal:
   - Warning icon + "Financial Integrity Warning" title
   - Status badge (reuses existing `IntegrityBadge`)
   - Score display
   - Blockers list
   - Two buttons: "Fix Issues" (navigates to `/estimates`) and "Continue Anyway"
   - Clicking "Continue Anyway" reveals a textarea requiring 10+ character reason
   - Submit calls `rpc_log_financial_override`, then `onProceed()`

**New hook: `src/hooks/useFinancialOverride.ts`**

A small hook wrapping the RPC call with loading/error state via `useMutation`.

---

### 3. Integration Points

**A. Workflow Phase Advance (PM Approval checkpoint)**

File: `src/pages/Workflow.tsx` -- `PhaseCard` component

- Intercept the "Request Approval" and "Mark Complete" button clicks
- For phases that represent PM approval (specifically the `foreman_approve` and `pm_closeout` phase keys), wrap the action with the integrity gate
- If integrity is clean, proceed as before; otherwise show the modal

**B. Invoice Send checkpoint**

File: `src/components/invoicing/SendInvoiceModal.tsx`

- Wrap the `handleSend` function with the integrity gate
- Before executing the existing send logic, check integrity
- The gate modal appears over the send modal if needed

**C. Project Close checkpoint**

File: `src/components/ProjectStatusDropdown.tsx`

- Intercept status change to `completed` or `archived`
- Before calling `rpc_update_project_status`, run the integrity gate
- If clean, proceed; otherwise show the modal with checkpoint `project_close`

---

### 4. Files to Create/Edit

| Action | File |
|--------|------|
| Create | `supabase/migrations/[timestamp]_financial_integrity_overrides.sql` |
| Create | `src/components/FinancialIntegrityGate.tsx` |
| Create | `src/hooks/useFinancialOverride.ts` |
| Edit | `src/pages/Workflow.tsx` -- wrap phase advance buttons |
| Edit | `src/components/invoicing/SendInvoiceModal.tsx` -- wrap send action |
| Edit | `src/components/ProjectStatusDropdown.tsx` -- wrap close/archive |

### 5. Technical Details

- The modal component uses existing UI primitives: `Dialog`, `AlertTriangle`, `Textarea`, `Button`, `IntegrityBadge`
- The `useProjectIntegrity` hook is reused as-is for fetching integrity data
- The override RPC fetches integrity server-side independently (not trusting client values) to ensure the logged snapshot is authentic
- Minimum reason length (10 chars) is enforced client-side with the submit button disabled until met

