# QA — Smart Defaults (Smart Memory)

## Scenarios

### 1. New project (no history)
- Open any creation modal for a brand-new project
- **Expected:** No suggestion chips, no prefills, forms behave normally

### 2. Project with task/deficiency history — trade chips
- Create 3+ tasks with different trades on a project
- Reopen CreateTaskModal or CreateDeficiencyModal
- **Expected:** Top 3 trades appear as "Recently used" chips; clicking fills dropdown

### 3. Location suggestions
- Create tasks/deficiencies with distinct locations
- Reopen modal
- **Expected:** Up to 3 recent locations appear below the location field; junk values ("tbd", "n/a") are excluded

### 4. Daily log prefill (crew count & weather)
- Create a daily log with crew_count=12, weather="Sunny"
- Open DailyLogForm for a new log on the same project
- **Expected:** crew_count prefilled to 12, weather prefilled to "Sunny"

### 5. Manpower requested_count prefill — project-wide
- Create a manpower request with requested_count=8 (any trade)
- Open CreateManpowerRequestModal again (no trade selected yet)
- **Expected:** Workers Needed prefilled to 8 (from most recent manpower request, NOT daily log crew count)

### 6. Manpower requested_count prefill — trade-specific
- Create manpower request: trade=Electrician, requested_count=4
- Create manpower request: trade=Plumber, requested_count=6
- Open CreateManpowerRequestModal, select trade=Electrician
- **Expected:** Workers Needed prefilled to 4 (trade-specific value)

### 7. Daily log crew_count does NOT leak into manpower requested_count
- Create a daily log with crew_count=25
- Open CreateManpowerRequestModal (no prior manpower requests)
- **Expected:** Workers Needed is EMPTY (not 25)

### 8. User override
- Any prefilled value can be changed by the user
- After editing, the prefill should not re-apply

### 9. Cache invalidation (project-scoped)
- Create a new task/deficiency/manpower request/daily log
- Reopen the same or different modal
- **Expected:** Suggestions reflect the newly created record
- **Performance:** Creating a task in Project A should NOT refetch smart defaults for Project B. Invalidation targets `['smart-defaults', projectId]` only.

### 10. Safety wizard trade fallback
- On a project with no check-in data for today
- Open DailySafetyWizard
- **Expected:** Top trades from smart defaults are pre-selected as fallback

### 11. Worker suggestions
- See `docs/qa-smart-defaults-workers.md` for detailed scenarios
