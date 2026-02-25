

# Simplify the Executive Dashboard

## Current State

The /executive page has **11 sections** with significant overlap. Three different areas show "which projects need attention" (Attention Inbox, Economic Signals, Change Log). Two areas show aggregate risk stats (Hero and Portfolio Health). Diagnostic cards (Confidence Ribbon, Data Integrity, Snapshot Status) belong on /data-health, not an executive view. The Insights section is duplicated from /dashboard.

## Proposed Simplified Layout

Strip it down to **4 sections** that answer the 4 questions an executive actually asks:

```text
+--------------------------------------------------+
| Header: "Executive Overview"     [Refresh] [Export]|
+--------------------------------------------------+
| 1. BRIEF: What happened this week?                |
|    5 headline metrics + date range                |
|    (existing Weekly Brief Hero, keep as-is)       |
+--------------------------------------------------+
| 2. ATTENTION: Which projects need me?             |
|    Attention Inbox (ranked list, keep as-is)      |
|    + Change Log collapsed inside (already there)  |
+--------------------------------------------------+
| 3. HEALTH: How's the portfolio overall?           |
|    Portfolio Health card (keep, it has OS score)   |
+--------------------------------------------------+
| 4. NOTES: What did we decide? (collapsed)         |
|    Decision Notes (collapsed by default)          |
+--------------------------------------------------+
```

## What Gets Removed

1. **Confidence Ribbon** -- Move to /data-health where it belongs. Executives don't need "72% coverage" on their main screen.

2. **Export Brief actions row** (Simple/Report toggle + Copy Brief + Download Brief) -- Consolidate into the Hero card. The Hero already has "Copy Summary". Replace it with a single dropdown: Copy / Download / Report format. Eliminates a whole visual row.

3. **Economic Signals section** -- Redundant with Attention Inbox. Both show "top risk projects." The Inbox version is more actionable (has next-step CTAs). Remove entirely.

4. **Confidence and Evidence footer** (Data Integrity + Snapshot Status) -- This is diagnostic detail. Already accessible via the "Data Health" link in the header. Remove from this page.

5. **Insights section** (AIInsightsSection) -- Already on /dashboard. Remove the duplicate. Executives who want project-level risk/margin cards can go to /dashboard.

6. **Manual "Load Dashboard" button** -- Auto-fetch on mount so the page is useful immediately. The Refresh button stays for manual re-fetch.

## What Stays (4 sections)

1. **Header** -- Simplified to just "Executive Overview" with Refresh + a single Export dropdown
2. **Weekly Brief Hero** -- The 5 headline metrics. Move export actions (copy/download) into the Hero as a small dropdown
3. **Attention Inbox** -- The ranked project list with the Change Log collapsed inside it (already works this way)
4. **Portfolio Health** -- OS score, risk breakdown, top causes. The one "big picture" card
5. **Decision Notes** -- Collapsed by default so it doesn't dominate the page

## Technical Changes

### File: `src/pages/ExecutiveDashboard.tsx`

**Auto-fetch on mount:**
- Add `useEffect` that calls `refresh()` on mount when `activeOrganizationId` is present and `data` is null. Eliminates the empty state entirely.

**Remove sections:**
- Delete the Confidence Ribbon render block (lines 331-338)
- Delete the Export Brief actions row (lines 344-381)
- Delete the Economic Signals section (lines 447-454)
- Delete the Confidence and Evidence footer section (lines 472-484)
- Delete the AIInsightsSection render (line 487)

**Remove unused imports:**
- `ConfidenceRibbon`
- `EconomicSignalsCard`
- `DataIntegrityCard`
- `SnapshotStatusCard`
- `AIInsightsSection`
- `useSnapshotCoverageReport`, `useDataQualityAudit`
- Related state: `ribbonCoverage`, `ribbonIssues`, `ribbonAsOf` computations
- Brief format state: `briefFormat`, `briefCopied`, `setBriefFormat`, `handleCopyBrief`, `handleDownloadBrief`

**Move export into Hero:**
- Add a small "Export" dropdown button inside `WeeklyBriefHero` next to the existing "Copy Summary" button. Options: "Copy as text", "Download as file". Uses the existing `buildExecutiveBriefExport` utility with 'simple' format (remove the format toggle -- simple is fine for executives).

**Simplify header actions:**
- Remove "Data Health" and "Full Report" buttons from header. Keep just "Refresh".
- Move Data Health + Full Report links into a subtle footer or the Portfolio Health card as secondary links.

**Collapse Decision Notes by default:**
- Wrap in a `Collapsible` with `defaultOpen={false}` so it doesn't take up space on first load.

### File: `src/components/executive/WeeklyBriefHero` (inline in ExecutiveDashboard.tsx)

- Add `onDownload` and export actions as a small dropdown next to "Copy Summary"

### Files NOT changed:
- No component files deleted (they may be used elsewhere)
- No backend/RPC changes
- No schema changes

## Result

- Page goes from **11 sections to 4** (plus collapsed notes)
- No redundant data shown
- Auto-loads on mount -- no "click to start"
- Diagnostic details stay on /data-health where they belong
- Export is consolidated into one spot instead of scattered across 2 rows

