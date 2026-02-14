# QA Gauntlet v1.5 — Adversarial Audit Report

> **Auditor**: AI Senior QA / Postgres Engineer  
> **Date**: 2026-02-14  
> **Verdict**: ❌ **FAIL**  
> **Confidence**: **38%**  
> **P0 Blockers**: 8  
> **P1 Weaknesses**: 6  

---

## 1️⃣ Spec Lock Consistency Audit

### Contradictions Found

| # | Issue | Location | Severity | Proposed Fix |
|---|-------|----------|----------|--------------|
| 1 | Negative tests say "expect empty or error" instead of asserting explicit error codes | QA_GAUNTLET §3 (NEG-* tests) | **P1** | Every negative test MUST assert a specific HTTP status (403) or Postgres error code (42501), never "empty or error" |
| 2 | No negative test for Worker attempting `INSERT INTO user_roles` or `UPDATE project_members.role` | Missing from §3 and §7 | **P0** | Add NEG-ROLE-01: Worker calls `INSERT INTO user_roles` → expect RLS denial (42501). Add NEG-ROLE-02: Worker calls `UPDATE project_members SET role = 'admin'` → expect RLS denial |
| 3 | UI gate for "Setup Wizard" says PM+ but no RLS policy on `project_settings` is referenced | §3 PERM-SETUP-01 vs actual RLS | **P1** | Document which RLS policy enforces this or add one |

---

## 2️⃣ Status / Enum Integrity Audit

### Mismatches Found

| # | Issue | Location | Severity | Fix |
|---|-------|----------|----------|-----|
| 1 | `item_type = 'task'` used in `generate_tasks_from_scope` RPC filter, but SPEC_LOCK and all seed data use `item_type = 'labor'` | RPC body vs `docs/SPEC_LOCK.md` §scope_item_types, seed recipes §2 | **P0** | Either change RPC to filter `item_type = 'labor'` OR update SPEC_LOCK + seeds to include `'task'` type. Must be one canonical value. |
| 2 | Task status tests reference `'completed'` and `'cancelled'` but DB enum is `'done'` and task has no `'cancelled'` value | §1 test matrix TASK-* tests | **P0** | Replace `'completed'` → `'done'` in all test assertions. Remove or clarify `'cancelled'` — it doesn't exist in the enum. |
| 3 | Receipt tests reference `receipts.status` column with values `'approved'`, `'rejected'` | §6 RPT-RCPT-* tests | **P0** | Column is `review_status` with values `'reviewed'`, `'flagged'`, `'pending'`. Update all receipt test references. |

---

## 3️⃣ Time Entry Inclusion Contract Audit

### Contract (from §5)

```
status = 'closed'
AND check_out_at IS NOT NULL
AND duration_hours IS NOT NULL
AND duration_hours > 0
```

### Inconsistencies Found

| # | Issue | RPC / Location | Severity |
|---|-------|----------------|----------|
| 1 | `project_actual_costs` RPC does NOT filter `duration_hours > 0` — it only checks `status = 'closed'` | RPC body in migration | **P0** |
| 2 | `project_task_actual_hours` RPC does NOT filter `check_out_at IS NOT NULL` | RPC body in migration | **P0** |
| 3 | `v_project_progress` view uses `status = 'closed'` but doesn't enforce `duration_hours > 0` | View definition | **P1** |
| 4 | No negative test seeds a row with `status='closed'` + `duration_hours = 0` to confirm exclusion | §2 seed data | **P1** |

### Required Fix

All RPCs and views that aggregate time data MUST use the full 4-clause inclusion predicate. Add seed row with `duration_hours = 0, status = 'closed'` and assert it is excluded from every aggregation.

---

## 4️⃣ Snapshot Time Boundary Audit

### Issues Found

