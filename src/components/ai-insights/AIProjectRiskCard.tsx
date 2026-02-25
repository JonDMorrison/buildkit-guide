import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardCard } from '@/components/dashboard/shared/DashboardCard';
import { Badge } from '@/components/ui/badge';
import { Sparkles, ShieldAlert, ShieldCheck } from 'lucide-react';

interface Props {
  projectId: string | null;
}

export function AIProjectRiskCard({ projectId }: Props) {
  const { data: snapshotCount, isLoading: countLoading } = useQuery({
    queryKey: ['ai-risk-snapshot-count', projectId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('project_economic_snapshots' as any)
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId!);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!projectId,
    staleTime: 10 * 60 * 1000,
  });

  const hasEnoughSnapshots = (snapshotCount ?? 0) >= 2;

  const { data: riskData, isLoading: riskLoading } = useQuery({
    queryKey: ['ai-project-risk', projectId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        'rpc_generate_project_margin_control',
        { p_project_id: projectId },
      );
      if (error) throw error;
      return data as any;
    },
    enabled: !!projectId && hasEnoughSnapshots,
    staleTime: 5 * 60 * 1000,
  });

  const loading = countLoading || riskLoading;

  if (!countLoading && !hasEnoughSnapshots) {
    return (
      <DashboardCard
        title="AI Risk Assessment"
        icon={Sparkles}
        variant="metric"
        traceSource="project_economic_snapshots count"
        helpText="Calculates a risk score based on margin pressure, labor burn, and data confidence."
        empty
        emptyMessage="This project needs at least 2 economic snapshots to show trends. Snapshots are captured daily."
      />
    );
  }

  const score = riskData?.risk_score ?? null;
  const position = riskData?.economic_position ?? null;
  const summary = riskData?.executive_summary ?? null;
  const components = riskData?.risk_components ?? {};

  const positionColor = position === 'at_risk' ? 'text-destructive'
    : position === 'volatile' ? 'text-accent-foreground'
    : 'text-primary';

  const ScoreIcon = score != null && score >= 60 ? ShieldAlert : ShieldCheck;

  return (
    <DashboardCard
      title="AI Risk Assessment"
      icon={Sparkles}
      loading={loading}
      variant="metric"
      traceSource="rpc_generate_project_margin_control → risk_score, economic_position"
      helpText="Calculates a risk score based on margin pressure, labor burn, and data confidence."
    >
      {riskData && (
        <div className="space-y-3">
          {/* Score + position */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <ScoreIcon className={`h-5 w-5 ${positionColor}`} />
              <span className={`text-3xl font-bold tabular-nums ${positionColor}`}>
                {score ?? '—'}
              </span>
            </div>
            {position && (
              <Badge variant="outline" className={`text-xs capitalize ${positionColor}`}>
                {position.replace(/_/g, ' ')}
              </Badge>
            )}
          </div>

          {/* Risk components */}
          {Object.keys(components).length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(components).map(([key, val]) => (
                <div key={key} className="rounded-md bg-muted/40 p-2 text-center">
                  <span className="text-sm font-bold tabular-nums text-foreground">{typeof val === 'number' ? val.toFixed(0) : String(val)}</span>
                  <p className="text-[9px] text-muted-foreground mt-0.5 uppercase tracking-wider">
                    {key.replace(/_/g, ' ').replace('pressure', '').trim()}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          {summary && (
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{summary}</p>
          )}
        </div>
      )}
    </DashboardCard>
  );
}
