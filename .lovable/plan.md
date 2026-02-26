

# Smart Memory -- Auto-Suggest Trades and Repeat Choices

## Overview

Add a `useSmartDefaults` hook and a `SmartSuggestionChips` component that surface recently-used trades, locations, crew count, and weather across form modals. Zero schema changes. Follows the existing `SmartJobSiteSuggestion` pattern.

## New Files

### 1. `src/hooks/useSmartDefaults.ts`

A hook that accepts `projectId` and runs 4 parallel queries via `useQuery`:

| Query | Table | Columns Selected | Limit |
|---|---|---|---|
| Tasks | `tasks` | `assigned_trade_id, location, created_at` | 50 |
| Deficiencies | `deficiencies` | `assigned_trade_id, location, created_at` | 20 |
| Manpower | `manpower_requests` | `trade_id, requested_count, created_at` | 10 |
| Daily logs | `daily_logs` | `crew_count, weather, created_at` | 5 |

All filtered by `project_id` and ordered by `created_at desc`.

**Aggregation logic:**

- **Trades**: Combine all trade IDs from all 3 sources, count frequency, apply recency bonus (`score = count * 10 + (used in last 7 days ? 20 : 0)`). Resolve trade names by cross-referencing the `trades` table (fetched once). Return top 3 sorted by score desc, then `name ASC` for ties.
- **Locations**: Merge from tasks + deficiencies, normalize (trim, lowercase for dedup), filter junk (`"tbd"`, `"-"`, `"n/a"`, empty). Return most-recent-first, max 3 unique.
- **Crew count**: `crew_count` from most recent daily log (not "yesterday" -- handles skipped days).
- **Weather**: `weather` from most recent daily log.

**Returns:**
```typescript
interface SmartDefaults {
  topTrades: Array<{ id: string; name: string; count: number }>;
  recentLocations: string[];
  lastCrewCount: number | null;
  lastWeather: string | null;
  loading: boolean;
}
```

**Cache:** `queryKey: ['smart-defaults', projectId]`, `staleTime: 5 * 60 * 1000`.

### 2. `src/components/common/SmartSuggestionChips.tsx`

A generic chip row component:

```
Recently used:  [ Electrician ]  [ Plumbing ]  [ HVAC ]
```

**Props:**
```typescript
interface SmartSuggestionChipsProps {
  label?: string;           // default "Recently used"
  items: Array<{ id: string; name: string }>;
  onSelect: (id: string) => void;
}
```

- Uses existing `Badge variant="outline"` with `cursor-pointer` and subtle hover.
- Renders nothing if `items` is empty.
- Max items controlled by the caller (hook already caps at 3).

## Modified Files

### 3. `CreateTaskModal.tsx`
- Import `useSmartDefaults`, `SmartSuggestionChips`.
- Call `useSmartDefaults(form.projectId)`.
- Render `SmartSuggestionChips` with `topTrades` above the "Assigned Trade" `Select` (line ~339). Clicking a chip sets `form.tradeId`.
- After successful submit (line ~272), add `queryClient.invalidateQueries({ queryKey: ['smart-defaults'] })`. Import `useQueryClient`.

### 4. `CreateDeficiencyModal.tsx`
- Same pattern: `useSmartDefaults(formData.project_id)`.
- Trade chips above the trade `Select` (line ~226).
- Location chips rendered as small clickable text suggestions below the location `Input` (line ~248). Clicking sets `formData.location`.
- Invalidate `smart-defaults` on successful submit.

### 5. `CreateManpowerRequestModal.tsx`
- `useSmartDefaults(form.project_id)`.
- Trade chips above trade `Select` (line ~190).
- If `lastCrewCount` exists and `form.requested_count` is empty, pre-fill it on first load (via a `useEffect` that checks a `hasUserEdited` ref).
- Invalidate on submit.

### 6. `DailyLogForm.tsx`
- `useSmartDefaults(projectId)`.
- On modal open, if no `existingLog` and form fields are empty: pre-fill `crew_count` from `lastCrewCount`, `weather` from `lastWeather`.
- Uses a `useEffect` gated on `open && !existingLog` to set values once.
- Invalidate on submit.

### 7. `DailySafetyWizard.tsx` (WizardStepOne)
- `useSmartDefaults(projectId)` called in the wizard.
- Pass `topTrades` names to WizardStepOne as a `suggestedTrades` prop.
- In WizardStepOne, if `selectedTrades` is empty on mount and `suggestedTrades` has items, pre-select them.
- This is a fallback -- the existing auto-fill from check-ins takes priority.

## What Does NOT Change

- No new database tables, RPCs, or edge functions.
- No schema migrations.
- No changes to existing form validation or submission logic.
- All pre-fills are overridable by the user.
- Forms with no project history behave exactly as before (no chips, no pre-fills).

## QA Checklist

- New project with no history: no chips, no pre-fills, forms unchanged
- Project with 10+ tasks: top 3 trades appear as chips, click fills dropdown
- Location suggestions appear below location input (task + deficiency modals)
- DailyLogForm pre-fills crew count and weather from most recent log
- Manpower modal pre-fills requested count from history
- User can override any pre-filled value
- After creating a new task, reopening the modal shows updated suggestions
- Safety wizard pre-selects frequent trades when no check-in data exists

