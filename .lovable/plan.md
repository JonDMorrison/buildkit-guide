

# Landing Page Copy Refresh

## Why
The current landing page covers five feature areas (tasks, safety, time tracking, AI, offline UX) but the app has grown significantly. Major capabilities like financial intelligence, executive dashboards, portfolio reporting, health diagnostics, and certification scoring are completely absent from the marketing copy. This is a missed opportunity to differentiate from simpler construction tools.

## What Changes

### 1. Update Hero Subtitle
**Current:** "Track tasks, time, and safety across every trade -- from one app."
**Proposed:** "Coordinate tasks, track costs, and run diagnostics across every trade and project -- from one app."

This signals the app is more than a checklist tool.

### 2. Add New Section: "Financial Intelligence" (after Time Tracking, before AI)
A new alternating-layout section highlighting:
- **Headline:** "Know Where Your Money Is Going -- Before It's Gone"
- **Subtitle:** Budget builder, estimate-vs-actual tracking, and profit risk alerts that catch cost overruns early.
- **Bullet points:**
  - Budget builder with line-item estimates
  - Variance tracking: budget, labor, and materials
  - Profit risk scoring per project
  - Receipt capture with AI categorization
- **Screenshot:** reuse `screenshotAi` or an existing asset (can be swapped later for a dedicated financial screenshot)

### 3. Add New Section: "Executive Portfolio View" (after Financial Intelligence, before AI)
- **Headline:** "Every Project. One Dashboard. Zero Surprises."
- **Subtitle:** Cross-project KPIs, attention inbox, and change feed so leadership sees what matters without chasing PMs.
- **Bullet points:**
  - Portfolio-level margin and cost rollups
  - Attention inbox surfaces what needs action now
  - Weekly AI-generated insight reports
  - Certification scoring tracks operational maturity

### 4. Update AI Section Copy
**Current bullets:** Document Q&A, Escalation emails, Receipt scanning
**Proposed bullets (expanded to reflect what actually exists):**
- Document Q&A with source references
- Weekly insight reports from project snapshots
- Hazard suggestions based on weather and tasks
- Escalation emails drafted instantly

### 5. Add "Health Diagnostics" to "Built for the Site" Grid
Replace or add a 5th card:
- **Title:** "Self-Diagnosing"
- **Description:** "Built-in health checks catch data gaps before they become problems."

This replaces "Voice Input" (which is a secondary feature) or extends the grid to 5 items.

### 6. Update Footer Copyright Year
Change "2025" to "2026" across Landing.tsx, Features.tsx, and HowItWorks.tsx footers.

## Files Modified
- `src/pages/Landing.tsx` -- all copy changes above (new sections, updated hero, updated AI bullets, updated "Built for the Site" grid, footer year)

## No Backend Changes
All changes are purely frontend copy and layout within the existing section pattern (alternating grid with icon bullets). No new routes, RPCs, or database changes.

## Risks
- Minimal. Pure copy/layout changes using existing component patterns.
- New sections reuse the same alternating `grid lg:grid-cols-2` layout already used throughout the page.
- Screenshots for new sections can temporarily reuse existing assets until dedicated ones are created.

