
## Plan: Ensure Clean Account Creation Without Inherited Data

### Problem
When new accounts are created, the `useOrganization` hook falls back to a hardcoded "Default Organization" ID even when the user has no actual membership. This creates a confusing state where users might appear to be in an organization they don't belong to, potentially seeing project dropdowns with demo data.

### Solution Overview
1. Remove the default organization fallback for users without memberships
2. Show an appropriate empty state or onboarding flow for users with no organization
3. Ensure the Dashboard handles the "no projects" case gracefully

---

### Technical Changes

#### 1. Update `useOrganization` Hook
**File:** `src/hooks/useOrganization.tsx`

Remove the fallback to `DEFAULT_ORG_ID` when a user has no organization memberships:

```typescript
// BEFORE (problematic):
} else {
  // Fallback to default org for users without memberships
  setActiveOrganizationIdState(DEFAULT_ORG_ID);
  setOrgRole(null);
}

// AFTER (clean):
} else {
  // User has no organization memberships - leave null
  setActiveOrganizationIdState(null);
  setOrgRole(null);
}
```

Also update the error fallback to not default to the org:
```typescript
// BEFORE:
} catch (error) {
  console.error('Error fetching organizations:', error);
  setActiveOrganizationIdState(DEFAULT_ORG_ID);
}

// AFTER:
} catch (error) {
  console.error('Error fetching organizations:', error);
  setActiveOrganizationIdState(null);
}
```

#### 2. Update Dashboard to Handle No Organization
**File:** `src/pages/Dashboard.tsx`

Add an empty state when user has no organization or projects:

```typescript
// After the project query, before rendering:
if (!userProjects || userProjects.length === 0) {
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <Building2 className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Welcome to ProjectPath</h2>
        <p className="text-muted-foreground max-w-md">
          You haven't been added to any projects yet. Ask your organization 
          admin to invite you to a project to get started.
        </p>
      </div>
    </Layout>
  );
}
```

#### 3. Remove `DEFAULT_ORG_ID` Constant
**File:** `src/hooks/useOrganization.tsx`

Remove the constant entirely since it should no longer be used:

```typescript
// DELETE this line:
const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';
```

---

### What This Achieves

- **Clean Slate:** New users without invitations will see an empty/onboarding state, not demo data
- **No Cross-Org Data Leakage:** Users can only see organizations they're actually members of
- **Clear UX:** Users understand they need to be invited to access projects
- **RLS Alignment:** Frontend state now matches what RLS policies would allow anyway

### Files to Modify
1. `src/hooks/useOrganization.tsx` - Remove default org fallback
2. `src/pages/Dashboard.tsx` - Add empty state for users with no projects
