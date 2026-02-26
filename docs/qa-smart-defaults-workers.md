# QA: Smart Defaults — Worker Suggestions

## Overview

Worker suggestions surface recently-assigned crew members when creating or editing tasks, using frequency + recency scoring from `task_assignments` data within the current project.

## Ranking Rules

- **Source**: `task_assignments` joined via `tasks.project_id`
- **Score**: `frequency * 10 + (assigned in last 7 days ? 20 : 0)`
- **Tie-break**: `user_id ASC` (deterministic)
- **Max**: 5 worker IDs returned
- **Display**: Filtered through `projectMembers` — only members of the current project appear

## Test Scenarios — CreateTaskModal

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
- **Verify**: `queryClient.invalidateQueries({ queryKey: ['smart-defaults', projectId] })` fires on success

### 7. No project selected
- **Expected**: No worker chips (hook disabled, returns empty array)

## Test Scenarios — TaskDetailModalEnhanced

### 8. Task with existing assignees
- **Expected**: "Recently assigned" chips exclude users already assigned to the task
- **Verify**: Chips only show unassigned project members from suggestedWorkerIds

### 9. Authorized user clicks chip → quick assign
- **Expected**: Worker is assigned to the task via `task_assignments` insert
- **Verify**: Assigned workers list updates immediately (refetch)
- **Verify**: Clicked chip disappears (now assigned)
- **Verify**: Toast confirms "Worker assigned"

### 10. Unauthorized user sees no chips
- **Expected**: If user lacks `assign_tasks` permission, chip row is not rendered
- **Verify**: `canEditTrade` gate prevents rendering

### 11. Project with no assignment history
- **Expected**: No chip row appears in task detail modal

### 12. Quick assign invalidates smart defaults
- **Steps**: Quick-assign a worker → close modal → reopen another task detail
- **Expected**: Smart defaults cache for this project is invalidated
- **Verify**: `queryClient.invalidateQueries({ queryKey: ['smart-defaults', projectId] })` fires

### 13. Double-click prevention
- **Expected**: While an assignment is in progress, clicked chip shows disabled state
- **Verify**: `assigningWorkerId` state prevents concurrent inserts

### 14. Stale duplicate guard
- **Expected**: If UI is stale and user clicks an already-assigned worker, toast shows "Already assigned"

## Query Details

- **QueryKey**: `['smart-defaults', projectId, 'assignments']`
- **Invalidation**: Project-scoped `['smart-defaults', projectId]` on all modals
- **StaleTime**: 5 minutes
- **Gating**: `enabled: !!projectId`

## Performance Note

Creating a task in Project A invalidates only `['smart-defaults', projectA_id]`. Smart defaults for Project B remain cached and are not refetched.
