import { describe, it, expect } from 'vitest';
import { buildExecutiveBriefExport, type ExecutiveBriefParams } from '@/lib/executiveBriefExport';

const BASE_PARAMS: ExecutiveBriefParams = {
  orgName: 'Acme Construction',
  asOf: '2025-06-15T12:00:00Z',
  attentionItems: [
    { project_name: 'Tower A', risk_change: 12, margin_change: -3.5, burn_change: 0.08, attention_score: 30 },
    { project_name: 'Bridge B', risk_change: 2, margin_change: -1, burn_change: 0, attention_score: 5 },
  ],
  confidence: { coveragePercent: 85, issuesCount: 3 },
  decisionNoteBody: 'Escalate Tower A to weekly review.',
};

describe('buildExecutiveBriefExport', () => {
  // ── Report format (default / original) ───────────────────────────────

  it('produces deterministic output for fixed inputs (report)', () => {
    const a = buildExecutiveBriefExport({ ...BASE_PARAMS, format: 'report' });
    const b = buildExecutiveBriefExport({ ...BASE_PARAMS, format: 'report' });
    expect(a.text).toBe(b.text);
    expect(a.filename).toBe(b.filename);
  });

  it('generates correct filename', () => {
    const { filename } = buildExecutiveBriefExport(BASE_PARAMS);
    expect(filename).toBe('ExecutiveBrief_acme-construction_2025-06-15.txt');
  });

  it('caps attention items at 10', () => {
    const items = Array.from({ length: 15 }, (_, i) => ({
      project_name: `Project ${i}`,
      risk_change: i,
      margin_change: 0,
      burn_change: 0,
    }));
    const { text } = buildExecutiveBriefExport({ ...BASE_PARAMS, attentionItems: items });
    expect(text).toContain('Project 9');
    expect(text).not.toContain('Project 10');
  });

  it('handles missing confidence data', () => {
    const { text } = buildExecutiveBriefExport({ ...BASE_PARAMS, confidence: null });
    expect(text).toContain('No confidence data available.');
  });

  it('handles empty attention items', () => {
    const { text } = buildExecutiveBriefExport({ ...BASE_PARAMS, attentionItems: [] });
    expect(text).toContain('No attention items at this time.');
  });

  it('handles missing decision note', () => {
    const { text } = buildExecutiveBriefExport({ ...BASE_PARAMS, decisionNoteBody: undefined });
    expect(text).toContain('(No decision notes captured.)');
  });

  it('trims trailing whitespace from decision note', () => {
    const { text } = buildExecutiveBriefExport({ ...BASE_PARAMS, decisionNoteBody: 'Note with spaces   \n  \n' });
    expect(text).toContain('Note with spaces\n\n═');
    expect(text).not.toContain('Note with spaces   ');
  });

  it('includes severity labels', () => {
    const { text } = buildExecutiveBriefExport(BASE_PARAMS);
    expect(text).toContain('🔴 Critical');
    expect(text).toContain('🟡 Watch');
  });

  it('defaults to report format when format not specified', () => {
    const { text } = buildExecutiveBriefExport(BASE_PARAMS);
    expect(text).toContain('═══════════════════════════════════════════════');
  });

  // ── Simple format ────────────────────────────────────────────────────

  it('simple format has no box-drawing characters', () => {
    const { text } = buildExecutiveBriefExport({ ...BASE_PARAMS, format: 'simple' });
    expect(text).not.toContain('═');
    expect(text).not.toContain('─');
  });

  it('simple format produces deterministic output', () => {
    const a = buildExecutiveBriefExport({ ...BASE_PARAMS, format: 'simple' });
    const b = buildExecutiveBriefExport({ ...BASE_PARAMS, format: 'simple' });
    expect(a.text).toBe(b.text);
  });

  it('simple format includes inline confidence', () => {
    const { text } = buildExecutiveBriefExport({ ...BASE_PARAMS, format: 'simple' });
    expect(text).toContain('Coverage: 85%');
    expect(text).toContain('Issues: 3');
  });

  // ── Timestamp formatting ─────────────────────────────────────────────

  it('timestamp uses UTC abbreviation, not locale output', () => {
    const { text } = buildExecutiveBriefExport({ ...BASE_PARAMS, format: 'report' });
    // Must contain deterministic UTC format
    expect(text).toContain('2025-06-15 12:00 UTC');
    // Must contain ISO in parentheses
    expect(text).toContain('(2025-06-15T12:00:00.000Z)');
    // Must NOT contain locale-dependent strings like "AM", "PM", or comma-separated locale dates
    expect(text).not.toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/); // no MM/DD/YYYY
  });
});
