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
  TableProperties,
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
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
    structural_rls_check?: StructuralRlsResult;
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

interface CrossOrgTestItem {
  test_name: string;
  actor: string;
  query: string;
  expected: string;
  actual: string;
  pass: boolean;
}

interface CrossOrgResult {
  pass: boolean;
  tests: CrossOrgTestItem[];
  test_count: number;
  fail_count: number;
  target_project_id: string | null;
  cross_org_project_id: string | null;
  projects_cross_org_count: number;
  release_blocked: boolean;
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

interface RlsTableInfo {
  table_name: string;
  rls_enabled: boolean;
  policy_count: number;
  policy_names: string[];
}

interface StructuralRlsResult {
  pass: boolean;
  tables: RlsTableInfo[];
  missing_rls: string[];
  rls_no_policies: string[];
  missing_from_db: string[];
  note: string;
}

/**
 * Security model config constant.
 * 'RLS'      — RLS is mandatory; any cross-org row leak is a release blocker.
 * 'RPC_ONLY' — Direct table access is not relied on; behavioral tests focus on RPC authorization.
 */
const SECURITY_MODEL: "RLS" | "RPC_ONLY" = "RLS";

const SECURITY_MODEL_BANNER = {
  RLS: {
    text: "RLS is mandatory. Any table returning rows cross-org is a release blocker.",
    className: "bg-destructive/10 border-destructive/30 text-destructive",
  },
  RPC_ONLY: {
    text: "Direct table access is not relied on for isolation. Behavioral tests focus on RPC authorization.",
    className: "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400",
  },
} as const;

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

  return <SystemAuditContent />;
}

