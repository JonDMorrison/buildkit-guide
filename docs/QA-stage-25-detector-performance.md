# QA — Stage 25: Auto-Detection Performance + Reliability

## What Changed

- **Parallel execution**: All detectors now run concurrently via `Promise.all` with individual `runDetector` wrappers that catch errors per-detector.
- **Failure isolation**: If one detector fails (e.g., RPC timeout), remaining detectors still return results. A subtle "Some checks couldn't load" banner appears with a Retry button.
- **React-query caching**: Detection results are cached under `['setup-detectors', orgId]` with 60s `staleTime`, preventing re-execution on every mount/re-render.
- **Retry control**: `retryDetectors()` invalidates the detector cache, triggering a fresh parallel run.

## Manual QA

### 1. Perceived load time
- Navigate to `/setup`
- Checklist should appear quickly (detectors run in parallel, not sequentially)

### 2. Failure isolation
- Throttle network or block a specific table query
- Checklist should still render with partial results
- "Some checks couldn't load" banner should appear
- Clicking "Retry" should re-run detectors

### 3. No spam
- Open Network tab, navigate to `/setup`
- Detectors should fire once on mount
- Navigating away and back within 60s should NOT re-fire detectors (cached)

### 4. Completion consistency
- Complete a step (e.g., invite a user)
- Progress bar and checklist should both update
- Refresh page — state persists

## Files Changed

- `src/hooks/useSetupProgress.tsx` — extracted `detectAllSteps()`, parallel execution, react-query caching
- `src/components/setup/useSmartChecklist.ts` — exposes `detectorErrors` + `retryDetectors`
- `src/components/setup/SmartChecklist.tsx` — error banner with retry button
