// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { buildHealthCheckReport, type HealthCheckReportInput } from '@/lib/healthCheckReport';

const FIXED_INPUT: HealthCheckReportInput = {
  orgName: 'Acme Corp',
  asOf: new Date('2026-02-25T12:00:00.000Z'),
  checks: [
    { name: 'access', status: 'pass', label: 'Access & Role Gate', detail: 'Admin access confirmed.' },
    { name: 'freshness', status: 'pass', label: 'Snapshot Freshness', detail: 'Latest snapshot: 2026-02-25. Within 36h.' },
    { name: 'coverage', status: 'warn', label: 'Snapshot Coverage', detail: '85% coverage.' },
    { name: 'quality', status: 'pass', label: 'Data Quality', detail: '0 issues.' },
    { name: 'intelligence', status: 'pass', label: 'Executive Intelligence', detail: 'Feed active.' },
    { name: 'ui', status: 'fail', label: 'UI Reliability', detail: '1 route with errors.' },
  ],
  coveragePercent: 85,
  issuesCount: 0,
  topAttentionProjects: [
    { project_name: 'Highway Bridge', attention_score: 12.5 },
    { project_name: 'Office Tower', attention_score: 8.3 },
  ],
};

describe('buildHealthCheckReport', () => {
  it('is deterministic given fixed input', () => {
    const a = buildHealthCheckReport(FIXED_INPUT);
    const b = buildHealthCheckReport(FIXED_INPUT);
    expect(a).toBe(b);
  });

  it('uses UTC timestamp format', () => {
    const report = buildHealthCheckReport(FIXED_INPUT);
    expect(report).toContain('2026-02-25T12:00:00.000Z');
  });

  it('includes org name', () => {
    const report = buildHealthCheckReport(FIXED_INPUT);
    expect(report).toContain('Acme Corp');
  });

  it('includes summary counts', () => {
    const report = buildHealthCheckReport(FIXED_INPUT);
    expect(report).toContain('Pass: 4');
    expect(report).toContain('Warn: 1');
    expect(report).toContain('Fail: 1');
  });

  it('includes coverage metric', () => {
    const report = buildHealthCheckReport(FIXED_INPUT);
    expect(report).toContain('Snapshot Coverage: 85%');
  });

  it('includes top attention projects', () => {
    const report = buildHealthCheckReport(FIXED_INPUT);
    expect(report).toContain('Highway Bridge');
    expect(report).toContain('12.50');
  });

  it('includes all check labels', () => {
    const report = buildHealthCheckReport(FIXED_INPUT);
    for (const check of FIXED_INPUT.checks) {
      expect(report).toContain(check.label);
    }
  });
});
