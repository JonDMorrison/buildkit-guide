
# Fix the AI Insights Section on Dashboard

## Problems Found

1. **Duplicate "AI INSIGHTS" header** -- The Dashboard wraps `AIInsightsSection` inside a `DashboardSection` with title "AI Insights" (line 505), and `AIInsightsSection` itself renders *another* `DashboardSection` with the same title (line 25). This produces the two stacked headers visible in the screenshot.

2. **AI Change Feed card is empty** -- The card shows dates ("2026-02-24 -> 2026-02-25") but the body is blank. This happens when the feed exists (has snapshot dates) but all classification counts are 0 and `top_changes` is empty. The card renders nothing in the `{feed && ...}` block because all conditional badges and list items evaluate to false. There is no "all stable" fallback message.

3. **AI Risk Assessment and AI Margin Signal say "Capture one more snapshot"** -- The selected project (37a409ca...) has 0 snapshots in `project_economic_snapshots`. The margin signal RPC returns `snapshot_count: 0`. These cards correctly gate on >= 2 snapshots, but the message is misleading since the user needs *two*, not "one more."

4. **No explanation of what this section is for** -- A non-technical user has no way to understand what "AI Change Feed," "AI Risk Assessment," or "AI Margin Signal" mean.

5. **"My Attention" blank items** -- The `AttentionInbox` renders items from `attention_ranked_projects` but if `project_name` is null/empty (from the RPC), the link text is blank. The recent migration should fix this, but a defensive fallback is needed.

## Plan

### 1. Fix the duplicate header

**File: `src/pages/Dashboard.tsx`** (lines 504-511)

Remove the outer `DashboardSection` wrapper. The `AIInsightsSection` component already renders its own `DashboardSection`. Just render `<AIInsightsSection>` directly, keeping `lazy` behavior by adding the `lazy` prop usage that already exists inside `AIInsightsSection`.

### 2. Add "all stable" fallback in AI Change Feed

**File: `src/components/ai-insights/AIChangeFeedCard.tsx`**

When `feed` exists but all counts are 0 and `top_changes` is empty, show a positive message like:

> "All projects stable -- no risk changes detected between snapshots."

This replaces the blank card body.

### 3. Fix empty-state messaging on Risk and Margin cards

**Files: `src/components/ai-insights/AIProjectRiskCard.tsx`, `src/components/ai-insights/AIMarginSignalCard.tsx`**

Change `emptyMessage` from "Capture one more snapshot to unlock AI insights." to "This project needs at least 2 economic snapshots to show trends. Snapshots are captured daily." -- clearer and more helpful.

### 4. Add help text to the AI Insights section

**File: `src/components/ai-insights/AIInsightsSection.tsx`**

Add a `helpText` prop to the `DashboardSection`:

> "AI-generated analysis comparing your latest economic snapshots. Shows which projects changed, risk levels, and margin trends."

### 5. Add defensive fallback for blank project names in AttentionInbox

**File: `src/components/executive/AttentionInbox.tsx`**

Change `{p.project_name}` to `{p.project_name || 'Unnamed Project'}` in both compact and full modes. This prevents blank rows if the RPC returns null names.

### 6. Add human-readable card descriptions

**Files: `AIChangeFeedCard.tsx`, `AIProjectRiskCard.tsx`, `AIMarginSignalCard.tsx`**

Add `helpText` to each `DashboardCard`:
- Change Feed: "Shows what changed across your projects between the two most recent snapshots."
- Risk Assessment: "Calculates a risk score based on margin pressure, labor burn, and data confidence."
- Margin Signal: "Tracks projected margin and risk score trends over the last 30 days."

---

## Technical Details

### Files to edit:
- `src/pages/Dashboard.tsx` -- Remove duplicate `DashboardSection` wrapper (lines 504-511)
- `src/components/ai-insights/AIInsightsSection.tsx` -- Add helpText to its `DashboardSection`
- `src/components/ai-insights/AIChangeFeedCard.tsx` -- Add "all stable" fallback + helpText
- `src/components/ai-insights/AIProjectRiskCard.tsx` -- Fix empty message + helpText
- `src/components/ai-insights/AIMarginSignalCard.tsx` -- Fix empty message + helpText
- `src/components/executive/AttentionInbox.tsx` -- Defensive fallback for blank project names

### No backend changes
- No RPCs, schemas, or RLS policies modified
- No new queries or hooks created
- All changes are UI-layer text and conditional rendering fixes