| # | Issue | Severity |
|---|-------|----------|
| 1 | `captured_at` is defined in snapshot tables but no test asserts that a time entry created AFTER `captured_at` is excluded from that snapshot | **P1** |
| 2 | Race-4 test says "run edge function 10× concurrently" but doesn't define what `captured_at` each run uses — if they all use `now()`, the UPSERT key (`project_id, snapshot_date`) handles it, but `captured_at` will be last-writer-wins | **P1** |
| 3 | No test verifies that a snapshot generated at 23:59 vs 00:01 captures the correct day's data | **P1** |

### Verdict

Snapshot boundaries are implicitly correct via UPSERT but not explicitly tested. No P0 here, but three P1 gaps.

---

## 5️⃣ Reporting Traceability Audit

### Spot Checks (9 random selections)

| # | Metric | Source | SQL Reproducible? | Tolerance | Verdict |
|---|--------|--------|-------------------|-----------|---------|
| 1 | KPI: Total Budget | `project_financial_snapshots.budget_total` | ✅ `SELECT budget_total FROM project_financial_snapshots WHERE project_id = $1 ORDER BY snapshot_date DESC LIMIT 1` | ±$0.01 | **PASS** |
| 2 | KPI: Actual Cost | `project_financial_snapshots.actual_total_cost` | ✅ `SELECT actual_total_cost FROM ...` | ±$0.01 | **PASS** |
| 3 | KPI: Hours Logged | `project_financial_snapshots.actual_hours` | ✅ `SELECT actual_hours FROM ...` | Exact | **PASS** |
| 4 | Variance Table: Labor Variance | `actual_labor_cost - budget_labor_cost` | ✅ Derived from snapshot columns | ±$0.01 | **PASS** |
| 5 | Variance Table: Material Variance | `actual_material_cost - budget_material_cost` | ✅ | ±$0.01 | **PASS** |
| 6 | Chart: Cost Trend | `project_financial_snapshots` time series | ✅ `SELECT snapshot_date, actual_total_cost FROM ... ORDER BY snapshot_date` | ±$0.01 | **PASS** |
| 7 | Chart: Margin Trend | `actual_margin_percent` series | ✅ | ±0.1% | **PASS** |
| 8 | CSV: Receipt Total | Sum of `receipts.total_amount` | ⚠️ Uses `WHERE status = 'approved'` but column is `review_status` and value should be `'reviewed'` | — | **FAIL** |
| 9 | Recommendation: Over-budget trigger | `actual_total_cost > budget_total * 1.1` | ⚠️ Threshold documented but receipt inclusion uses wrong column filter | — | **FAIL** |

### Result: 7/9 PASS, 2/9 FAIL (receipt column confusion)

---

## 6️⃣ SECURITY DEFINER & RLS Audit

### Issues Found

| # | Issue | Severity |
|---|-------|----------|
| 1 | `generate_tasks_from_scope` uses `SECURITY DEFINER` and checks `EXISTS(SELECT 1 FROM project_members WHERE project_id = p_project_id AND user_id = auth.uid())` — **correct** | OK |
| 2 | `collect-weekly-snapshots` edge function runs as service role — no per-user auth check needed (cron job) — **correct** | OK |
| 3 | No test verifies that calling `generate_tasks_from_scope` with a `project_id` from another org raises an error (not just 0 rows) | **P0** |
| 4 | `assign_time_entry_task` — no explicit test that the task's `project_id` matches the time entry's `project_id` | **P0** |
| 5 | Snapshot tables (`project_financial_snapshots`, `org_financial_snapshots`) — no test confirms direct INSERT is blocked by RLS for non-service-role | **P1** |

---

## 7️⃣ AI Insight Integrity Audit

### Issues Found

| # | Issue | Severity |
|---|-------|----------|
| 1 | Tests HEV-01 through HEV-06 verify that `EVIDENCE` JSON exists and has required keys, but do NOT cross-check that numeric values in the narrative text match EVIDENCE values | **P0** |
| 2 | No test parses the `content.narrative` string to extract numbers and compare against `content.evidence` | **P0** |
| 3 | `input_hash` idempotency test (HEV-05) exists but doesn't verify determinism — it only checks the hash is present, not that same input → same hash | **P1** |
| 4 | Role restriction for regeneration (HEV-06) exists and asserts PM+ only — **correct** | OK |

