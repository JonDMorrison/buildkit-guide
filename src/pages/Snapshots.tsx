import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { SectionHeader } from "@/components/SectionHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useOrganization } from "@/hooks/useOrganization";
import { useOrganizationRole } from "@/hooks/useOrganizationRole";
import { useProjectRole } from "@/hooks/useProjectRole";
import { NoAccess } from "@/components/NoAccess";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Camera, Play, CheckCircle, XCircle, Clock, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

interface RunLogEntry {
  id: string;
  organization_id: string;
  run_at: string;
  snapshot_date: string;
  projects_count: number;
  success: boolean;
  error: string | null;
  created_at: string;
}

const WEEKS_OPTIONS = [4, 8, 12, 24, 52];

const Snapshots = () => {
  const navigate = useNavigate();
  const { activeOrganizationId } = useOrganization();
  const { role: orgRole, isLoading: orgRoleLoading } = useOrganizationRole();
  const { isGlobalAdmin, loading: roleLoading } = useProjectRole();
  const { toast } = useToast();

  const [weeks, setWeeks] = useState(12);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ weeks: number; created_or_updated: number } | null>(null);
  const [logs, setLogs] = useState<RunLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  const canAccess = isGlobalAdmin || orgRole === "admin" || orgRole === "pm";

  const fetchLogs = useCallback(async () => {
    if (!activeOrganizationId) return;
    setLogsLoading(true);
    const { data, error } = await supabase
      .from("snapshots_run_log")
      .select("*")
      .eq("organization_id", activeOrganizationId)
      .order("run_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error fetching snapshot logs:", error);
    }
    setLogs((data as RunLogEntry[]) || []);
    setLogsLoading(false);
  }, [activeOrganizationId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleBackfill = async () => {
    if (!activeOrganizationId) return;
    setRunning(true);
    setResult(null);

    try {
      const { data, error } = await supabase.rpc("backfill_weekly_snapshots", {
        p_org_id: activeOrganizationId,
        p_weeks: weeks,
      });

      if (error) {
        toast({
          title: "Backfill failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      const res = data as { weeks: number; created_or_updated: number };
      setResult(res);
      toast({
        title: "Backfill complete",
        description: `Generated snapshots for ${res.weeks} weeks (${res.created_or_updated} created/updated).`,
      });

      // Refresh logs
      await fetchLogs();
    } catch (err) {
      toast({
        title: "Unexpected error",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  if (roleLoading || orgRoleLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      </Layout>
    );
  }

  if (!canAccess) {
    return (
      <Layout>
        <NoAccess />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/insights")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <SectionHeader title="Financial Snapshots" />
        </div>

        {/* Backfill Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Backfill Weekly Snapshots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Generate historical weekly snapshots to populate trend charts. Each week is truncated to Monday.
              Existing snapshots for the same date are updated (not duplicated).
            </p>

            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5 min-w-[140px]">
                <Label>Weeks to backfill</Label>
                <Select value={String(weeks)} onValueChange={(v) => setWeeks(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKS_OPTIONS.map((w) => (
                      <SelectItem key={w} value={String(w)}>
                        {w} weeks
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleBackfill} disabled={running || !activeOrganizationId}>
                {running ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent mr-2" />
                    Running…
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Backfill last {weeks} weeks
                  </>
                )}
              </Button>
            </div>

            {result && (
              <div className="mt-4 p-3 rounded-md bg-muted text-sm">
                <div className="flex items-center gap-2 text-foreground">
                  <CheckCircle className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                  <span>
                    Completed: <strong>{result.weeks}</strong> weeks processed,{" "}
                    <strong>{result.created_or_updated}</strong> snapshots created/updated.
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Run Log */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Snapshot Run Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No snapshot runs recorded yet. Use the backfill tool or wait for the weekly cron.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Run At</TableHead>
                    <TableHead>Snapshot Date</TableHead>
                    <TableHead className="text-center">Projects</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {format(new Date(log.run_at), "MMM d, yyyy h:mm a")}
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {log.snapshot_date}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {log.projects_count}
                      </TableCell>
                      <TableCell className="text-center">
                        {log.success ? (
                          <Badge variant="secondary" className="text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            OK
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">
                            <XCircle className="h-3 w-3 mr-1" />
                            Failed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {log.error || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Snapshots;
