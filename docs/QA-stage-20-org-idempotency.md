# Stage 20 QA Script — Org Creation Idempotency

## Manual QA Checklist

### 1. Brand New User → Create Org → Refresh → No Duplicates
1. Sign up as a new user
2. Complete Step 1 (role selection)
3. On Step 2, enter company name "Test Corp" and click Continue
4. **Immediately refresh the browser**
5. Verify: the wizard restarts but the existing org is detected via `useOrganization`
6. On Step 2, enter same name and submit again
7. Verify: no duplicate org is created; the RPC returns `already_existed: true`
8. Check database: only one organization with slug `test-corp` exists

### 2. Back Button Stress
1. New user → Step 1 → Step 2 (enter org name)
2. Click Continue (org created)
3. Click Back to return to Step 2
4. Click Continue again
5. Verify: no second org is created; `orgCreated` state is reused
6. Repeat 3-4 multiple times
7. Verify: still only one org in DB

### 3. Double-Click Submit
1. New user → Step 1 → Step 2
2. Enter org name "Double Click Inc"
3. **Rapidly double-click** the Continue button
4. Verify: `isSubmitting` guard prevents parallel calls
5. Verify: only one org created
6. Verify: button shows disabled/loading state on first click

### 4. Existing Org Member → No New Org
1. Sign in as a user who already has an organization membership
2. Navigate to `/welcome` (may need to clear `has_onboarded`)
3. On Step 2, the `useEffect` guard should pre-populate `orgCreated` from existing org
4. Verify: submitting Step 2 skips to Step 3 without creating a new org

### 5. Slug Collision
1. Create org with name "Acme" → slug should be `acme`
2. (Different user / reset) Create org with name "Acme" again
3. Verify: second org gets slug `acme-2` (deterministic)
4. Create third "Acme" → slug `acme-3`
5. Verify: no randomness, no timestamps in slugs

### 6. CreateProjectModal Fallback Org
1. Navigate to project creation as user with no org
2. Modal should call `rpc_onboarding_ensure_org` instead of raw insert
3. Verify: org is created with membership + settings atomically

## Final Confirmation Checklist

- [ ] No existing RPC contracts were modified (only NEW `rpc_onboarding_ensure_org` added)
- [ ] No margin/volatility/snapshot engines touched
- [ ] Gating patterns respected (`ProtectedRoute` on `/welcome` and `/setup`)
- [ ] Deterministic slug resolution: `base`, `base-2`, `base-3` (no randomness)
- [ ] Change set is PR-sized (4 files modified, 1 created, 1 migration)
- [ ] NULL slugs backfilled in migration before `NOT NULL` constraint applied
- [ ] `SECURITY DEFINER` with pinned `search_path` on new RPC (matches repo pattern)
