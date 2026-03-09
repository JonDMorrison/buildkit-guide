import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { DashboardCard } from '@/components/dashboard/shared/DashboardCard';
import { SeverityBadge } from '@/components/SeverityBadge';
import { CLASSIFICATION_LABEL, normalizeSeverity } from '@/lib/severity';
import {
  AlertTriangle, TrendingDown, TrendingUp, Flame, CheckCircle2,
  ExternalLink, Camera, Loader2, Megaphone, RefreshCw,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface TopChange {
  project_id: string;
  project_name: string;
  prev_risk: number;
  curr_risk: number;
  risk_change: number;
  prev_margin: number;
  curr_margin: number;
  margin_change: number;
  prev_burn: number;
  curr_burn: number;
  burn_change: number;
  classification: string;
}

interface AttentionProject {
  project_id: string;
  project_name: string;
  attention_score: number;
  risk_change: number;
  margin_change: number;
  burn_change: number;
}

export interface ChangeFeedData {
  latest_snapshot_date: string;
  previous_snapshot_date: string;
  new_risks: number;
  resolved_risks: number;
  improving: number;
  worsening: number;
  burn_increases: number;
  top_changes: TopChange[];
  attention_ranked_projects: AttentionProject[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function DeltaBadge({ value, suffix = '', invert = false }: { value: number; suffix?: string; invert?: boolean }) {
  const positive = invert ? value < 0 : value > 0;
  const negative = invert ? value > 0 : value < 0;
  if (value === 0) return <span className="text-xs font-mono text-muted-foreground">—</span>;
  return (
    <span
      className={`text-xs font-mono font-medium ${
        negative ? 'text-destructive' : positive ? 'text-primary' : 'text-muted-foreground'
      }`}
    >
      {value > 0 ? '+' : ''}{value.toFixed(1)}{suffix}
    </span>
  );
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

function classificationLabel(c: string) {
  return CLASSIFICATION_LABEL[c] ?? c;
}

// ── Component ──────────────────────────────────────────────────────────────

interface Props {
  orgId: string;
  /** Expose feed data to parent for other cards */
  onFeedLoaded?: (feed: ChangeFeedData | null) => void;
}

export function ExecutiveBriefCard({ orgId, onFeedLoaded }: Props) {
  const [feed, setFeed] = useState<ChangeFeedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSnapshot, setNeedsSnapshot] = useState(false);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNeedsSnapshot(false);
    try {
      const dbRpc = supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>
      ) => Promise<{ data: unknown; error: { message: string } | null }>;

      const { data, error: rpcErr } = await dbRpc(
        'rpc_executive_change_feed',
        { p_org_id: orgId },
      );
      if (rpcErr) throw new Error(rpcErr.message);
      const feedData = data as ChangeFeedData | null;
      if (!feedData || !feedData.latest_snapshot_date) {
        setNeedsSnapshot(true);
        setFeed(null);
        onFeedLoaded?.(null);
      } else {
        setFeed(feedData);
        onFeedLoaded?.(feedData);
      }
    } catch (e: unknown) {
      if (e instanceof Error) setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [orgId, onFeedLoaded]);

  const captureAndRefresh = useCallback(async () => {
    setCapturing(true);
    setError(null);
    try {
      const dbRpc = supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>
      ) => Promise<{ data: unknown; error: { message: string } | null }>;

      const { error: capErr } = await dbRpc(
        'rpc_capture_org_economic_snapshots',
        { p_org_id: orgId, p_force: true },
      );
      if (capErr) throw new Error(capErr.message);
      await fetchFeed();
    } catch (e: unknown) {
      if (e instanceof Error) setError(e.message);
    } finally {
      setCapturing(false);
    }
  }, [orgId, fetchFeed]);

  const [loaded, setLoaded] = useState(false);
  if (!loaded && orgId) {
    setLoaded(true);
    fetchFeed();
  }

  // Needs more snapshots
  if (needsSnapshot && !loading) {
    return (
      <DashboardCard
        title="Executive Brief"
        icon={Megaphone}
        variant="alert"
        traceSource="rpc_executive_change_feed"
        empty
        emptyMessage="Change detection requires at least two snapshots."
        actions={
          <Button size="sm" variant="outline" onClick={captureAndRefresh} disabled={capturing}>
            {capturing
              ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Capturing…</>
              : <><Camera className="h-3.5 w-3.5 mr-1.5" />Capture Snapshots Now</>
            }
          </Button>
        }
      />
    );
  }

  if (error) {
    return (
      <DashboardCard title="Executive Brief" icon={Megaphone} variant="alert" error={error} traceSource="rpc_executive_change_feed" />
    );
  }

  const headlines = feed ? [
    { label: 'New Risks',    value: feed.new_risks,       color: 'text-destructive',       icon: AlertTriangle },
    { label: 'Resolved',     value: feed.resolved_risks,  color: 'text-primary',           icon: CheckCircle2 },
    { label: 'Improving',    value: feed.improving,       color: 'text-primary',           icon: TrendingUp },
    { label: 'Worsening',    value: feed.worsening,       color: 'text-destructive',       icon: TrendingDown },
    { label: 'Burn ↑',       value: feed.burn_increases,  color: 'text-accent-foreground', icon: Flame },
  ] : [];

  return (
    <DashboardCard
      title="Executive Brief"
      description={feed ? `${feed.previous_snapshot_date} → ${feed.latest_snapshot_date}` : undefined}
      icon={Megaphone}
      loading={loading && !feed}
      traceSource="rpc_executive_change_feed"
      actions={
        <Button variant="ghost" size="sm" onClick={fetchFeed} disabled={loading} className="shrink-0">
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      }
    >
      {feed && (
        <div className="space-y-4">
          {/* Headline metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {headlines.map(h => (
              <div key={h.label} className="text-center rounded-lg bg-muted/40 p-2.5">
                <h.icon className={`h-4 w-4 mx-auto mb-1 ${h.color}`} />
                <div className={`text-2xl font-bold tabular-nums ${h.color}`}>{h.value}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{h.label}</div>
              </div>
            ))}
          </div>

          {/* Top changes table */}
          {feed.top_changes.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted text-muted-foreground">
                    <th className="text-left px-3 py-2 font-medium">Project</th>
                    <th className="text-left px-3 py-2 font-medium">Status</th>
                    <th className="text-right px-3 py-2 font-medium">Risk Δ</th>
                    <th className="text-right px-3 py-2 font-medium">Margin Δ</th>
                    <th className="text-right px-3 py-2 font-medium">Burn Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {feed.top_changes.slice(0, 5).map(c => (
                    <tr key={c.project_id} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2">
                        <Link to={`/projects/${c.project_id}`} className="text-primary hover:underline inline-flex items-center gap-1">
                          {c.project_name} <ExternalLink className="h-2.5 w-2.5" />
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1">
                          {classificationIcon(c.classification)}
                          <SeverityBadge severity={normalizeSeverity(c.classification)} label={classificationLabel(c.classification)} className="text-[10px]" />
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right"><DeltaBadge value={c.risk_change} invert /></td>
                      <td className="px-3 py-2 text-right"><DeltaBadge value={c.margin_change} suffix="%" /></td>
                      <td className="px-3 py-2 text-right"><DeltaBadge value={c.burn_change} invert /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">No significant changes between snapshots.</p>
          )}
        </div>
      )}
    </DashboardCard>
  );
}
