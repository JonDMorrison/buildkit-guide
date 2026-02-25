/**
 * Pure helpers for health-check context routing.
 * No React, no backend calls.
 */

/** Canonical check IDs (must match actionRouter.ts HEALTH_CHECK_IDS) */
export const HEALTH_CHECK_LABELS: Record<string, string> = {
  access: 'Access & Role Gate',
  snapshot_freshness: 'Snapshot Freshness',
  snapshot_coverage: 'Snapshot Coverage',
  data_quality: 'Data Quality',
  exec_intelligence: 'Executive Intelligence',
  ui_reliability: 'UI Reliability',
} as const;

export interface HealthContext {
  active: boolean;
  checkId: string | null;
  label: string | null;
}

/**
 * Parse health context from a URLSearchParams-compatible string.
 * @param search - window.location.search or useLocation().search
 */
export function parseHealthContext(search: string): HealthContext {
  const params = new URLSearchParams(search);
  const from = params.get('from');
  if (from !== 'health') {
    return { active: false, checkId: null, label: null };
  }
  const checkId = params.get('check');
  const label = checkId ? (HEALTH_CHECK_LABELS[checkId] ?? checkId) : null;
  return { active: true, checkId, label };
}

/**
 * Strip `from` and `check` health-context params from a search string.
 * Preserves all other params.
 * @returns new search string (without leading '?', or empty string).
 */
export function stripHealthContext(search: string): string {
  const params = new URLSearchParams(search);
  params.delete('from');
  params.delete('check');
  const result = params.toString();
  return result ? `?${result}` : '';
}
