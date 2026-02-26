# QA: Smart Defaults — Worker Suggestions

## Overview

Worker suggestions surface recently-assigned crew members when creating tasks, using frequency + recency scoring from `task_assignments` data within the current project.

## Ranking Rules

- **Source**: `task_assignments` joined via `tasks.project_id`
- **Score**: `frequency * 10 + (assigned in last 7 days ? 20 : 0)`
- **Tie-break**: `user_id ASC` (deterministic)
- **Max**: 5 worker IDs returned
- **Display**: Filtered through `projectMembers` — only members of the current project appear

## Test Scenarios

### 1. New project with no task history
- **Expected**: No "Recently assigned" chip section appears
- **Verify**: Hook returns `suggestedWorkerIds: []`

### 2. Project with task assignments
- **Expected**: Up to 5 worker chips appear above the worker multi-select
- **Verify**: Workers are ordered by score desc, then user_id ASC

### 3. Clicking a worker chip
- **Expected**: Worker is added to `selectedWorkers` state
- **Verify**: Chip disappears from suggestions (already selected)
- **Verify**: Worker appears in the selected badges list

### 4. Already-selected workers are excluded from chips
- **Expected**: If a worker is already selected, they do not appear in suggestion chips
- **Verify**: Re-selecting doesn't duplicate

### 5. Workers not in projectMembers are excluded
- **Expected**: If a user_id from task_assignments is no longer a project member, they don't appear
- **Verify**: Only current project members show as chips

### 6. Invalidation after task creation
- **Steps**: Create a task with assigned workers → reopen Create Task modal
- **Expected**: New assignments reflected in suggestions (stale cache invalidated)
- **Verify**: `queryClient.invalidateQueries({ queryKey: ['smart-defaults'] })` fires on success

### 7. No project selected
- **Expected**: No worker chips (hook disabled, returns empty array)

## Query Details

- **QueryKey**: `['smart-defaults', 'assignments', projectId]`
- **Invalidation**: Broad prefix `['smart-defaults']` on all create modals
- **StaleTime**: 5 minutes
- **Gating**: `enabled: !!projectId`
