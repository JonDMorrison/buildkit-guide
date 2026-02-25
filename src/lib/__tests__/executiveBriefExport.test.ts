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
  it('produces deterministic output for fixed inputs', () => {
    const a = buildExecutiveBriefExport(BASE_PARAMS);
    const b = buildExecutiveBriefExport(BASE_PARAMS);
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
    // Should contain Project 0 through Project 9, not Project 10+
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
    // The note body should appear trimmed (no trailing spaces/newlines before the final separator)
    expect(text).toContain('Note with spaces\n\n═');
    expect(text).not.toContain('Note with spaces   ');
  });

  it('includes severity labels', () => {
    const { text } = buildExecutiveBriefExport(BASE_PARAMS);
    expect(text).toContain('🔴 Critical');
    expect(text).toContain('🟡 Watch');
  });
});
