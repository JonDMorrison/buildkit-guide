# Spec Lock — Single Source of Truth for QA

> **Version**: 1.0 · **Date**: 2026-02-13 · **Status**: CANONICAL — all QA tests MUST reference this document.

---

## Table of Contents

1. [Contradictions Detected & Resolved](#1-contradictions-detected--resolved)
2. [Permissions Spec](#2-permissions-spec)
3. [Status/Enum Truth Table](#3-statusenum-truth-table)
4. [P0 Invalid Status/Enum Tests](#4-p0-invalid-statusenum-tests)

---

## 1. Contradictions Detected & Resolved

### C-1: `projects.status` — No DB Enum Constraint

**Problem**: `projects.status` is typed as `string` in the DB (no Postgres enum). The QA doc references values `'active'`, `'completed'`, `'on_hold'`, `'deleted'` but nothing at the DB level enforces these. Any string can be written.

**QA Doc Reference**: A-009 mentions `status!='deleted'`; A-011 mentions `p_status_filter='active'`; seed data uses `'active'` and `'deleted'`.

**Resolution**: `projects.status` is APP-ENFORCED ONLY. Valid values are `active | completed | on_hold | deleted`. A CHECK constraint or enum should be added. Until then, P0 tests must verify the app rejects invalid values at the API/UI layer.

**⚠ RECOMMENDED FIX**: Add `CHECK (status IN ('active','completed','on_hold','deleted'))` constraint on `projects.status`.

---

### C-2: `time_entries.status` — No DB Enum Constraint

**Problem**: `time_entries.status` is `string` (no enum). App uses `'open'` and `'closed'` but DB accepts anything.

**QA Doc Reference**: A-003, F-002, F-004 all filter by `status='closed'`. Edge functions write `'open'` and `'closed'`.

**Resolution**: Valid values are `open | closed`. APP-ENFORCED ONLY via edge functions.

**⚠ RECOMMENDED FIX**: Add `CHECK (status IN ('open','closed'))` constraint.

---

### C-3: `project_scope_items.item_type` — No DB Enum Constraint

**Problem**: `item_type` is `string`. Seed data uses `'labor'` only. No enum or CHECK.

**Resolution**: Valid values are `labor | material | equipment | subcontract | other`. APP-ENFORCED ONLY.

**⚠ RECOMMENDED FIX**: Add CHECK constraint.

---

### C-4: `receipts` Status Column Naming

**Problem**: The QA doc references `receipts.status` (e.g., §5.2 `status = 'approved'`), but the actual column is `receipts.review_status` with DB enum `receipt_review_status` containing `pending | reviewed | processed`. There is NO `'approved'` value.

**QA Doc Reference**: §5.2 uses `WHERE status = 'approved'` — this is **WRONG** and will return 0 rows.

**Resolution**: The correct filter is `WHERE review_status = 'reviewed'` or `WHERE review_status = 'processed'` (depending on business intent). The QA doc must be corrected.

**⚠ CORRECTED RULE**: Receipts included in actuals cost should use `review_status IN ('reviewed', 'processed')` or no filter (count all receipts). Verify with `project_actual_costs` RPC implementation.

---

### C-5: Task Status `'pending'` in Seed Data vs Enum

**Problem**: Seed data in §2.4 uses `status = 'pending'` for a task, but the DB enum `task_status` only allows `not_started | in_progress | blocked | done`. `'pending'` is INVALID and will fail on insert.

**QA Doc Reference**: Line 317 seed: `(:task2_id, :proj1_id, 'Wire outlets', 'pending', :scope2_id, 20)`.

**Resolution**: Change to `'not_started'`. This is a bug in the QA doc seed data.

---

### C-6: Task Status `'completed'` in Race Test vs Enum

**Problem**: Race Test §4 "Race 2" references `status = 'completed'` but the enum only has `done`. `'completed'` is INVALID.

**QA Doc Reference**: Line 459: "Foreman updates task status to 'completed'"; Line 464: checks `status = 'completed'`.

**Resolution**: Change to `'done'`.

---

### C-7: Organization Role Mismatch — `'worker'` in Seed vs App Roles

**Problem**: Seed data uses `organization_memberships.role = 'worker'` but this is a free-text field. The QA doc Permission Grid header says "Worker" but the app_role enum (used in `project_members`) has `internal_worker` and `external_trade`, NOT `worker`.

**Resolution**: `organization_memberships.role` is a free-text string (not the `app_role` enum). Valid org-level roles are: `admin | pm | foreman | worker | accounting | hr`. The `app_role` enum (`admin | project_manager | foreman | internal_worker | external_trade | accounting`) is used ONLY in `project_members.role` and `user_roles.role`.

---

### C-8: Permission Grid Uses "Foreman" for Both Org and Project

**Problem**: The grid lists Foreman as able to create budgets and scope items (✅), but the RLS policies on `project_budgets` and `project_scope_items` use `can_manage_project()` which requires `is_admin()` OR `has_project_role(_, _, 'project_manager')`. Foreman is NOT included.

**QA Doc Reference**: §3 grid rows for "Create budget", "Edit budget", "Create scope item" show Foreman ✅.

**Resolution**: Foreman CANNOT create/edit budgets or scope items unless the RPC/RLS is updated. The QA doc is **WRONG**. Corrected in the Permissions Spec below.

---

### C-9: `'accounting'` App Role Added but Not in Original Enum

**Problem**: The `app_role` enum was originally created with 5 values. A 6th value `'accounting'` was added later. The QA doc §3 does not account for the Accounting role in the Permission Grid.

**Resolution**: The Accounting role is now canonical. Included in the Permissions Spec below.

---

## 2. Permissions Spec

### 2.1 Role Definitions

| Abbreviation | Org-Level Role | Project-Level Role (`app_role`) | Notes |
|---|---|---|---|
| **GA** | Global Admin | `admin` (in `user_roles`) | Full system access |
| **OA** | Org Admin | `admin` (in `org_memberships`) | Full org access |
| **PM** | Org PM | `project_manager` (in `project_members`) | Manages assigned projects |
| **FM** | Org Foreman | `foreman` (in `project_members`) | Field leadership on assigned projects |
| **IW** | Org Worker | `internal_worker` (in `project_members`) | Horizon staff |
| **ET** | — | `external_trade` (in `project_members`) | Subcontractor |
| **AC** | Accounting | `accounting` (in `project_members` or `user_roles`) | Financial access |
| **HR** | HR | `hr` (in `org_memberships`) | Payroll/timesheet access |

### 2.2 Surface Permissions

| Surface / Action | GA | OA | PM | FM | IW | ET | AC | HR | Enforcement |
|---|---|---|---|---|---|---|---|---|---|
| **`/insights` (portfolio)** — View | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | UI gate + RLS on `project_financial_snapshots` |
| **`/insights/project` (project)** — View | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | UI gate + RLS on snapshots + budget |
| **`/data-health`** — View | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | UI gate (NoAccess component) |
| **`/insights/snapshots`** — View | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | UI gate + RLS |
| **Budget tab — Create** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | RLS (`can_manage_project`) |
| **Budget tab — Edit** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | RLS (`can_manage_project`) |
| **Scope item — Create** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | RLS (`can_manage_project`) |
| **Scope item — Edit** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | RLS (`can_manage_project`) |
| **Generate tasks from scope** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | RPC (`SECURITY DEFINER`, checks `can_manage_project`) |
| **Assign time entry to task** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | RPC (`SECURITY DEFINER`, role check) |
| **Invoice snapshot update buttons** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | UI gate (draft only) + RLS |
| **CSV export (portfolio)** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | UI gate (client-side generation) |
| **CSV export (project)** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | UI gate |
| **AI regenerate insight** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | UI gate |
| **Weekly digest — received** | ✅* | ✅* | ✅* | ❌ | ❌ | ❌ | ❌ | ❌ | Edge function role filter + `notification_preferences.weekly_digest` |

> \* Only if `weekly_digest = true` in `notification_preferences`.

### 2.3 Enforcement Legend

| Symbol | Meaning |
|---|---|
| **UI gate** | Frontend component hides/disables the action. NOT sufficient alone for security. |
| **RLS** | Row-Level Security policy on the table. Enforced at DB level. |
| **RPC** | `SECURITY DEFINER` function with explicit role checks. Enforced at DB level. |
| **All** | UI gate + RLS or RPC. Defense in depth. |

### 2.4 Negative Test Matrix

| # | Actor | Action | Expected | Enforcement Layer |
|---|---|---|---|---|
| N-01 | Worker | `generate_tasks_from_scope` via API | RPC error or empty result | RPC |
| N-02 | Worker | `assign_time_entry_task` via API | Permission error | RPC |
| N-03 | Foreman | INSERT into `project_budgets` | RLS violation | RLS |
| N-04 | Non-org user | SELECT `project_financial_snapshots` | 0 rows | RLS |
| N-05 | PM | INSERT into `project_financial_snapshots` | RLS violation | RLS |
| N-06 | Worker | Navigate to `/data-health` | NoAccess component | UI gate |
| N-07 | Worker | Navigate to `/insights` | NoAccess component | UI gate |
| N-08 | Foreman | `project_portfolio_report` for other org | 0 rows | RLS + RPC |
| N-09 | Foreman | INSERT into `project_scope_items` | RLS violation | RLS |
| N-10 | Foreman | UPDATE `project_budgets` | RLS violation | RLS |
| N-11 | External Trade | SELECT `project_budgets` for project | 0 rows (RLS) | RLS |
| N-12 | Accounting | `generate_tasks_from_scope` | Denied | RPC |

---

## 3. Status/Enum Truth Table

### 3.1 DB-Enforced Enums (Postgres `CREATE TYPE`)

These are enforced at the database level. Invalid values are **rejected by Postgres** with a type error.

| Table.Column | Enum Name | Allowed Values | Enforced By |
|---|---|---|---|
| `tasks.status` | `task_status` | `not_started`, `in_progress`, `blocked`, `done` | DB enum |
| `invoices.status` | `invoice_status` | `draft`, `sent`, `paid`, `overdue`, `void` | DB enum |
| `deficiencies.status` | `deficiency_status` | `open`, `in_progress`, `fixed`, `verified` | DB enum |
| `safety_forms.status` | `safety_status` | `draft`, `submitted`, `reviewed` | DB enum |
| `notifications.type` | `notification_type` | `task_assigned`, `blocker_added`, `safety_alert`, `manpower_request`, `general`, `blocker_cleared`, `manpower_approved`, `manpower_denied`, `deficiency_created`, `document_uploaded`, `incident_report` | DB enum |
| `receipts.category` | `receipt_category` | `fuel`, `materials`, `tools`, `meals`, `lodging`, `other` | DB enum |
| `receipts.review_status` | `receipt_review_status` | `pending`, `reviewed`, `processed` | DB enum |
| `project_members.role` | `app_role` | `admin`, `project_manager`, `foreman`, `internal_worker`, `external_trade`, `accounting` | DB enum |
| `user_roles.role` | `app_role` | (same as above) | DB enum |

### 3.2 App-Enforced Strings (No DB Constraint)

These columns are `text`/`varchar` with NO enum or CHECK. Invalid values are silently accepted by the DB.

| Table.Column | Expected Values (per app code) | Risk | Recommended Fix |
|---|---|---|---|
| `projects.status` | `active`, `completed`, `on_hold`, `deleted` | Any string accepted; RPCs may break with unexpected values | Add CHECK constraint |
| `time_entries.status` | `open`, `closed` | Any string accepted; cost calculations may miscount | Add CHECK constraint |
| `time_entries.source` | `gps`, `manual`, `manual_adjustment`, `offline_sync` | Any string accepted | Add CHECK constraint |
| `time_entries.closed_method` | `self`, `auto_close`, `force`, `admin` | Any string accepted | Add CHECK constraint |
| `project_scope_items.item_type` | `labor`, `material`, `equipment`, `subcontract`, `other` | Any string accepted | Add CHECK constraint |
| `project_scope_items.source_type` | `manual`, `import` | Any string accepted | Add CHECK constraint |
| `time_adjustment_requests.status` | `pending`, `approved`, `denied`, `cancelled` | Any string accepted | Add CHECK constraint |
| `time_adjustment_requests.request_type` | `missed_check_in`, `missed_check_out`, `add_manual_entry`, `change_times`, `change_job_site`, `add_note` | Any string accepted | Add CHECK constraint |
| `organization_memberships.role` | `admin`, `pm`, `foreman`, `worker`, `accounting`, `hr` | Any string accepted; role checks may fail silently | Add CHECK constraint |
| `manpower_requests.status` | `pending`, `approved`, `denied` | Any string accepted | Add CHECK constraint |
| `timesheet_periods.status` | `open`, `submitted`, `approved`, `locked` | Any string accepted; state machine RPCs assume specific values | Add CHECK constraint |

### 3.3 Cross-Reference: QA Doc Values vs DB Reality

| QA Doc Value | Column | DB Type | ✅ Valid? | Fix Required |
|---|---|---|---|---|
| `'active'` | projects.status | string | ✅ (app convention) | Add CHECK |
| `'deleted'` | projects.status | string | ✅ (app convention) | Add CHECK |
| `'completed'` | tasks.status | task_status enum | ❌ **INVALID** | Use `'done'` |
| `'pending'` | tasks.status | task_status enum | ❌ **INVALID** | Use `'not_started'` |
| `'approved'` | receipts.status | N/A | ❌ **COLUMN DOESN'T EXIST** | Use `review_status IN ('reviewed','processed')` |
| `'closed'` | time_entries.status | string | ✅ (app convention) | Add CHECK |
| `'open'` | time_entries.status | string | ✅ (app convention) | Add CHECK |
| `'labor'` | project_scope_items.item_type | string | ✅ (app convention) | Add CHECK |
| `'worker'` | org_memberships.role | string | ✅ (app convention) | Add CHECK |

---

## 4. P0 Invalid Status/Enum Tests

These tests attempt to write invalid enum/status values and confirm the DB rejects them.

### 4.1 DB-Enum Rejection Tests (Must Fail at DB Level)

| Test ID | Table | Column | Invalid Value | Expected Error | Sev |
|---|---|---|---|---|---|
| SL-001 | tasks | status | `'pending'` | `invalid input value for enum task_status: "pending"` | P0 |
| SL-002 | tasks | status | `'completed'` | `invalid input value for enum task_status: "completed"` | P0 |
| SL-003 | tasks | status | `'cancelled'` | `invalid input value for enum task_status: "cancelled"` | P0 |
| SL-004 | invoices | status | `'cancelled'` | `invalid input value for enum invoice_status: "cancelled"` | P0 |
| SL-005 | invoices | status | `'pending'` | `invalid input value for enum invoice_status: "pending"` | P0 |
| SL-006 | invoices | status | `'approved'` | `invalid input value for enum invoice_status: "approved"` | P0 |
| SL-007 | deficiencies | status | `'closed'` | `invalid input value for enum deficiency_status: "closed"` | P0 |
| SL-008 | deficiencies | status | `'resolved'` | `invalid input value for enum deficiency_status: "resolved"` | P0 |
| SL-009 | safety_forms | status | `'approved'` | `invalid input value for enum safety_status: "approved"` | P0 |
| SL-010 | safety_forms | status | `'completed'` | `invalid input value for enum safety_status: "completed"` | P0 |
| SL-011 | receipts | review_status | `'approved'` | `invalid input value for enum receipt_review_status: "approved"` | P0 |
| SL-012 | receipts | review_status | `'rejected'` | `invalid input value for enum receipt_review_status: "rejected"` | P0 |
| SL-013 | receipts | category | `'equipment'` | `invalid input value for enum receipt_category: "equipment"` | P0 |
| SL-014 | project_members | role | `'worker'` | `invalid input value for enum app_role: "worker"` | P0 |
| SL-015 | project_members | role | `'manager'` | `invalid input value for enum app_role: "manager"` | P0 |
| SL-016 | notifications | type | `'reminder'` | `invalid input value for enum notification_type: "reminder"` | P0 |

### 4.2 App-Enforced String Tests (Currently Accepted — Flags Missing Constraints)

These tests document that the DB does NOT reject invalid values. Each test is a P0 gap that should be closed with a CHECK constraint.

| Test ID | Table | Column | Invalid Value | Current Behavior | Target Behavior | Sev |
|---|---|---|---|---|---|---|
| SL-017 | projects | status | `'archived'` | ✅ Accepted (BUG) | Should reject | P0 |
| SL-018 | projects | status | `''` (empty) | ✅ Accepted (BUG) | Should reject | P0 |
| SL-019 | time_entries | status | `'pending'` | ✅ Accepted (BUG) | Should reject | P0 |
| SL-020 | time_entries | status | `'approved'` | ✅ Accepted (BUG) | Should reject | P0 |
| SL-021 | project_scope_items | item_type | `'service'` | ✅ Accepted (BUG) | Should reject | P0 |
| SL-022 | organization_memberships | role | `'superadmin'` | ✅ Accepted (BUG) | Should reject | P0 |
| SL-023 | time_adjustment_requests | status | `'expired'` | ✅ Accepted (BUG) | Should reject | P0 |
| SL-024 | timesheet_periods | status | `'rejected'` | ✅ Accepted (BUG) | Should reject | P0 |
| SL-025 | manpower_requests | status | `'cancelled'` | ✅ Accepted (BUG) | Should reject | P0 |

### 4.3 SQL Verification Queries

```sql
-- SL-001: Task with invalid enum
INSERT INTO tasks (project_id, title, status, created_by)
VALUES (:pid, 'Test', 'pending', :uid);
-- Expected: ERROR invalid input value for enum task_status

-- SL-004: Invoice with invalid enum
INSERT INTO invoices (invoice_number, organization_id, created_by, status)
VALUES ('TEST-001', :org_id, :uid, 'cancelled');
-- Expected: ERROR invalid input value for enum invoice_status

-- SL-011: Receipt with invalid review_status
UPDATE receipts SET review_status = 'approved' WHERE id = :rid;
-- Expected: ERROR invalid input value for enum receipt_review_status

-- SL-014: Project member with invalid role
INSERT INTO project_members (user_id, project_id, role)
VALUES (:uid, :pid, 'worker');
-- Expected: ERROR invalid input value for enum app_role

-- SL-017: Project with invalid status (SHOULD fail but currently doesn't)
UPDATE projects SET status = 'archived' WHERE id = :pid;
-- Current: SUCCESS (no constraint)
-- Target: ERROR new row violates check constraint

-- SL-019: Time entry with invalid status (SHOULD fail but currently doesn't)
UPDATE time_entries SET status = 'pending' WHERE id = :teid;
-- Current: SUCCESS (no constraint)
-- Target: ERROR new row violates check constraint
```

---

## Appendix: Recommended Migration to Close Gaps

```sql
-- Add CHECK constraints for app-enforced strings
-- Run AFTER verifying no existing rows violate these constraints

ALTER TABLE projects
  ADD CONSTRAINT chk_projects_status
  CHECK (status IN ('active', 'completed', 'on_hold', 'deleted'));

ALTER TABLE time_entries
  ADD CONSTRAINT chk_time_entries_status
  CHECK (status IN ('open', 'closed'));

ALTER TABLE project_scope_items
  ADD CONSTRAINT chk_scope_items_item_type
  CHECK (item_type IN ('labor', 'material', 'equipment', 'subcontract', 'other'));

ALTER TABLE organization_memberships
  ADD CONSTRAINT chk_org_memberships_role
  CHECK (role IN ('admin', 'pm', 'foreman', 'worker', 'accounting', 'hr'));

ALTER TABLE time_adjustment_requests
  ADD CONSTRAINT chk_time_adj_status
  CHECK (status IN ('pending', 'approved', 'denied', 'cancelled'));

ALTER TABLE time_adjustment_requests
  ADD CONSTRAINT chk_time_adj_request_type
  CHECK (request_type IN ('missed_check_in', 'missed_check_out', 'add_manual_entry', 'change_times', 'change_job_site', 'add_note'));

ALTER TABLE timesheet_periods
  ADD CONSTRAINT chk_timesheet_status
  CHECK (status IN ('open', 'submitted', 'approved', 'locked'));

ALTER TABLE manpower_requests
  ADD CONSTRAINT chk_manpower_status
  CHECK (status IN ('pending', 'approved', 'denied'));
```

---

*End of Spec Lock v1.0*
