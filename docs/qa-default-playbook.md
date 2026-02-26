# QA: Default Playbook Prompt — PR1 + PR2

## Scenarios

### 1. Set default → dialog copy is truthful
- Create project with job_type "Electrical"
- Select a playbook and click Apply
- Dialog appears: **"Set as default playbook?"**
- Body says: `Make "X" your organization's default playbook for new projects? You can change this anytime in Playbooks.`
- ✅ No job_type-specific claim (default is org-wide)

### 2. Default not recommended when job_type mismatches
- Set playbook A (job_type: "Electrical") as default
- Create project with job_type "Plumbing"
- Playbook A should **NOT** appear as "Recommended" or "Best match"
- Only playbooks matching job_type "Plumbing" should be recommended
- ✅ Default is org-wide but recommendation is job_type-scoped

### 3. Default IS recommended when job_type matches
- Set playbook A (job_type: "Electrical") as default
- Create project with job_type "Electrical"
- Playbook A appears first as "Best match" / "Recommended"
- ✅ Correct behavior

### 4. Sorting is deterministic
- Sort order: matching-default → newly created → job_type match → alphabetical by name
- No randomness or projects_using-based tie-breaking
- ✅ Stable across refreshes

### 5. Error handling
- If rpc_update_playbook fails, error toast shown, project creation unaffected
- ✅ Non-blocking

### 6. Permission guard — non-privileged user (PR2)
- Log in as **foreman** or **internal_worker**
- Create project and apply a playbook
- ✅ "Set as default?" prompt does **NOT** appear
- Project is still created successfully

### 7. Permission guard — privileged user (PR2)
- Log in as **admin** or **pm**
- Create project and apply a non-default playbook
- ✅ "Set as default?" prompt appears
- Click "Yes, set as default" → success toast

### 8. RPC rejection handling (PR2)
- If RPC returns 42501 (e.g., role changed mid-session)
- ✅ Toast: "You don't have permission to set the default playbook."
- Project creation is unaffected

### 9. Cache invalidation correctness (PR2)
- After setting default, `playbooks-list`, `playbook-detail`, and `playbook-performance` queries are all invalidated
- ✅ Default badge appears immediately in playbook list

## Future (PR3)
- If per-job_type defaults are added to schema, update dialog copy and recommendation logic
