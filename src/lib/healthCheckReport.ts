/**
 * Deterministic health check report builder.
 * All timestamps in UTC. No locale formatting.
 */

export type CheckStatus = 'pass' | 'warn' | 'fail';

export interface HealthCheckResult {
  name: string;
  status: CheckStatus;
  label: string;
  detail: string;
}

export interface HealthCheckReportInput {
  orgName: string;
  asOf: Date;
  checks: HealthCheckResult[];
  coveragePercent: number | null;
  issuesCount: number | null;
  topAttentionProjects: Array<{ project_name: string; attention_score: number }>;
}

function statusIcon(s: CheckStatus): string {
  switch (s) {
    case 'pass': return '✅';
    case 'warn': return '⚠️';
    case 'fail': return '❌';
  }
}

export function buildHealthCheckReport(input: HealthCheckReportInput): string {
  const lines: string[] = [];
  const utc = input.asOf.toISOString();

  lines.push('PRODUCTION HEALTH CHECK');
  lines.push(`Organization: ${input.orgName}`);
  lines.push(`As of: ${utc}`);
  lines.push('');
  lines.push('='.repeat(50));
  lines.push('');

  // Summary counts
  const passCount = input.checks.filter(c => c.status === 'pass').length;
  const warnCount = input.checks.filter(c => c.status === 'warn').length;
  const failCount = input.checks.filter(c => c.status === 'fail').length;
  lines.push(`Checks: ${input.checks.length} | Pass: ${passCount} | Warn: ${warnCount} | Fail: ${failCount}`);
  lines.push('');

  // Individual checks
  for (const check of input.checks) {
    lines.push(`${statusIcon(check.status)} ${check.label}`);
    lines.push(`  ${check.detail}`);
    lines.push('');
  }

  // Key metrics
  lines.push('-'.repeat(50));
  lines.push('Key Metrics:');
  if (input.coveragePercent !== null) {
    lines.push(`  Snapshot Coverage: ${input.coveragePercent}%`);
  }
  if (input.issuesCount !== null) {
    lines.push(`  Data Quality Issues: ${input.issuesCount}`);
  }
  lines.push('');

  // Top attention projects
  if (input.topAttentionProjects.length > 0) {
    lines.push('Top Attention Projects:');
    for (const p of input.topAttentionProjects.slice(0, 3)) {
      lines.push(`  - ${p.project_name} (score: ${p.attention_score.toFixed(2)})`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
