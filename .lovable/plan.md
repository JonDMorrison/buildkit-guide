
## What’s actually happening (root cause)

### 1) The request is failing at the database layer with an RLS error
When you click **Create Project**, the frontend sends:

- `POST /rest/v1/projects?select=*`
- with `Prefer: return=representation` (because the code does `.insert(...).select().single()`)

Your network logs show the backend response:

- **HTTP 403**
- `{"code":"42501","message":"new row violates row-level security policy for table \"projects\""}`

So project creation is not failing “mysteriously”; it’s being blocked by Row Level Security.

### 2) Why you see “Unknown error” in the UI instead of the real message
In `src/components/CreateProjectModal.tsx`, the catch block does:

```ts
description: error instanceof Error ? error.message : 'Unknown error'
```

Supabase/PostgREST errors are often *plain objects* (not `instanceof Error`), so the UI frequently falls back to `"Unknown error"` even when the backend returned a useful message.

### 3) The policies we changed were necessary, but not sufficient
You shared the last migration diff (`supabase/migrations/20260204133341_033acad1-db98-45ef-9f1e-e422a0a7b044.sql`) which:

- Updated **projects INSERT** policy to allow org admins/PMs
- Updated **project_members INSERT** policy to allow creator to add themselves (within 30s)

Those changes *do exist* in the database right now (confirmed via `pg_policies`).

### 4) The hidden “chicken-and-egg” problem: INSERT is using RETURNING, and RETURNING is blocked by the projects SELECT policy
Your current **projects SELECT** policy (defined in `supabase/migrations/20251213224611_9ff27cdd-19f2-4fab-bb55-7c791892fa20.sql`) is:

```sql
USING (
  is_project_member(auth.uid(), id)
  AND has_org_membership(organization_id)
);
```

Meaning: a user can only “see” a project row if they are already in `project_members`.

But the create flow is:

1) Insert into `projects` and ask the backend to return the inserted row (`select=*`)
2) Then insert into `project_members` using the returned `project.id`

At the moment of (1), the user is **not yet** a project member, so the row is not visible under the SELECT policy.

Because the insert is being executed with a “return the created row” behavior, the database ends up enforcing visibility rules at that point, and the operation fails with the RLS error you’re seeing.

This is why it keeps failing even after loosening the INSERT policy.

## Where this lives in the codebase

### Frontend (create flow + error handling)
- `src/components/CreateProjectModal.tsx`
  - The insert is: `supabase.from('projects').insert(...).select().single()`
  - The “Unknown error” comes from `error instanceof Error ? ... : 'Unknown error'`
- Entry points that open this modal:
  - `src/pages/Index.tsx` (Projects list page)
  - `src/components/dashboard/QuickAddModal.tsx` (Quick Add → New Project)
- Organization context feeding `organization_id`:
  - `src/hooks/useOrganization.tsx`

### Database policies + helper functions
- Project SELECT policy (the one causing the “returning row” problem):
  - `supabase/migrations/20251213224611_9ff27cdd-19f2-4fab-bb55-7c791892fa20.sql`
- Recent policy edits you shared:
  - `supabase/migrations/20260204133215_01877c31-92cc-4e9a-bcb9-fb69df6ea45f.sql`
  - `supabase/migrations/20260204133341_033acad1-db98-45ef-9f1e-e422a0a7b044.sql`
- Helper functions involved:
  - `public.is_org_admin`, `public.is_admin`, `public.has_role`, `public.is_project_member`, `public.has_org_membership`

## Everything I checked / tried (audit trail)

1) Confirmed the backend error from the client network log:
   - The failing call is `POST .../rest/v1/projects?select=*`
   - Response is `42501 new row violates row-level security policy for table "projects"`

2) Verified the *current* policies in the database (not just migrations):
   - `projects` has an INSERT policy named **“Org members with appropriate role can insert projects”**
   - `project_members` has an INSERT policy named **“Admin, PM, or org admin can add project members”**

3) Verified helper functions are present and SECURITY DEFINER:
   - `is_org_admin`, `is_admin`, `has_role`, `has_project_role`, `is_project_member`, `has_org_membership`

