/**
 * Executive Brief Export Builder
 *
 * Produces a deterministic plain-text executive brief
 * from already-loaded dashboard data. No queries, no side-effects.
 *
 * Supports two formats:
 * - "simple": minimal ASCII, single blank-line separators
 * - "report": boxed format with box-drawing characters
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

export type ExportFormat = 'simple' | 'report';

export interface ExecutiveBriefParams {
  orgName: string;
  asOf: string; // ISO timestamp or date string
  attentionItems: AttentionItem[];
  confidence?: ExportConfidence | null;
  decisionNoteBody?: string;
  format?: ExportFormat;
}

function weekEndingDate(asOf: string): string {
  const d = new Date(asOf);
  if (isNaN(d.getTime())) return 'Unknown';
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

/**
 * Deterministic timestamp rendering.
 * Output: "YYYY-MM-DD HH:mm UTC (2025-06-15T12:00:00.000Z)"
 * Uses UTC always to avoid locale drift.
 */
function formatTimestamp(asOf: string): string {
  const d = new Date(asOf);
  if (isNaN(d.getTime())) return asOf;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min} UTC (${d.toISOString()})`;
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

// ── Report format (original boxed) ──────────────────────────────────────

function buildReportFormat(params: ExecutiveBriefParams): string {
  const { orgName, asOf, attentionItems, confidence, decisionNoteBody } = params;
  const weekEnding = weekEndingDate(asOf);
  const asOfDisplay = formatTimestamp(asOf);
  const lines: string[] = [];

  lines.push('═══════════════════════════════════════════════');
  lines.push(`EXECUTIVE BRIEF — ${orgName.toUpperCase()}`);
  lines.push(`As of: ${asOfDisplay}`);
  lines.push(`Week ending: ${weekEnding}`);
  lines.push('═══════════════════════════════════════════════');
  lines.push('');

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

  return lines.join('\n');
}

// ── Simple format (minimal ASCII) ───────────────────────────────────────

function buildSimpleFormat(params: ExecutiveBriefParams): string {
  const { orgName, asOf, attentionItems, confidence, decisionNoteBody } = params;
  const weekEnding = weekEndingDate(asOf);
  const asOfDisplay = formatTimestamp(asOf);
  const lines: string[] = [];

  lines.push(`EXECUTIVE BRIEF — ${orgName.toUpperCase()}`);
  lines.push(`As of: ${asOfDisplay}`);
  lines.push(`Week ending: ${weekEnding}`);
  lines.push('');

  lines.push('TOP ATTENTION');
  const capped = attentionItems.slice(0, 10);
  if (capped.length === 0) {
    lines.push('No attention items at this time.');
  } else {
    capped.forEach((item, i) => {
      lines.push(`${i + 1}. ${severityLabel(item)} ${item.project_name} — ${issueLabel(item)}`);
    });
  }
  lines.push('');

  lines.push('CONFIDENCE');
  if (confidence) {
    const parts: string[] = [];
    if (confidence.coveragePercent != null) parts.push(`Coverage: ${confidence.coveragePercent.toFixed(0)}%`);
    if (confidence.issuesCount != null) parts.push(`Issues: ${confidence.issuesCount}`);
    lines.push(parts.length > 0 ? parts.join(' | ') : 'No confidence data available.');
  } else {
    lines.push('No confidence data available.');
  }
  lines.push('');

  lines.push('DECISIONS / NOTES');
  const trimmedNote = (decisionNoteBody ?? '').trimEnd();
  lines.push(trimmedNote || '(No decision notes captured.)');

  return lines.join('\n');
}

// ── Public API ──────────────────────────────────────────────────────────

export function buildExecutiveBriefExport(params: ExecutiveBriefParams): { text: string; filename: string } {
  const format = params.format ?? 'report';
  const text = format === 'simple' ? buildSimpleFormat(params) : buildReportFormat(params);

  const dateSlug = new Date(params.asOf).toISOString().slice(0, 10);
  const filename = `ExecutiveBrief_${slugify(params.orgName)}_${isNaN(Date.parse(params.asOf)) ? 'undated' : dateSlug}.txt`;

  return { text, filename };
}
