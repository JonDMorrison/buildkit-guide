
## Problem Identified

Jordan Pughe cannot create projects because of missing permissions. The database Row-Level Security (RLS) policy requires users to have either:
1. **Admin role**, OR
2. **Project Manager role** (globally assigned)

Jordan currently has **neither** - no entries exist in the `user_roles` table for their account.

---

## Root Cause

The "Create Project" button is visible to Jordan (the frontend check uses `isAdmin || isPM()`), but when they actually try to save, the database blocks the insert because Jordan lacks the required role in the `user_roles` table.

---

## Solution Options

**Option A: Add Jordan as a Project Manager (Recommended)**
- Insert a `project_manager` role for Jordan in the `user_roles` table
- This gives them permission to create new projects and manage them
- Best for team leads who need to create and coordinate projects

**Option B: Add Jordan as an Admin**
- Insert an `admin` role for Jordan
- This gives them full access to everything in the app
- Best for senior managers who need complete oversight

---

## Implementation Steps

1. **Add role to `user_roles` table** for Jordan's user ID (`250fa4b2-2f13-4760-b04a-b3e4a2fe5ee7`)

2. **Add organization membership** (optional but recommended) - Jordan should also be added to the organization so they appear in team lists and can be assigned to projects properly

---

## Technical Details

The following SQL will grant Jordan project manager permissions:

```sql
-- Add project_manager role for Jordan
INSERT INTO user_roles (user_id, role)
VALUES ('250fa4b2-2f13-4760-b04a-b3e4a2fe5ee7', 'project_manager');

-- Add to default organization (recommended)
INSERT INTO organization_memberships (user_id, organization_id, role, is_active)
VALUES (
  '250fa4b2-2f13-4760-b04a-b3e4a2fe5ee7',
  '00000000-0000-0000-0000-000000000001',
  'pm',
  true
);
```

After these changes, Jordan will be able to create projects immediately (may need to refresh the browser).

---

## Recommendation

I recommend **Option A** (Project Manager role) unless Jordan needs full admin access to all features. Would you like me to proceed with adding Jordan as a Project Manager?
