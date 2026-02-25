import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { DashboardCard } from '@/components/dashboard/shared/DashboardCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, TrendingDown, TrendingUp, Flame, CheckCircle2,
  Sparkles, RefreshCw,
} from 'lucide-react';

interface TopChange {
  project_id: string;
  project_name: string;
  risk_change: number;
  margin_change: number;
  burn_change: number;
  classification: string;
}

interface FeedData {
  latest_snapshot_date: string;
  previous_snapshot_date: string;
  new_risks: number;
  resolved_risks: number;
  improving: number;
  worsening: number;
  burn_increases: number;
  top_changes: TopChange[];
}

function classificationIcon(c: string) {
  switch (c) {
    case 'new_risks':      return <AlertTriangle className="h-3.5 w-3.5 text-destructive" />;
    case 'resolved_risks': return <CheckCircle2  className="h-3.5 w-3.5 text-primary" />;
    case 'improving':      return <TrendingUp    className="h-3.5 w-3.5 text-primary" />;
    case 'worsening':      return <TrendingDown  className="h-3.5 w-3.5 text-destructive" />;
    case 'burn_increase':  return <Flame         className="h-3.5 w-3.5 text-accent-foreground" />;
    default:               return null;
  }
}

const classLabel: Record<string, string> = {
  new_risks: 'New Risk', resolved_risks: 'Resolved',
  improving: 'Improving', worsening: 'Worsening', burn_increase: 'Burn ↑',
};

export function AIChangeFeedCard() {
  const { activeOrganizationId } = useOrganization();
  const queryClient = useQueryClient();

  const { data: feed, isLoading, error, isFetching } = useQuery({
    queryKey: ['ai-change-feed', activeOrganizationId],
    queryFn: async () => {
      const { data, error: rpcErr } = await (supabase as any).rpc(
        'rpc_executive_change_feed',
        { p_org_id: activeOrganizationId },
      );
      if (rpcErr) throw new Error(rpcErr.message);
      return (data?.latest_snapshot_date ? data : null) as FeedData | null;
    },
    enabled: !!activeOrganizationId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['ai-change-feed', activeOrganizationId] });
  }, [queryClient, activeOrganizationId]);

  const needsSnapshot = !isLoading && feed === null && !error;

  if (needsSnapshot) {
    return (
      <DashboardCard
        title="AI Change Feed"
        icon={Sparkles}
        variant="metric"
        traceSource="rpc_executive_change_feed"
        empty
        emptyMessage="Capture one more snapshot to unlock AI insights."
      />
    );
  }

  return (
    <DashboardCard
      title="AI Change Feed"
      description={feed ? `${feed.previous_snapshot_date} → ${feed.latest_snapshot_date}` : undefined}
      icon={Sparkles}
      loading={isLoading}
      error={error ? (error as Error).message : null}
      traceSource="rpc_executive_change_feed"
      actions={
        <Button variant="ghost" size="sm" onClick={refresh} disabled={isFetching} className="shrink-0">
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      }
    >
      {feed && (
        <div className="space-y-3">
          {/* Summary badges */}
          <div className="flex flex-wrap gap-2">
            {feed.new_risks > 0 && <Badge variant="destructive" className="text-xs">{feed.new_risks} New Risk{feed.new_risks !== 1 ? 's' : ''}</Badge>}
            {feed.resolved_risks > 0 && <Badge variant="secondary" className="text-xs text-primary">{feed.resolved_risks} Resolved</Badge>}
            {feed.improving > 0 && <Badge variant="secondary" className="text-xs text-primary">{feed.improving} Improving</Badge>}
            {feed.worsening > 0 && <Badge variant="destructive" className="text-xs">{feed.worsening} Worsening</Badge>}
            {feed.burn_increases > 0 && <Badge variant="outline" className="text-xs text-accent-foreground">{feed.burn_increases} Burn ↑</Badge>}
          </div>

          {/* Top changes */}
          {feed.top_changes.slice(0, 4).map(c => (
            <div key={c.project_id} className="flex items-center justify-between p-2 rounded-md border border-border/50 bg-card hover:bg-muted/10 transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                {classificationIcon(c.classification)}
                <Link to={`/projects/${c.project_id}`} className="text-xs text-foreground font-medium truncate hover:text-primary transition-colors">
                  {c.project_name}
                </Link>
                <span className="text-[10px] text-muted-foreground">{classLabel[c.classification] ?? c.classification}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-xs font-mono">
                <span className={c.risk_change > 0 ? 'text-destructive' : c.risk_change < 0 ? 'text-primary' : 'text-muted-foreground'}>
                  R{c.risk_change > 0 ? '+' : ''}{c.risk_change.toFixed(0)}
                </span>
                <span className={c.margin_change < 0 ? 'text-destructive' : c.margin_change > 0 ? 'text-primary' : 'text-muted-foreground'}>
                  M{c.margin_change > 0 ? '+' : ''}{c.margin_change.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
