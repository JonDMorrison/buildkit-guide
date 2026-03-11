import { useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { useAuthRole } from '@/hooks/useAuthRole';
import { useCurrentProject } from '@/hooks/useCurrentProject';
import { useOrganization } from '@/hooks/useOrganization';
import { NoAccess } from '@/components/NoAccess';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Rocket, Clock, RefreshCw,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { HealthContextBanner } from '@/components/HealthContextBanner';

/* ─── Types ─── */
interface AuditRunRow {
  id: string;
  run_id: string;
  pass_count: number;
  fail_count: number;
  manual_count: number;
  p0_blockers: number;
  created_at: string;
  json_result: AuditCheckResult[] | null;
}

interface AuditCheckResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'MANUAL' | string;
  severity: 'P0' | 'P1' | 'P2' | string;
  actual: string;
}

interface ManualCheck {
  id: string;
  check_key: string;
  label: string;
  is_checked: boolean;
  checked_by: string | null;
  checked_at: string | null;
}

/* ─── Page (Gate) ─── */
export default function Release() {
  const { isAdmin, isPM, loading: authLoading } = useAuthRole();

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      </Layout>
    );
  }

  if (!isAdmin && !isPM()) {
    return <Layout><NoAccess /></Layout>;
  }

  return <ReleaseContent />;
}

