

# OS-Grade Diagnostics Upgrade

Two parts: a new database function and a major UI upgrade to the diagnostics page.

---

## Part 1: Create `rpc_whoami()` Database Function

A new migration to create a minimal, read-only RPC that proves the JWT is reaching the database layer.

```sql
CREATE OR REPLACE FUNCTION public.rpc_whoami()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'uid', auth.uid(),
    'role', auth.role()
  );
$$;

REVOKE ALL ON FUNCTION public.rpc_whoami() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpc_whoami() TO authenticated;
```

---

## Part 2: Upgrade `AIBrainDiagnostics.tsx`

### New state variables
- `authProbe`: stores client-side session/user info (session exists, uid prefix, expires_at, user exists, user id prefix)
- `dbAuth`: stores `rpc_whoami()` result (`uid`, `role`)
- `dbAuthLoading`: loading flag for the whoami call
- `dbAuthError`: error from whoami call

### On-mount behavior
1. Call `supabase.auth.getSession()` and `supabase.auth.getUser()` to populate `authProbe`.
2. Call `supabase.rpc('rpc_whoami')` to populate `dbAuth`.
3. Both run automatically when the page loads.

### New UI sections (inserted before the controls card)

**Auth Probe Card** -- displays:
- `sessionExists`: boolean
- `uid` (first 8 chars)
- `expires_at`
- `userExists`: boolean
- `user.id` (first 8 chars)

**DB Auth Card** -- displays:
- `uid` from `rpc_whoami()`
- `role` from `rpc_whoami()`
- A "Verify DB Auth" refresh button
- Status badge (PASS if uid is non-null, FAIL otherwise)
- Error message if the call fails

### Button gating
- "Run AI Brain Tests" is `disabled` unless `dbAuth?.uid` is truthy (server-side proof).
- If `dbAuth` is null/missing uid, show inline message: "DB auth missing -- please refresh or log in."

### Flow summary

```text
Page mounts
  |
  +---> getSession() + getUser() --> populate Auth Probe card
  |
  +---> rpc_whoami() --> populate DB Auth card
              |
              +-- uid present? --> Enable "Run AI Brain Tests"
              +-- uid null?    --> Disable button, show warning
```

---

## Technical Details

### Files modified
- **New migration**: `rpc_whoami()` function with SECURITY DEFINER, pinned search_path, grant/revoke
- **`src/pages/AIBrainDiagnostics.tsx`**: Add auth probe state, db auth state, on-mount effects, two new UI cards, button gating logic

### No other files change. Existing test runner logic, section cards, and result rendering remain untouched.

