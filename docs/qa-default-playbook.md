# QA: Default Playbook — Full Audit

## Sorting Order (Item 1)

### Newly created always #1
- Generate a playbook via "Build from history"
- ✅ It appears as the top recommendation with "Just created" badge
- ✅ Even if a matching-default exists, newly created is #1

### Full sort order
1. `newlyCreatedId` (if present) — always first
2. Matching default (`is_default` + job_type matches) — next
3. Other job_type matches — then
4. Name ascending tie-breaker — deterministic

## Default Mismatch Job Type (Item 2)

### Default with mismatched job_type is NOT recommended
- Set playbook A (job_type: "Electrical") as default
- Create project with job_type "Plumbing"
- ✅ Playbook A does NOT appear as "Recommended" or "Best match"
- ✅ No "Default" badge in suggestion view (only "Best match" or "Just created" badges exist)
- ✅ `is_recommended` only true when `typeMatch` is true (org-wide default alone is insufficient)

## Permission Guard (Items 3 + 4)

### UI guard matches server vocabulary
- DB stores roles as: `admin`, `pm`, `foreman`, `hr`, `internal_worker`
- UI checks: `orgRole === 'admin' || orgRole === 'pm'`
- RPC checks: `has_org_role(v_org_id, ARRAY['admin','project_manager'])`
- `has_org_role` function normalizes `'pm'` ↔ `'project_manager'` equivalence
- ✅ UI guard and server guard are aligned

### Non-privileged user (foreman/worker)
- Create project and apply playbook
- ✅ "Set as default?" prompt does NOT appear
- ✅ Project creation succeeds normally

### Privileged user (admin/pm)
- Create project and apply non-default playbook
- ✅ "Set as default?" prompt appears
- ✅ Click "Yes, set as default" → success toast

### Error code robustness (Item 4)
- Error handling checks:
  - `err.code === '42501'` → permission toast
  - `err.message` includes "forbidden" → permission toast
  - `err.message` includes "permission" → permission toast
  - Otherwise → generic "Couldn't set default" toast
- ✅ Covers Supabase error surface variants

## Cache Invalidation (Item 5)

### Verified query keys match actual hook definitions
- `usePlaybookList`: `['playbooks-list', orgId]` → invalidated with `['playbooks-list']` (prefix match ✅)
- `usePlaybookDetail`: `['playbook-detail', playbookId]` → invalidated with `['playbook-detail']` ✅
- `usePlaybookPerformance`: `['playbook-performance', playbookId]` → invalidated with `['playbook-performance']` ✅
- Note: `invalidateQueries({ queryKey: ['playbooks-list'] })` uses prefix matching by default in TanStack Query v5

## Non-Blocking Prompt (Item 6)

### Prompt only opens once
- `defaultPrompt` is set once after project creation succeeds (line ~204)
- Modal closes via `onOpenChange(false)` at line ~228 before prompt appears
- `defaultPrompt` is reset to `null` in the `finally` block of `handleSetDefault`
- Dismissing via "Not now" sets `defaultPrompt` to `null` via `onOpenChange`
- ✅ No re-render or query invalidation can re-trigger the prompt
- ✅ `defaultPrompt` is not persisted — it resets when modal closes

## Build From History (Item 7)

### Button disabled without job_type
- Empty state button: "Build workflow from past {jobType} jobs" — only shown when `jobType` is truthy (line ~183 condition)
- Action bar button: "Build from history" — only shown when `jobType` is truthy (line ~337 condition)
- Dialog "Find patterns" button: `disabled={!jobType.trim()}`
- ✅ Edge function never invoked with blank job_type

## Trust Disclosure (Item 8)

### Dialog subtitle provides clear disclosure
- "We'll analyze recent projects in this job type and propose phases, tasks, and hour ranges."
- "You can edit the workflow before applying it."
- ✅ No "AI" in labels, but mechanism is disclosed in plain English

## 404 No Similar Projects (Item 9)

### Dialog allows recovery
- Error fallback: "No similar past projects found for this job type yet. Try another job type or start from an existing playbook."
- ✅ User can change jobType and retry ("Find patterns" button remains active)
- ✅ User can close dialog and pick an existing playbook
- ✅ Dialog doesn't crash or become stuck

## Backend: has_org_role Function (Critical Fix)

### Function was missing from database
- All playbook RPCs referenced `has_org_role()` which did not exist
- Created as SECURITY DEFINER function with `pm` ↔ `project_manager` normalization
- ✅ `rpc_update_playbook` now works for admin and pm roles
- ✅ Access properly denied for foreman/worker/hr roles