### Required Fix

Add a programmatic test that:
1. Extracts all `$X,XXX` and `XX%` patterns from `narrative`
2. Asserts each exists in `evidence` JSON
3. Fails if any narrative number has no evidence source

---

## 8️⃣ Seed Data Coherence Audit

### Issues Found

| # | Issue | Severity |
|---|-------|----------|
| 1 | Seed INSERT for `time_entries` omits `project_timezone` which is `NOT NULL` with no default | **P0** |
| 2 | Seed uses `item_type = 'labor'` for scope items but RPC filters `item_type = 'task'` — seeds will never match | **P0** (same as §2 #1) |
| 3 | Seed receipt data uses `status: 'approved'` but column is `review_status` | **P1** (same as §2 #3) |
| 4 | No seed creates a `duration_hours = 0` closed entry for negative testing | **P1** |

---

## 9️⃣ Abuse & Tamper Audit

### Coverage Check

| Scenario | Test Exists? | Severity if Missing |
|----------|-------------|---------------------|
| Mutating invoice snapshot after sent/paid | ✅ INV-SNAP-03 | — |
| Cross-project time assignment | ❌ No explicit test | **P0** |
| Duplicate task generation under concurrency | ✅ Race-1, Race-2 | — |
| Snapshot duplication under cron race | ✅ Race-4 | — |
| Backfill limits enforced | ✅ TIME-BF-01 | — |
| Worker self-role-escalation | ❌ No test | **P0** |
| Cross-org scope generation | ❌ No explicit test | **P0** |

---

## 🔟 Final Verdict

### ❌ FAIL — Confidence: 38%

### P0 Blockers (8)

| # | Summary |
|---|---------|
| P0-1 | `item_type = 'task'` vs `'labor'` mismatch — all task generation tests silently return 0 results |
| P0-2 | Task status enum references `'completed'`/`'cancelled'` — these don't exist in the DB |
| P0-3 | Receipt column `status` vs `review_status` with wrong enum values — corrupts financial trust tests |
| P0-4 | `project_actual_costs` RPC missing `duration_hours > 0` filter — violates Time Entry Inclusion Contract |
| P0-5 | `project_task_actual_hours` RPC missing `check_out_at IS NOT NULL` filter |
| P0-6 | No cross-org test for `generate_tasks_from_scope` — expects error, not silence |
| P0-7 | AI narrative numbers not cross-checked against EVIDENCE JSON — hallucinations undetectable |
| P0-8 | Seed `time_entries` missing `project_timezone` NOT NULL column — seeds will fail to insert |

### P1 Weaknesses (6)

| # | Summary |
|---|---------|
| P1-1 | Negative tests use "empty or error" instead of explicit error codes |
| P1-2 | No `duration_hours = 0` seed row for negative aggregation testing |
| P1-3 | Snapshot time boundary tests don't assert cross-midnight correctness |
| P1-4 | `input_hash` idempotency test doesn't verify determinism |
| P1-5 | Snapshot tables lack direct-INSERT RLS denial tests |
| P1-6 | `v_project_progress` view doesn't enforce full inclusion contract |

### Biggest Systemic Risk

The fundamental disconnect between the database schema and QA specifications — particularly `item_type = 'task'` vs `'labor'` and `receipts.status` vs `receipts.review_status` — means the two most business-critical features (automated task generation from scope and financial reporting from receipts) are being tested against phantom columns and values that don't exist. Every test that touches these paths is silently passing with zero rows rather than failing loudly with wrong data, creating a false sense of correctness. Until the schema, RPCs, seeds, and test assertions are aligned to a single canonical source of truth, the QA Gauntlet provides no release confidence.
