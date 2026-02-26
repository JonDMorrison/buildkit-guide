# QA: Default Playbook Prompt — PR1

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

## Future (PR2)
- If per-job_type defaults are added to schema, update dialog copy and recommendation logic
