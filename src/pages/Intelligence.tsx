import { Layout } from "@/components/Layout";
import { SectionHeader } from "@/components/SectionHeader";
import { NoAccess } from "@/components/NoAccess";
import { useProjectRole } from "@/hooks/useProjectRole";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { useOrganization } from "@/hooks/useOrganization";
import {
  useProfitRisk,
  useCostRollup,
  useVarianceSummary,
  useReceiptLag,
  useSafetyGaps,
} from "@/hooks/useIntelligenceDashboard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, ShieldAlert, TrendingUp, Receipt, Shield, Info, Users } from "lucide-react";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/formatters";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

// ── Project selector (org-scoped) ──
function useOrgProjects(orgId: string | null) {
  return useQuery({
    queryKey: ['intelligence', 'projects', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id,name,currency,status')
        .eq('organization_id', orgId!)
        .neq('status', 'deleted')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId,
  });
}

// ── Risk level badge ──
function RiskBadge({ level, score }: { level: string; score: number }) {
  const variant = level === 'high' ? 'destructive' : level === 'medium' ? 'secondary' : 'outline';
  return (
    <Badge variant={variant} className="text-xs">
      {score}/100 — {level.charAt(0).toUpperCase() + level.slice(1)}
    </Badge>
  );
}

// ── Traceable KPI Card ──
function KpiCard({
  title,
  icon: Icon,
  value,
  subtitle,
  traceSource,
  children,
  loading,
  className,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  value: React.ReactNode;
  subtitle?: string;
  traceSource: string;
  children?: React.ReactNode;
  loading?: boolean;
  className?: string;
}) {
  return (
    <Card className={cn("relative", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <Info className="h-3 w-3 text-muted-foreground/50" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs">
              <p className="text-xs"><strong>Source:</strong> {traceSource}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-32" />
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
            {children}
          </>
        )}
      </CardContent>
    </Card>
  );
}

const Intelligence = () => {
  const { isGlobalAdmin, canManageProject, loading: roleLoading } = useProjectRole();
  const { currentProjectId, setCurrentProject } = useCurrentProject();
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;

  const { data: projects, isLoading: projectsLoading } = useOrgProjects(orgId);
  const { data: risk, isLoading: riskLoading } = useProfitRisk(currentProjectId);
  const { data: rollup, isLoading: rollupLoading } = useCostRollup(currentProjectId);
  const { data: variance, isLoading: varianceLoading } = useVarianceSummary(currentProjectId);
  const { data: receiptLag, isLoading: receiptLagLoading } = useReceiptLag(currentProjectId);
  const { data: safetyGaps, isLoading: safetyLoading } = useSafetyGaps(currentProjectId);

  const canAccess = isGlobalAdmin || (currentProjectId ? canManageProject(currentProjectId) : false);

  // Access gate
  if (!roleLoading && !isGlobalAdmin && currentProjectId && !canManageProject(currentProjectId)) {
    return (
      <Layout>
        <NoAccess />
      </Layout>
    );
  }

  const currency = risk?.currency ?? rollup?.currency ?? 'CAD';

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header + Project Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <SectionHeader
            title="Intelligence"
            subtitle="Project risk, cost health, and compliance at a glance"
          />
          <Select
            value={currentProjectId ?? ''}
            onValueChange={(v) => setCurrentProject(v || null)}
          >
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Select a project…" />
            </SelectTrigger>
            <SelectContent>
              {projectsLoading ? (
                <div className="p-2"><Skeleton className="h-5 w-full" /></div>
              ) : (
                (projects ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {!currentProjectId ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Select a project above to view intelligence data.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* ── 1. Risk Score ── */}
            <KpiCard
              title="Risk Score"
              icon={AlertTriangle}
              loading={riskLoading}
              traceSource="rpc_get_project_profit_risk → risk_score, risk_level"
              value={risk ? <RiskBadge level={risk.risk_level} score={risk.risk_score} /> : '—'}
              subtitle={
                risk?.projected_margin != null
                  ? `Projected margin: ${formatPercent(risk.projected_margin)}`
                  : risk?.projected_final_cost != null
                    ? `Projected final: ${formatCurrency(risk.projected_final_cost, currency)}`
                    : 'Insufficient data for projection'
              }
            >
              {risk && risk.drivers.length > 0 && (
                <div className="mt-3 space-y-1">
                  {risk.drivers.map((d) => (
                    <div key={d.key} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <ShieldAlert className={cn(
                        "h-3 w-3 mt-0.5 shrink-0",
                        d.severity === 'high' ? 'text-destructive' : 'text-muted-foreground'
                      )} />
                      <span>{d.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </KpiCard>

            {/* ── 2. Unrated Labor Exposure ── */}
            <KpiCard
              title="Unrated Labor Exposure"
              icon={Users}
              loading={rollupLoading}
              traceSource="rpc_get_project_cost_rollup → unrated_labor_hours, unrated_labor_entries_count"
              value={
                rollup
                  ? rollup.unrated_labor_hours > 0
                    ? `${formatNumber(rollup.unrated_labor_hours)} hrs`
                    : '0 hrs'
                  : '—'
              }
              subtitle={
                rollup && rollup.unrated_labor_hours > 0
                  ? `${rollup.unrated_labor_entries_count} entries without cost rates`
                  : rollup ? 'All labor entries have cost rates' : undefined
              }
              className={rollup && rollup.unrated_labor_hours > 0 ? 'border-yellow-500/30' : ''}
            />

            {/* ── 3. Variance Summary ── */}
            <KpiCard
              title="Integrity & Variance"
              icon={TrendingUp}
              loading={varianceLoading}
              traceSource="estimate_variance_summary → integrity_score, budget_variance_pct, labor_variance_pct"
              value={
                variance
                  ? (
                    <span className={cn(
                      (variance.integrity_score ?? 0) >= 80 ? 'text-primary' :
                      (variance.integrity_score ?? 0) >= 50 ? 'text-accent-foreground' : 'text-destructive'
                    )}>
                      {variance.integrity_score ?? 0}/100
                    </span>
                  )
                  : '—'
              }
              subtitle={variance?.integrity_status ?? undefined}
            >
              {variance && (
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  {variance.budget_variance_pct != null && (
                    <div>
                      <span className="text-muted-foreground">Budget: </span>
                      <span className={variance.budget_variance_pct > 0 ? 'text-destructive' : 'text-primary'}>
                        {variance.budget_variance_pct > 0 ? '+' : ''}{formatPercent(variance.budget_variance_pct)}
                      </span>
                    </div>
                  )}
                  {variance.labor_variance_pct != null && (
                    <div>
                      <span className="text-muted-foreground">Labor: </span>
                      <span className={variance.labor_variance_pct > 0 ? 'text-destructive' : 'text-primary'}>
                        {variance.labor_variance_pct > 0 ? '+' : ''}{formatPercent(variance.labor_variance_pct)}
                      </span>
                    </div>
                  )}
                </div>
              )}
              {variance && variance.blockers?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {variance.blockers.map((b) => (
                    <Badge key={b.key} variant="destructive" className="text-[10px]">
                      {b.label}
                    </Badge>
                  ))}
                </div>
              )}
            </KpiCard>

            {/* ── 4. Receipt Approval Lag ── */}
            {receiptLag !== null && !receiptLagLoading && (
              <KpiCard
                title="Receipt Approval Lag"
                icon={Receipt}
                loading={receiptLagLoading}
                traceSource="receipts table → review_status='pending', created_at delta"
                value={
                  receiptLag && receiptLag.pending_count > 0
                    ? `${receiptLag.avg_lag_days ?? 0} days avg`
                    : 'No pending'
                }
                subtitle={
                  receiptLag && receiptLag.pending_count > 0
                    ? `${receiptLag.pending_count} pending · oldest: ${receiptLag.oldest_pending_days ?? 0}d`
                    : 'All receipts reviewed'
                }
                className={receiptLag && receiptLag.pending_count > 5 ? 'border-yellow-500/30' : ''}
              />
            )}

            {/* ── 5. Safety Compliance Gaps ── */}
            <KpiCard
              title="Safety Compliance"
              icon={Shield}
              loading={safetyLoading}
              traceSource="safety_forms.status vs daily_logs count"
              value={
                safetyGaps
                  ? `${safetyGaps.compliance_pct}%`
                  : '—'
              }
              subtitle={
                safetyGaps
                  ? safetyGaps.gap_count > 0
                    ? `${safetyGaps.gap_count} missing forms of ${safetyGaps.total_forms_required} expected`
                    : `${safetyGaps.total_forms_submitted} forms submitted`
                  : undefined
              }
              className={safetyGaps && safetyGaps.compliance_pct < 80 ? 'border-destructive/30' : ''}
            />
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Intelligence;
