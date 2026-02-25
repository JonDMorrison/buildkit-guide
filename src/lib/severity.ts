import type { SeverityLevel } from '@/components/SeverityBadge';

/**
 * Deterministic mapping from change-feed classification → SeverityBadge level.
 * No scoring logic — pure static dictionary.
 */
export const CLASSIFICATION_SEVERITY: Record<string, SeverityLevel> = {
  new_risks:      'critical',
  worsening:      'high',
  burn_increase:  'medium',
  resolved_risks: 'low',
  improving:      'low',
  data_quality:   'high',
  volatility:     'medium',
  labor:          'medium',
  blockers:       'high',
  blocked:        'high',
  deadline:       'medium',
};

/** Human-readable label for each classification */
export const CLASSIFICATION_LABEL: Record<string, string> = {
  new_risks:      'New Risk',
  resolved_risks: 'Resolved',
  improving:      'Improving',
  worsening:      'Worsening',
  burn_increase:  'Burn ↑',
  data_quality:   'Data Quality',
  volatility:     'Volatile',
  labor:          'Labor',
  blockers:       'Blocked',
  blocked:        'Blocked',
  deadline:       'Deadline',
};

/** Filter categories for the AttentionInbox */
export type AttentionFilterCategory = 'all' | 'financial' | 'execution' | 'data_quality';

export const ATTENTION_FILTER_LABELS: Record<AttentionFilterCategory, string> = {
  all:          'All',
  financial:    'Financial',
  execution:    'Execution',
  data_quality: 'Data Quality',
};

/** Which classifications belong to each filter category */
const CATEGORY_CLASSIFICATIONS: Record<Exclude<AttentionFilterCategory, 'all'>, Set<string>> = {
  financial:    new Set(['new_risks', 'worsening', 'burn_increase', 'improving', 'resolved_risks']),
  execution:    new Set(['blockers', 'blocked', 'deadline', 'labor']),
  data_quality: new Set(['data_quality', 'volatility']),
};

export function classificationMatchesFilter(classification: string, filter: AttentionFilterCategory): boolean {
  if (filter === 'all') return true;
  return CATEGORY_CLASSIFICATIONS[filter]?.has(classification) ?? false;
}

/**
 * Normalize any severity-like string into a SeverityLevel.
 * Handles both SeverityBadge levels and classification strings.
 */
export function normalizeSeverity(input: string): SeverityLevel {
  // Direct SeverityBadge levels
  if (input === 'low' || input === 'medium' || input === 'high' || input === 'critical') {
    return input;
  }
  // Classification → severity
  return CLASSIFICATION_SEVERITY[input] ?? 'medium';
}
