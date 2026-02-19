/**
 * Top Causes Dictionary
 *
 * Single source of truth for intervention flag metadata.
 * Used by ExecutiveDashboard, ExecutiveReport, and any future
 * risk surfaces. No DB dependency — pure frontend constant.
 */

export interface CauseDefinition {
  /** Human-readable display label */
  label: string;
  /** Why this flag is operationally significant */
  whyItMatters: string;
  /** Expected directional impact on project margin (static guidance) */
  marginImpact: string;
}

export const CAUSES_DICTIONARY: Record<string, CauseDefinition> = {
  margin_declining: {
    label:        'Margin Declining',
    whyItMatters: 'Week-over-week realized margin is trending downward. Left unaddressed, a declining trajectory compounds — each additional week of overrun directly reduces net profit at closeout.',
    marginImpact: 'Typically −2% to −8% at completion per sustained week of decline, depending on project size and remaining duration.',
  },

  labor_burn_high: {
    label:        'Labor Burn Exceeding Benchmark',
    whyItMatters: 'Labor costs are burning at a rate faster than the planned benchmark. Since labor is the largest controllable cost on most projects, high burn rates rapidly erode margin before materials or change orders can be adjusted.',
    marginImpact: 'Every 10% excess labor burn translates to approximately 2–4% margin compression on a typical labour-heavy project.',
  },

  labor_burn_exceeding_benchmark: {
    label:        'Labor Burn Exceeding Benchmark',
    whyItMatters: 'Labor costs are burning at a rate faster than the planned benchmark. Since labor is the largest controllable cost on most projects, high burn rates rapidly erode margin before materials or change orders can be adjusted.',
    marginImpact: 'Every 10% excess labor burn translates to approximately 2–4% margin compression on a typical labour-heavy project.',
  },

  below_low_band: {
    label:        'Below Historical Low Band',
    whyItMatters: 'Realized margin has dropped below the organization\'s historical low-band threshold — the worst recorded performance across comparable projects. This is a systemic signal, not a one-week anomaly.',
    marginImpact: 'Projects below the low band have historically closed out 5–15% below initial planned margin. Immediate corrective action is required.',
  },

  low_historical_data: {
    label:        'Low Historical Data',
    whyItMatters: 'Insufficient historical entries exist to produce statistically reliable cost projections. Without a benchmark, the risk model cannot accurately flag burn-rate anomalies until they become severe.',
    marginImpact: 'Projection uncertainty is high. Margin outcomes may deviate ±10–20% from estimates until sufficient time entries and cost actuals are recorded.',
  },
};

/**
 * Returns the CauseDefinition for a flag key, with a safe fallback.
 */
export function getCause(key: string): CauseDefinition {
  return (
    CAUSES_DICTIONARY[key] ?? {
      label:        key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      whyItMatters: 'This flag indicates an anomaly detected by the Margin Control Engine. Review project financials for further context.',
      marginImpact: 'Impact is not yet classified for this flag type.',
    }
  );
}
