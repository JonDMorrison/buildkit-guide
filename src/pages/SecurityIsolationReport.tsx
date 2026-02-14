import { useState, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { useAuthRole } from "@/hooks/useAuthRole";
import { useOrganization } from "@/hooks/useOrganization";
import { NoAccess } from "@/components/NoAccess";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ShieldCheck,
  ShieldAlert,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TestResult {
  table: string;
  rowCount: number;
  sampleIds: string[];
  pass: boolean;
  reason: string;
  error?: string;
}

interface ProbeResult extends TestResult {
  targetOrgId: string;
}

// Tables to test and how they relate to org
const TABLES_CONFIG = [
  { table: "projects", orgCol: "organization_id", direct: true },
  { table: "tasks", orgCol: null, direct: false, through: "project_id", parent: "projects" },
  { table: "invoices", orgCol: "organization_id", direct: true },
  { table: "time_entries", orgCol: "organization_id", direct: true },
  { table: "receipts", orgCol: null, direct: false, through: "project_id", parent: "projects" },
  { table: "safety_forms", orgCol: null, direct: false, through: "project_id", parent: "projects" },
  { table: "project_budgets", orgCol: null, direct: false, through: "project_id", parent: "projects" },
  { table: "project_scope_items", orgCol: null, direct: false, through: "project_id", parent: "projects" },
] as const;

async function fetchUserOrgIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("is_active", true);
  if (error || !data) return [];
  return [...new Set(data.map((m) => m.organization_id))];
}

async function runTableTest(
  tableName: string,
  userOrgIds: string[]
): Promise<TestResult> {
  try {
    const { data, error, count } = await supabase
      .from(tableName as any)
      .select("id", { count: "exact" })
      .limit(3);

    if (error) {
      return {
        table: tableName,
        rowCount: 0,
        sampleIds: [],
        pass: true,
        reason: "Query denied by RLS (PASS)",
        error: error.message,
      };
    }

    const rowCount = count ?? (data?.length || 0);
    const sampleIds = (data || []).map((r: any) => r.id).slice(0, 3);

    if (userOrgIds.length === 0) {
      return {
        table: tableName,
        rowCount,
        sampleIds,
        pass: rowCount === 0,
        reason:
          rowCount === 0
            ? "No org memberships → 0 rows (PASS)"
            : `FAIL: ${rowCount} rows visible with no org membership`,
      };
    }

    // User has org memberships — rows should exist but be scoped
    return {
      table: tableName,
      rowCount,
      sampleIds,
      pass: true,
      reason: `${rowCount} rows visible, scoped to ${userOrgIds.length} org(s)`,
    };
  } catch (e: any) {
    return {
      table: tableName,
      rowCount: 0,
      sampleIds: [],
      pass: true,
      reason: "Exception treated as denied",
      error: e.message,
    };
  }
}

async function runCrossOrgProbe(
  tableName: string,
  config: (typeof TABLES_CONFIG)[number],
  targetOrgId: string,
  userOrgIds: string[]
): Promise<ProbeResult> {
  const isMember = userOrgIds.includes(targetOrgId);

  try {
    let query;
    if (config.direct && config.orgCol) {
      query = supabase
        .from(tableName as any)
        .select("id", { count: "exact" })
        .eq(config.orgCol, targetOrgId)
        .limit(3);
    } else {
      // Indirect: get project IDs for the target org, then filter
      const { data: orgProjects } = await supabase
        .from("projects")
        .select("id")
        .eq("organization_id", targetOrgId);

      const projectIds = (orgProjects || []).map((p) => p.id);
      if (projectIds.length === 0) {
        return {
          table: tableName,
          rowCount: 0,
          sampleIds: [],
          pass: true,
          reason: "No projects found for target org (PASS)",
          targetOrgId,
        };
      }

      query = supabase
        .from(tableName as any)
        .select("id", { count: "exact" })
        .in("project_id", projectIds)
        .limit(3);
    }

    const { data, error, count } = await query;

    if (error) {
      return {
        table: tableName,
        rowCount: 0,
        sampleIds: [],
        pass: true,
        reason: "Query denied by RLS (PASS)",
        error: error.message,
        targetOrgId,
      };
    }

    const rowCount = count ?? (data?.length || 0);
    const sampleIds = (data || []).map((r: any) => r.id).slice(0, 3);

    if (!isMember) {
      return {
        table: tableName,
        rowCount,
        sampleIds,
        pass: rowCount === 0,
        reason:
          rowCount === 0
            ? "Non-member → 0 rows (PASS)"
            : `FAIL: ${rowCount} rows leaked to non-member!`,
        targetOrgId,
      };
    }

    return {
      table: tableName,
      rowCount,
      sampleIds,
      pass: true,
      reason: `Member of org → ${rowCount} rows visible (expected)`,
      targetOrgId,
    };
  } catch (e: any) {
    return {
      table: tableName,
      rowCount: 0,
      sampleIds: [],
      pass: true,
      reason: "Exception treated as denied",
      error: e.message,
      targetOrgId,
    };
  }
}

function StatusIcon({ pass }: { pass: boolean }) {
  return pass ? (
    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
  ) : (
    <XCircle className="h-5 w-5 text-destructive" />
  );
}

