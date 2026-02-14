import { useState, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { useAuthRole } from "@/hooks/useAuthRole";
import { NoAccess } from "@/components/NoAccess";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Download,
  Clock,
  Database,
  Lock,
  Brain,
  BarChart3,
  GitCompare,
  Timer,
} from "lucide-react";
import { toast } from "sonner";

interface AuditResults {
  ran_at: string;
  sections: {
    financial_reconciliation?: FinancialResult;
    time_inclusion_contract?: TimeContractResult;
    enum_integrity?: EnumResult;
    cross_org_leak_test?: CrossOrgResult;
    ai_narrative_validation?: AINarrativeResult;
    snapshot_consistency?: SnapshotResult;
    drift_detection?: DriftResult;
  };
}

interface FinancialResult {
  pass: boolean;
  planned_total: number | null;
  contract_value: number | null;
  manual_actual_total: number;
  labor_total: number;
  receipt_total: number;
  rpc_actual_total: number | null;
  rpc_difference: number | null;
  snapshot_actual_total: number | null;
  snapshot_difference: number | null;
}

interface TimeContractResult {
  pass: boolean;
  closed_with_zero_duration: number;
  closed_with_null_checkout: number;
  total_closed_entries: number;
  canonical_predicate_matches: number;
  invalid_entries_in_closed: number;
}

interface EnumResult {
  pass: boolean;
  checks: Record<
    string,
    { pass: boolean; found: string[]; allowed: string[]; unexpected: string[] }
  >;
}

interface CrossOrgResult {
  pass: boolean;
  tables_checked: string[];
  tables_with_rls_policies: string[];
  tables_without_policies: string[];
  note: string;
}

interface AINarrativeResult {
  pass: boolean;
  insight_id?: string;
  insight_type?: string;
  narrative_numbers?: string[];
  evidence_numbers?: string[];
  missing?: string[];
  note?: string;
}

interface SnapshotResult {
  pass: boolean;
  snapshot_id?: string;
  captured_at?: string;
  drifted_fields?: Record<
    string,
    { snapshot: number; live: number; diff: number }
  >;
  task_counts?: { total: number; completed: number };
  note?: string;
}

interface DriftResult {
  pass: boolean;
  canonical_check_constraints: Array<{ table: string; constraint: string }>;
  canonical_enums: string[];
  not_null_issues: Array<{
    table: string;
    column: string;
    expected: string;
    actual: string;
  }>;
  note: string;
}

