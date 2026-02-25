import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { DashboardCard } from '@/components/dashboard/shared/DashboardCard';
import { Button } from '@/components/ui/button';
import { Sparkles, TrendingUp, TrendingDown, Minus, Loader2, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

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
  const { activeOrganizationId: orgId } = useOrganization();
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);

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

  async function handleGenerate() {
    if (!orgId) return;
    setGenerating(true);
    try {
      const { error } = await (supabase as any).rpc(
        'rpc_capture_org_economic_snapshots',
        { p_org_id: orgId, p_force: true },
      );
      if (error) throw error;
      toast.success('Analysis data generated. It may take a moment to process.');
      queryClient.invalidateQueries({ queryKey: ['ai-margin-signal', projectId] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate analysis data');
    } finally {
      setGenerating(false);
    }
  }

  if (!isLoading && !hasEnough) {
    return (
      <DashboardCard
        title="AI Margin Signal"
        icon={Sparkles}
        variant="metric"
        traceSource="rpc_get_margin_snapshot_history"
        helpText="Tracks projected margin and risk score trends over the last 30 days."
      >
        <div className="space-y-3 py-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Not enough data yet to show margin trends. The system needs at least two financial checkpoints to compare.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleGenerate}
            disabled={generating || !orgId}
          >
            {generating ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
            )}
            {generating ? 'Generating…' : 'Generate Analysis'}
          </Button>
          <p className="text-[10px] text-muted-foreground text-center">
            This captures a financial checkpoint for all your projects. Run it twice (or wait a day) to unlock trends.
          </p>
        </div>
      </DashboardCard>
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
