# QA Checklist — Budget, Scope, Variance & Customer Hierarchy

## 1. Budget & Scope Workflow

- [ ] **Create project** → Verify it appears in project list
- [ ] **Add budget** to project → Verify contract_value, planned costs saved correctly
- [ ] **Try negative contract_value** → Verify DB rejects with error message
- [ ] **Try negative planned_hours** on scope item → Verify DB rejects
- [ ] **Add scope items** → Verify item_type, planned_hours, planned_total display
- [ ] **Edit scope item** inline → Verify save/cancel work, updated values persist
- [ ] **Delete scope item** → Verify confirm dialog, item removed from list
- [ ] **Generate Tasks from scope** → Verify preview modal shows correct items
- [ ] **Confirm generation** → Verify tasks created with scope_item_id set
- [ ] **Sync Tasks** → Verify existing tasks updated (name from scope item), user edits to other fields preserved
- [ ] **View generated task** → Verify scope_item_id is populated (not null)
- [ ] **Verify permissions**: Only Admin/PM can add/edit/delete scope items and generate tasks
- [ ] **Foreman** can view scope tab but action buttons are hidden
- [ ] **Worker** cannot access scope tab or its actions

## 2. Variance / Estimate Accuracy

- [ ] **Navigate to Insights** → Portfolio page loads, shows KPI cards
- [ ] **Filter by status** → Table updates correctly
- [ ] **Click a project row** → Navigates to project estimate accuracy page
- [ ] **Project Estimate Accuracy** → KPI cards show planned vs actual with delta
- [ ] **Variance breakdown table** → All categories (Labor, Material, Machine, Other, Total) display
- [ ] **Project with no budget** → Planned values show as 0, variance = negative actual
- [ ] **Project with contract_value=0** → Profit/Margin cards show "No contract value set"
- [ ] **Workers without cost_rate** → Warning banner appears when labor hours > 0 but cost = 0
- [ ] **Export CSV** → Downloads valid CSV file with correct data
- [ ] **Portfolio Export CSV** → Downloads full portfolio data

## 3. Customer Hierarchy (Parent/Child)

- [ ] **Create parent client** → Appears in client list
- [ ] **Create child client** → Select parent from dropdown, saved correctly
- [ ] **Verify parent column** in client list shows parent name
- [ ] **Try circular parent** (A→B→A) → Verify DB rejects with error
- [ ] **Try self-referencing parent** → Verify DB rejects
- [ ] **Edit client** → All new fields (GST#, A/P, PM, Site contacts, zones) save
- [ ] **Archive client** → Moves to archived section
- [ ] **Reactivate client** → Returns to active list
- [ ] **Verify zones >= 0** → Negative zones rejected by DB

## 4. Project ↔ Client Integration

- [ ] **Create project with client** → Client dropdown works, client_id saved
- [ ] **Edit project** → Client selector shows, billing/shipping card displays:
  - Billing Customer = parent client (if child selected) else direct client
  - Job Site = project.location
- [ ] **Project status dropdown** → All statuses available, transitions work
- [ ] **Status → deleted** → is_deleted syncs to true

## 5. Invoice Auto-Population

- [ ] **Create invoice, select project** → Client auto-populates from project.client_id
- [ ] **If client has parent** → Bill-to uses PARENT client name/address
- [ ] **Ship-to** uses project.location
- [ ] **A/P email** shown as default send-to (not primary email)
- [ ] **Send Invoice** → Defaults to ap_email; ap_contact_name as recipient
- [ ] **Override email** → Manual override allowed in send dialog
- [ ] **PM email** is NOT used for invoice sending unless manually entered

## 6. Data Health Panel (Admin Only)

- [ ] **Navigate to /data-health** → Only accessible to admins
- [ ] **Non-admin** → Shows NoAccess
- [ ] **Check: Workers with $0 cost rate** → Lists affected members
- [ ] **Check: Projects missing budgets** → Lists projects without budget rows
- [ ] **Check: Receipts missing cost_type** → Shows count
- [ ] **Check: $0 contract with invoices** → Shows conflicting invoices
- [ ] **Check: Generated tasks missing scope_item_id** → Shows count
- [ ] **All green** → Summary shows "All checks passed"

## 7. RLS / Permission Consistency

- [ ] **RLS on project_budgets** → Only org members can read/write
- [ ] **RLS on project_scope_items** → Only org members can read/write
- [ ] **UI gating matches API** → Foreman cannot edit budgets even via direct API
- [ ] **Workers cannot access** Insights, Hours, Job Cost pages
- [ ] **External trade** only sees Tasks, Time, Receipts in nav

## 8. Edge Cases

- [ ] **Delete scope item with generated tasks** → Tasks remain but scope_item_id set to null
- [ ] **Large number of scope items** (20+) → Table renders without performance issues
- [ ] **Project with no time entries** → Variance shows 0 actual cleanly
- [ ] **Project with no receipts** → Material/Machine costs show as 0
- [ ] **Invoice for project with no client** → No auto-populate, manual selection works
