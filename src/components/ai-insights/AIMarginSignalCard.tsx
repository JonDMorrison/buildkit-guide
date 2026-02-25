import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardCard } from '@/components/dashboard/shared/DashboardCard';
import { Sparkles, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Props {
  projectId: string | null;
}

interface MarginSnapshot {
  snapshot_date: string;
  risk_score: number;
  projected_margin_pct: number | null;
  labor_burn_ratio: number | null;
}

export function AIMarginSignalCard({ projectId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['ai-margin-signal', projectId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        'rpc_get_margin_snapshot_history',
        { p_project_id: projectId, p_days: 30 },
      );
      if (error) throw error;
      return (data as MarginSnapshot[]) || [];
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  });

  const snapshots = data ?? [];
  const hasEnough = snapshots.length >= 2;

  if (!isLoading && !hasEnough) {
    return (
      <DashboardCard
        title="AI Margin Signal"
        icon={Sparkles}
        variant="metric"
        traceSource="rpc_get_margin_snapshot_history"
        helpText="Tracks projected margin and risk score trends over the last 30 days."
        empty
        emptyMessage="This project needs at least 2 economic snapshots to show trends. Snapshots are captured daily."
      />
    );
  }

  const latest = snapshots[snapshots.length - 1];
  const prev = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;

  const marginDelta = latest && prev && latest.projected_margin_pct != null && prev.projected_margin_pct != null
    ? latest.projected_margin_pct - prev.projected_margin_pct
    : null;

  const riskDelta = latest && prev ? latest.risk_score - prev.risk_score : null;

  const burnLatest = latest?.labor_burn_ratio;
  const burnPrev = prev?.labor_burn_ratio;
  const burnDelta = burnLatest != null && burnPrev != null ? burnLatest - burnPrev : null;

  const TrendIcon = marginDelta != null
    ? marginDelta > 0.5 ? TrendingUp : marginDelta < -0.5 ? TrendingDown : Minus
    : Minus;

  const trendColor = marginDelta != null
    ? marginDelta > 0.5 ? 'text-primary' : marginDelta < -0.5 ? 'text-destructive' : 'text-muted-foreground'
    : 'text-muted-foreground';

  return (
    <DashboardCard
      title="AI Margin Signal"
      description={`${snapshots.length} snapshots (30d)`}
      icon={Sparkles}
      loading={isLoading}
      variant="metric"
      traceSource="rpc_get_margin_snapshot_history → projected_margin_pct, risk_score, labor_burn_ratio"
      helpText="Tracks projected margin and risk score trends over the last 30 days."
    >
      {latest && (
        <div className="space-y-3">
          {/* Projected margin */}
          <div className="flex items-center gap-3">
            <TrendIcon className={`h-5 w-5 ${trendColor}`} />
            <div>
              <span className={`text-2xl font-bold tabular-nums ${trendColor}`}>
                {latest.projected_margin_pct != null ? `${latest.projected_margin_pct.toFixed(1)}%` : '—'}
              </span>
              <span className="text-[10px] text-muted-foreground ml-1.5 uppercase">Projected Margin</span>
            </div>
          </div>

          {/* Delta indicators */}
          <div className="grid grid-cols-3 gap-2">
            <DeltaMetric
              label="Margin Δ"
              value={marginDelta}
              suffix="%"
              invert={false}
            />
            <DeltaMetric
              label="Risk Δ"
              value={riskDelta}
              suffix=""
              invert={true}
            />
            <DeltaMetric
              label="Burn Δ"
              value={burnDelta}
              suffix=""
              invert={true}
            />
          </div>

          {/* Mini sparkline text */}
          <p className="text-[10px] text-muted-foreground">
            Risk: {latest.risk_score.toFixed(0)} · Burn: {burnLatest != null ? burnLatest.toFixed(2) : '—'}
          </p>
        </div>
      )}
    </DashboardCard>
  );
}

function DeltaMetric({ label, value, suffix, invert }: {
  label: string;
  value: number | null;
  suffix: string;
  invert: boolean;
}) {
  if (value == null) return (
    <div className="rounded-md bg-muted/40 p-2 text-center">
      <span className="text-sm font-mono text-muted-foreground">—</span>
      <p className="text-[9px] text-muted-foreground mt-0.5 uppercase tracking-wider">{label}</p>
    </div>
  );

  const positive = invert ? value < 0 : value > 0;
  const negative = invert ? value > 0 : value < 0;
  const color = negative ? 'text-destructive' : positive ? 'text-primary' : 'text-muted-foreground';

  return (
    <div className="rounded-md bg-muted/40 p-2 text-center">
      <span className={`text-sm font-mono font-medium ${color}`}>
        {value > 0 ? '+' : ''}{value.toFixed(1)}{suffix}
      </span>
      <p className="text-[9px] text-muted-foreground mt-0.5 uppercase tracking-wider">{label}</p>
    </div>
  );
}
