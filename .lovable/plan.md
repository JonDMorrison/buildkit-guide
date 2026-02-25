

# Simplify the Project Overview Page

## What's Wrong Today

The project page is overwhelming. Here's what you see scrolling top-to-bottom:

1. A breadcrumb showing a raw UUID (not the project name)
2. A "Back to Projects" button
3. Optional context/labor banners
4. A header with the project name, job number, integrity badge, status dropdown, and currency selector -- all crammed on one line
5. Three stat cards (Progress, Blocked Tasks, Safety Compliance) in a 3-column grid that wastes space when data is 0
6. An AI Insights section with 2 cards
7. An **11-tab bar** (Overview, Tasks, Scope, Budget, Drawings, Lookahead, Trades, Safety, Docs, Issues, Receipts) that's nearly unreadable on most screens
8. Inside the Overview tab: Economic Control Panel, Customer & Contacts (3-column), Drawings & Plans, Pending Manpower, Blocked Tasks (again), Upcoming Deadlines, Recent Activity, a full-width "Add Task" button, and an AI Workflow toggle

That's roughly **15+ distinct visual blocks** before you even switch tabs.

## The Simplification Plan

### 1. Fix the breadcrumb

Replace the raw UUID with the project name (e.g., `Projects > Margin Stress Test Project`).

### 2. Consolidate the header

- Merge the "Back to Projects" button into the breadcrumb (clicking "Projects" navigates back).
- Move the currency selector and integrity badge into the kebab/more menu -- they're rarely changed.
- Keep only: **Project Name**, **Job Number**, **Status dropdown**, and **kebab menu**.

### 3. Replace the 3 stat cards with a compact summary strip

Instead of 3 large cards taking up an entire screen fold, show a single horizontal strip:
```text
[=== 45% complete ===]  12 tasks | 2 blocked | Safety: 100%
```
One line, always visible, no cards.

### 4. Move AI Insights below the tabs (not above)

AI Insights currently sits between the stats and the tabs, pushing the tab bar far down the page. Move it into the Overview tab content or make it a collapsible section at the bottom.

### 5. Reduce 11 tabs to 5 grouped tabs

Current 11 tabs are too many. Group them:

| New Tab | Contains |
|---|---|
| **Overview** | Summary strip, Economic Control, Customer & Contacts, recent activity |
| **Work** | Tasks list, Blockers, Lookahead, Manpower -- everything about "what's being done" |
| **Financials** | Scope, Budget, Receipts -- everything about money |
| **Documents** | Drawings, Docs, Safety forms -- everything you upload/review |
| **Issues** | Deficiencies/punch list, trades list |

This reduces cognitive load from 11 choices to 5 clear categories.

### 6. Simplify the Overview tab content

Current Overview tab has 8 sections stacked vertically. Simplify to:

- **At a Glance** -- the compact progress strip (from change #3) + Economic Control (collapsed by default if position is "Stable")
- **Key Contacts** -- Customer & Contacts card (kept, it's useful)
- **What Needs Attention** -- merge Blocked Tasks + Upcoming Deadlines into one "attention" list, hide if empty
- Remove: standalone "Recent Activity" card (low value), standalone "Add Task" button (redundant with sidebar nav), standalone Drawings preview (now in Documents tab), Workflow Toggle (move to kebab menu)

### 7. Add help tooltips to each section

Using the existing `SectionHelp` component, add `?` tooltips to every section header so new users understand what each area does.

---

## Technical Details

### Files to edit:

- **`src/pages/ProjectOverview.tsx`** -- Main restructure:
  - Fix breadcrumb to show project name
  - Remove "Back to Projects" button (breadcrumb handles it)
  - Simplify header (move currency/integrity into kebab menu)
  - Replace 3 stat cards with compact `ProgressStrip` component
  - Move AI Insights into Overview tab
  - Reduce TabsList from 11 to 5 tabs
  - Reorganize tab content into grouped views
  - Simplify Overview tab (merge blockers + deadlines, remove low-value cards)
  - Move Workflow Toggle into kebab menu

### Files to create:

- **`src/components/project/ProgressStrip.tsx`** -- Compact single-line progress summary (progress bar + key stats in one row)
- **`src/components/project/WorkTab.tsx`** -- Combined Tasks + Blockers + Lookahead + Manpower tab
- **`src/components/project/FinancialsTab.tsx`** -- Combined Scope + Budget + Receipts tab
- **`src/components/project/DocumentsTab.tsx`** -- Combined Drawings + Docs + Safety tab

### Files unchanged:

- All existing tab content components (ProjectTasks, ProjectDrawings, etc.) are reused inside the new grouped tabs -- no logic rewrite needed
- No backend changes, no new queries, no schema changes
- EconomicControlPanel stays as-is, just repositioned
- CustomerHierarchyCard stays as-is

### Summary of what gets removed/moved:

| Element | Action |
|---|---|
| Raw UUID breadcrumb | Replace with project name |
| "Back to Projects" button | Remove (breadcrumb handles it) |
| 3 large stat cards | Replace with 1-line ProgressStrip |
| AI Insights above tabs | Move into Overview tab content |
| 11-tab bar | Consolidate to 5 tabs |
| Drawings preview in Overview | Remove (now in Documents tab) |
| "Add Task" full-width button | Remove (Tasks tab + sidebar) |
| Recent Activity card | Remove (low signal) |
| Workflow Toggle card | Move into kebab menu |
| Currency selector in header | Move into kebab menu |
| Integrity badge in header | Move into kebab menu |

