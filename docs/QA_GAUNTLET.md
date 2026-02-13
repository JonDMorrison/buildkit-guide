# QA Gauntlet — Full-Stack Test Plan

> **Version**: 1.1 · **Date**: 2026-02-13 · **Scope**: Budget-to-Execution Intelligence, Estimate Accuracy, Task Automation, Client Hierarchy, Invoice Snapshots, Task-Level Time Tracking, Data Health, Snapshots/Trends/Recommendations/AI, Time Entry Inclusion Contract

---

## Table of Contents

1. [Test Matrix (120+ cases)](#1-test-matrix)
2. [Seed Data Recipes](#2-seed-data-recipes)
3. [Role & Permission Gauntlet](#3-role--permission-gauntlet)
4. [Concurrency & Race Tests](#4-concurrency--race-tests)
5. [Time Entry Inclusion Contract](#5-time-entry-inclusion-contract)
6. [Reporting Trust Tests](#6-reporting-trust-tests)
7. [Security & Data Isolation Tests](#7-security--data-isolation-tests)
8. [Regression Checklist](#8-regression-checklist)
9. [Acceptance Gate](#9-acceptance-gate)

---

## 1. Test Matrix

### A — Budget-to-Execution Intelligence

| Test ID | Scenario Name | Roles | Preconditions / Seed Data | Steps | Expected Result | Failure Modes | SQL Verification | Sev |
|---------|--------------|-------|--------------------------|-------|----------------|---------------|-----------------|-----|
| A-001 | Create project budget with all cost fields | Admin | Project exists, no budget | 1. Navigate to Project Overview → Budget tab 2. Fill all planned fields (labor_hours=100, labor_cost=5000, material=3000, machine=1000, other=500) 3. Set contract_value=15000 4. Save | Budget row created with planned_total_cost = 5000+3000+1000+500 = 9500 | planned_total_cost not computed; contract_value=0 default | `SELECT planned_labor_cost+planned_material_cost+planned_machine_cost+planned_other_cost AS computed, planned_total_cost FROM project_budgets WHERE project_id=:pid` — must be ≤ $0.01 diff | P0 |
| A-002 | Update budget re-computes planned_total | PM | Budget exists | 1. Change planned_material_cost from 3000→5000 2. Save | planned_total_cost increases by 2000 | Stale cache; trigger not firing | Same query as A-001 | P0 |
| A-003 | project_actual_costs RPC — labor from closed time entries only | Admin | 5 time entries: 3 closed (total 24h), 2 open | 1. Call `project_actual_costs(:pid)` | actual_labor_hours = 24 (excludes open entries) | Open entries counted | `SELECT SUM(duration_hours) FROM time_entries WHERE project_id=:pid AND status='closed'` vs RPC result | P0 |
| A-004 | project_actual_costs — cost_rate=0 flagged | Admin | 2 closed entries: user1 rate=$50, user2 rate=$0 | 1. Call RPC | labor_hours_missing_cost_rate = user2's hours; actual_labor_cost uses only user1 rate×hours | $0 entries counted in cost | Compare `labor_hours_missing_cost_rate` output to manual count | P0 |
| A-005 | project_actual_costs — receipts by cost_type | Admin | Receipts: 2 material ($100,$200), 1 machine ($150), 1 other ($50), 1 NULL cost_type ($75) | 1. Call RPC | material=300, machine=150, other=50, unclassified=75 | NULL cost_type summed into other | `SELECT cost_type, SUM(amount) FROM receipts WHERE project_id=:pid GROUP BY cost_type` | P0 |
| A-006 | project_actual_costs — membership check | Admin | Worker with time entries but NOT in project_members | 1. Call RPC | labor_hours_missing_membership > 0 | Not detected | `SELECT COUNT(*) FROM time_entries te WHERE te.project_id=:pid AND te.status='closed' AND NOT EXISTS (SELECT 1 FROM project_members pm WHERE pm.user_id=te.user_id AND pm.project_id=te.project_id)` | P1 |
| A-007 | project_variance_summary composition | Admin | Budget + actuals seeded | 1. Call `project_variance_summary(:pid)` | labor_cost_delta = planned_labor_cost - actual_labor_cost; total_cost_delta = planned_total - actual_total; margins computed correctly | Sign convention inverted | See Trust Tests §5 | P0 |
| A-008 | project_invoicing_summary strict vs relaxed | Admin | 3 invoices: 1 sent ($1000), 1 paid ($2000), 1 draft ($500). contract_value=10000 | 1. Call `project_invoicing_summary(:pid, false, false)` | strict: sent+paid = $3000, billed_pct=30%. 2. Call with include_drafts=true | relaxed includes draft: $3500, 35% | Draft counted in strict | `SELECT status, SUM(total) FROM invoices WHERE project_id=:pid GROUP BY status` | P0 |
| A-009 | project_portfolio_report — aggregation across projects | Admin | 3 projects (1 with budget, 1 without, 1 deleted) | 1. Call `project_portfolio_report(:org_id)` | Only active projects returned; project without budget shows 0 for planned fields | Deleted projects included; division by zero on 0 budget | `SELECT COUNT(*) FROM projects WHERE organization_id=:org_id AND status!='deleted'` vs row count | P0 |
| A-010 | portfolio_report — pagination | Admin | 15 projects | 1. Call with p_limit=5, p_offset=0 2. Then p_offset=5 3. Then p_offset=10 | 5,5,5 rows respectively; no duplicates across pages | Duplicate rows; wrong offset | Union all pages, `SELECT COUNT(DISTINCT project_id)` = 15 | P1 |
| A-011 | portfolio_report — status filter | Admin | Projects: 2 active, 1 completed, 1 on_hold | 1. Call with p_status_filter='active' | Only 2 rows | Filter ignored | Count result rows | P1 |
| A-012 | Budget with contract_value=0 | Admin | Budget exists, contract_value=0 | 1. View variance summary | margin_percent should be 0% (not NaN/Infinity); UI shows "N/A" or 0% | Division by zero crash | `SELECT actual_margin_percent FROM project_variance_summary(:pid)` | P0 |
| A-013 | Budget with all planned costs = 0 | Admin | Budget exists, all planned fields = 0 | 1. View variance | total_cost_delta = -actual_total; no division errors | Crash on 0 denominator | Check delta_pct fields aren't NaN | P1 |

### B — Estimate Accuracy Learning Engine

| Test ID | Scenario | Roles | Preconditions | Steps | Expected | Failure Modes | SQL Verification | Sev |
|---------|----------|-------|---------------|-------|----------|---------------|-----------------|-----|
| B-001 | Portfolio Insights page loads KPIs | Admin | 5 projects with budgets, 2 without | 1. Navigate /insights | KPIs show: total projects (7), projects with budgets (5), aggregate planned vs actual | Missing-budget projects pollute KPIs | Count "Excluded from KPIs" badge = 2 | P0 |
| B-002 | Portfolio leaderboard sort by variance | PM | 5 projects with varying cost deltas | 1. Load /insights 2. Click column header to sort | Sorted correctly ascending/descending | Sort on string not number | Visual check + extract values | P1 |
| B-003 | Portfolio filter by status | PM | Projects: active, completed, on_hold | 1. Select "Active" filter | Only active projects shown | Filter doesn't propagate to RPC | Row count matches | P1 |
| B-004 | Portfolio filter by data quality | PM | Projects with/without budget, with/without missing rates | 1. Toggle "Has Issues" filter | Only projects with data quality flags shown | Filter logic inverted | Check each shown project has ≥1 flag | P1 |
| B-005 | Portfolio CSV export | Admin | 10 projects loaded | 1. Click "Export CSV" | CSV downloads with correct headers; missing-budget projects show "Not set" for planned columns; diagnostic columns present | Headers mismatch; numbers formatted wrong | Open CSV, verify column count and sample values | P1 |
| B-006 | Portfolio CSV — blank budget values | Admin | Project without budget | 1. Export CSV | Planned columns show "Not set" or empty, NOT "0" | Shows 0 misleadingly | Inspect CSV cell | P1 |
| B-007 | Portfolio "Updating…" state | PM | Slow network (throttle) | 1. Load /insights 2. Change filter while loading | "Updating…" indicator appears; previous data stays visible (no flash to empty) | Content disappears during refetch | Visual check | P2 |
| B-008 | Portfolio empty state | PM | Org with 0 projects | 1. Navigate /insights | Empty state message, no crash | JS error on empty array | Console check | P1 |
| B-009 | Project Estimate Accuracy — KPI cards | PM | Project with budget; actuals exist | 1. Navigate /insights/project?projectId=:pid | Cards show: Planned Cost, Actual Cost, Variance $, Variance %, Margin | Wrong sign on delta | Compare to `project_variance_summary` RPC | P0 |
| B-010 | Project Estimate Accuracy — variance breakdown table | PM | Budget + actuals with all cost types | 1. View breakdown table | Rows for Labor, Material, Machine, Other; each shows planned/actual/delta | Missing row for a category | Sum of breakdown = total | P0 |
| B-011 | Project Estimate Accuracy — diagnostics alerts | PM | Missing cost rates > 5h, unclassified > $500 | 1. View project page | Yellow/orange alert banners appear with correct counts | Alerts not shown | Match to RPC diagnostics fields | P1 |
| B-012 | Project Estimate Accuracy — no budget | PM | Project without budget | 1. Navigate to project insights | "Budget Required" badge shown; KPI cards show "Not set"; no crash | Crash on null budget | Console check | P0 |
| B-013 | Project CSV export | PM | Project with full data | 1. Export CSV | All fields present and accurate | Missing columns | Verify headers | P1 |

### C — Task Automation from Scope

| Test ID | Scenario | Roles | Preconditions | Steps | Expected | Failure Modes | SQL Verification | Sev |
|---------|----------|-------|---------------|-------|----------|---------------|-----------------|-----|
| C-001 | Create scope item | PM | Project exists | 1. Navigate to Scope tab 2. Add item: name="Framing", hours=40, unit_rate=75, material=500, machine=200 | Row created; planned_total auto-computed = (1×40×75)+500+200 = 3700 | Trigger not firing | `SELECT planned_total FROM project_scope_items WHERE name='Framing' AND project_id=:pid` | P0 |
| C-002 | Edit scope item recalculates planned_total | PM | Scope item exists | 1. Change quantity from 1→2 | planned_total = (2×40×75)+500+200 = 6700 | Stale total | Same query | P0 |
| C-003 | Sort scope items | PM | 3 scope items | 1. Drag item 3 to position 1 | sort_order updated for all 3 items | sort_order collision | `SELECT name, sort_order FROM project_scope_items WHERE project_id=:pid ORDER BY sort_order` | P2 |
| C-004 | Archive scope item | PM | Scope item with no linked tasks | 1. Archive item | is_archived=true, archived_at set | archived_at null | `SELECT is_archived, archived_at FROM project_scope_items WHERE id=:sid` | P1 |
| C-005 | Unarchive scope item | PM | Archived scope item | 1. Unarchive | is_archived=false, archived_at=null | archived_at persists | Same query | P1 |
| C-006 | Hard delete scope item — no linked tasks | PM | Scope item, 0 tasks linked | 1. Delete item | Row removed | Not deleted | `SELECT COUNT(*) FROM project_scope_items WHERE id=:sid` = 0 | P1 |
| C-007 | Hard delete scope item — linked tasks exist | PM | Scope item linked to 2 tasks | 1. Attempt delete | Error: "Cannot delete scope item with linked tasks" | Silent success leaving orphaned tasks | Error message shown + `SELECT COUNT(*) FROM project_scope_items WHERE id=:sid` = 1 | P0 |
| C-008 | preview_tasks_from_scope — create_missing mode | PM | 3 scope items, 1 already has a task | 1. Call `preview_tasks_from_scope(:pid, 'create_missing')` | Returns 2 rows with action='create'; existing item shows action='skip' or absent | Shows 3 creates (would duplicate) | Count action='create' | P0 |
| C-009 | generate_tasks_from_scope — create_missing | PM | 3 scope items, 1 has task | 1. Call `generate_tasks_from_scope(:pid, 'create_missing')` | 2 new tasks created; scope_item_id set; planned_hours from scope item | Duplicate tasks; wrong planned_hours | `SELECT t.title, t.planned_hours, t.scope_item_id FROM tasks t JOIN project_scope_items si ON t.scope_item_id=si.id WHERE t.project_id=:pid` | P0 |
| C-010 | generate_tasks — idempotency | PM | Already generated tasks | 1. Call create_missing again | 0 new tasks created | Duplicates | `SELECT COUNT(*) FROM tasks WHERE project_id=:pid` unchanged | P0 |
| C-011 | generate_tasks — sync_existing mode | PM | Scope item hours changed from 40→60; linked task has planned_hours=40 | 1. Call `generate_tasks_from_scope(:pid, 'sync_existing')` | Task's planned_hours updated to 60 | Not synced | `SELECT planned_hours FROM tasks WHERE scope_item_id=:sid` | P1 |
| C-012 | Planned hours canonicalization | PM | Task with planned_hours=10, budgeted_hours=20, estimated_hours=30 | 1. View task | Display shows 10 (planned_hours takes priority) | Shows estimated_hours instead | Check UI display | P1 |
| C-013 | Generated task badge in UI | PM | Task generated from scope | 1. View task list | "Generated" badge visible on task card | Badge missing | Visual check | P2 |
| C-014 | Navigate from task to scope tab | PM | Task with scope_item_id | 1. Click "View Scope Item" link on task | Navigates to Scope tab with item highlighted | Broken link; 404 | URL check | P2 |
| C-015 | Generate from archived scope items | PM | 1 active, 1 archived scope item | 1. Call create_missing | Only active item generates task | Archived items generate tasks | `SELECT COUNT(*) FROM tasks WHERE scope_item_id=:archived_sid` = 0 | P1 |

### D — Parent/Child Customer Model

| Test ID | Scenario | Roles | Preconditions | Steps | Expected | Failure Modes | SQL Verification | Sev |
|---------|----------|-------|---------------|-------|----------|---------------|-----------------|-----|
| D-001 | Create client with all fields | Admin | Org exists | 1. Create client: name, GST, AP contact (name/email/phone), PM contact, site contact, zones=3 | All fields persisted | Fields truncated or not saved | `SELECT gst_number, ap_contact_name, ap_email, zones FROM clients WHERE id=:cid` | P1 |
| D-002 | Set parent client | Admin | Parent client + child client in same org | 1. Edit child → select parent | parent_client_id set | Parent from different org selectable | `SELECT parent_client_id FROM clients WHERE id=:child_id` | P0 |
| D-003 | Prevent self-parent | Admin | Client exists | 1. Try to set parent = self | Error: rejected | Self-reference created | `SELECT id, parent_client_id FROM clients WHERE id=:cid` — must differ | P0 |
| D-004 | Prevent cross-org parent | Admin | Client in org1, parent candidate in org2 | 1. Try setting parent from org2 | Error: "Parent client must belong to the same organization" | Cross-org parent set | Check trigger `enforce_client_parent_org_match` fires | P0 |
| D-005 | Prevent parent cycle (A→B→A) | Admin | A.parent=B | 1. Try B.parent=A | Error or prevention | Cycle created | `WITH RECURSIVE ... SELECT` cycle detection query | P0 |
| D-006 | Archive client | Admin | Client with no children, not on active projects | 1. Set is_active=false | Client archived | Active invoices still reference | `SELECT is_active FROM clients WHERE id=:cid` = false | P1 |
| D-007 | Archive parent with active children warning | Admin | Parent with 2 active child clients | 1. Attempt archive parent | UI warns "Has active children"; requires confirmation | Silent archive; children orphaned | `SELECT COUNT(*) FROM clients WHERE parent_client_id=:pid AND is_active=true` | P1 |
| D-008 | "Has active children" badge | Admin | Parent with 1 active child | 1. View clients list | Badge shown next to parent | Badge missing | Visual check | P2 |
| D-009 | Reactivate archived client | Admin | Archived client | 1. Set is_active=true | Client reactivated | Fails silently | `SELECT is_active FROM clients WHERE id=:cid` = true | P2 |
| D-010 | Project client selector — active only default | PM | 3 active clients, 2 archived | 1. Open project client dropdown | Only 3 active shown | Archived clients shown | Count dropdown options | P1 |
| D-011 | Project client selector — include archived toggle | PM | Same as D-010 | 1. Toggle "Include archived" | All 5 shown; archived ones marked | Toggle doesn't work | Count options = 5 | P1 |
| D-012 | Client zones field | Admin | Client with zones=5 | 1. View client | Zones displayed correctly | Shows default 1 | `SELECT zones FROM clients WHERE id=:cid` = 5 | P2 |

### E — Invoice Snapshot Stability + Email

| Test ID | Scenario | Roles | Preconditions | Steps | Expected | Failure Modes | SQL Verification | Sev |
|---------|----------|-------|---------------|-------|----------|---------------|-----------------|-----|
| E-001 | Create invoice persists billing snapshot | PM | Project with parent client (parent has billing address); project has location | 1. Create invoice for project | bill_to_client_id = parent, bill_to_name = parent name, bill_to_address = parent billing, ship_to_address = project location, send_to_emails populated | Snapshot fields null | `SELECT bill_to_client_id, bill_to_name, bill_to_address, ship_to_address, send_to_emails FROM invoices WHERE id=:inv_id` | P0 |
| E-002 | Change parent customer after invoice created | Admin | Invoice exists with snapshot | 1. Change project's client to a different parent 2. View existing invoice | Invoice still shows ORIGINAL customer/address | Invoice shows new customer | Same query — values unchanged | P0 |
| E-003 | Change project location after invoice created | Admin | Invoice with ship_to_address | 1. Change project address 2. View existing invoice | ship_to_address unchanged on invoice | Address mutated | Same query | P0 |
| E-004 | Draft invoice "Update from Customer" | PM | Draft invoice with stale snapshot; customer address changed | 1. Click "Update from Customer/Project" | Snapshot fields updated to current customer data | Doesn't update; or updates sent invoices too | `SELECT bill_to_address FROM invoices WHERE id=:inv_id` matches new address | P1 |
| E-005 | Sent invoice — "Update" button hidden/disabled | PM | Invoice status='sent' | 1. View invoice detail | "Update from Customer" button not present or disabled | Button allows mutating sent invoice | Visual check | P0 |
| E-006 | Paid invoice — snapshot immutable | Admin | Invoice status='paid' | 1. Attempt any snapshot update via API | Rejected or no-op | Snapshot changed | Query snapshot fields before/after | P0 |
| E-007 | Older invoice without snapshots — populate workflow | Admin | Invoice created before snapshot fields existed (all null) | 1. View invoice 2. Click "Populate snapshot" | Snapshot populated from current client/project data | Button absent; crash on null client | `SELECT bill_to_name FROM invoices WHERE id=:inv_id` not null after | P1 |
| E-008 | SendInvoiceModal — default emails | PM | Invoice with send_to_emails='a@x.com, b@x.com' | 1. Open send modal | Email field pre-populated with 'a@x.com, b@x.com' | Empty field; wrong emails | Visual check | P1 |
| E-009 | SendInvoiceModal — invalid email blocked | PM | Invoice ready to send | 1. Type 'notanemail' in email field 2. Click send | Validation error shown; send blocked | Email sent to invalid address | Check error state | P0 |
| E-010 | SendInvoiceModal — comma-separated valid | PM | Ready invoice | 1. Enter 'a@x.com, b@y.com' 2. Send | Both emails receive invoice | Only first email sent | Check Resend logs or response | P1 |
| E-011 | SendInvoiceModal — persists final email list | PM | Invoice with original send_to_emails='a@x.com' | 1. Change to 'a@x.com, c@x.com' 2. Send | invoice.send_to_emails updated to 'a@x.com, c@x.com' | Original preserved; new emails lost | `SELECT send_to_emails FROM invoices WHERE id=:inv_id` | P1 |
| E-012 | Invoice void status — snapshot unchanged | Admin | Sent invoice | 1. Void invoice | Status='void'; snapshot fields preserved | Snapshot cleared | Query snapshot fields | P1 |

### F — Task-Level Time Tracking + Scope Variance

| Test ID | Scenario | Roles | Preconditions | Steps | Expected | Failure Modes | SQL Verification | Sev |
|---------|----------|-------|---------------|-------|----------|---------------|-----------------|-----|
| F-001 | Check-in with task_id | Worker | Task assigned to worker; job site configured | 1. Check in via UI 2. Select task | time_entry.task_id = selected task | task_id null | `SELECT task_id FROM time_entries WHERE id=:entry_id` | P0 |
| F-002 | project_task_actual_hours RPC | Admin | 3 tasks with closed time entries (8h, 4h, 2h) | 1. Call RPC | Returns 3 rows with correct hours | Open entries counted; wrong grouping | `SELECT task_id, SUM(duration_hours) FROM time_entries WHERE project_id=:pid AND status='closed' GROUP BY task_id` matches RPC | P0 |
| F-003 | ScopeItemVarianceTable — planned vs actual by scope item | PM | 2 scope items with linked tasks and time entries | 1. View table | Each scope item shows correct planned_hours (from scope) and actual_hours (from time entries via tasks) | actual_hours from wrong source | Cross-check RPC output | P0 |
| F-004 | Coverage strip — total/linked/unassigned | PM | 100h total closed time; 70h with task_id; 30h without | 1. View coverage strip | Total=100h, Linked=70h (70%), Unassigned=30h (30%) | Percentages wrong; open entries counted | `SELECT SUM(CASE WHEN task_id IS NOT NULL THEN duration_hours ELSE 0 END) AS linked, SUM(CASE WHEN task_id IS NULL THEN duration_hours ELSE 0 END) AS unassigned FROM time_entries WHERE project_id=:pid AND status='closed'` | P1 |
| F-005 | Unassigned modal — list entries without task | PM | 5 time entries without task_id | 1. Click unassigned count 2. View modal | Lists 5 entries with user, date, hours, job_site | Missing entries; shows assigned ones | Visual + count check | P1 |
| F-006 | Assign time entry to task — Admin/PM | Admin | Unassigned time entry; task in same project | 1. Click assign 2. Select task | task_id updated; entry moves from unassigned to linked | Assignment fails; wrong task | `SELECT task_id FROM time_entries WHERE id=:entry_id` = :task_id | P0 |
| F-007 | Assign time entry — Worker denied | Worker | Same setup | 1. Attempt assign via UI or direct RPC | Denied | Worker can assign | RPC should raise exception | P0 |
| F-008 | assign_time_entry_task — cross-project blocked | Admin | Time entry in project A; task in project B | 1. Call RPC with cross-project IDs | Error: project mismatch | Assignment succeeds across projects | RPC error check | P0 |
| F-009 | Scope variance — task with 0 time entries | PM | Scope item → task with 0 time entries | 1. View variance table | actual_hours=0; delta=-planned_hours; delta_pct=-100% | Crash on division; null display | Visual check | P1 |

### G — Data Health Panel

| Test ID | Scenario | Roles | Preconditions | Steps | Expected | Failure Modes | SQL Verification | Sev |
|---------|----------|-------|---------------|-------|----------|---------------|-----------------|-----|
| G-001 | Access control — Admin can view | Admin | Navigate to /data-health | Page loads with all sections | 403 or blank | — | P0 |
| G-002 | Access control — Worker denied | Worker | Navigate to /data-health | Redirect or "No Access" component | Page loads with data | — | P0 |
| G-003 | Missing cost rates section | Admin | 3 users with cost_rate=0 and time entries in last 30 days | 1. View section | Lists 3 users with affected projects and hours | Users with cost_rate>0 shown | `SELECT pm.user_id FROM project_members pm WHERE pm.cost_rate=0 AND EXISTS(SELECT 1 FROM time_entries te WHERE te.user_id=pm.user_id AND te.created_at > now()-interval '30 days')` | P1 |
| G-004 | Unmatched time entries section | Admin | Time entries where user not in project_members | 1. View section | Shows count and entries | Not detected | See A-006 query | P1 |
| G-005 | Unclassified receipts section | Admin | Receipts with NULL cost_type across 2 projects | 1. View section | Groups by project; shows totals | Wrong totals | `SELECT project_id, COUNT(*), SUM(amount) FROM receipts WHERE cost_type IS NULL GROUP BY project_id` | P1 |
| G-006 | Active projects missing budgets | Admin | 3 active projects, 1 without budget | 1. View section | Shows 1 project with "Create Budget" CTA | Shows projects with budgets | `SELECT p.id FROM projects p WHERE p.status='active' AND NOT EXISTS (SELECT 1 FROM project_budgets pb WHERE pb.project_id=p.id)` | P1 |
| G-007 | Create Budget CTA navigates correctly | Admin | Missing budget listed | 1. Click "Create Budget" | Navigates to project's budget tab | Broken link | URL check | P2 |
| G-008 | Links from Insights → Data Health | Admin | Recommendation with data_quality category | 1. Click "Fix" link on recommendation | Navigates to /data-health | 404 or wrong page | URL check | P2 |
| G-009 | Data Health → back to Insights | Admin | On Data Health page | 1. Click breadcrumb/back link | Returns to Insights | Broken navigation | URL check | P2 |

### H — Snapshots + Trends + Recommendations + AI

| Test ID | Scenario | Roles | Preconditions | Steps | Expected | Failure Modes | SQL Verification | Sev |
|---------|----------|-------|---------------|-------|----------|---------------|-----------------|-----|
| H-001 | generate_project_financial_snapshot — creates snapshot | Admin | Project with budget + actuals | 1. Call RPC with today's date | Snapshot row created with all metrics matching current RPC outputs | Snapshot metrics differ from live RPCs | `SELECT * FROM project_financial_snapshots WHERE project_id=:pid AND snapshot_date=:date` cross-check each field with variance_summary | P0 |
| H-002 | Snapshot upsert idempotency | Admin | Snapshot exists for date | 1. Call generate again for same date | Row updated in-place (no duplicate) | Duplicate row; unique constraint error | `SELECT COUNT(*) FROM project_financial_snapshots WHERE project_id=:pid AND snapshot_date=:date` = 1 | P0 |
| H-003 | Snapshot RLS — org member can read | PM | Snapshot exists | 1. Query as PM in org | Data returned | RLS blocks read | Supabase client query | P0 |
| H-004 | Snapshot RLS — non-member blocked | Worker (diff org) | Snapshot exists | 1. Query as user not in org | Empty result | Data leaked | Supabase client query returns 0 rows | P0 |
| H-005 | Snapshot RLS — users cannot insert directly | PM | — | 1. Attempt direct INSERT into project_financial_snapshots | RLS blocks insert | User can insert arbitrary data | Expect error | P0 |
| H-006 | generate_org_financial_snapshot | Admin | 3 projects with snapshots for same date | 1. Call org snapshot RPC | Aggregated row: totals = sum of project snapshots | Aggregation wrong | `SELECT SUM(actual_total_cost) FROM project_financial_snapshots WHERE organization_id=:org_id AND snapshot_date=:date` vs org snapshot actual_total_cost | P0 |
| H-007 | generate_weekly_snapshots_for_org | Admin | 5 active projects | 1. Call RPC | 5 project snapshots + 1 org snapshot created | Missing projects; no org snapshot | Count queries | P0 |
| H-008 | backfill_weekly_snapshots — last 4 weeks | Admin | Projects with historical data | 1. Call with p_weeks=4 | 4 weeks × (N projects + 1 org) snapshots created | Gaps in weekly data | `SELECT DISTINCT snapshot_date FROM project_financial_snapshots WHERE organization_id=:org_id ORDER BY snapshot_date` — 4 dates | P1 |
| H-009 | collect-weekly-snapshots cron edge function | System | Cron configured | 1. Invoke edge function with valid cron secret | Snapshots generated for all orgs | Auth failure; partial completion | Check edge function logs | P1 |
| H-010 | collect-weekly-snapshots — invalid cron secret | System | — | 1. Invoke with wrong secret | 401 response | Function executes | Response status check | P0 |
| H-011 | Org trend chart — margin over time | Admin | 8 weekly org snapshots | 1. View /insights | Margin trend chart shows 8 data points | Wrong x-axis; missing points | Visual + data count | P1 |
| H-012 | Project trend chart — planned vs actual | PM | 8 weekly project snapshots | 1. View project insights | Two lines showing planned and actual cost | Lines swapped; wrong scale | Visual check | P1 |
| H-013 | Recommendation: persistent labor overrun | System | Last 4 snapshots: labor_hours > 15% of planned in 3/4 weeks | 1. View recommendations | "Persistent Labor Overrun" warning appears | Not triggered; wrong threshold | Check rule engine output | P0 |
| H-014 | Recommendation: margin declining 3 weeks | System | 3 consecutive snapshots with decreasing margin | 1. View recommendations | "Margin Declining" critical alert | Not triggered; wrong sort | Check rule engine | P0 |
| H-015 | Recommendation: no budget | System | Project without budget | 1. View recommendations | "No Budget Defined" critical | Not shown | Check rule engine | P0 |
| H-016 | Recommendation: unclassified receipts > $500 | System | $750 unclassified | 1. View recommendations | Warning with $750 evidence | Threshold wrong | Check rule engine | P1 |
| H-017 | Recommendation links to correct fix path | PM | Recommendation with link to budget tab | 1. Click "Fix" | Navigates to correct URL with projectId | Broken link; wrong tab | URL check | P1 |
| H-018 | Portfolio recommendations — top 5 limit | Admin | 12 total recommendations across org | 1. View org recommendations panel | Shows exactly 5, sorted by severity (critical first) | Shows all 12; wrong sort | Count visible cards | P1 |
| H-019 | AI insight — idempotency via input_hash | Admin | Insight exists for same hash | 1. Regenerate insight with same data | Existing row updated, not duplicated | Duplicate rows | `SELECT COUNT(*) FROM ai_insights WHERE organization_id=:org_id AND input_hash=:hash` = 1 | P0 |
| H-020 | AI insight — no invented numbers | Admin | Snapshots with specific metrics | 1. Generate insight 2. Parse response | Every number in narrative exists in the input metrics JSON | AI hallucinated numbers | Manual audit of narrative vs input | P0 |
| H-021 | AI insight — regenerate button (Admin/PM only) | Worker | Insight exists | 1. View insight card | Regenerate button NOT shown for Worker | Worker can regenerate | Visual check | P1 |
| H-022 | Weekly digest email — opt-in preference | Admin | weekly_digest=true in notification_preferences | 1. Wait for Monday cron (or trigger manually) | Email received with top 5 recs + variance table | No email; wrong content | Check Resend delivery logs | P1 |
| H-023 | Weekly digest — non-admin excluded | Worker | weekly_digest=true but role=worker | 1. Cron fires | Worker does NOT receive email | Worker gets admin-level digest | Check sent count | P0 |
| H-024 | Weekly digest — opted-out admin | Admin | weekly_digest=false | 1. Cron fires | No email sent to this admin | Email sent despite opt-out | Check sent list | P1 |

### I — Cross-Cutting & Edge Cases

| Test ID | Scenario | Roles | Preconditions | Steps | Expected | Failure Modes | SQL Verification | Sev |
|---------|----------|-------|---------------|-------|----------|---------------|-----------------|-----|
| I-001 | Project with budget but $0 contract_value | PM | Budget exists, contract_value=0 | View all pages | No division-by-zero crashes; margin shows 0% or N/A | Infinity/NaN in UI | Console check | P0 |
| I-002 | Receipts without cost_type in all reports | Admin | 10 receipts, 3 NULL cost_type | All cost RPCs | unclassified_cost = sum of NULL receipts | Counted in other | RPC output check | P0 |
| I-003 | Deleted scope items excluded from generation | PM | is_archived=true scope item | generate_tasks_from_scope | No task created for archived item | Task created | Count check | P1 |
| I-004 | Invoice void — excluded from strict totals | Admin | Voided invoice | project_invoicing_summary | Not in strict or relaxed totals | Counted in totals | `SELECT status, SUM(total) FROM invoices WHERE project_id=:pid AND status='void'` not in RPC | P0 |
| I-005 | Time entry with duration_hours = 0 | Worker | Entry checked in and out at same time | All reports | 0h counted; no division errors | NaN in averages | Console check | P2 |
| I-006 | Very large dataset — 1000+ time entries | Admin | 1000 time entries for one project | Load all pages | No timeout; pagination works | 504 gateway timeout; 1000-row limit hit | Response times | P1 |
| I-007 | Loading states across all Insights pages | Any | Slow network | Navigate between pages | Skeleton loaders shown; no layout shift | Raw data flash; blank page | Visual check | P2 |
| I-008 | Empty state — project with budget but no actuals | PM | Budget exists, 0 time entries, 0 receipts | View project insights | All actuals show $0/0h; variance = 100% under; charts empty gracefully | Crash; misleading data | Console check | P1 |
| I-009 | Notification preferences — weekly_digest toggle | Admin | On /notification-settings | 1. Toggle weekly_digest on 2. Refresh page | Toggle persists as ON | Reverts to OFF; saves wrong field | `SELECT weekly_digest FROM notification_preferences WHERE user_id=:uid` | P1 |

---

## 2. Seed Data Recipes

### 2.1 Minimal Multi-Tenant Setup

```sql
-- ===== ORG 1: "Horizon Construction" (primary test org) =====
INSERT INTO organizations (id, name) VALUES
  (:org1_id, 'Horizon Construction');

-- Users (insert into auth.users first via Supabase dashboard, then profiles)
-- Profiles
INSERT INTO profiles (id, email, full_name) VALUES
  (:admin_uid, 'admin@horizon.test', 'Alice Admin'),
  (:pm_uid, 'pm@horizon.test', 'Pete PM'),
  (:foreman_uid, 'foreman@horizon.test', 'Frank Foreman'),
  (:worker_uid, 'worker@horizon.test', 'Will Worker'),
  (:acct_uid, 'acct@horizon.test', 'Accounting Amy');

-- Organization memberships
INSERT INTO organization_memberships (user_id, organization_id, role, is_active) VALUES
  (:admin_uid, :org1_id, 'admin', true),
  (:pm_uid, :org1_id, 'pm', true),
  (:foreman_uid, :org1_id, 'foreman', true),
  (:worker_uid, :org1_id, 'worker', true),
  (:acct_uid, :org1_id, 'accounting', true);

-- User roles (global)
INSERT INTO user_roles (user_id, role) VALUES
  (:admin_uid, 'admin');

-- ===== ORG 2: "Rival Builders" (cross-org isolation test) =====
INSERT INTO organizations (id, name) VALUES
  (:org2_id, 'Rival Builders');
INSERT INTO profiles (id, email, full_name) VALUES
  (:rival_uid, 'admin@rival.test', 'Rob Rival');
INSERT INTO organization_memberships (user_id, organization_id, role, is_active) VALUES
  (:rival_uid, :org2_id, 'admin', true);

-- ===== ORG 3: "Empty Corp" (empty state tests) =====
INSERT INTO organizations (id, name) VALUES
  (:org3_id, 'Empty Corp');
INSERT INTO organization_memberships (user_id, organization_id, role, is_active) VALUES
  (:admin_uid, :org3_id, 'admin', true);

-- ===== ORG 4: "Cycle Test LLC" (hierarchy cycle tests) =====
INSERT INTO organizations (id, name) VALUES
  (:org4_id, 'Cycle Test LLC');
INSERT INTO organization_memberships (user_id, organization_id, role, is_active) VALUES
  (:admin_uid, :org4_id, 'admin', true);
```

### 2.2 Projects + Budgets

```sql
-- Project WITH budget
INSERT INTO projects (id, name, organization_id, status, job_number) VALUES
  (:proj1_id, 'Tower Alpha', :org1_id, 'active', 'TA-001');

INSERT INTO project_budgets (project_id, organization_id, contract_value,
  planned_labor_hours, planned_labor_cost, planned_material_cost,
  planned_machine_cost, planned_other_cost) VALUES
  (:proj1_id, :org1_id, 50000, 200, 10000, 5000, 2000, 1000);

-- Project WITHOUT budget
INSERT INTO projects (id, name, organization_id, status, job_number) VALUES
  (:proj2_id, 'Garage Beta', :org1_id, 'active', 'GB-002');

-- Project in ORG 2 (isolation test)
INSERT INTO projects (id, name, organization_id, status) VALUES
  (:proj_rival_id, 'Rival Tower', :org2_id, 'active');

-- Deleted project (should be excluded from reports)
INSERT INTO projects (id, name, organization_id, status, is_deleted) VALUES
  (:proj_deleted_id, 'Demolished', :org1_id, 'deleted', true);

-- Project members
INSERT INTO project_members (user_id, project_id, role, cost_rate) VALUES
  (:admin_uid, :proj1_id, 'project_manager', 0),
  (:pm_uid, :proj1_id, 'project_manager', 75),
  (:foreman_uid, :proj1_id, 'foreman', 60),
  (:worker_uid, :proj1_id, 'worker', 45);
```

### 2.3 Clients (Parent/Child)

```sql
-- Parent client
INSERT INTO clients (id, name, organization_id, is_active,
  billing_address, gst_number, ap_contact_name, ap_email, zones) VALUES
  (:parent_client_id, 'Mega Corp', :org1_id, true,
   '100 King St, Toronto', 'GST-123456', 'Finance Dept', 'ap@megacorp.com', 3);

-- Child client
INSERT INTO clients (id, name, organization_id, is_active, parent_client_id) VALUES
  (:child_client_id, 'Mega Corp - Division A', :org1_id, true, :parent_client_id);

-- Archived client
INSERT INTO clients (id, name, organization_id, is_active) VALUES
  (:archived_client_id, 'Old Client', :org1_id, false);

-- Client in ORG 2 (cross-org cycle test)
INSERT INTO clients (id, name, organization_id, is_active) VALUES
  (:rival_client_id, 'Rival Client', :org2_id, true);

-- Clients in ORG 4 (cycle test)
INSERT INTO clients (id, name, organization_id, is_active) VALUES
  (:cycle_a_id, 'Cycle A', :org4_id, true),
  (:cycle_b_id, 'Cycle B', :org4_id, true);
UPDATE clients SET parent_client_id = :cycle_b_id WHERE id = :cycle_a_id;
-- Now attempt: UPDATE clients SET parent_client_id = :cycle_a_id WHERE id = :cycle_b_id;
-- → should fail (cycle)
```

### 2.4 Scope Items + Tasks + Time Entries

```sql
-- Scope items
INSERT INTO project_scope_items (id, project_id, organization_id, name,
  item_type, planned_hours, planned_unit_rate, planned_material_cost,
  planned_machine_cost, quantity, sort_order) VALUES
  (:scope1_id, :proj1_id, :org1_id, 'Framing', 'labor', 40, 75, 500, 200, 1, 1),
  (:scope2_id, :proj1_id, :org1_id, 'Electrical', 'labor', 20, 80, 300, 0, 1, 2),
  (:scope3_id, :proj1_id, :org1_id, 'Cleanup', 'labor', 10, 50, 0, 0, 1, 3);

-- Archived scope item
INSERT INTO project_scope_items (id, project_id, organization_id, name,
  item_type, planned_hours, is_archived, archived_at, sort_order) VALUES
  (:scope_archived_id, :proj1_id, :org1_id, 'Old Work', 'labor', 30, true, now(), 4);

-- Tasks linked to scope items
INSERT INTO tasks (id, project_id, title, status, scope_item_id, planned_hours) VALUES
  (:task1_id, :proj1_id, 'Frame walls', 'in_progress', :scope1_id, 40),
  (:task2_id, :proj1_id, 'Wire outlets', 'pending', :scope2_id, 20);

-- Task WITHOUT scope link (for unlinked coverage tests)
INSERT INTO tasks (id, project_id, title, status, planned_hours) VALUES
  (:task_unlinked_id, :proj1_id, 'General labor', 'in_progress', 8);

-- Time entries — closed, with task_id
INSERT INTO time_entries (id, organization_id, user_id, project_id, task_id,
  check_in_at, check_out_at, duration_hours, duration_minutes, status, source) VALUES
  (:te1_id, :org1_id, :worker_uid, :proj1_id, :task1_id,
   now()-interval '10h', now()-interval '2h', 8.0, 480, 'closed', 'self'),
  (:te2_id, :org1_id, :worker_uid, :proj1_id, :task2_id,
   now()-interval '26h', now()-interval '22h', 4.0, 240, 'closed', 'self');

-- Time entry — closed, NO task_id (unassigned)
INSERT INTO time_entries (id, organization_id, user_id, project_id, task_id,
  check_in_at, check_out_at, duration_hours, duration_minutes, status, source) VALUES
  (:te_unassigned_id, :org1_id, :worker_uid, :proj1_id, NULL,
   now()-interval '50h', now()-interval '48h', 2.0, 120, 'closed', 'self');

-- Time entry — OPEN (should be excluded from actuals)
INSERT INTO time_entries (id, organization_id, user_id, project_id,
  check_in_at, status, source) VALUES
  (:te_open_id, :org1_id, :worker_uid, :proj1_id,
   now()-interval '1h', 'open', 'self');
```

### 2.5 Receipts + Invoices

```sql
-- Receipts with various cost types
INSERT INTO receipts (id, project_id, organization_id, uploaded_by, amount, cost_type, status) VALUES
  (:rcpt1_id, :proj1_id, :org1_id, :worker_uid, 100.00, 'material', 'approved'),
  (:rcpt2_id, :proj1_id, :org1_id, :worker_uid, 200.00, 'material', 'approved'),
  (:rcpt3_id, :proj1_id, :org1_id, :worker_uid, 150.00, 'machine', 'approved'),
  (:rcpt4_id, :proj1_id, :org1_id, :worker_uid, 50.00, 'other', 'approved'),
  (:rcpt5_id, :proj1_id, :org1_id, :worker_uid, 75.00, NULL, 'approved'); -- unclassified

-- Invoices
INSERT INTO invoices (id, organization_id, project_id, invoice_number, status,
  subtotal, tax_amount, total, issue_date, created_by,
  bill_to_client_id, bill_to_name, bill_to_address, ship_to_address, send_to_emails) VALUES
  (:inv_sent_id, :org1_id, :proj1_id, 'INV-0001', 'sent',
   1000, 130, 1130, '2026-01-15', :pm_uid,
   :parent_client_id, 'Mega Corp', '100 King St', '200 Queen St', 'ap@megacorp.com'),
  (:inv_paid_id, :org1_id, :proj1_id, 'INV-0002', 'paid',
   2000, 260, 2260, '2026-01-01', :pm_uid,
   :parent_client_id, 'Mega Corp', '100 King St', '200 Queen St', 'ap@megacorp.com'),
  (:inv_draft_id, :org1_id, :proj1_id, 'INV-0003', 'draft',
   500, 65, 565, '2026-02-01', :pm_uid,
   NULL, NULL, NULL, NULL, NULL),
  (:inv_void_id, :org1_id, :proj1_id, 'INV-0004', 'void',
   800, 104, 904, '2026-01-20', :pm_uid,
   :parent_client_id, 'Mega Corp', '100 King St', '200 Queen St', NULL);
```

### 2.6 Notification Preferences

```sql
INSERT INTO notification_preferences (user_id, weekly_digest) VALUES
  (:admin_uid, true),
  (:pm_uid, true),
  (:worker_uid, true), -- should NOT receive digest (role check)
  (:foreman_uid, false);
```

---

## 3. Role & Permission Gauntlet

### Legend

- ✅ Allowed
- ❌ Denied
- 🔒 RLS enforced
- 🧩 RPC check
- 🖥️ UI gated

| Action | Global Admin | Org Admin | Org PM | Foreman | Worker | Accounting/HR |
|--------|:-----------:|:---------:|:------:|:-------:|:------:|:------------:|
| **View /insights** | ✅ 🖥️🔒 | ✅ 🖥️🔒 | ✅ 🖥️🔒 | ❌ 🖥️ | ❌ 🖥️ | ❌ 🖥️ |
| **View /insights/project** | ✅ | ✅ | ✅ (own projects) | ❌ 🖥️ | ❌ 🖥️ | ❌ 🖥️ |
| **View /data-health** | ✅ | ✅ | ✅ | ❌ 🖥️ | ❌ 🖥️ | ❌ 🖥️ |
| **Create budget** | ✅ 🔒 | ✅ 🔒 | ✅ 🔒 | ❌ 🔒 | ❌ 🔒 | ❌ 🔒 |
| **Edit budget** | ✅ 🔒 | ✅ 🔒 | ✅ 🔒 | ❌ 🔒 | ❌ 🔒 | ❌ 🔒 |
| **Create scope item** | ✅ 🔒 | ✅ 🔒 | ✅ 🔒 | ❌ 🔒 | ❌ 🔒 | ❌ 🔒 |
| **Generate tasks from scope** | ✅ 🧩 | ✅ 🧩 | ✅ 🧩 | ❌ 🧩 | ❌ 🧩 | ❌ 🧩 |
| **Assign time entry to task** | ✅ 🧩 | ✅ 🧩 | ✅ 🧩 | ❌ 🧩 | ❌ 🧩 | ❌ 🧩 |
| **Create client** | ✅ 🔒 | ✅ 🔒 | ✅ 🔒 | ❌ 🔒 | ❌ 🔒 | ❌ 🔒 |
| **Archive client** | ✅ 🔒 | ✅ 🔒 | ❌ 🔒 | ❌ 🔒 | ❌ 🔒 | ❌ 🔒 |
| **Create invoice** | ✅ 🔒 | ✅ 🔒 | ✅ 🔒 | ❌ 🔒 | ❌ 🔒 | ✅ 🔒 |
| **Send invoice** | ✅ 🔒 | ✅ 🔒 | ✅ 🔒 | ❌ 🔒 | ❌ 🔒 | ✅ 🔒 |
| **Void invoice** | ✅ 🔒 | ✅ 🔒 | ❌ 🔒 | ❌ 🔒 | ❌ 🔒 | ❌ 🔒 |
| **Regenerate AI insight** | ✅ 🖥️ | ✅ 🖥️ | ✅ 🖥️ | ❌ 🖥️ | ❌ 🖥️ | ❌ 🖥️ |
| **Export CSV (portfolio)** | ✅ 🖥️ | ✅ 🖥️ | ✅ 🖥️ | ❌ 🖥️ | ❌ 🖥️ | ❌ 🖥️ |
| **View snapshots** | ✅ 🔒 | ✅ 🔒 | ✅ 🔒 | ❌ 🔒 | ❌ 🔒 | ❌ 🔒 |
| **Insert snapshot directly** | ❌ 🔒 | ❌ 🔒 | ❌ 🔒 | ❌ 🔒 | ❌ 🔒 | ❌ 🔒 |
| **Weekly digest received** | ✅ (if opted in) | ✅ (if opted in) | ✅ (if opted in) | ❌ (role filter) | ❌ (role filter) | ❌ (role filter) |

### Negative Tests (must confirm denial)

| # | Test | Expected Error |
|---|------|---------------|
| N-01 | Worker calls `generate_tasks_from_scope` via Postman | RPC error or empty result (RLS blocks) |
| N-02 | Worker calls `assign_time_entry_task` | Permission error from RPC |
| N-03 | Foreman attempts INSERT into `project_budgets` | RLS violation |
| N-04 | Non-org user attempts SELECT on `project_financial_snapshots` | 0 rows returned |
| N-05 | PM attempts INSERT into `project_financial_snapshots` | RLS violation |
| N-06 | Worker navigates to `/data-health` | NoAccess component or redirect |
| N-07 | Worker navigates to `/insights` | NoAccess component or redirect |
| N-08 | Foreman calls `project_portfolio_report` for another org | 0 rows (org_id filter + RLS) |

---

## 4. Concurrency & Race Tests

### Race 1: Dual Task Generation from Scope

**Setup**: PM-A and PM-B both on project with 5 scope items, 0 existing tasks.

**Steps**:
1. PM-A calls `generate_tasks_from_scope(:pid, 'create_missing')` at T=0
2. PM-B calls same RPC at T=0+50ms

**Expected**: Exactly 5 tasks created (not 10). Second call should find existing tasks and skip.

**Detection**:
```sql
SELECT scope_item_id, COUNT(*) AS task_count
FROM tasks WHERE project_id = :pid
GROUP BY scope_item_id
HAVING COUNT(*) > 1;
-- Must return 0 rows
```

**Risk**: No advisory lock in RPC → duplicate tasks.

### Race 2: Sync While Foreman Updates Task

**Setup**: PM syncing scope (sync_existing mode), Foreman marking task complete simultaneously.

**Steps**:
1. Foreman updates task status to 'completed' at T=0
2. PM calls sync_existing at T=0+100ms (which updates planned_hours)

**Expected**: Task status = 'completed' AND planned_hours updated. Neither write lost.

**Detection**: `SELECT status, planned_hours FROM tasks WHERE id = :task_id` — both fields correct.

### Race 3: Assign Time Entry During Check-Out

**Setup**: Worker has open entry :te_id. PM tries to assign it to a task simultaneously with worker checking out.

**Steps**:
1. Worker calls `time-check-out` edge function at T=0
2. PM calls `assign_time_entry_task(:te_id, :task_id)` at T=0+50ms

**Expected**: Both succeed. Entry is closed AND has task_id assigned.

**Detection**: `SELECT status, task_id FROM time_entries WHERE id = :te_id` — status='closed', task_id=:task_id.

### Race 4: Snapshot Generation During Invoice Creation

**Setup**: Snapshot cron fires while PM is creating a new invoice.

**Steps**:
1. Cron calls `generate_weekly_snapshots_for_org` at T=0
2. PM creates invoice worth $5000 at T=0+200ms

**Expected**: Snapshot captures data as of T=0 (without new invoice). Next week's snapshot includes it. No crash.

**Detection**: Snapshot's invoiced_amount should not include the new $5000 invoice (timing-dependent; acceptable either way as long as no crash/corruption).

---

## 5. Time Entry Inclusion Contract

> **CANONICAL** — Every RPC/query that counts time MUST use this contract. Deviations are P0 bugs.

### 5A. Required Filters (the "Countable Entry" predicate)

A time entry is **countable** (included in actuals) if and only if ALL conditions hold:

| # | Condition | SQL Fragment | Rationale |
|---|-----------|-------------|-----------|
| 1 | Entry is closed | `status = 'closed'` | Open entries are in-progress; duration is not final |
| 2 | Duration is positive and non-NULL | `duration_hours IS NOT NULL AND duration_hours > 0` | NULL/zero/negative durations indicate corrupt or meaningless data |
| 3 | Check-out exists | `check_out_at IS NOT NULL` | Without check-out, duration is unreliable even if status='closed' |
| 4 | Entry is not soft-deleted | (no `is_deleted` column today — if added: `is_deleted = false`) | Future-proofing |

**Canonical WHERE clause** (copy-paste into every RPC):

```sql
WHERE te.project_id = :pid
  AND te.status = 'closed'
  AND te.check_out_at IS NOT NULL
  AND te.duration_hours IS NOT NULL
  AND te.duration_hours > 0
```

**Consumers that MUST use this contract:**

| Consumer | Current Filter | Gap |
|----------|---------------|-----|
| `project_actual_costs` RPC | `status='closed'` | Missing NULL/zero/negative duration guard |
| `project_variance_summary` RPC | Delegates to `project_actual_costs` | Inherits gap |
| `project_task_actual_hours` RPC | `status='closed'` | Missing NULL/zero duration guard |
| Scope variance coverage UI | `status='closed'` | Missing NULL/zero duration guard |
| `generate_project_financial_snapshot` | Delegates to `project_actual_costs` | Inherits gap |
| `useJobCostReport` hook | `status='closed'` + `NOT NULL duration_hours` | Missing zero/negative guard |
| Data Health "missing cost rates" | `created_at > now()-30d` | Uses `created_at` not `check_out_at`; no status filter |

### 5B. Timestamp for "Last N Days" Windows

**Rule**: Use `check_out_at` (not `created_at`, not `check_in_at`) for rolling-window filters.

**Rationale**: 
- `check_in_at` can be far in the past for long-running or forgotten entries
- `created_at` reflects row insertion, not when work was completed
- `check_out_at` represents when the work period ended — the most meaningful business timestamp

**Canonical fragment for "last 30 days":**

```sql
AND te.check_out_at >= (now() AT TIME ZONE 'America/Vancouver' - interval '30 days')
```

**Why timezone matters**: A cutoff at UTC midnight excludes entries that finished during Vancouver evening. All rolling windows must be evaluated in the organization's `default_timezone`.

### 5C. Edge Case Handling Matrix

| Scenario | `duration_hours` | `check_out_at` | `status` | Countable? | Action |
|----------|-----------------|----------------|----------|------------|--------|
| Normal closed entry | 8.0 | set | closed | ✅ Yes | Include |
| Open entry (in progress) | NULL | NULL | open | ❌ No | Excluded by `status='closed'` |
| Closed but NULL duration | NULL | set | closed | ❌ No | **Excluded** — data integrity issue; flag in Data Health |
| Closed but duration = 0 | 0.0 | set (same as check_in) | closed | ❌ No | **Excluded** — zero-second shift is meaningless |
| Closed but duration < 0 | -2.5 | before check_in | closed | ❌ No | **Blocked at DB** (see constraint below); if exists, exclude + flag |
| Closed, duration > 24h | 26.0 | set | closed | ✅ Yes* | Include but **flag** `long_shift` (existing flag); Data Health shows it |
| Closed but no check_out | 8.0 | NULL | closed | ❌ No | **Excluded** — inconsistent state; flag in Data Health |
| Auto-closed entry | 18.0 | set | closed | ✅ Yes | Include (flagged `auto_closed` already) |

\* Entries >24h are unusual but valid (multi-day shifts happen in construction). They are included but flagged for review.

---

### 5D. Tests — Time Entry Inclusion Contract

| Test ID | Scenario | Sev | Preconditions | Steps | Expected Result | SQL Verification |
|---------|----------|-----|---------------|-------|----------------|-----------------|
| TE-001 | Closed entry with `duration_hours = NULL` excluded from `project_actual_costs` | P0 | Insert closed entry with `check_out_at` set but `duration_hours = NULL` | Call `project_actual_costs(:pid)` | Entry's hours NOT counted in `actual_labor_hours` | `SELECT SUM(duration_hours) FROM time_entries WHERE project_id=:pid AND status='closed' AND duration_hours IS NOT NULL AND duration_hours > 0` matches RPC output |
| TE-002 | Closed entry with `duration_hours = NULL` excluded from `project_task_actual_hours` | P0 | Same entry linked to a task | Call `project_task_actual_hours(:pid)` | Task shows 0 actual hours from this entry | `SELECT task_id, SUM(duration_hours) FROM time_entries WHERE project_id=:pid AND status='closed' AND duration_hours IS NOT NULL AND duration_hours > 0 GROUP BY task_id` |
| TE-003 | Closed entry with `duration_hours = NULL` excluded from scope variance | P0 | Same entry; task linked to scope item | View ScopeItemVarianceTable | Scope item actual_hours does NOT include this entry | Cross-check with TE-002 query |
| TE-004 | Closed entry with `duration_hours = NULL` excluded from snapshots | P0 | Same entry | Call `generate_project_financial_snapshot` | Snapshot `actual_labor_hours` excludes this entry | Compare snapshot field to TE-001 query |
| TE-005 | Negative `duration_hours` blocked by DB constraint | P0 | — | `UPDATE time_entries SET duration_hours = -2.5 WHERE id = :te_id` | DB error: CHECK constraint violation | `-- Expected: ERROR new row violates check constraint "chk_time_entries_duration_non_negative"` |
| TE-006 | Negative `duration_hours` blocked via API | P0 | Worker with open entry | Call `time-check-out` edge function with `check_out_at` before `check_in_at` | Edge function rejects or computes 0 | Check response status = 400 or duration computed as 0 |
| TE-007 | `duration_hours = 0` excluded from actuals | P0 | Insert closed entry with `duration_hours = 0`, `check_out_at = check_in_at` | Call `project_actual_costs(:pid)` | Entry NOT counted | Same as TE-001 query with `> 0` guard |
| TE-008 | Open entries never counted — `project_actual_costs` | P0 | Open entry exists | Call RPC | Not counted | `SELECT COUNT(*) FROM time_entries WHERE project_id=:pid AND status='open'` > 0 but RPC excludes them |
| TE-009 | Open entries never counted — `project_task_actual_hours` | P0 | Open entry with task_id | Call RPC | Not counted | Same pattern |
| TE-010 | Open entries never counted — scope variance | P0 | Open entry with task linked to scope | View variance table | Not counted | Same pattern |
| TE-011 | Open entries never counted — snapshots | P0 | Open entry | Generate snapshot | Not counted | Snapshot matches closed-only sum |
| TE-012 | Overlapping entries flagged in Data Health | P1 | Two closed entries for same user with overlapping `[check_in_at, check_out_at)` ranges | View `/data-health` | "Overlapping Time Entries" diagnostic section lists both entries | `SELECT a.id, b.id FROM time_entries a JOIN time_entries b ON a.user_id = b.user_id AND a.organization_id = b.organization_id AND a.id < b.id AND tstzrange(a.check_in_at, a.check_out_at, '[)') && tstzrange(b.check_in_at, b.check_out_at, '[)') WHERE a.status='closed' AND b.status='closed'` |
| TE-013 | Overlapping entries — both counted in actuals (current policy) | P1 | Same overlapping entries | Call `project_actual_costs` | Both entries counted (sum = total hours). Overlap does NOT silently deduplicate | Verify sum matches raw SUM. Document: overlap is a Data Health flag, not a filter |
| TE-014 | Timezone boundary — entry closing at 11:59 PM PST Dec 31 | P1 | Entry with `check_out_at = '2026-01-01T07:59:00Z'` (= Dec 31 11:59 PM PST) | Query "last 30 days" with cutoff at Jan 1 PST | Entry IS included (it's still Dec 31 in Vancouver) | `SELECT COUNT(*) FROM time_entries WHERE check_out_at >= '2025-12-02T08:00:00Z' AND check_out_at < '2026-01-01T08:00:00Z' AND status='closed'` -- PST = UTC-8 |
| TE-015 | Timezone boundary — entry closing at 12:01 AM PST Jan 1 | P1 | Entry with `check_out_at = '2026-01-01T08:01:00Z'` (= Jan 1 00:01 AM PST) | Same query | Entry NOT included (it's Jan 1 in Vancouver, outside Dec window) | Same query returns 0 for this entry |
| TE-016 | Closed entry with NULL `check_out_at` (inconsistent state) | P0 | Insert entry: `status='closed', check_out_at=NULL, duration_hours=8` | Call `project_actual_costs` | Entry excluded (inconsistent state) | `SELECT COUNT(*) FROM time_entries WHERE status='closed' AND check_out_at IS NULL` — these are data quality issues |
| TE-017 | Data Health flags NULL-duration closed entries | P1 | Closed entry with NULL duration | View `/data-health` | "Closed Entries Missing Duration" diagnostic appears | `SELECT id, user_id, check_in_at FROM time_entries WHERE status='closed' AND (duration_hours IS NULL OR duration_hours <= 0)` |

### 5E. Seed Data — Edge Case Entries

```sql
-- Closed but NULL duration (TE-001 through TE-004)
INSERT INTO time_entries (id, organization_id, user_id, project_id, task_id,
  check_in_at, check_out_at, duration_hours, duration_minutes, status, source) VALUES
  (:te_null_dur_id, :org1_id, :worker_uid, :proj1_id, :task1_id,
   now()-interval '5h', now()-interval '1h', NULL, NULL, 'closed', 'manual_adjustment');

-- Zero duration (TE-007)
INSERT INTO time_entries (id, organization_id, user_id, project_id,
  check_in_at, check_out_at, duration_hours, duration_minutes, status, source) VALUES
  (:te_zero_dur_id, :org1_id, :worker_uid, :proj1_id,
   now()-interval '3h', now()-interval '3h', 0.0, 0, 'closed', 'self');

-- Closed but no checkout (TE-016, inconsistent state)
INSERT INTO time_entries (id, organization_id, user_id, project_id,
  check_in_at, check_out_at, duration_hours, duration_minutes, status, source) VALUES
  (:te_no_checkout_id, :org1_id, :worker_uid, :proj1_id,
   now()-interval '6h', NULL, 8.0, 480, 'closed', 'manual_adjustment');

-- Overlapping entries for same user (TE-012, TE-013)
INSERT INTO time_entries (id, organization_id, user_id, project_id,
  check_in_at, check_out_at, duration_hours, duration_minutes, status, source) VALUES
  (:te_overlap_a_id, :org1_id, :worker_uid, :proj1_id,
   '2026-02-10 08:00:00-08', '2026-02-10 16:00:00-08', 8.0, 480, 'closed', 'self'),
  (:te_overlap_b_id, :org1_id, :worker_uid, :proj1_id,
   '2026-02-10 14:00:00-08', '2026-02-10 20:00:00-08', 6.0, 360, 'closed', 'self');

-- Timezone boundary entries (TE-014, TE-015)
INSERT INTO time_entries (id, organization_id, user_id, project_id,
  check_in_at, check_out_at, duration_hours, duration_minutes, status, source) VALUES
  (:te_tz_before_id, :org1_id, :worker_uid, :proj1_id,
   '2025-12-31 15:00:00-08', '2025-12-31 23:59:00-08', 8.98, 539, 'closed', 'self'),
  (:te_tz_after_id, :org1_id, :worker_uid, :proj1_id,
   '2025-12-31 16:00:00-08', '2026-01-01 00:01:00-08', 8.02, 481, 'closed', 'self');
```

### 5F. Recommended DB Constraint

```sql
-- Block negative durations at the database level
ALTER TABLE time_entries
  ADD CONSTRAINT chk_time_entries_duration_non_negative
  CHECK (duration_hours IS NULL OR duration_hours >= 0);

ALTER TABLE time_entries
  ADD CONSTRAINT chk_time_entries_duration_minutes_non_negative
  CHECK (duration_minutes IS NULL OR duration_minutes >= 0);
```

### 5G. Overlap Policy Decision

**Current Policy**: Overlapping entries are **allowed and both counted**. They are NOT deduplicated or silently excluded. Instead, overlaps are surfaced as a **Data Health diagnostic** for Admin/PM review.

**Rationale**: In construction, workers may legitimately clock overlapping entries across different projects or job sites (e.g., split shifts). Automatic deduplication would silently lose hours. Instead, overlaps are flagged for human review.

**Enforcement**:
- **Check-in edge function**: Prevents new check-in while an entry is open (same org) — so real-time overlaps don't happen
- **Adjustment requests**: The `rpc_review_time_adjustment_request` RPC checks for overlaps and auto-denies if detected
- **Historical/imported data**: May contain overlaps — flagged in Data Health, not rejected

---

## 6. Reporting Trust Tests ("Numbers Must Match")

### 5.1 planned_total_cost Composition

```sql
-- From project_budgets
SELECT
  planned_labor_cost + planned_material_cost + planned_machine_cost + planned_other_cost AS computed_total,
  -- Compare to what variance_summary returns
  (SELECT planned_total_cost FROM project_variance_summary(:pid)) AS rpc_total
FROM project_budgets WHERE project_id = :pid;
-- computed_total = rpc_total (within $0.01)
```

### 5.2 actual_total_cost Composition

```sql
-- Manual computation
WITH labor AS (
  SELECT COALESCE(SUM(te.duration_hours * pm.cost_rate), 0) AS cost
  FROM time_entries te
  JOIN project_members pm ON pm.user_id = te.user_id AND pm.project_id = te.project_id
  WHERE te.project_id = :pid AND te.status = 'closed' AND pm.cost_rate > 0
),
receipts_by_type AS (
  SELECT
    COALESCE(SUM(CASE WHEN cost_type='material' THEN amount END), 0) AS material,
    COALESCE(SUM(CASE WHEN cost_type='machine' THEN amount END), 0) AS machine,
    COALESCE(SUM(CASE WHEN cost_type='other' THEN amount END), 0) AS other,
    COALESCE(SUM(CASE WHEN cost_type IS NULL THEN amount END), 0) AS unclassified
  FROM receipts WHERE project_id = :pid AND status = 'approved'
)
SELECT
  labor.cost + receipts_by_type.material + receipts_by_type.machine
    + receipts_by_type.other + receipts_by_type.unclassified AS manual_total,
  (SELECT actual_total_cost FROM project_actual_costs(:pid)) AS rpc_total
FROM labor, receipts_by_type;
-- manual_total = rpc_total (within $0.01)
```

### 5.3 Profit & Margin

```sql
SELECT
  contract_value - actual_total_cost AS computed_profit,
  actual_profit AS rpc_profit,
  CASE WHEN contract_value > 0
    THEN ((contract_value - actual_total_cost) / contract_value * 100)
    ELSE 0 END AS computed_margin,
  actual_margin_percent AS rpc_margin
FROM project_variance_summary(:pid)
CROSS JOIN project_budgets WHERE project_budgets.project_id = :pid;
-- computed_profit = rpc_profit (±$0.01)
-- computed_margin = rpc_margin (±0.1%)
```

### 5.4 Strict vs Relaxed Invoicing

```sql
WITH inv AS (
  SELECT
    SUM(CASE WHEN status IN ('sent','paid') THEN total ELSE 0 END) AS strict_total,
    SUM(CASE WHEN status IN ('sent','paid','draft') THEN total ELSE 0 END) AS relaxed_total
  FROM invoices
  WHERE project_id = :pid AND status != 'void'
)
SELECT
  inv.strict_total,
  inv.relaxed_total,
  (SELECT invoiced_amount_strict FROM project_invoicing_summary(:pid)) AS rpc_strict,
  (SELECT invoiced_amount_relaxed FROM project_invoicing_summary(:pid, true, false)) AS rpc_relaxed
FROM inv;
-- strict_total = rpc_strict; relaxed_total = rpc_relaxed
```

### 5.5 billed_percentage

```sql
SELECT
  CASE WHEN contract_value > 0
    THEN (invoiced_amount_strict / contract_value * 100)
    ELSE 0 END AS computed_billed_pct,
  billed_pct_strict AS rpc_billed_pct
FROM project_invoicing_summary(:pid)
CROSS JOIN project_budgets WHERE project_budgets.project_id = :pid;
-- Must match within 0.1%
```

### 5.6 Scope Variance Reconciliation

```sql
-- Actual hours per scope item via tasks
WITH task_hours AS (
  SELECT t.scope_item_id, SUM(th.actual_hours) AS actual_hours
  FROM project_task_actual_hours(:pid) th
  JOIN tasks t ON t.id = th.task_id
  WHERE t.scope_item_id IS NOT NULL
  GROUP BY t.scope_item_id
)
SELECT
  si.name,
  si.planned_hours * si.quantity AS planned,
  COALESCE(th.actual_hours, 0) AS actual,
  sa.planned_hours AS rpc_planned,
  sa.actual_hours AS rpc_actual
FROM project_scope_items si
LEFT JOIN task_hours th ON th.scope_item_id = si.id
LEFT JOIN project_scope_accuracy(:pid) sa ON sa.scope_item_id = si.id
WHERE si.project_id = :pid AND si.is_archived = false;
-- planned = rpc_planned; actual = rpc_actual (each row)
```

### UI vs SQL Tolerance

| Metric | Tolerance |
|--------|-----------|
| Dollar amounts | ±$0.01 |
| Percentages | ±0.1% |
| Hours | ±0.01h |
| Counts | Exact match |

---

## 7. Security & Data Isolation Tests

### 7.1 Cross-Org Read Isolation

| # | Test | Method | Expected |
|---|------|--------|----------|
| S-01 | Org2 admin queries `project_budgets` for Org1 project | Supabase JS client as Org2 user | 0 rows |
| S-02 | Org2 admin queries `project_financial_snapshots` for Org1 | Supabase JS client | 0 rows |
| S-03 | Org2 admin calls `project_portfolio_report(:org1_id)` | Supabase RPC | 0 rows (org membership checked) |
| S-04 | Org2 admin calls `project_variance_summary` for Org1 project | Supabase RPC | 0 rows or empty (project membership checked via budget RLS) |
| S-05 | Org2 admin queries `clients` for Org1 | Supabase JS | 0 rows |
| S-06 | Org2 admin queries `invoices` for Org1 | Supabase JS | 0 rows |
| S-07 | Org2 admin queries `ai_insights` for Org1 | Supabase JS | 0 rows |
| S-08 | Unauthenticated request to `project_portfolio_report` | curl with no auth header | 401 or empty |

### 7.2 SECURITY DEFINER Function Tests

| # | Function | Test | Expected |
|---|----------|------|----------|
| SD-01 | `assign_time_entry_task` | Worker calls it | Error / denied |
| SD-02 | `assign_time_entry_task` | Cross-project entry+task | Error: project mismatch |
| SD-03 | `generate_tasks_from_scope` | Non-member calls it | Empty result or error |
| SD-04 | `rpc_approve_timesheet_period` | Worker tries to approve own period | Error: insufficient role |
| SD-05 | `rpc_review_time_adjustment_request` | Worker tries to review | Error: insufficient role |

### 7.3 Client Hierarchy Constraint Tests

| # | Test | Expected Error |
|---|------|---------------|
| CH-01 | Set `parent_client_id` to self | Trigger/constraint error |
| CH-02 | Set `parent_client_id` to client in different org | "Parent client must belong to the same organization" |
| CH-03 | Create cycle: A→B→C→A | Trigger error (if implemented) or application-level prevention |
| CH-04 | Set `parent_client_id` to non-existent UUID | Foreign key violation |

### 7.4 Snapshot Write Protection

| # | Test | Expected |
|---|------|----------|
| SW-01 | PM attempts `INSERT INTO project_financial_snapshots` | RLS violation |
| SW-02 | PM attempts `UPDATE project_financial_snapshots` | RLS violation |
| SW-03 | PM attempts `DELETE FROM project_financial_snapshots` | RLS violation |
| SW-04 | Service role (via RPC) writes snapshot | Success |

---

## 8. Regression Checklist

50+ must-pass checks organized by area.

### Budgets (B1–B8)

- [ ] B1: Create budget with all fields → `planned_total` auto-computed
- [ ] B2: Edit budget → `planned_total` recalculated
- [ ] B3: Delete budget → project shows "Not set" in all reports
- [ ] B4: Budget with `contract_value=0` → no division errors anywhere
- [ ] B5: Budget with all planned costs = 0 → no crashes
- [ ] B6: `project_variance_summary` returns correct deltas (sign convention: positive = under budget)
- [ ] B7: `project_actual_costs` excludes open time entries
- [ ] B8: `project_actual_costs` correctly classifies receipts by `cost_type` (including NULL → unclassified)

### Scope / Tasks (ST1–ST10)

- [ ] ST1: Create scope item → `planned_total` trigger fires
- [ ] ST2: Edit scope item → `planned_total` recalculated
- [ ] ST3: Archive scope item → `is_archived=true`, `archived_at` set
- [ ] ST4: Unarchive → `is_archived=false`, `archived_at=null`
- [ ] ST5: Delete scope item with linked tasks → blocked
- [ ] ST6: Delete scope item without tasks → succeeds
- [ ] ST7: `generate_tasks_from_scope` create_missing → correct count, no dupes
- [ ] ST8: `generate_tasks_from_scope` idempotent on re-run → 0 new tasks
- [ ] ST9: `preview_tasks_from_scope` shows correct preview
- [ ] ST10: Generated tasks have `scope_item_id` set and correct `planned_hours`

### Time Tracking (TT1–TT8)

- [ ] TT1: Check-in with task selection → `task_id` persisted
- [ ] TT2: `project_task_actual_hours` returns correct hours per task
- [ ] TT3: Open entries excluded from task actual hours
- [ ] TT4: Coverage strip shows correct total/linked/unassigned
- [ ] TT5: Unassigned modal lists correct entries
- [ ] TT6: `assign_time_entry_task` succeeds for Admin/PM
- [ ] TT7: `assign_time_entry_task` denied for Worker
- [ ] TT8: Cross-project assignment blocked

### Time Entry Inclusion Contract (TC1–TC8)

- [ ] TC1: Closed entry with NULL `duration_hours` excluded from ALL actuals RPCs
- [ ] TC2: Negative `duration_hours` rejected by DB constraint
- [ ] TC3: Zero `duration_hours` excluded from actuals
- [ ] TC4: Open entries excluded from every consumer (actuals, task hours, scope, snapshots)
- [ ] TC5: Closed entry with NULL `check_out_at` excluded from actuals
- [ ] TC6: Overlapping entries flagged in Data Health
- [ ] TC7: Timezone boundary (PST) correctly filters "last 30 days"
- [ ] TC8: Data Health shows closed entries with NULL/zero duration

### Receipts (R1–R4)

- [ ] R1: Receipt with `cost_type=NULL` counted as unclassified
- [ ] R2: Unclassified cost in all reports matches manual sum
- [ ] R3: Receipt upload notification fires
- [ ] R4: Data Health shows unclassified receipts section

### Invoicing (IV1–IV10)

- [ ] IV1: Create invoice persists billing snapshot fields
- [ ] IV2: Sent invoice snapshot immutable after client change
- [ ] IV3: Paid invoice snapshot immutable
- [ ] IV4: Draft invoice "Update from Customer" works
- [ ] IV5: Void invoice excluded from strict and relaxed totals
- [ ] IV6: `strict` totals = sent + paid only
- [ ] IV7: `relaxed` totals = sent + paid + draft
- [ ] IV8: Send modal defaults to `send_to_emails`
- [ ] IV9: Invalid email blocked in send modal
- [ ] IV10: Send persists final email list back to invoice

### Insights Pages (IN1–IN8)

- [ ] IN1: Portfolio page loads KPIs excluding no-budget projects
- [ ] IN2: "Excluded" count shown for no-budget projects
- [ ] IN3: Status filter works
- [ ] IN4: Data quality filter works
- [ ] IN5: CSV export has correct headers and values
- [ ] IN6: Project page shows variance breakdown
- [ ] IN7: Diagnostics alerts shown when thresholds met
- [ ] IN8: "Budget Required" shown for no-budget project

### Data Health (DH1–DH5)

- [ ] DH1: Page accessible by Admin/PM only
- [ ] DH2: Missing cost rates section correct
- [ ] DH3: Unclassified receipts section correct
- [ ] DH4: Missing budgets section shows active projects only
- [ ] DH5: "Create Budget" CTA navigates correctly

### Snapshots / Trends (SN1–SN8)

- [ ] SN1: `generate_project_financial_snapshot` creates accurate snapshot
- [ ] SN2: Upsert idempotency (no duplicates)
- [ ] SN3: Org snapshot aggregates project snapshots
- [ ] SN4: `backfill_weekly_snapshots` creates N weeks of data
- [ ] SN5: Cron edge function validates secret
- [ ] SN6: Trend charts render with correct data points
- [ ] SN7: Recommendations trigger at correct thresholds
- [ ] SN8: Recommendation links navigate to fix paths

### Clients (CL1–CL5)

- [ ] CL1: Parent/child relationship persists
- [ ] CL2: Self-parent blocked
- [ ] CL3: Cross-org parent blocked
- [ ] CL4: Archive parent warns about active children
- [ ] CL5: Active-only client selector default

### AI / Digest (AI1–AI4)

- [ ] AI1: AI insight idempotent via `input_hash`
- [ ] AI2: AI narrative only cites provided metrics
- [ ] AI3: Weekly digest sent only to opted-in Admin/PM
- [ ] AI4: Weekly digest NOT sent to Workers regardless of opt-in

---

## 9. Acceptance Gate

### Pass Criteria

| Level | Criteria |
|-------|---------|
| **P0** | 100% passing. Zero exceptions. Any P0 failure is a release blocker. |
| **P1** | Maximum 3 open failures, each with a documented workaround and fix timeline ≤ 1 sprint. |
| **P2** | No limit, but must be triaged and ticketed. |
| **Security** | Zero unresolved security failures across all categories (cross-org isolation, RLS, SECURITY DEFINER, hierarchy constraints). Any security failure = automatic release block regardless of severity label. |
| **Trust Tests** | All 6 reconciliation queries must match within stated tolerance. Any mismatch = P0 bug. |
| **UI vs SQL** | Every KPI card, every table cell, every chart data point must trace to a verifiable SQL query. Random sampling: at minimum 10 spot checks per release. |

### Sign-Off Checklist

- [ ] All P0 tests passing
- [ ] Security gauntlet: 0 failures
- [ ] Trust tests: all 6 reconciliations within tolerance
- [ ] Role permission grid: all negative tests confirmed denied
- [ ] Concurrency tests: no data corruption detected
- [ ] CSV export validation: headers + sample values verified
- [ ] Weekly digest: confirmed delivery + correct content for opted-in Admin/PM
- [ ] AI insights: no hallucinated numbers in narratives
- [ ] Cross-org isolation: confirmed for all 4 test orgs
- [ ] Empty state handling: no crashes on orgs/projects with zero data

---

*End of QA Gauntlet v1.0*
