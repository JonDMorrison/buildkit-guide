

# Dashboard UX Overhaul: Clarity, Simplicity, and Help Tooltips

## Problem

The current `/dashboard` is confusing because:
1. **Too many sections** stacked vertically with unclear purpose: Mission Control, Header, Economic Pulse, Focus, My Attention, At a Glance, Operations (with 3 tabs), AI Insights -- that's 7+ visual sections.
2. **Jargon-heavy labels** like "Mission Control", "Economic Pulse", "Confidence Ribbon", "At a Glance" don't explain what they do.
3. **No contextual help** -- there are `traceSource` tooltips for developers but nothing for end users.
4. **Worker dashboard** has the same issue: section names like "Blockers" with 4 sub-categories (Materials, Inspection, Safety, Other) is over-structured for a field worker.

## Solution Overview

**A) Add a `SectionHelp` tooltip component** -- a small `?` icon in the top-right of each `DashboardSection` that shows a plain-English hover explanation of what that section does.

**B) Simplify the PM/Admin dashboard layout** -- reduce from 7 sections down to 4 clear ones with human-readable names.

**C) Simplify the Worker dashboard** -- consolidate blocker categories into a single list, rename sections.

**D) Simplify the Foreman dashboard** -- same help tooltips, clearer naming.

---

## Detailed Changes

### 1. New Component: `SectionHelp`

**File:** `src/components/dashboard/shared/SectionHelp.tsx`

A small `HelpCircle` icon that shows a hover card with a plain-English explanation. Used in every `DashboardSection`.

### 2. Update `DashboardSection` to accept a `helpText` prop

**File:** `src/components/dashboard/shared/DashboardSection.tsx`

Add an optional `helpText?: string` prop. When provided, render the `SectionHelp` icon next to the section title.

### 3. Simplify PM/Admin Dashboard (`src/pages/Dashboard.tsx`)

**Current layout (7+ sections):**
```text
Mission Control (Data Confidence + Top Issues)
Header (Today on Site)
Economic Pulse Strip
Focus (My Day + Blockers)
My Attention (Attention Inbox)
At a Glance (5 KPI cards)
Operations (3 tabs: Site Status / Project Health / Planning)
AI Insights
```

**New layout (4 sections):**
```text
Header ("Today on Site" -- kept as-is)

1. "Your Priorities" (was Focus + At a Glance)
   - Row 1: My Day tasks + Active Blockers (side by side)
   - Row 2: 4-5 KPI metric cards (Today's Tasks, Blocked, Crew, Projects, Change Orders)
   - Help: "Your most urgent tasks, active blockers, and key numbers for today."

2. "Attention Needed" (was My Attention + Mission Control, PM/Admin only)
   - Attention Inbox (if items exist)
   - Data Confidence + Top Issues cards (moved from Mission Control)
   - Help: "Projects flagged for risk changes and data quality alerts."

3. "Site Operations" (was Operations tabs, kept but simplified label)
   - Same 3 tabs (Site Status / Project Health / Planning)
   - Foreman sees this without tabs, just Site Status
   - Help: "Live site conditions, project health signals, and upcoming work."

4. "AI Insights" (kept, lazy loaded)
   - Help: "AI-generated observations based on your project data."
```

Key simplifications:
- **Remove** the standalone "Mission Control" section header and fold its cards into "Attention Needed"
- **Remove** the separate "Economic Pulse Strip" (it's PM-only niche data that adds visual noise -- move to the Operations > Project Health tab)
- **Merge** "Focus" and "At a Glance" into one "Your Priorities" section
- Every section gets a `?` help tooltip

### 4. Simplify Worker Dashboard (`src/components/dashboard/worker/WorkerDashboard.tsx`)

**Current:** 4 sections (Tasks Due Today, My Tasks, Blockers with 4 categories, Quick Actions)

**New:** 3 sections with help tooltips:
- "Today's Work" -- merge Tasks Due Today + Priority Tasks into one card. Help: "Tasks assigned to you, sorted by urgency."
- "Blockers" -- single flat list instead of 4 category cards. Help: "Issues preventing your tasks from moving forward. Report new ones to your foreman."
- "Quick Actions" -- kept, with help: "Shortcuts to common actions like logging time or uploading photos."

### 5. Add help to `DashboardCard` (optional per-card `?`)

**File:** `src/components/dashboard/shared/DashboardCard.tsx`

Add an optional `helpText?: string` prop. When provided, render a `HelpCircle` icon (alongside existing `traceSource` info icon) that shows a user-facing tooltip. This replaces the developer-only `traceSource` for end users.

---

## Technical Details

### Files to create:
- `src/components/dashboard/shared/SectionHelp.tsx`

### Files to edit:
- `src/components/dashboard/shared/DashboardSection.tsx` -- add `helpText` prop
- `src/components/dashboard/shared/DashboardCard.tsx` -- add `helpText` prop
- `src/pages/Dashboard.tsx` -- restructure sections, add help text strings
- `src/components/dashboard/worker/WorkerDashboard.tsx` -- simplify blockers, add help text
- `src/components/dashboard/DashboardMissionControl.tsx` -- no longer a standalone section; export inner content for embedding

### No backend changes. No new queries. All existing data reused.

### Help text dictionary (all roles):

| Section | Help Text |
|---|---|
| Your Priorities | Your most urgent tasks, active blockers, and key numbers for today. |
| Attention Needed | Projects flagged for risk or data quality issues that need your review. |
| Site Operations | Live site conditions, project health signals, and upcoming work planning. |
| AI Insights | AI-generated observations and recommendations based on your project data. |
| Today's Work (worker) | Tasks assigned to you today, sorted by urgency. Tap any task to see details. |
| Blockers (worker) | Issues preventing your tasks from moving forward. Talk to your foreman if stuck. |
| Quick Actions (worker) | Shortcuts to log time, upload receipts, or document site progress. |