const StatusBadge = ({ pass }: { pass: boolean }) => (
  <Badge
    variant={pass ? "default" : "destructive"}
    className={`text-xs font-mono ${pass ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
  >
    {pass ? "PASS" : "FAIL"}
  </Badge>
);

const fmt = (n: number | null | undefined) =>
  n != null ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—";

export default function SystemAudit() {
  const { isAdmin, loading: authLoading } = useAuthRole();
  const { currentProjectId } = useCurrentProject();

  // Fetch project name for display
  const { data: currentProject } = useQuery({
    queryKey: ["project-name", currentProjectId],
    queryFn: async () => {
      if (!currentProjectId) return null;
      const { data } = await supabase
        .from("projects")
        .select("id, name")
        .eq("id", currentProjectId)
        .maybeSingle();
      return data;
    },
    enabled: !!currentProjectId,
  });

  const [results, setResults] = useState<AuditResults | null>(null);
  const [running, setRunning] = useState(false);

  const runAudit = useCallback(async () => {
    setRunning(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        toast.error("Not authenticated");
        return;
      }

      const resp = await supabase.functions.invoke("system-audit", {
        body: { project_id: currentProject?.id || null },
      });

      if (resp.error) {
        toast.error("Audit failed: " + resp.error.message);
        return;
      }

      setResults(resp.data as AuditResults);
      toast.success("Audit complete");
    } catch (err) {
      toast.error("Audit failed");
      console.error(err);
    } finally {
      setRunning(false);
    }
  }, [currentProject?.id]);

  const exportJSON = useCallback(() => {
    if (!results) return;
    const blob = new Blob([JSON.stringify(results, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `system-audit-${new Date().toISOString().slice(0, 19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [results]);

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return (
      <Layout>
        <NoAccess />
      </Layout>
    );
  }

  const s = results?.sections;
  const allPass =
    results &&
    Object.values(s || {}).every((section) =>
      typeof section === "object" && section !== null && "pass" in section
        ? (section as { pass: boolean }).pass
        : true
    );

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="h-6 w-6" />
              System Integrity Audit
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Forensic verification against live database schema.
              {currentProject && (
                <span className="text-primary ml-1">
                  Project: {currentProject.name}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {results && (
              <>
                <Badge
                  variant={allPass ? "default" : "destructive"}
                  className={`text-sm px-3 py-1 ${allPass ? "bg-emerald-600" : ""}`}
                >
                  {allPass ? "ALL PASS" : "FAILURES DETECTED"}
                </Badge>
                <Button variant="outline" size="sm" onClick={exportJSON}>
                  <Download className="h-4 w-4 mr-1" /> Export JSON
                </Button>
              </>
            )}
            <Button onClick={runAudit} disabled={running} size="sm">
              <RefreshCw
                className={`h-4 w-4 mr-1 ${running ? "animate-spin" : ""}`}
              />
              {running ? "Running…" : "Run Audit Now"}
            </Button>
          </div>
        </div>

        {results && (
          <p className="text-xs text-muted-foreground font-mono">
            Last run: {new Date(results.ran_at).toLocaleString()}
          </p>
        )}

        {!results && !running && (
          <Card>
            <CardContent className="py-16 text-center">
              <ShieldAlert className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Click "Run Audit Now" to verify system integrity.
              </p>
              {!currentProject && (
                <p className="text-sm text-muted-foreground mt-2">
                  Select a project for financial reconciliation & snapshot
                  checks.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {running && (
          <Card>
            <CardContent className="py-16 text-center">
              <RefreshCw className="h-8 w-8 mx-auto text-primary animate-spin mb-4" />
              <p className="text-muted-foreground">
                Running integrity checks…
              </p>
            </CardContent>
          </Card>
        )}

        {results && !running && (
          <div className="space-y-4">
            {/* Section 1: Financial */}
            {s?.financial_reconciliation && (
              <AuditSection
                title="Financial Reconciliation"
                icon={<BarChart3 className="h-5 w-5" />}
                pass={s.financial_reconciliation.pass}
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <MetricCell
                    label="Planned Total"
                    value={fmt(s.financial_reconciliation.planned_total)}
                  />
                  <MetricCell
                    label="Manual Actual"
                    value={fmt(s.financial_reconciliation.manual_actual_total)}
                  />
                  <MetricCell
                    label="RPC Actual"
                    value={fmt(s.financial_reconciliation.rpc_actual_total)}
                  />
                  <MetricCell
                    label="Snapshot Actual"
                    value={fmt(s.financial_reconciliation.snapshot_actual_total)}
                  />
                  <MetricCell
                    label="Labor (recomputed)"
                    value={fmt(s.financial_reconciliation.labor_total)}
                  />
                  <MetricCell
                    label="Receipts"
                    value={fmt(s.financial_reconciliation.receipt_total)}
                  />
                  <MetricCell
                    label="RPC Δ"
                    value={fmt(s.financial_reconciliation.rpc_difference)}
                    warn={
                      (s.financial_reconciliation.rpc_difference ?? 0) > 0.01
                    }
                  />
                  <MetricCell
                    label="Snapshot Δ"
                    value={fmt(s.financial_reconciliation.snapshot_difference)}
                    warn={
                      (s.financial_reconciliation.snapshot_difference ?? 0) >
                      0.01
                    }
                  />
                </div>
              </AuditSection>
            )}

            {/* Section 2: Time Contract */}
            {s?.time_inclusion_contract && (
              <AuditSection
                title="Time Entry Inclusion Contract"
                icon={<Timer className="h-5 w-5" />}
                pass={s.time_inclusion_contract.pass}
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <MetricCell
                    label="Total Closed"
                    value={String(
                      s.time_inclusion_contract.total_closed_entries
                    )}
                  />
                  <MetricCell
                    label="Canonical Matches"
                    value={String(
                      s.time_inclusion_contract.canonical_predicate_matches
                    )}
                  />
                  <MetricCell
                    label="Zero Duration"
                    value={String(
                      s.time_inclusion_contract.closed_with_zero_duration
                    )}
                    warn={
                      s.time_inclusion_contract.closed_with_zero_duration > 0
                    }
                  />
                  <MetricCell
                    label="NULL Checkout"
                    value={String(
                      s.time_inclusion_contract.closed_with_null_checkout
                    )}
                    warn={
                      s.time_inclusion_contract.closed_with_null_checkout > 0
                    }
                  />
                </div>
              </AuditSection>
            )}

            {/* Section 3: Enum Integrity */}
            {s?.enum_integrity && (
              <AuditSection
                title="Enum Integrity"
                icon={<Database className="h-5 w-5" />}
                pass={s.enum_integrity.pass}
              >
                <div className="space-y-2">
                  {Object.entries(s.enum_integrity.checks).map(
                    ([key, check]) => (
                      <div
                        key={key}
                        className={`flex items-center justify-between p-2 rounded text-sm ${
                          check.pass
                            ? "bg-muted/50"
                            : "bg-destructive/10 border border-destructive/30"
                        }`}
                      >
                        <div>
                          <span className="font-mono font-medium">{key}</span>
                          <span className="text-muted-foreground ml-2">
                            [{check.found.join(", ")}]
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {check.unexpected.length > 0 && (
                            <span className="text-destructive text-xs font-mono">
                              unexpected: {check.unexpected.join(", ")}
                            </span>
                          )}
                          <StatusBadge pass={check.pass} />
                        </div>
                      </div>
                    )
                  )}
                </div>
              </AuditSection>
            )}

            {/* Section 4: Cross-Org */}
            {s?.cross_org_leak_test && (
              <AuditSection
                title="Cross-Org Isolation"
                icon={<Lock className="h-5 w-5" />}
                pass={s.cross_org_leak_test.pass}
              >
                <p className="text-sm text-muted-foreground mb-2">
                  {s.cross_org_leak_test.note}
                </p>
                {s.cross_org_leak_test.tables_without_policies.length > 0 && (
                  <div className="text-sm text-destructive font-mono">
                    Missing RLS:{" "}
                    {s.cross_org_leak_test.tables_without_policies.join(", ")}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  Checked: {s.cross_org_leak_test.tables_checked.length} tables
                  · {s.cross_org_leak_test.tables_with_rls_policies.length} with
                  policies
                </div>
              </AuditSection>
            )}

            {/* Section 5: AI Narrative */}
            {s?.ai_narrative_validation && (
              <AuditSection
                title="AI Narrative Validation"
                icon={<Brain className="h-5 w-5" />}
                pass={s.ai_narrative_validation.pass}
              >
                {s.ai_narrative_validation.note && (
                  <p className="text-sm text-muted-foreground">
                    {s.ai_narrative_validation.note}
                  </p>
                )}
                {s.ai_narrative_validation.narrative_numbers && (
                  <div className="text-sm space-y-1 mt-2">
                    <div>
                      <span className="text-muted-foreground">
                        Narrative numbers:{" "}
                      </span>
                      <span className="font-mono">
                        {s.ai_narrative_validation.narrative_numbers.join(
                          ", "
                        ) || "none"}
                      </span>
                    </div>
                    {(s.ai_narrative_validation.missing?.length ?? 0) > 0 && (
                      <div className="text-destructive font-mono text-xs">
                        Unmatched:{" "}
                        {s.ai_narrative_validation.missing?.join(", ")}
                      </div>
                    )}
                  </div>
                )}
              </AuditSection>
            )}

            {/* Section 6: Snapshot */}
            {s?.snapshot_consistency && (
              <AuditSection
                title="Snapshot Consistency"
                icon={<Clock className="h-5 w-5" />}
                pass={s.snapshot_consistency.pass}
              >
                <p className="text-sm text-muted-foreground">
                  {s.snapshot_consistency.note}
                </p>
                {s.snapshot_consistency.captured_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Snapshot:{" "}
                    {new Date(
                      s.snapshot_consistency.captured_at
                    ).toLocaleString()}
                  </p>
                )}
                {s.snapshot_consistency.drifted_fields &&
                  Object.keys(s.snapshot_consistency.drifted_fields).length >
                    0 && (
                    <div className="mt-2 space-y-1">
                      {Object.entries(
                        s.snapshot_consistency.drifted_fields
                      ).map(([field, d]) => (
                        <div
                          key={field}
                          className="text-sm bg-destructive/10 p-2 rounded font-mono"
                        >
                          {field}: snapshot={fmt(d.snapshot)} live=
                          {fmt(d.live)} Δ={fmt(d.diff)}
                        </div>
                      ))}
                    </div>
                  )}
              </AuditSection>
            )}

            {/* Section 7: Drift */}
            {s?.drift_detection && (
              <AuditSection
                title="Schema Drift Detection"
                icon={<GitCompare className="h-5 w-5" />}
                pass={s.drift_detection.pass}
              >
                <p className="text-sm text-muted-foreground">
                  {s.drift_detection.note}
                </p>
                {s.drift_detection.not_null_issues.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {s.drift_detection.not_null_issues.map((issue, i) => (
                      <div
                        key={i}
                        className="text-sm bg-destructive/10 p-2 rounded font-mono"
                      >
                        {issue.table}.{issue.column}: expected{" "}
                        {issue.expected}, got {issue.actual}
                      </div>
                    ))}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-2">
                  Canonical constraints:{" "}
                  {s.drift_detection.canonical_check_constraints
                    .map((c) => `${c.table}.${c.constraint}`)
                    .join(", ")}
                </div>
              </AuditSection>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

function AuditSection({
  title,
  icon,
  pass,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  pass: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card
      className={
        pass ? "" : "border-destructive/50 bg-destructive/5"
      }
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
          <StatusBadge pass={pass} />
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function MetricCell({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div
      className={`p-2 rounded ${warn ? "bg-destructive/10" : "bg-muted/50"}`}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`font-mono text-sm font-medium ${warn ? "text-destructive" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}
