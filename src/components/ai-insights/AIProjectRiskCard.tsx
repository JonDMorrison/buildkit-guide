import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { DashboardCard } from '@/components/dashboard/shared/DashboardCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, ShieldAlert, ShieldCheck, Loader2, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  projectId: string | null;
}

export function AIProjectRiskCard({ projectId }: Props) {
  const { activeOrganizationId: orgId } = useOrganization();
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);

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
      // Invalidate to re-check snapshot count
      queryClient.invalidateQueries({ queryKey: ['ai-risk-snapshot-count', projectId] });
      queryClient.invalidateQueries({ queryKey: ['ai-project-risk', projectId] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate analysis data');
    } finally {
      setGenerating(false);
    }
  }

  if (!countLoading && !hasEnoughSnapshots) {
    return (
      <DashboardCard
        title="Risk Assessment"
        icon={Sparkles}
        variant="metric"
        traceSource="project_economic_snapshots count"
        helpText="A 0–100 risk score combining margin erosion, labor overspend, and data completeness. Higher means more attention needed."
      >
        <div className="space-y-3 py-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Not enough data yet to assess risk. The system needs to analyze your project financials over at least two checkpoints.
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
      title="Risk Assessment"
      icon={Sparkles}
      loading={loading}
      variant="metric"
      traceSource="rpc_generate_project_margin_control → risk_score, economic_position"
      helpText="A 0–100 risk score combining margin erosion, labor overspend, and data completeness. Higher means more attention needed."
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
