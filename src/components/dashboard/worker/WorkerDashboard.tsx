import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { format, startOfDay, isBefore, addDays } from "date-fns";
import { DashboardLayout } from "@/components/dashboard/shared/DashboardLayout";
import { DashboardHeader } from "@/components/dashboard/shared/DashboardHeader";
import { DashboardSection } from "@/components/dashboard/shared/DashboardSection";
import { DashboardGrid } from "@/components/dashboard/shared/DashboardGrid";
import { DashboardCard } from "@/components/dashboard/shared/DashboardCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  ListChecks,
  AlertTriangle,
  Clock,
  Camera,
  Receipt,
  ChevronRight,
} from "lucide-react";

interface WorkerBlocker {
  id: string;
  is_resolved: boolean;
  reason: string;
}

interface WorkerTask {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  assigned_trade?: { name: string } | null;
  blockers?: WorkerBlocker[] | null;
}

interface WorkerProject {
  id: string;
  name: string;
  location: string | null;
  status: string;
  role: string;
  trade_name: string | null;
}

export function WorkerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentProjectId } = useCurrentProject();
  const today = startOfDay(new Date());

  // ── Tasks assigned to this user ──────────────────────────────────────
  const { data: myTasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["worker-my-tasks", user?.id, currentProjectId],
    queryFn: async () => {
      if (!user?.id || !currentProjectId) return [] as WorkerTask[];
      const { data, error } = await supabase
        .from("tasks")
        .select(`*, assigned_trade:trades(name), task_assignments!inner(user_id), blockers(id, is_resolved, reason)`)
        .eq("project_id", currentProjectId)
        .eq("is_deleted", false)
        .eq("task_assignments.user_id", user.id);
      if (error) throw error;
      return (data as unknown as WorkerTask[]) || [];
    },
    enabled: !!user?.id && !!currentProjectId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  // ── User projects ────────────────────────────────────────────────────
  const { data: userProjects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["worker-projects", user?.id],
    queryFn: async () => {
      if (!user?.id) return [] as WorkerProject[];
      const { data, error } = await supabase
        .from("project_members")
        .select(`project_id, role, trade:trades(name), projects(id, name, location, status)`)
        .eq("user_id", user.id);
      if (error) throw error;

      interface ProjectMemberRow {
        project_id: string;
        role: string;
        trade?: { name: string } | null;
        projects: {
          id: string;
          name: string;
          location: string | null;
          status: string;
        } | null;
      }

      return ((data as unknown as ProjectMemberRow[]) || [])
        .map((pm) => {
          if (!pm.projects) return null;
          return {
            ...pm.projects,
            role: pm.role,
            trade_name: pm.trade?.name || null,
          } as WorkerProject;
        })
        .filter((p): p is WorkerProject => p !== null);
    },
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // ── Derived data ─────────────────────────────────────────────────────

  const tasksDueToday = useMemo(() => myTasks.filter(
    t => t.due_date && format(new Date(t.due_date), "yyyy-MM-dd") === format(today, "yyyy-MM-dd") && t.status !== "done"
  ), [myTasks, today]);

  const priorityTasks = useMemo(() => myTasks
    .filter(t => t.status !== "done")
    .sort((a, b) => {
      if (a.status === "blocked" && b.status !== "blocked") return -1;
      if (b.status === "blocked" && a.status !== "blocked") return 1;
      const aDue = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const bDue = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      return aDue - bDue;
    })
    .slice(0, 8), [myTasks]);

  const activeBlockers = useMemo(() => {
    const all: Array<{ id: string; reason: string; taskTitle: string; type: string }> = [];
    myTasks.forEach(t => {
      (t.blockers || []).forEach((b) => {
        if (!b.is_resolved) {
          const reason = (b.reason || "").toLowerCase();
          let type = "other";
          if (reason.includes("material") || reason.includes("supply")) type = "materials";
          else if (reason.includes("inspect")) type = "inspection";
          else if (reason.includes("safety")) type = "safety";
          all.push({ id: b.id, reason: b.reason, taskTitle: t.title, type });
        }
      });
    });
    return all;
  }, [myTasks]);


  const statusColors: Record<string, string> = {
    blocked: "bg-destructive animate-pulse",
    in_progress: "bg-primary",
    not_started: "bg-muted-foreground/40",
    done: "bg-primary/60",
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <DashboardHeader
        title="My Day"
        subtitle="Your tasks, blockers, and quick actions"
        actions={
          <Button onClick={() => navigate("/tasks")} size="sm" variant="outline" className="px-3 w-fit">
            <ListChecks className="h-4 w-4 mr-1" /> All Tasks
          </Button>
        }
      />

      {/* ── 1. Today's Work (merged Due Today + Priority Tasks) ────── */}
      <DashboardSection
        title="Today's Work"
        helpText="Everything assigned to you for today, sorted by priority. Tap a task to mark progress, add photos, or flag a blocker."
      >
        <DashboardGrid columns={2}>
          {/* Due today card */}
          <DashboardCard
            title="Due Today"
            description={`${tasksDueToday.length} task${tasksDueToday.length !== 1 ? "s" : ""} due`}
            icon={Clock}
            loading={tasksLoading}
            variant="table"
            empty={!tasksLoading && tasksDueToday.length === 0}
            emptyMessage="No tasks due today — check your full task list."
          >
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {tasksDueToday.map(task => (
                <div
                  key={task.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-muted/5 hover:bg-muted/10 transition-all cursor-pointer"
                  onClick={() => navigate("/tasks")}
                >
                  <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${statusColors[task.status] ?? "bg-muted-foreground/40"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{task.title}</p>
                    {task.assigned_trade && (
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5 mt-0.5">
                        {task.assigned_trade.name}
                      </Badge>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                </div>
              ))}
            </div>
          </DashboardCard>

          {/* Priority tasks card */}
          <DashboardCard
            title="Priority Tasks"
            description={`${myTasks.filter(t => t.status !== "done").length} open`}
            icon={CheckCircle2}
            loading={tasksLoading}
            variant="table"
            empty={!tasksLoading && priorityTasks.length === 0}
            emptyMessage="All caught up — no open tasks assigned to you."
          >
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {priorityTasks.map(task => (
                <div
                  key={task.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-muted/5 hover:bg-muted/10 transition-all cursor-pointer"
                  onClick={() => navigate("/tasks")}
                >
                  <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${statusColors[task.status] ?? "bg-muted-foreground/40"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {task.due_date && (
                        <span className={`text-xs ${isBefore(new Date(task.due_date), addDays(today, 1)) ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                          Due: {format(new Date(task.due_date), "MMM dd")}
                        </span>
                      )}
                      {task.status === "blocked" && (
                        <Badge className="bg-destructive/10 text-destructive border-destructive/30 border text-[10px] py-0 px-1">Blocked</Badge>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                </div>
              ))}
            </div>
          </DashboardCard>
        </DashboardGrid>
      </DashboardSection>

      {/* ── 2. Blockers (single flat list) ──────────────────────────── */}
      <DashboardSection
        title="Blockers"
        helpText="Problems stopping your work — waiting on materials, another trade, or a decision. Let your foreman know so they can help resolve it."
      >
        <DashboardCard
          title="Active Blockers"
          description={`${activeBlockers.length} unresolved`}
          icon={AlertTriangle}
          variant={activeBlockers.length > 0 ? "alert" : "metric"}
          empty={activeBlockers.length === 0}
          emptyMessage="No blockers — all tasks running smoothly."
        >
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {activeBlockers.slice(0, 8).map(b => (
              <div key={b.id} className="p-3 rounded-lg border border-border/50 bg-card">
                <p className="text-sm font-medium text-foreground line-clamp-1">{b.reason}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{b.taskTitle}</p>
              </div>
            ))}
            {activeBlockers.length > 8 && (
              <p className="text-xs font-medium text-center text-destructive">
                +{activeBlockers.length - 8} more
              </p>
            )}
          </div>
        </DashboardCard>
      </DashboardSection>

      {/* ── 3. Quick Actions ────────────────────────────────────── */}
      <DashboardSection
        title="Quick Actions"
        helpText="One-tap shortcuts: log your hours, snap a receipt photo, or submit a daily update without navigating away from the dashboard."
      >
        <DashboardGrid columns={3}>
          <QuickActionCard
            title="Submit Time"
            description="Log your hours for today"
            icon={Clock}
            onClick={() => navigate("/time-tracking")}
          />
          <QuickActionCard
            title="Upload Receipt"
            description="Submit expense receipts"
            icon={Receipt}
            onClick={() => navigate("/receipts")}
          />
          <QuickActionCard
            title="Upload Photo"
            description="Document site progress"
            icon={Camera}
            onClick={() => navigate(currentProjectId ? `/projects/${currentProjectId}` : "/projects")}
          />
        </DashboardGrid>
      </DashboardSection>
    </DashboardLayout>
  );
}

/* ── Quick Action Card ──────────────────────────────────────────────── */

function QuickActionCard({
  title,
  description,
  icon: Icon,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  return (
    <DashboardCard title={title} description={description} icon={Icon} variant="metric">
      <Button onClick={onClick} variant="outline" size="sm" className="w-full mt-1">
        {title} <ChevronRight className="h-3.5 w-3.5 ml-1" />
      </Button>
    </DashboardCard>
  );
}
