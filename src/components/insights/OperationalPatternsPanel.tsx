import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen,
  TrendingUp,
  AlertTriangle,
  Users,
  RefreshCw,
  Layers,
  Crown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface PlaybookEntry {
  id: string;
  name: string;
  version: number;
  projects_using: number;
  job_type: string | null;
}

interface OverrunPhase {
  phase_name: string;
  avg_baseline_hours: number;
  total_actual_hours: number;
  task_count: number;
  overrun_percent: number;
}

interface EfficientRole {
  crew_role: string;
  entry_count: number;
  avg_hours_per_entry: number;
  total_hours: number;
}

interface ReworkFrequency {
  resolved_count: number;
  total_count: number;
  aging_count: number;
  open_rate_percent: number;
}

interface PlaybookAdoption {
  total_projects: number;
  playbook_projects: number;
  adoption_percent: number;
}

interface OperationalPatternsData {
  top_playbooks: PlaybookEntry[];
  most_overrun_phase: OverrunPhase | null;
  most_efficient_role: EfficientRole | null;
  rework_frequency: ReworkFrequency | null;
  playbook_adoption: PlaybookAdoption | null;
}

interface Props {
  organizationId: string;
}

export const OperationalPatternsPanel = ({ organizationId }: Props) => {
  const [data, setData] = useState<OperationalPatternsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const dbRpc = supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>
      ) => Promise<{ data: unknown; error: { message: string } | null }>;

      const { data: result } = await dbRpc(
        "get_operational_patterns",
        { p_organization_id: organizationId }
      );
      if (result) setData(result as OperationalPatternsData);
      setLoading(false);
    };
    load();
  }, [organizationId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Operational Patterns
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const adoption = data.playbook_adoption;
  const overrun = data.most_overrun_phase;
  const efficient = data.most_efficient_role;
  const rework = data.rework_frequency;
  const playbooks = data.top_playbooks || [];

  const hasData = playbooks.length > 0 || overrun || efficient || rework;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            Operational Patterns
          </CardTitle>
          {adoption && (
            <Badge variant="outline" className="text-xs font-mono">
              {adoption.adoption_percent}% playbook adoption
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="text-center py-8">
            <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No operational data yet. Apply playbooks to projects and log time entries to see execution patterns.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* Top Playbooks */}
            <div className="space-y-3 md:col-span-2 xl:col-span-1">
              <div className="flex items-center gap-2 mb-1">
                <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Top Playbooks
                </span>
              </div>
              {playbooks.length === 0 ? (
                <p className="text-xs text-muted-foreground">No playbooks created yet.</p>
              ) : (
                <div className="space-y-2">
                  {playbooks.map((pb, i) => (
                    <div
                      key={pb.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border/30"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {i === 0 && <Crown className="h-3.5 w-3.5 text-primary shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{pb.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            v{pb.version} · {pb.job_type || "General"}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        className="text-xs tabular-nums shrink-0 ml-2"
                      >
                        {pb.projects_using} project{pb.projects_using !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Most Overrun Phase */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Most Overrun Phase
                </span>
              </div>
              {overrun ? (
                <div className="p-3 rounded-lg bg-muted/30 border border-border/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{overrun.phase_name}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs tabular-nums",
                        overrun.overrun_percent > 25
                          ? "text-destructive border-destructive/30"
                          : overrun.overrun_percent > 10
                          ? "text-yellow-600 border-yellow-500/30"
                          : "text-green-600 border-green-500/30"
                      )}
                    >
                      {overrun.overrun_percent > 0 ? "+" : ""}
                      {overrun.overrun_percent}%
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Baseline</span>
                      <p className="font-medium tabular-nums">{overrun.avg_baseline_hours}h</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Actual</span>
                      <p className="font-medium tabular-nums">{overrun.total_actual_hours}h</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Across {overrun.task_count} tracked tasks
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Not enough time data to determine phase overruns.
                </p>
              )}

              {/* Rework Frequency */}
              <div className="flex items-center gap-2 mb-1 mt-4">
                <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Rework Frequency
                </span>
              </div>
              {rework && rework.total_count > 0 ? (
                <div className="p-3 rounded-lg bg-muted/30 border border-border/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium tabular-nums">
                      {rework.open_rate_percent}% open
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {rework.total_count} total deficiencies
                    </span>
                  </div>
                  <Progress
                    value={100 - rework.open_rate_percent}
                    className="h-1.5"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{rework.resolved_count} resolved</span>
                    {rework.aging_count > 0 && (
                      <span className="text-destructive">
                        {rework.aging_count} aging (&gt;7d)
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No deficiency data.</p>
              )}
            </div>

            {/* Efficiency & Adoption */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Most Efficient Role
                </span>
              </div>
              {efficient ? (
                <div className="p-3 rounded-lg bg-muted/30 border border-border/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="capitalize text-xs">
                      {efficient.crew_role}
                    </Badge>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {efficient.entry_count} entries
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Avg/Entry</span>
                      <p className="font-medium tabular-nums">{efficient.avg_hours_per_entry}h</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Logged</span>
                      <p className="font-medium tabular-nums">{efficient.total_hours}h</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Needs 5+ time entries per role to calculate.
                </p>
              )}

              {/* Playbook Adoption */}
              <div className="flex items-center gap-2 mb-1 mt-4">
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Playbook Adoption
                </span>
              </div>
              {adoption && adoption.total_projects > 0 ? (
                <div className="p-3 rounded-lg bg-muted/30 border border-border/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold tabular-nums">
                      {adoption.adoption_percent}%
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {adoption.playbook_projects}/{adoption.total_projects} projects
                    </span>
                  </div>
                  <Progress value={adoption.adoption_percent} className="h-1.5" />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No projects yet.</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
