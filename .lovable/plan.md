
# Task Automation from Scope Items

## Summary

Build an RPC function `generate_tasks_from_scope` and a new "Scope" tab on the Project Overview page. PMs can define scope items, then generate or sync tasks idempotently. The Tasks list view gets a "Generated" badge linking back to scope.

## Database Migration

### RPC Function: `generate_tasks_from_scope(p_project_id uuid, p_mode text)`

- `SECURITY DEFINER`, validates org membership + admin/PM role inside
- Two modes:
  - `create_missing`: INSERT INTO tasks SELECT from `project_scope_items` WHERE `item_type = 'task'` AND no existing task with matching `scope_item_id` for that project. Uses `ON CONFLICT (project_id, scope_item_id) WHERE scope_item_id IS NOT NULL DO NOTHING` for safety.
  - `sync_existing`: UPDATE tasks SET `title`, `description`, `planned_hours` FROM scope items WHERE `tasks.is_generated = true` AND `tasks.scope_item_id` matches. Only overwrites `title`/`description`/`planned_hours` (never status, dates, assignments).
- Maps: `tasks.title = scope_item.name`, `tasks.description = scope_item.description`, `tasks.planned_hours = scope_item.planned_hours`, `tasks.estimated_hours = scope_item.planned_hours` (keep both in sync), `tasks.is_generated = true`, `tasks.scope_item_id = scope_item.id`
- Sets `tasks.location` from `projects.location`, `tasks.created_by` from `auth.uid()`, `tasks.status = 'not_started'`
- Returns JSON: `{ created: number, updated: number, skipped: number }`

### Dry-Run Function: `preview_tasks_from_scope(p_project_id uuid, p_mode text)`

- Same logic but SELECT only (no mutations)
- Returns TABLE of `(scope_item_id, scope_item_name, action text)` where action is `'create'`, `'update'`, or `'skip'`
- Used by the preview modal before confirming

## Frontend Components

### 1. New "Scope" Tab in ProjectOverview

Add a 10th tab "Scope" to the `TabsList` in `ProjectOverview.tsx` (change grid-cols-9 to grid-cols-10).

**Component: `ProjectScopeTab`** (`src/components/scope/ProjectScopeTab.tsx`)
- Fetches `project_scope_items` filtered by `project_id`, ordered by `sort_order`
- Displays a table/card list with columns: Name, Type (task/service/product), Planned Hours, Planned Total, Sort Order
- Inline editing: click a row to edit name, description, planned_hours, sort_order directly
- "Add Scope Item" button to add new rows (defaults: `item_type='task'`, `source_type='manual'`)
- Delete button per row (with confirmation)
- Permission-gated: only admin/PM can edit; foreman can view

**Action Buttons (admin/PM only):**
- "Generate Tasks" -- calls preview first, then executes `create_missing`
- "Sync Tasks" -- calls preview first, then executes `sync_existing`

### 2. Preview Modal (`src/components/scope/ScopeTaskPreviewModal.tsx`)

- Before executing, calls `preview_tasks_from_scope` RPC
- Shows a list: scope item name, action (Create / Update / Skip), with color coding
- Summary counts at top: "X to create, Y to update, Z already up-to-date"
- Warning banner if project has manual tasks (tasks without `scope_item_id`) -- informational only
- "Confirm" and "Cancel" buttons
- On confirm, calls `generate_tasks_from_scope` RPC, shows success toast with counts

### 3. Task List View Update

In `TaskListView.tsx` / `SortableTaskItem`:
- If `task.is_generated === true`, show a small `<Badge variant="outline">Generated</Badge>` next to the title
- Badge is clickable -- navigates to `/projects/{project_id}?tab=scope` (or opens scope tab)

### 4. TypeScript Client Helper

**File: `src/lib/scopeTaskGeneration.ts`**

```typescript
export async function previewScopeTaskGeneration(projectId: string, mode: 'create_missing' | 'sync_existing') {
  const { data, error } = await supabase.rpc('preview_tasks_from_scope', {
    p_project_id: projectId,
    p_mode: mode,
  });
  if (error) throw error;
  return data;
}

export async function generateTasksFromScope(projectId: string, mode: 'create_missing' | 'sync_existing') {
  const { data, error } = await supabase.rpc('generate_tasks_from_scope', {
    p_project_id: projectId,
    p_mode: mode,
  });
  if (error) throw error;
  return data;
}
```

## File Changes Summary

| File | Change |
|------|--------|
| `supabase/migrations/...` | New migration: 2 RPC functions + index |
| `src/pages/ProjectOverview.tsx` | Add "Scope" tab (grid-cols-10), import `ProjectScopeTab` |
| `src/components/scope/ProjectScopeTab.tsx` | New -- scope item list with inline edit, generate/sync buttons |
| `src/components/scope/ScopeTaskPreviewModal.tsx` | New -- dry-run preview dialog |
| `src/components/scope/ScopeItemRow.tsx` | New -- inline-editable row component |
| `src/lib/scopeTaskGeneration.ts` | New -- RPC client helpers |
| `src/components/tasks/TaskListView.tsx` | Add "Generated" badge when `is_generated === true` |

## Permissions

- **View scope tab**: all project members
- **Edit scope items / generate tasks**: admin, PM only (checked server-side in RPC + client-side via `useAuthRole`)
- **Foreman**: read-only view of scope items

## Edge Cases

- Re-running "Generate Tasks" is safe: `ON CONFLICT DO NOTHING` ensures no duplicates
- Sync only touches `is_generated = true` tasks -- manually created tasks are never modified
- If a scope item is deleted, the linked task keeps `scope_item_id = NULL` (ON DELETE SET NULL) and `is_generated` stays true as a historical marker
- Zero scope items: buttons disabled with tooltip "Add scope items first"

## Test Checklist

1. Create 5 scope items (3 as `task` type, 2 as `service` type) on a project
2. Click "Generate Tasks" -- preview shows 3 tasks to create, 0 to update
3. Confirm -- 3 tasks appear in Tasks tab with "Generated" badge
4. Re-click "Generate Tasks" -- preview shows 0 to create, 3 skipped
5. Edit a scope item name and planned_hours
6. Click "Sync Tasks" -- preview shows 1 to update
7. Confirm -- task title and planned_hours updated, status/dates unchanged
8. Verify the 2 `service` type scope items never generated tasks
9. Check foreman user cannot see generate/sync buttons