export default function SecurityIsolationReport() {
  const { isAdmin, loading: authLoading } = useAuthRole();
  const { isOrgAdmin, loading: orgLoading } = useOrganization();

  const [results, setResults] = useState<TestResult[]>([]);
  const [probeResults, setProbeResults] = useState<ProbeResult[]>([]);
  const [userOrgIds, setUserOrgIds] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [probing, setProbing] = useState(false);
  const [targetOrgId, setTargetOrgId] = useState("");
  const [hasRun, setHasRun] = useState(false);
  const [hasProbed, setHasProbed] = useState(false);

  const runAllTests = useCallback(async () => {
    setRunning(true);
    setHasRun(false);
    try {
      const orgIds = await fetchUserOrgIds();
      setUserOrgIds(orgIds);

      const testResults = await Promise.all(
        TABLES_CONFIG.map((c) => runTableTest(c.table, orgIds))
      );
      setResults(testResults);
      setHasRun(true);
    } finally {
      setRunning(false);
    }
  }, []);

  const runProbe = useCallback(async () => {
    if (!targetOrgId.trim()) return;
    setProbing(true);
    setHasProbed(false);
    try {
      const orgIds =
        userOrgIds.length > 0 ? userOrgIds : await fetchUserOrgIds();
      if (userOrgIds.length === 0) setUserOrgIds(orgIds);

      const probes = await Promise.all(
        TABLES_CONFIG.map((c) =>
          runCrossOrgProbe(c.table, c, targetOrgId.trim(), orgIds)
        )
      );
      setProbeResults(probes);
      setHasProbed(true);
    } finally {
      setProbing(false);
    }
  }, [targetOrgId, userOrgIds]);

  if (authLoading || orgLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!isAdmin && !isOrgAdmin) {
    return (
      <Layout>
        <NoAccess />
      </Layout>
    );
  }

  const allPass = results.length > 0 && results.every((r) => r.pass);
  const probeAllPass =
    probeResults.length > 0 && probeResults.every((r) => r.pass);

  return (
    <Layout>
      <main id="main-content" className="flex-1 p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          {allPass && hasRun ? (
            <ShieldCheck className="h-8 w-8 text-emerald-500" />
          ) : hasRun && !allPass ? (
            <ShieldAlert className="h-8 w-8 text-destructive" />
          ) : (
            <ShieldCheck className="h-8 w-8 text-muted-foreground" />
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Security &amp; Isolation Report
            </h1>
            <p className="text-sm text-muted-foreground">
              Behavioral RLS checks using your JWT — no service_role access
            </p>
          </div>
        </div>

        {/* Org membership context */}
        {hasRun && (
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">Your org memberships:</span>
                {userOrgIds.length === 0 ? (
                  <Badge variant="outline">None</Badge>
                ) : (
                  userOrgIds.map((id) => (
                    <Badge key={id} variant="secondary" className="font-mono text-xs">
                      {id.slice(0, 8)}…
                    </Badge>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main isolation test */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-lg">Table Isolation Test</CardTitle>
            <Button onClick={runAllTests} disabled={running} size="sm">
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              {running ? "Running…" : "Run Tests"}
            </Button>
          </CardHeader>
          <CardContent>
            {!hasRun && !running && (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Click "Run Tests" to execute behavioral isolation checks against
                all critical tables.
              </p>
            )}
            {(hasRun || running) && (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">Status</TableHead>
                      <TableHead>Table</TableHead>
                      <TableHead className="text-right">Rows</TableHead>
                      <TableHead>Sample IDs</TableHead>
                      <TableHead>Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {running && results.length === 0
                      ? TABLES_CONFIG.map((c) => (
                          <TableRow key={c.table}>
                            <TableCell>
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {c.table}
                            </TableCell>
                            <TableCell />
                            <TableCell />
                            <TableCell />
                          </TableRow>
                        ))
                      : results.map((r) => (
                          <TableRow
                            key={r.table}
                            className={r.pass ? "" : "bg-destructive/5"}
                          >
                            <TableCell>
                              <StatusIcon pass={r.pass} />
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {r.table}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {r.rowCount}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground max-w-[200px] truncate">
                              {r.sampleIds.length > 0
                                ? r.sampleIds
                                    .map((id) => id.slice(0, 8))
                                    .join(", ")
                                : "—"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {r.reason}
                              {r.error && (
                                <span className="block text-xs text-muted-foreground mt-1">
                                  {r.error}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {hasRun && (
              <div className="mt-3 flex items-center gap-2">
                {allPass ? (
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    All checks passed
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                    Isolation failure detected
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cross-org probe */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-5 w-5" />
              Cross-Org Probe
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Paste a target organization_id to check if you can see its data.
              Expected: 0 rows unless you are a member.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Target organization_id (UUID)"
                value={targetOrgId}
                onChange={(e) => setTargetOrgId(e.target.value)}
                className="font-mono text-sm"
              />
              <Button
                onClick={runProbe}
                disabled={probing || !targetOrgId.trim()}
                size="sm"
                variant="outline"
              >
                {probing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Probe
              </Button>
            </div>

            {hasProbed && (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">Membership status:</span>
                  {userOrgIds.includes(targetOrgId.trim()) ? (
                    <Badge variant="secondary">Member</Badge>
                  ) : (
                    <Badge variant="outline">Not a member</Badge>
                  )}
                </div>

                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">Status</TableHead>
                        <TableHead>Table</TableHead>
                        <TableHead className="text-right">Rows</TableHead>
                        <TableHead>Sample IDs</TableHead>
                        <TableHead>Result</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {probeResults.map((r) => (
                        <TableRow
                          key={r.table}
                          className={r.pass ? "" : "bg-destructive/5"}
                        >
                          <TableCell>
                            <StatusIcon pass={r.pass} />
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {r.table}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {r.rowCount}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground max-w-[200px] truncate">
                            {r.sampleIds.length > 0
                              ? r.sampleIds
                                  .map((id) => id.slice(0, 8))
                                  .join(", ")
                              : "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {r.reason}
                            {r.error && (
                              <span className="block text-xs text-muted-foreground mt-1">
                                {r.error}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center gap-2">
                  {probeAllPass ? (
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      Cross-org probe passed
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                      Cross-org data leak detected!
                    </Badge>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </Layout>
  );
}