4) Verified Jon’s org-admin status evaluates correctly:
   - `is_org_admin(jon_user_id, jon_org_id) = true`

5) Found the structural mismatch:
   - The create call requests a returned representation (because `.select().single()`)
   - But `projects` SELECT policy requires project membership that doesn’t exist yet at that time

## Proposed fix (make project creation reliable in all cases)

### A) Fix the database policies so “create + return” works reliably
**Goal:** a creator must be allowed to see the newly created project row immediately (at least for the purpose of returning it), without opening security holes.

1) Update the `projects` SELECT policy:
   - Change from:
     - “only project members can view”
   - To:
     - “project members OR the creator can view”
   - Keep the org isolation check:
     - still require `has_org_membership(organization_id)` so ex-members can’t keep viewing org data

   Conceptually:
   ```sql
   USING (
     has_org_membership(organization_id)
     AND (
       is_project_member(auth.uid(), id)
       OR created_by = auth.uid()
     )
   );
   ```

2) Tighten the `projects` INSERT policy to prevent abuse:
   - Require `created_by = auth.uid()`
   - Require org membership + role (admin/pm) for that `organization_id` (except true global admins, if you want that)
   - This prevents a user from spoofing `created_by` to gain access via the new SELECT rule.

   Conceptually:
   ```sql
   WITH CHECK (
     created_by = auth.uid()
     AND (
       is_admin(auth.uid())
       OR exists (
         select 1
         from organization_memberships om
         where om.user_id = auth.uid()
           and om.organization_id = organization_id
           and om.role in ('admin','pm')
           and om.is_active = true
       )
     )
   );
   ```

3) Remove the fragile “30 seconds” window on `project_members` INSERT:
   - Allow creators to add themselves to their own project **without a time limit**, but only when:
     - `user_id = auth.uid()` AND project `created_by = auth.uid()`
   - This avoids edge failures on slow networks / background tabs.

### B) Fix the frontend so you never see “Unknown error” again
In `src/components/CreateProjectModal.tsx`:

1) Improve error message extraction:
   - If `error` is an object with a `message` string, show it.
   - If it’s a PostgREST-like object (`{ code, message, hint, details }`), format it for the toast.
   - This will immediately surface RLS messages instead of “Unknown error”.

2) Add one guard to reduce race conditions:
   - Disable “Create Project” submission until organization context is done loading, or ensure an `organization_id` is present before trying to insert.

### C) Add “foundation-level” tests and safeguards
1) Add an E2E test that covers:
   - Org admin creates project successfully
   - Org PM creates project successfully
   - Worker cannot create project (UI hides it; API would fail)
   - Newly created project appears in the Projects list immediately

2) Add a regression test for the specific previously-broken scenario:
   - Create project via UI → ensures the INSERT returning path works (no RLS failure)

## Validation matrix (how we’ll prove it’s fixed “in all other cases”)

After implementing the changes:

1) Org Admin (like jon@brandsinblooms.com)
   - Create project from Index page
   - Create project from Quick Add
   - Verify it appears immediately and navigation to `/projects/:id` works

2) Org PM
   - Same as above

3) Foreman / Worker roles
   - Confirm no “Add Project” CTA
   - Confirm backend rejects project inserts if attempted

4) New user with no org
   - Create project triggers org creation first
   - Ensure project create succeeds and project shows up

5) Removed-from-org user
   - Ensure they cannot see org projects even if they created them (the `has_org_membership(organization_id)` part prevents “creator lingering access”)

## Implementation steps (what I would change next once you approve)

1) Create a new database migration to:
   - Update `projects` SELECT policy to include `created_by = auth.uid()` path (still gated by `has_org_membership`)
   - Tighten `projects` INSERT policy to require `created_by = auth.uid()` and correct org role
   - Update `project_members` INSERT policy to remove the 30-second time window and replace with “creator can always self-add”

2) Update `src/components/CreateProjectModal.tsx`:
   - Improve error handling (no more “Unknown error”)
   - Optionally block submission until org context is ready

3) Add/extend E2E test coverage for project creation

