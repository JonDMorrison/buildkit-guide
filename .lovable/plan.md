
# Rename AI-Branded Labels Across the App

## Philosophy

AI should work quietly in the background. Users care about *what* the information tells them, not *that* it comes from AI. The rename shifts labels from tech-jargon ("AI Change Feed") to outcome-oriented names ("What Changed", "Risk Assessment", "Margin Trends").

## Complete Inventory of AI-Branded Labels

Here is every place in the app that surfaces "AI" in user-facing text, grouped by priority:

### Tier 1 — Dashboard Cards (the ones you saw)

| Current Label | New Label | File |
|---|---|---|
| "AI Change Feed" | "What Changed" | `src/components/ai-insights/AIChangeFeedCard.tsx` |
| "AI Risk Assessment" | "Risk Assessment" | `src/components/ai-insights/AIProjectRiskCard.tsx` |
| "AI Margin Signal" | "Margin Trends" | `src/components/ai-insights/AIMarginSignalCard.tsx` |
| "AI Insights" (section header) | "Insights" | `src/components/ai-insights/AIInsightsSection.tsx` |

### Tier 2 — Navigation and Breadcrumbs

| Current Label | New Label | File |
|---|---|---|
| "AI Brain" (nav item) | "Diagnostics" | `src/hooks/useNavigationTabs.tsx` (line 55) |
| "AI Assistant" (breadcrumb) | "Assistant" | `src/components/Breadcrumbs.tsx` (line 20) |
| "AI Assistant" (dashboard widget label) | "Assistant" | `src/components/dashboard/DashboardCustomizer.tsx` (line 27) |

### Tier 3 — Pages and Headings

| Current Label | New Label | File |
|---|---|---|
| "AI Assistant" (page heading) | "Assistant" | `src/pages/AI.tsx` (line 119) |
| "AI Brain Diagnostics" (page heading) | "System Diagnostics" | `src/pages/ai-brain/DiagnosticsSection.tsx` (lines 732, 735, 786) |
| "AI Brain Test Runner" / "AI Brain Scenario Suite" (release checklist) | "Test Runner" / "Scenario Suite" | `src/pages/AdminReleaseChecklist.tsx` (lines 363, 371) |

### Tier 4 — Notifications and Control Center

| Current Label | New Label | File |
|---|---|---|
| "AI Insights" (notification tab) | "Insights" | `src/components/notifications/NotificationsDropdown.tsx` (line 167) |
| "Select a project to see AI insights" | "Select a project to see insights" | `src/components/notifications/NotificationsDropdown.tsx` (line 237) |
| "Select a project to see AI insights" | "Select a project to see insights" | `src/components/control-center/AIInsightsList.tsx` (line 76) |
| "AI insights" (empty message in change feed) | "insights" | `src/components/ai-insights/AIChangeFeedCard.tsx` (line 42) |

### Tier 5 — Marketing / Onboarding (recommend but lower priority)

| Current Label | New Label | File |
|---|---|---|
| "AI Assistant" (features page) | "Smart Assistant" | `src/pages/Features.tsx` (line 145) |
| "AI Assistant" (welcome wizard) | "Smart Assistant" | `src/components/onboarding/WelcomeWizard.tsx` (line 80) |
| "AI assistant" (org onboarding) | "assistant" | `src/components/onboarding/OrgOnboardingWizard.tsx` (line 308) |

### Tier 6 — Internal/Developer Only (no rename needed)

These are internal trace sources, RPC keys, and backend function names that users never see:
- `rpc-tracer.ts` card labels (trace only, not rendered to users as headings)
- `actionRouter.ts` label "View AI Brain" (change to "View Diagnostics")
- Edge function error messages ("AI service not configured") -- keep as-is, these are error logs

---

## Implementation Plan

### Step 1: Rename the 3 dashboard card titles + section header
- `AIChangeFeedCard.tsx`: title "AI Change Feed" -> "What Changed"
- `AIProjectRiskCard.tsx`: title "AI Risk Assessment" -> "Risk Assessment"
- `AIMarginSignalCard.tsx`: title "AI Margin Signal" -> "Margin Trends"
- `AIInsightsSection.tsx`: section title "AI Insights" -> "Insights"
- `AIChangeFeedCard.tsx`: empty message remove "AI" from "AI insights"

### Step 2: Rename nav item and breadcrumb
- `useNavigationTabs.tsx` line 55: "AI Brain" -> "Diagnostics"
- `Breadcrumbs.tsx` line 20: "AI Assistant" -> "Assistant"
- `DashboardCustomizer.tsx` line 27: "AI Assistant" -> "Assistant"

### Step 3: Rename page headings
- `AI.tsx` line 119: "AI Assistant" -> "Assistant"
- `DiagnosticsSection.tsx`: "AI Brain Diagnostics" -> "System Diagnostics", button "Run AI Brain Tests" -> "Run Diagnostics"

### Step 4: Rename notification and control center labels
- `NotificationsDropdown.tsx`: "AI Insights" tab -> "Insights", empty message drop "AI"
- `AIInsightsList.tsx`: empty message drop "AI"

### Step 5: Rename release checklist labels
- `AdminReleaseChecklist.tsx`: "AI Brain Test Runner" -> "Test Runner", "AI Brain Scenario Suite" -> "Scenario Suite"

### Step 6: Update action router label
- `actionRouter.ts`: "View AI Brain" -> "View Diagnostics"

### Not Changed (intentional)
- File names (e.g. `AIChangeFeedCard.tsx`) stay as-is to avoid import churn
- Backend table/RPC names unchanged
- Edge function error messages unchanged
- Internal trace source strings unchanged
- Marketing pages left for a separate pass (lower priority, different audience)

## Technical Scope
- ~12 files edited, all UI-layer string changes
- No backend, RPC, or schema changes
- No new components or hooks
- No logic changes -- purely label/text swaps
