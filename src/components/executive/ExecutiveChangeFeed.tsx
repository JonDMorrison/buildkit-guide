import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, TrendingDown, TrendingUp, Flame, CheckCircle2,
  ExternalLink, Camera, Loader2, Megaphone, Eye, RefreshCw,
} from 'lucide-react';

// ── Types (mirroring RPC return shape) ─────────────────────────────────────

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

interface ChangeFeedData {
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
  const map: Record<string, string> = {
    new_risks:      'New Risk',
    resolved_risks: 'Resolved',
    improving:      'Improving',
    worsening:      'Worsening',
    burn_increase:  'Burn ↑',
  };
  return map[c] ?? c;
}

// ── Component ──────────────────────────────────────────────────────────────

interface Props {
  orgId: string;
}

export function ExecutiveChangeFeed({ orgId }: Props) {
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
      const { data, error: rpcErr } = await (supabase as any).rpc(
        'rpc_executive_change_feed',
        { p_org_id: orgId },
      );
      if (rpcErr) throw new Error(rpcErr.message);

      // The RPC returns null / empty when < 2 snapshots
      if (!data || !data.latest_snapshot_date) {
        setNeedsSnapshot(true);
        setFeed(null);
      } else {
        setFeed(data as ChangeFeedData);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  const captureAndRefresh = useCallback(async () => {
    setCapturing(true);
    setError(null);
    try {
      const { error: capErr } = await (supabase as any).rpc(
        'rpc_capture_org_economic_snapshots',
        { p_org_id: orgId, p_force: true },
      );
      if (capErr) throw new Error(capErr.message);
      await fetchFeed();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCapturing(false);
    }
  }, [orgId, fetchFeed]);

  // ── Auto-load on mount ──
  // Use a ref-like pattern: load once when orgId is set
  const [loaded, setLoaded] = useState(false);
  if (!loaded && orgId) {
    setLoaded(true);
    fetchFeed();
  }

  // ── Needs-more-snapshots state ──
  if (needsSnapshot && !loading) {
    return (
      <Card className="border-dashed border-accent">
        <CardContent className="p-8 text-center space-y-3">
          <Camera className="h-8 w-8 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Change detection requires at least <strong>two snapshots</strong>. Collect one more to unlock the Executive Brief.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={captureAndRefresh}
            disabled={capturing}
          >
            {capturing
              ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Capturing…</>
              : <><Camera className="h-4 w-4 mr-1.5" />Capture Snapshots Now</>
            }
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loading && !feed) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-2">Loading change feed…</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="p-4 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <span className="text-sm text-destructive">{error}</span>
        </CardContent>
      </Card>
    );
  }

  if (!feed) return null;

  const headlines = [
    { label: 'New Risks',    value: feed.new_risks,       color: 'text-destructive',       icon: AlertTriangle },
    { label: 'Resolved',     value: feed.resolved_risks,  color: 'text-primary',           icon: CheckCircle2 },
    { label: 'Improving',    value: feed.improving,       color: 'text-primary',           icon: TrendingUp },
    { label: 'Worsening',    value: feed.worsening,       color: 'text-destructive',       icon: TrendingDown },
    { label: 'Burn ↑',       value: feed.burn_increases,  color: 'text-accent-foreground', icon: Flame },
  ];

  const attention = feed.attention_ranked_projects ?? [];

  return (
    <div className="space-y-4">
      {/* ── Section 1: Executive Brief ──────────────────────── */}
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <Megaphone className="h-4 w-4" />
                Executive Brief
                <span className="text-xs text-muted-foreground font-normal ml-1">
                  (Compared to previous snapshot)
                </span>
              </CardTitle>
              <p className="text-xs text-muted-foreground font-mono mt-1">
                {feed.previous_snapshot_date} → {feed.latest_snapshot_date}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchFeed}
              disabled={loading}
              className="shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
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
          {feed.top_changes.length > 0 && (
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
                        <Link
                          to={`/projects/${c.project_id}`}
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          {c.project_name}
                          <ExternalLink className="h-2.5 w-2.5" />
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1">
                          {classificationIcon(c.classification)}
                          <span className="text-foreground">{classificationLabel(c.classification)}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <DeltaBadge value={c.risk_change} invert />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <DeltaBadge value={c.margin_change} suffix="%" />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <DeltaBadge value={c.burn_change} invert />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {feed.top_changes.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              No significant changes between snapshots.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Section 2: Attention Ranked Projects ───────────── */}
      <Card className="border-accent/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Eye className="h-4 w-4" />
            Where leadership should look first
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {attention.length > 0 ? (
            <div className="space-y-2">
              {attention.slice(0, 5).map((p, i) => (
                <div
                  key={p.project_id}
                  className="flex items-center gap-3 rounded-md border border-border px-3 py-2 hover:bg-muted/30 transition-colors"
                >
                  <span className="text-xs font-mono text-muted-foreground w-5 text-right shrink-0">
                    #{i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/projects/${p.project_id}`}
                      className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
                    >
                      {p.project_name}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span>Score: <span className="font-mono font-medium text-foreground">{p.attention_score.toFixed(1)}</span></span>
                      <span>Risk Δ: <DeltaBadge value={p.risk_change} invert /></span>
                      <span>Margin Δ: <DeltaBadge value={p.margin_change} suffix="%" /></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No attention-ranked projects yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
