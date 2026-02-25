/**
 * Executive Brief Export Builder
 *
 * Produces a deterministic plain-text executive brief
 * from already-loaded dashboard data. No queries, no side-effects.
 */

export interface AttentionItem {
  project_name: string;
  risk_change: number;
  margin_change: number;
  burn_change: number;
  attention_score?: number;
}

export interface ExportConfidence {
  coveragePercent: number | null;
  issuesCount: number | null;
}

export interface ExecutiveBriefParams {
  orgName: string;
  asOf: string; // ISO timestamp or date string
  attentionItems: AttentionItem[];
  confidence?: ExportConfidence | null;
  decisionNoteBody?: string;
}

function weekEndingDate(asOf: string): string {
  const d = new Date(asOf);
  if (isNaN(d.getTime())) return 'Unknown';
  // Walk forward to nearest Sunday
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function severityLabel(item: AttentionItem): string {
  if (item.risk_change > 10) return '🔴 Critical';
  if (item.risk_change > 5) return '🟠 High';
  if (item.risk_change > 0) return '🟡 Watch';
  if (item.risk_change < -5) return '🟢 Improving';
  return '⚪ Stable';
}

function issueLabel(item: AttentionItem): string {
  const parts: string[] = [];
  if (item.risk_change !== 0) parts.push(`Risk Δ${item.risk_change > 0 ? '+' : ''}${item.risk_change.toFixed(1)}`);
  if (item.margin_change !== 0) parts.push(`Margin Δ${item.margin_change > 0 ? '+' : ''}${item.margin_change.toFixed(1)}%`);
  if (item.burn_change !== 0) parts.push(`Burn Δ${item.burn_change > 0 ? '+' : ''}${item.burn_change.toFixed(2)}`);
  return parts.join(', ') || 'No change';
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30) || 'org';
}

export function buildExecutiveBriefExport(params: ExecutiveBriefParams): { text: string; filename: string } {
  const { orgName, asOf, attentionItems, confidence, decisionNoteBody } = params;

  const weekEnding = weekEndingDate(asOf);
  const asOfDisplay = (() => {
    const d = new Date(asOf);
    return isNaN(d.getTime()) ? asOf : d.toLocaleString();
  })();

  const lines: string[] = [];

  // ── Header ─────────────────────────────────────────────
  lines.push('═══════════════════════════════════════════════');
  lines.push(`EXECUTIVE BRIEF — ${orgName.toUpperCase()}`);
  lines.push(`As of: ${asOfDisplay}`);
  lines.push(`Week ending: ${weekEnding}`);
  lines.push('═══════════════════════════════════════════════');
  lines.push('');

  // ── 1. Top Attention ───────────────────────────────────
  lines.push('1. TOP ATTENTION');
  lines.push('───────────────────────────────────────────────');
  const capped = attentionItems.slice(0, 10);
  if (capped.length === 0) {
    lines.push('   No attention items at this time.');
  } else {
    capped.forEach((item, i) => {
      lines.push(`   ${i + 1}. [${severityLabel(item)}] ${item.project_name}`);
      lines.push(`      ${issueLabel(item)}`);
    });
  }
  lines.push('');

  // ── 2. Confidence ──────────────────────────────────────
  lines.push('2. CONFIDENCE');
  lines.push('───────────────────────────────────────────────');
  if (confidence) {
    if (confidence.coveragePercent != null) {
      lines.push(`   Snapshot coverage: ${confidence.coveragePercent.toFixed(0)}%`);
    }
    if (confidence.issuesCount != null) {
      lines.push(`   Data quality issues: ${confidence.issuesCount}`);
    }
    if (confidence.coveragePercent == null && confidence.issuesCount == null) {
      lines.push('   No confidence data available.');
    }
  } else {
    lines.push('   No confidence data available.');
  }
  lines.push('');

  // ── 3. Decisions / Notes ───────────────────────────────
  lines.push('3. DECISIONS / NOTES');
  lines.push('───────────────────────────────────────────────');
  const trimmedNote = (decisionNoteBody ?? '').trimEnd();
  if (trimmedNote) {
    lines.push(trimmedNote);
  } else {
    lines.push('   (No decision notes captured.)');
  }
  lines.push('');
  lines.push('═══════════════════════════════════════════════');

  const dateSlug = new Date(asOf).toISOString().slice(0, 10);
  const filename = `ExecutiveBrief_${slugify(orgName)}_${isNaN(Date.parse(asOf)) ? 'undated' : dateSlug}.txt`;

  return { text: lines.join('\n'), filename };
}
