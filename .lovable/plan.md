

## Organization Financial Enforcement Setting

This adds a per-organization setting that controls how strictly the financial integrity gate behaves -- from advisory (current default soft friction) up to strict phase gating (hard block, no override allowed).

---

### 1. Database Migration

**A. Add column to `organizations`**

```sql
ALTER TABLE public.organizations
  ADD COLUMN financial_enforcement_level text NOT NULL DEFAULT 'advisory'
  CHECK (financial_enforcement_level IN ('advisory', 'strict_reporting', 'strict_phase_gating'));
```

**B. Extend `estimate_variance_summary` RPC**

Add the `financial_enforcement_level` to the returned JSON object at the top level so the client can read it:

```sql
-- Inside the RETURN jsonb_build_object(...), add:
'financial_enforcement_level', v_enforcement_level
```

The function will read the value from `organizations` alongside the existing `base_currency` fetch.

**C. Extend `rpc_request_phase_advance` with hard gate**

Add a block after requirements validation but before the status update:

```text
IF v_enforcement_level = 'strict_phase_gating' THEN
  -- Fetch integrity from estimate_variance_summary
  IF v_integrity_status = 'blocked' THEN
    RAISE EXCEPTION 'Financial integrity is blocked. Override not allowed under strict gating.'
      USING ERRCODE = '42501';
  END IF;
END IF;
```

This applies only to phases that are financially gated (`foreman_approve`, `pm_closeout`).

**D. Extend `rpc_send_invoice` with hard gate**

Same check: if enforcement is `strict_phase_gating` and integrity is `blocked`, raise an exception.

**E. Extend `rpc_log_financial_override`**

Reject override attempts when enforcement is `strict_phase_gating`:

```text
IF v_enforcement_level = 'strict_phase_gating' AND v_integrity_status = 'blocked' THEN
  RAISE EXCEPTION 'Override not permitted under strict phase gating' USING ERRCODE = '42501';
END IF;
```

---

### 2. Frontend Changes

**A. `useProjectIntegrity.ts`**

Parse and expose the new `financial_enforcement_level` field from the RPC response alongside the existing integrity data.

Update `IntegrityData` type to include `enforcementLevel: 'advisory' | 'strict_reporting' | 'strict_phase_gating'`.

**B. `FinancialIntegrityGate.tsx`**

Modify behavior based on enforcement level:

| Level | `blocked` status | `needs_attention` status |
|-------|-----------------|------------------------|
| `advisory` | Show modal with override option (current behavior) | Show modal with override option |
| `strict_reporting` | Show modal with override option (same as advisory) | Show modal with override option |
| `strict_phase_gating` | Show modal with NO override -- only "Fix Issues" button. "Continue Anyway" is hidden. | Show modal with override option |

The key UI difference: when `strict_phase_gating` + `blocked`, the "Continue Anyway" button is removed entirely. The user can only click "Fix Issues" or close the modal (which cancels).

**C. No admin UI for toggling the setting yet**

The column defaults to `advisory`. Changing it requires a direct database update for now. An admin settings UI can be added later without any schema changes.

---

### 3. Files to Create/Edit

| Action | File |
|--------|------|
| Create | `supabase/migrations/[timestamp]_financial_enforcement_level.sql` |
| Edit | `src/hooks/useProjectIntegrity.ts` -- expose `enforcementLevel` |
| Edit | `src/components/FinancialIntegrityGate.tsx` -- conditional override hiding |

The three integration points (Workflow.tsx, SendInvoiceModal.tsx, ProjectStatusDropdown.tsx) do NOT need changes -- the gate component handles all enforcement logic internally. Server-side RPCs provide the hard block as a second layer of defense.

---

### 4. Technical Notes

- The server-side hard block in `rpc_request_phase_advance` and `rpc_send_invoice` is the true enforcement layer. The frontend hiding of "Continue Anyway" is a UX convenience -- even if bypassed, the server will reject the action.
- `strict_reporting` behaves identically to `advisory` in terms of allowed actions. The distinction exists for future reporting/audit features that can filter by enforcement level.
- Only `foreman_approve` and `pm_closeout` phases are checked in `rpc_request_phase_advance` (matching the existing `needsIntegrityGate` logic). Other phases pass through without financial checks.
- The column uses TEXT + CHECK constraint (not an enum) as specified, making future values additive without migration complexity.