/* ─── Content ─── */
function ReleaseContent() {
  const { currentProjectId } = useCurrentProject();
  const { isAdmin, isPM } = useAuthRole(currentProjectId ?? undefined);
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id;
  const queryClient = useQueryClient();

  const canEdit = isAdmin || isPM();

  // Ensure default manual checks exist
  useEffect(() => {
    if (!orgId) return;
    supabase.rpc('rpc_ensure_release_checks', { p_org_id: orgId }).then();
  }, [orgId]);

  // Latest audit run
  const { data: latestRun, isLoading: runLoading } = useQuery({
    queryKey: ['release-latest-audit', orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from('audit_run_history')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as AuditRunRow | null;
    },
    enabled: !!orgId,
  });

  // Manual checks
  const { data: manualChecks, isLoading: checksLoading } = useQuery({
    queryKey: ['release-manual-checks', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('release_manual_checks')
        .select('id,check_key,label,is_checked,checked_by,checked_at')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ManualCheck[];
    },
    enabled: !!orgId,
  });

  // Toggle check mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, checked }: { id: string; checked: boolean }) => {
      const { error } = await supabase
        .from('release_manual_checks')
        .update({
          is_checked: checked,
          checked_at: checked ? new Date().toISOString() : null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['release-manual-checks', orgId] });
    },
    onError: (e) => {
      toast.error('Failed to update check: ' + e.message);
    },
  });

  // Release candidate logic
  const releaseReady = useMemo(() => {
    if (!latestRun) return false;
    if (latestRun.p0_blockers > 0) return false;
    if (latestRun.fail_count > 0) return false;
    if (!manualChecks || manualChecks.length === 0) return false;
    return manualChecks.every(c => c.is_checked);
  }, [latestRun, manualChecks]);

  // Extract P0/fail checks from json_result for display
  const failChecks = useMemo(() => {
    if (!latestRun?.json_result) return [];
    const checks: AuditCheckResult[] = Array.isArray(latestRun.json_result) ? latestRun.json_result : [];
    return checks.filter((c) => c.status === 'FAIL');
  }, [latestRun]);


  const totalChecks = latestRun ? latestRun.pass_count + latestRun.fail_count + latestRun.manual_count : 0;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        <HealthContextBanner />
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Rocket className="h-6 w-6" />
              Release Readiness
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Verify all automated and manual checks before releasing.
            </p>
          </div>
          {/* Release Candidate Badge */}
          {releaseReady && (
            <Badge className="bg-status-complete text-status-complete-foreground text-sm px-3 py-1.5 gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              Release Candidate
            </Badge>
          )}
          {!releaseReady && latestRun && (
            <Badge variant="destructive" className="text-sm px-3 py-1.5 gap-1.5">
              <AlertTriangle className="h-4 w-4" />
              Not Ready
            </Badge>
          )}
        </div>

        {/* Audit Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Latest Audit Run
            </CardTitle>
            {latestRun && (
              <CardDescription className="flex items-center gap-1.5 text-xs">
                <Clock className="h-3 w-3" />
                {new Date(latestRun.created_at).toLocaleString()}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {runLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-lg" />
                ))}
              </div>
            ) : !latestRun ? (
              <div className="text-center py-8 text-muted-foreground">
                <RefreshCw className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
                <p>No audit runs found. Run the audit suite first.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <MetricCard label="Total Checks" value={totalChecks} />
                  <MetricCard label="Pass" value={latestRun.pass_count} className="text-status-complete" />
                  <MetricCard label="Fail" value={latestRun.fail_count} className={latestRun.fail_count > 0 ? 'text-destructive' : 'text-status-complete'} />
                  <MetricCard label="P0 Blockers" value={latestRun.p0_blockers} className={latestRun.p0_blockers > 0 ? 'text-destructive' : 'text-status-complete'} />
                </div>

                {/* Failed checks detail */}
                {failChecks.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium text-destructive flex items-center gap-1.5">
                      <XCircle className="h-4 w-4" />
                      Failed Checks ({failChecks.length})
                    </p>
                    <div className="space-y-1.5">
                      {failChecks.map((c, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm p-2 rounded-lg bg-destructive/5 border border-destructive/10">
                          <Badge className={`text-[10px] shrink-0 mt-0.5 ${c.severity === 'P0' ? 'bg-destructive text-destructive-foreground' : 'bg-amber-600 text-white'}`}>
                            {c.severity}
                          </Badge>
                          <div className="min-w-0">
                            <span className="font-medium text-foreground">{c.name}</span>
                            <p className="text-xs text-muted-foreground truncate">{c.actual}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Manual Checks Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Manual Checks
            </CardTitle>
            <CardDescription>
              These must be completed before a release can proceed.
              {!canEdit && ' (View only — admin/PM required to toggle)'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {checksLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 rounded-lg" />
                ))}
              </div>
            ) : !manualChecks || manualChecks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No manual checks configured.</p>
            ) : (
              <div className="space-y-1">
                {manualChecks.map(check => (
                  <ManualCheckRow
                    key={check.id}
                    check={check}
                    canEdit={canEdit}
                    onToggle={(checked) => toggleMutation.mutate({ id: check.id, checked })}
                    isToggling={toggleMutation.isPending}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Banner */}
        {latestRun && (
          <Card className={releaseReady ? 'border-status-complete/50 bg-status-complete/5' : 'border-destructive/30 bg-destructive/5'}>
            <CardContent className="py-6 text-center">
              {releaseReady ? (
                <>
                  <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-status-complete" />
                  <p className="font-semibold text-foreground">All checks passed</p>
                  <p className="text-sm text-muted-foreground mt-1">This build qualifies as a Release Candidate.</p>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-10 w-10 mx-auto mb-2 text-destructive" />
                  <p className="font-semibold text-foreground">Release blocked</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {latestRun.p0_blockers > 0 && `${latestRun.p0_blockers} P0 blocker(s). `}
                    {latestRun.fail_count > 0 && `${latestRun.fail_count} failed check(s). `}
                    {manualChecks && !manualChecks.every(c => c.is_checked) && 'Manual checks incomplete.'}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}

/* ─── Sub-components ─── */

function MetricCard({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${className ?? 'text-foreground'}`}>{value}</p>
    </div>
  );
}

function ManualCheckRow({
  check,
  canEdit,
  onToggle,
  isToggling,
}: {
  check: ManualCheck;
  canEdit: boolean;
  onToggle: (checked: boolean) => void;
  isToggling: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
        check.is_checked ? 'bg-muted/30' : 'hover:bg-muted/50'
      } ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <Checkbox
        checked={check.is_checked}
        onCheckedChange={(val) => {
          if (canEdit && !isToggling) onToggle(!!val);
        }}
        disabled={!canEdit || isToggling}
      />
      <div className="flex-1 min-w-0">
        <span className={`text-sm font-medium ${check.is_checked ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
          {check.label}
        </span>
        {check.is_checked && check.checked_at && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Completed {new Date(check.checked_at).toLocaleDateString()}
          </p>
        )}
      </div>
      {check.is_checked && (
        <CheckCircle2 className="h-4 w-4 text-status-complete shrink-0" />
      )}
    </label>
  );
}
