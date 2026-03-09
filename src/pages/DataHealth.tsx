import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SectionHeader } from "@/components/SectionHeader";
import { NoAccess } from "@/components/NoAccess";
import { useAuthRole } from "@/hooks/useAuthRole";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  CheckCircle2,
  Users,
  Clock,
  Receipt,
  FolderOpen,
  ExternalLink,
  RefreshCw,
  Layers,
  ShieldAlert,
} from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { HealthContextBanner } from "@/components/HealthContextBanner";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface MissingCostRateRow {
  user_id: string;
  full_name: string;
  affected_projects: number;
  hours_last_30d: number;
}

interface UnmatchedTimeRow {
  project_id: string;
  project_name: string;
  entry_count: number;
  sample_user_ids: string[];
}

interface UnclassifiedReceiptRow {
  project_id: string;
  project_name: string;
  receipt_count: number;
  total_amount: number;
}

interface MissingBudgetRow {
  project_id: string;
  project_name: string;
  job_number: string | null;
  status: string;
}

interface OverlapRow {
  user_id: string;
  full_name: string;
  project_name: string;
  overlap_date: string;
  entry_count: number;
}

interface CrossProjectTaskRefRow {
  entry_id: string;
  entry_project_name: string;
  task_project_name: string;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

const DataHealth = () => {
  const { isAdmin, isPM, loading: roleLoading } = useAuthRole();
  const { activeOrganizationId } = useOrganization();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [missingCostRates, setMissingCostRates] = useState<MissingCostRateRow[]>([]);
  const [unmatchedTime, setUnmatchedTime] = useState<UnmatchedTimeRow[]>([]);
  const [unclassifiedReceipts, setUnclassifiedReceipts] = useState<UnclassifiedReceiptRow[]>([]);
  const [missingBudgets, setMissingBudgets] = useState<MissingBudgetRow[]>([]);
  const [overlappingEntries, setOverlappingEntries] = useState<OverlapRow[]>([]);
  const [crossProjectTaskRefs, setCrossProjectTaskRefs] = useState<CrossProjectTaskRefRow[]>([]);

  const canView = isAdmin || isPM();

  const fetchData = async () => {
    if (!activeOrganizationId || !canView) return;
    setLoading(true);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const since = thirtyDaysAgo.toISOString();

    try {
      // --- Fetch active projects for org ---
      const { data: orgProjects } = await supabase
        .from("projects")
        .select("id, name, job_number, status")
        .eq("organization_id", activeOrganizationId)
        .eq("is_deleted", false);
      const projectIds = (orgProjects || []).map((p) => p.id);
      const projectMap = Object.fromEntries((orgProjects || []).map((p) => [p.id, p]));

      if (projectIds.length === 0) {
        setMissingCostRates([]);
        setUnmatchedTime([]);
        setUnclassifiedReceipts([]);
        setMissingBudgets([]);
        setOverlappingEntries([]);
        setCrossProjectTaskRefs([]);
        setLoading(false);
        return;
      }

      // --- 1) Missing cost rates ---
      const { data: zeroCostMembers } = await supabase
        .from("project_members")
        .select("user_id, project_id")
        .in("project_id", projectIds as string[])
        .eq("cost_rate", 0);

      const zeroCostUserIds = [...new Set((zeroCostMembers || []).map((m) => m.user_id))];

      let costRateRows: MissingCostRateRow[] = [];
      if (zeroCostUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", zeroCostUserIds as string[]);
        const nameMap = Object.fromEntries((profiles || []).map((p) => [p.id, p.full_name || "Unknown"]));

        const { data: timeEntries } = await supabase
          .from("time_entries")
          .select("user_id, duration_hours")
        .in("project_id", projectIds as string[])
        .in("user_id", zeroCostUserIds as string[])
        .eq("status", "closed")
          .gte("check_in_time", since);

        const userHours: Record<string, number> = {};
        for (const te of timeEntries || []) {
          userHours[te.user_id] = (userHours[te.user_id] || 0) + (te.duration_hours || 0);
        }

        const userProjects: Record<string, Set<string>> = {};
        for (const m of zeroCostMembers || []) {
          if (!userProjects[m.user_id]) userProjects[m.user_id] = new Set();
          userProjects[m.user_id].add(m.project_id);
        }

        costRateRows = zeroCostUserIds.map((uid) => ({
          user_id: uid,
          full_name: nameMap[uid] || uid.slice(0, 8),
          affected_projects: userProjects[uid]?.size || 0,
          hours_last_30d: userHours[uid] || 0,
        }));
        costRateRows.sort((a, b) => b.hours_last_30d - a.hours_last_30d);
      }
      setMissingCostRates(costRateRows);

      // --- 2) Time entries with no project membership ---
      const { data: recentTime } = await supabase
        .from("time_entries")
        .select("id, user_id, project_id")
        .in("project_id", projectIds as string[])
        .eq("status", "closed")
        .gte("check_in_time", since);

      const { data: allMembers } = await supabase
        .from("project_members")
        .select("user_id, project_id")
        .in("project_id", projectIds as string[]);

      const memberSet = new Set((allMembers || []).map((m) => `${m.project_id}::${m.user_id}`));
      const unmatched: Record<string, { count: number; users: Set<string> }> = {};
      for (const te of recentTime || []) {
        const key = `${te.project_id}::${te.user_id}`;
        if (!memberSet.has(key)) {
          if (!unmatched[te.project_id]) unmatched[te.project_id] = { count: 0, users: new Set() };
          unmatched[te.project_id].count++;
          unmatched[te.project_id].users.add(te.user_id);
        }
      }
      setUnmatchedTime(
        Object.entries(unmatched)
          .map(([pid, data]) => ({
            project_id: pid,
            project_name: projectMap[pid]?.name || pid.slice(0, 8),
            entry_count: data.count,
            sample_user_ids: [...data.users].slice(0, 3),
          }))
          .sort((a, b) => b.entry_count - a.entry_count)
      );

      // --- 3) Unclassified receipts ---
      const { data: receiptsData, error: receiptsError } = await supabase
        .from("receipts")
        .select("project_id, amount, cost_type")
        .in("project_id", projectIds);

      if (receiptsError) throw receiptsError;
      const receipts = receiptsData as { project_id: string; amount: number; cost_type: string | null }[] | null;

      const allowed = new Set(["material", "machine", "other"]);
      const receiptAgg: Record<string, { count: number; total: number }> = {};
      for (const r of receipts || []) {
        if (!r.cost_type || !allowed.has(r.cost_type)) {
          if (!r.project_id) continue;
          if (!receiptAgg[r.project_id]) receiptAgg[r.project_id] = { count: 0, total: 0 };
          receiptAgg[r.project_id].count++;
          receiptAgg[r.project_id].total += r.amount || 0;
        }
      }
      setUnclassifiedReceipts(
        Object.entries(receiptAgg)
          .map(([pid, data]) => ({
            project_id: pid,
            project_name: projectMap[pid]?.name || pid.slice(0, 8),
            receipt_count: data.count,
            total_amount: data.total,
          }))
          .sort((a, b) => b.total_amount - a.total_amount)
      );

      // --- 4) Projects missing budgets ---
      const { data: budgets } = await supabase
        .from("project_budgets")
        .select("project_id")
        .eq("organization_id", activeOrganizationId);

      const budgetSet = new Set((budgets || []).map((b) => b.project_id));
      const activeStatuses = new Set(["awarded", "in_progress", "potential"]);
      setMissingBudgets(
        (orgProjects || [])
          .filter((p) => !budgetSet.has(p.id) && activeStatuses.has(p.status))
          .map((p) => ({
            project_id: p.id,
            project_name: p.name,
            job_number: p.job_number,
            status: p.status,
          }))
      );

      // --- 5) Overlapping time entries per worker per day ---
      // Fetch recent closed entries with timestamps
      const { data: allRecentEntries } = await supabase
        .from("time_entries")
        .select("id, user_id, project_id, check_in_at, check_out_at")
        .in("project_id", projectIds as string[])
        .eq("status", "closed")
        .not("check_out_at", "is", null)
        .gte("check_in_at", since)
        .order("check_in_at", { ascending: true })
        .limit(1000);

      const overlapResults: OverlapRow[] = [];
      if (allRecentEntries && allRecentEntries.length > 0) {
        // Group by user
        const byUser: Record<string, typeof allRecentEntries> = {};
        for (const e of allRecentEntries) {
          if (!byUser[e.user_id]) byUser[e.user_id] = [];
          byUser[e.user_id].push(e);
        }

        // Get user names
        const userIds = Object.keys(byUser);
        const { data: userProfiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds as string[]);
        const profileMap = Object.fromEntries((userProfiles || []).map((p) => [p.id, p.full_name || "Unknown"]));

        for (const [userId, entries] of Object.entries(byUser)) {
          // Check pairwise overlaps (already sorted by check_in_at)
          const overlapDates = new Map<string, number>();
          for (let i = 0; i < entries.length; i++) {
            for (let j = i + 1; j < entries.length; j++) {
              const a = entries[i];
              const b = entries[j];
              // If b starts after a ends, no overlap (and no further overlaps since sorted)
              if (new Date(b.check_in_at) >= new Date(a.check_out_at!)) break;
              // Overlap found
              const date = new Date(a.check_in_at).toISOString().slice(0, 10);
              overlapDates.set(date, (overlapDates.get(date) || 0) + 1);
            }
          }

          for (const [date, count] of overlapDates) {
            // Find the project for display (use first entry on that date)
            const entryOnDate = entries.find((e) => e.check_in_at.startsWith(date));
            overlapResults.push({
              user_id: userId,
              full_name: profileMap[userId] || userId.slice(0, 8),
              project_name: projectMap[entryOnDate?.project_id || ""]?.name || "—",
              overlap_date: date,
              entry_count: count,
            });
          }
        }
      }
      setOverlappingEntries(overlapResults);

      // --- 6) Time entries with task_id referencing tasks from a different project (P0 invariant) ---
      const { data: taskLinkedEntries } = await supabase
        .from("time_entries")
        .select("id, project_id, task_id")
        .in("project_id", projectIds as string[])
        .not("task_id", "is", null)
        .gte("check_in_at", since)
        .limit(500);

      const crossRefs: CrossProjectTaskRefRow[] = [];
      if (taskLinkedEntries && taskLinkedEntries.length > 0) {
        const taskIds = [...new Set(taskLinkedEntries.map((e) => e.task_id!))];
        // Fetch tasks to get their project_ids
        const { data: tasks } = await supabase
          .from("tasks")
          .select("id, project_id")
          .in("id", taskIds as string[]);
        const taskProjectMap = Object.fromEntries((tasks || []).map((t) => [t.id, t.project_id]));

        for (const entry of taskLinkedEntries) {
          const taskProjectId = taskProjectMap[entry.task_id!];
          if (taskProjectId && taskProjectId !== entry.project_id) {
            crossRefs.push({
              entry_id: entry.id,
              entry_project_name: projectMap[entry.project_id]?.name || entry.project_id.slice(0, 8),
              task_project_name: projectMap[taskProjectId]?.name || taskProjectId.slice(0, 8),
            });
          }
        }
      }
      setCrossProjectTaskRefs(crossRefs);




    } catch (err) {
      console.error("DataHealth fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Exit early while role is still loading to prevent race condition
    if (roleLoading) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrganizationId, canView, roleLoading]);

  const totalIssues = useMemo(
    () =>
      missingCostRates.length +
      unmatchedTime.length +
      unclassifiedReceipts.length +
      missingBudgets.length +
      overlappingEntries.length +
      crossProjectTaskRefs.length,
    [missingCostRates, unmatchedTime, unclassifiedReceipts, missingBudgets, overlappingEntries, crossProjectTaskRefs]
  );

  /* ---------------------------------------------------------------- */
  /* Loading / Access gates                                            */
  /* ---------------------------------------------------------------- */

  if (roleLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      </Layout>
    );
  }

  if (!canView) {
    return (
      <Layout>
        <NoAccess />
      </Layout>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */

  return (
    <Layout>
      <div className="container max-w-5xl mx-auto px-4 py-6 space-y-6">
        <HealthContextBanner />
        <div className="flex items-center justify-between">
          <SectionHeader title="Data Health" />
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(7)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : (
          <>
            {/* Summary banner */}
            <Card>
              <CardContent className="py-4 flex items-center gap-3">
                {totalIssues === 0 ? (
                  <>
                    <CheckCircle2 className="h-6 w-6 text-status-complete" />
                    <span className="text-lg font-medium">
                      All checks passed — budget-to-execution data is complete.
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-6 w-6 text-status-issue" />
                    <span className="text-lg font-medium">
                      {totalIssues} data issue{totalIssues !== 1 ? "s" : ""} may affect reporting accuracy.
                    </span>
                  </>
                )}
              </CardContent>
            </Card>

            {/* ──── 1) Missing Cost Rates ──── */}
            <SectionCard
              icon={<Users className="h-5 w-5" />}
              title="Missing Cost Rates"
              description="Workers with $0/hr cost rate on active projects. Labor cost calculations are affected."
              count={missingCostRates.length}
              emptyText="All project members have cost rates configured."
            >
              {missingCostRates.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Worker</TableHead>
                      <TableHead className="text-right">Projects</TableHead>
                      <TableHead className="text-right">Hours (30d)</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {missingCostRates.slice(0, 20).map((r) => (
                      <TableRow key={r.user_id}>
                        <TableCell className="font-medium">{r.full_name}</TableCell>
                        <TableCell className="text-right">{r.affected_projects}</TableCell>
                        <TableCell className="text-right">
                          {r.hours_last_30d > 0 ? formatNumber(r.hours_last_30d) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => navigate(`/users`)}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {missingCostRates.length > 20 && (
                <p className="text-xs text-muted-foreground mt-2 px-1">
                  Showing 20 of {missingCostRates.length} workers
                </p>
              )}
            </SectionCard>

            {/* ──── 2) Unmatched Time Entries ──── */}
            <SectionCard
              icon={<Clock className="h-5 w-5" />}
              title="Time Entries Without Project Membership"
              description="Closed time entries from the last 30 days where the worker has no project_members row. These hours have $0 labor cost."
              count={unmatchedTime.reduce((s, r) => s + r.entry_count, 0)}
              emptyText="All recent time entries have matching project memberships."
            >
              {unmatchedTime.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead className="text-right">Entries</TableHead>
                      <TableHead className="text-right">Unique Workers</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unmatchedTime.slice(0, 15).map((r) => (
                      <TableRow key={r.project_id}>
                        <TableCell className="font-medium">{r.project_name}</TableCell>
                        <TableCell className="text-right">{formatNumber(r.entry_count)}</TableCell>
                        <TableCell className="text-right">{r.sample_user_ids.length}</TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => navigate(`/users?projectId=${r.project_id}`)}
                          >
                            Add Members
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </SectionCard>

            {/* ──── 3) Unclassified Receipts ──── */}
            <SectionCard
              icon={<Receipt className="h-5 w-5" />}
              title="Unclassified Receipts"
              description="Receipts without a valid cost_type (material, machine, or other). These amounts won't appear in category breakdowns."
              count={unclassifiedReceipts.reduce((s, r) => s + r.receipt_count, 0)}
              emptyText="All receipts have a valid cost type classification."
            >
              {unclassifiedReceipts.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead className="text-right">Receipts</TableHead>
                      <TableHead className="text-right">Total Amount</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unclassifiedReceipts.slice(0, 15).map((r) => (
                      <TableRow key={r.project_id}>
                        <TableCell className="font-medium">{r.project_name}</TableCell>
                        <TableCell className="text-right">{r.receipt_count}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.total_amount)}</TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => navigate(`/projects/${r.project_id}/receipts`)}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </SectionCard>

            {/* ──── 4) Projects Missing Budgets ──── */}
            <SectionCard
              icon={<FolderOpen className="h-5 w-5" />}
              title="Active Projects Missing Budgets"
              description="Active projects (awarded, in progress, potential) without a budget record. Variance and margin calculations require a budget."
              count={missingBudgets.length}
              emptyText="All active projects have budgets configured."
            >
              {missingBudgets.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job #</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {missingBudgets.map((r) => (
                      <TableRow key={r.project_id}>
                        <TableCell className="font-mono text-sm">
                          {r.job_number || "—"}
                        </TableCell>
                        <TableCell className="font-medium">{r.project_name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize text-xs">
                            {r.status.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              navigate(`/insights/project?projectId=${r.project_id}`)
                            }
                          >
                            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                            Create Budget
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </SectionCard>

            {/* ──── 5) Overlapping Time Entries ──── */}
            <SectionCard
              icon={<Layers className="h-5 w-5" />}
              title="Overlapping Time Entries"
              description="Workers with multiple closed time entries whose time ranges overlap on the same day. Can inflate labor hours and costs."
              count={overlappingEntries.length}
              emptyText="No overlapping time entries found in the last 30 days."
            >
              {overlappingEntries.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Worker</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Overlaps</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overlappingEntries.slice(0, 20).map((r, i) => (
                      <TableRow key={`${r.user_id}-${r.overlap_date}-${i}`}>
                        <TableCell className="font-medium">{r.full_name}</TableCell>
                        <TableCell>{r.project_name}</TableCell>
                        <TableCell className="font-mono text-sm">{r.overlap_date}</TableCell>
                        <TableCell className="text-right">{r.entry_count}</TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => navigate(`/daily-logs?date=${r.overlap_date}`)}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {overlappingEntries.length > 20 && (
                <p className="text-xs text-muted-foreground mt-2 px-1">
                  Showing 20 of {overlappingEntries.length} overlaps
                </p>
              )}
            </SectionCard>

            {/* ──── 6) Cross-Project Task References (P0 Invariant) ──── */}
            <SectionCard
              icon={<ShieldAlert className="h-5 w-5" />}
              title="Cross-Project Task References"
              description="Time entries linked to tasks from a different project. This should NEVER happen — indicates a data integrity violation."
              count={crossProjectTaskRefs.length}
              emptyText="All task-linked time entries reference tasks within the same project."
            >
              {crossProjectTaskRefs.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entry ID</TableHead>
                      <TableHead>Entry Project</TableHead>
                      <TableHead>Task Project</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {crossProjectTaskRefs.slice(0, 10).map((r) => (
                      <TableRow key={r.entry_id}>
                        <TableCell className="font-mono text-xs">{r.entry_id.slice(0, 8)}…</TableCell>
                        <TableCell className="font-medium">{r.entry_project_name}</TableCell>
                        <TableCell className="font-medium text-destructive">{r.task_project_name}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </SectionCard>



          </>
        )}
      </div>
    </Layout>
  );
};

/* ------------------------------------------------------------------ */
/* Reusable section card                                               */
/* ------------------------------------------------------------------ */

interface SectionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  count: number;
  emptyText: string;
  children: React.ReactNode;
}

const SectionCard = ({ icon, title, description, count, emptyText, children }: SectionCardProps) => (
  <Card>
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {icon}
          <div>
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            <CardDescription className="text-xs mt-0.5">{description}</CardDescription>
          </div>
        </div>
        <Badge variant={count > 0 ? "destructive" : "secondary"}>
          {count > 0 ? `${count} found` : "OK"}
        </Badge>
      </div>
    </CardHeader>
    <CardContent className="pt-0">
      {count === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
          <CheckCircle2 className="h-4 w-4 text-status-complete" />
          {emptyText}
        </div>
      ) : (
        children
      )}
    </CardContent>
  </Card>
);

export default DataHealth;