function SystemAuditContent() {
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

            {/* Section 4: Cross-Org Behavioral Tests */}
            {s?.cross_org_leak_test && (
              <AuditSection
                title="Cross-Org Behavioral Isolation"
                icon={<Lock className="h-5 w-5" />}
                pass={s.cross_org_leak_test.pass}
              >
                <div
                  className={`text-sm font-medium px-3 py-2 rounded border mb-3 ${SECURITY_MODEL_BANNER[SECURITY_MODEL].className}`}
                >
                  <span className="font-mono text-xs mr-2">[{SECURITY_MODEL}]</span>
                  {SECURITY_MODEL_BANNER[SECURITY_MODEL].text}
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  {s.cross_org_leak_test.note}
                </p>
                {s.cross_org_leak_test.tests && s.cross_org_leak_test.tests.length > 0 && (
                  <div className="overflow-x-auto mt-2">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th className="py-1.5 pr-3 font-medium text-muted-foreground">Test</th>
                          <th className="py-1.5 pr-3 font-medium text-muted-foreground">Actor</th>
                          <th className="py-1.5 pr-3 font-medium text-muted-foreground hidden md:table-cell">Expected</th>
                          <th className="py-1.5 pr-3 font-medium text-muted-foreground">Actual</th>
                          <th className="py-1.5 font-medium text-muted-foreground text-right">Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.cross_org_leak_test.tests.map((test, i) => (
                          <tr
                            key={i}
                            className={`border-b border-border/50 ${!test.pass ? "bg-destructive/10" : ""}`}
                          >
                            <td className="py-1.5 pr-3 font-mono text-xs">{test.test_name}</td>
                            <td className="py-1.5 pr-3">
                              <Badge
                                variant="outline"
                                className={`text-xs ${
                                  test.actor === "org_member"
                                    ? "border-primary/50 text-primary"
                                    : test.actor === "non_member"
                                      ? "border-orange-500/50 text-orange-600"
                                      : "border-muted-foreground/50 text-muted-foreground"
                                }`}
                              >
                                {test.actor === "org_member"
                                  ? "Member"
                                  : test.actor === "non_member"
                                    ? "Non-member"
                                    : "Unauth"}
                              </Badge>
                            </td>
                            <td className="py-1.5 pr-3 text-xs text-muted-foreground hidden md:table-cell">
                              {test.expected}
                            </td>
                            <td className="py-1.5 pr-3 font-mono text-xs">
                              {test.actual}
                            </td>
                            <td className="py-1.5 text-right">
                              <StatusBadge pass={test.pass} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-2 flex gap-3">
                  <span>Tests: {s.cross_org_leak_test.test_count ?? s.cross_org_leak_test.tests?.length ?? 0}</span>
                  <span>Failures: {s.cross_org_leak_test.fail_count ?? 0}</span>
                  {s.cross_org_leak_test.cross_org_project_id && (
                    <span className="font-mono">
                      Cross-org target: {s.cross_org_leak_test.cross_org_project_id.slice(0, 8)}…
                    </span>
                  )}
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

            {/* Section 9: Release Checklist */}
            {results && (
              <ReleaseChecklist sections={s} />
            )}
            {/* Section 8: Structural RLS Check */}
            {s?.structural_rls_check && (
              <AuditSection
                title="Structural RLS Verification"
                icon={<TableProperties className="h-5 w-5" />}
                pass={s.structural_rls_check.pass}
              >
                <p className="text-sm text-muted-foreground mb-2">
                  {s.structural_rls_check.note}
                </p>
                {s.structural_rls_check.tables && s.structural_rls_check.tables.length > 0 && (
                  <div className="overflow-x-auto mt-2">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th className="py-1.5 pr-3 font-medium text-muted-foreground">Table</th>
                          <th className="py-1.5 pr-3 font-medium text-muted-foreground">RLS</th>
                          <th className="py-1.5 pr-3 font-medium text-muted-foreground">Policies</th>
                          <th className="py-1.5 font-medium text-muted-foreground hidden md:table-cell">Policy Names</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.structural_rls_check.tables.map((t) => (
                          <tr
                            key={t.table_name}
                            className={`border-b border-border/50 ${
                              !t.rls_enabled
                                ? "bg-destructive/10"
                                : t.policy_count === 0
                                  ? "bg-orange-500/10"
                                  : ""
                            }`}
                          >
                            <td className="py-1.5 pr-3 font-mono text-xs">{t.table_name}</td>
                            <td className="py-1.5 pr-3">
                              <Badge
                                variant={t.rls_enabled ? "default" : "destructive"}
                                className={`text-xs font-mono ${t.rls_enabled ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
                              >
                                {t.rls_enabled ? "ON" : "OFF"}
                              </Badge>
                            </td>
                            <td className="py-1.5 pr-3 font-mono text-xs">{t.policy_count}</td>
                            <td className="py-1.5 text-xs text-muted-foreground hidden md:table-cell max-w-xs truncate">
                              {t.policy_names.length > 0
                                ? t.policy_names.join(", ")
                                : <span className="text-destructive">none</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {s.structural_rls_check.missing_from_db.length > 0 && (
                  <div className="text-sm text-destructive font-mono mt-2">
                    Missing tables: {s.structural_rls_check.missing_from_db.join(", ")}
                  </div>
                )}
              </AuditSection>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
function ReleaseChecklist({ sections }: { sections: AuditResults["sections"] }) {
  const checks = [
    {
      id: "cross_org_projects",
      label: "Cross-org projects isolation",
      description: "No authenticated user can SELECT projects from another organization",
      pass: sections?.cross_org_leak_test
        ? (sections.cross_org_leak_test.projects_cross_org_count ?? 0) === 0
        : null,
      blocker: true,
    },
    {
      id: "cross_org_all_tables",
      label: "Cross-org behavioral isolation (all tables)",
      description: "All cross-org SELECT queries return 0 rows",
      pass: sections?.cross_org_leak_test?.pass ?? null,
      blocker: true,
    },
    {
      id: "rls_structural",
      label: "Structural RLS enabled on all critical tables",
      description: "Every critical table has RLS enabled with at least one policy",
      pass: sections?.structural_rls_check?.pass ?? null,
      blocker: true,
    },
    {
      id: "financial_reconciliation",
      label: "Financial reconciliation within tolerance",
      description: "RPC and snapshot totals match manual recomputation (±$0.01)",
      pass: sections?.financial_reconciliation?.pass ?? null,
      blocker: false,
    },
    {
      id: "time_contract",
      label: "Time entry inclusion contract enforced",
      description: "No closed entries with zero duration or null checkout",
      pass: sections?.time_inclusion_contract?.pass ?? null,
      blocker: false,
    },
    {
      id: "enum_integrity",
      label: "Enum integrity verified",
      description: "All status/type columns contain only canonical values",
      pass: sections?.enum_integrity?.pass ?? null,
      blocker: false,
    },
  ];

  const blockersFailing = checks.filter((c) => c.blocker && c.pass === false);
  const allBlockersPass = blockersFailing.length === 0 && checks.some((c) => c.blocker && c.pass === true);

  return (
    <Card className={blockersFailing.length > 0 ? "border-destructive/50 bg-destructive/5" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Release Checklist
          </CardTitle>
          {allBlockersPass ? (
            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-xs">RELEASE OK</Badge>
          ) : blockersFailing.length > 0 ? (
            <Badge variant="destructive" className="text-xs">RELEASE BLOCKED</Badge>
          ) : (
            <Badge variant="outline" className="text-xs">PENDING</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3">
          Run the full audit after every migration. All blocker items must pass before publishing.
        </p>
        <div className="space-y-2">
          {checks.map((check) => (
            <div
              key={check.id}
              className={`flex items-start gap-3 p-2.5 rounded text-sm ${
                check.pass === false
                  ? "bg-destructive/10 border border-destructive/30"
                  : check.pass === true
                    ? "bg-muted/50"
                    : "bg-muted/30 opacity-60"
              }`}
            >
              <div className="mt-0.5">
                {check.pass === true ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : check.pass === false ? (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                ) : (
                  <Clock className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{check.label}</span>
                  {check.blocker && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-destructive/50 text-destructive">
                      BLOCKER
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{check.description}</p>
              </div>
              <div className="shrink-0">
                {check.pass !== null && <StatusBadge pass={check.pass} />}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
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
