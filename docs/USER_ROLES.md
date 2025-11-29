# User Roles Management

## Role Hierarchy

1. **Admin** - Full system access
2. **Project Manager** - Can create/edit tasks, manage lookaheads, approve manpower, see all trades
3. **Foreman** - Can create tasks, mark blockers, submit safety forms
4. **Internal Worker** - Can view assigned tasks, upload photos, ask AI questions
5. **External Trade** - Limited access, can only view their own tasks, upload attachments, ask AI

## Creating the First Admin

After signing up your first user, you need to manually assign the admin role. You can do this through the Lovable Cloud backend:

1. Open the backend (Cloud tab in Lovable)
2. Navigate to the `user_roles` table
3. Insert a new row:
   - `user_id`: Copy the UUID from the `profiles` table for your user
   - `role`: Select `admin`

Alternatively, run this SQL query (replace `YOUR_USER_EMAIL` with your actual email):

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM public.profiles
WHERE email = 'YOUR_USER_EMAIL';
```

## Assigning Roles to Users

Once you have an admin account, you can assign roles through:

1. **Backend Interface** (for now):
   - Go to Cloud → Database → user_roles table
   - Insert new role assignments

2. **Future Admin Panel** (to be built):
   - Admin dashboard with role management UI
   - Bulk role assignments
   - Role removal/updates

## Role Combinations

Users can have multiple roles (e.g., a Project Manager can also be a Foreman). The system uses the highest permission level for access control.

## Permission Matrix

| Feature | Admin | PM | Foreman | Internal | External |
|---------|-------|-----|---------|----------|----------|
| View all projects | ✅ | ❌ | ❌ | ❌ | ❌ |
| View own projects | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create projects | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create/edit tasks | ✅ | ✅ | ✅ | ❌ | ❌ |
| View tasks | ✅ | ✅ | ✅ | Own only | Own only |
| Mark blockers | ✅ | ✅ | ✅ | ❌ | ❌ |
| Submit safety forms | ✅ | ✅ | ✅ | ❌ | ❌ |
| Approve manpower | ✅ | ✅ | ❌ | ❌ | ❌ |
| Upload attachments | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ask AI questions | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manage users/roles | ✅ | ❌ | ❌ | ❌ | ❌ |
