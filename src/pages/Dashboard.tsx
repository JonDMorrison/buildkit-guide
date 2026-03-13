import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useDefaultHomeRoute } from "@/hooks/useDefaultHomeRoute";
import { useRouteAccess } from "@/hooks/useRouteAccess";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAuthRole } from "@/hooks/useAuthRole";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { Button } from "@/components/ui/button";
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary";
import { NewUserWelcome } from "@/components/dashboard/NewUserWelcome";
import {
  DailySnapshotStrip,
  SnapshotDetailModal,
  ActiveTradesModal,
  WeatherInfoModal,
  CrewInfoModal,
  BlockersPreviewModal,
} from "@/components/dashboard/widgets";
import type { SnapshotTask, SnapshotTrade } from "@/components/dashboard/widgets";
import { ArrowRight, Building2, Plus, Loader2 } from "lucide-react";
import { CertificationBadge } from "@/components/CertificationBadge";
import { useCertificationTier } from "@/hooks/useCertificationTier";
import { QuickAddModal } from "@/components/dashboard/QuickAddModal";
import { format, isBefore, addDays, startOfDay } from "date-fns";
import { WorkerDashboard } from "@/components/dashboard/worker/WorkerDashboard";
import { SmartChecklist } from "@/components/setup/SmartChecklist";

// Shared dashboard system
import { DashboardLayout } from "@/components/dashboard/shared/DashboardLayout";
import { DashboardHeader } from "@/components/dashboard/shared/DashboardHeader";
import { DashboardSection } from "@/components/dashboard/shared/DashboardSection";
import { DashboardGrid } from "@/components/dashboard/shared/DashboardGrid";

// PM card components
import {
  OpenChangeOrdersCard,
  ProjectHealthSignalCard,
  MyDayTaskList,
  BlockersCard,
  LookaheadPreview,
} from "@/components/dashboard/pm";

// AI insight cards (direct imports — AIProjectRiskCard excluded, deduped via canonical keys)
import { AIChangeFeedCard } from "@/components/ai-insights/AIChangeFeedCard";
import { AIMarginSignalCard } from "@/components/ai-insights/AIMarginSignalCard";

import { AttentionInbox } from "@/components/executive/AttentionInbox";
import { useOrganization } from "@/hooks/useOrganization";
import { usePrefetchRoute } from "@/hooks/usePrefetchRoute";
import { useExecutiveChangeFeed } from "@/hooks/rpc/useExecutiveChangeFeed";
import { HealthContextBanner } from "@/components/HealthContextBanner";

/* ------------------------------------------------------------------ */
/* Gate — resolves role before mounting content or firing queries       */
/* ------------------------------------------------------------------ */

export default function Dashboard() {
  const { isAdmin, isPM, isForeman, loading } = useRouteAccess();
  const { homeRoute } = useDefaultHomeRoute();
  const { activeOrganizationId, loading: orgLoading } = useOrganization();

  if (loading || orgLoading) {
    return <DashboardLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div></DashboardLayout>;
  }

  if (!activeOrganizationId) {
    return <DashboardRedirect to="/welcome" />;
  }

  const canViewDashboard = isAdmin || isPM || isForeman;
  if (!canViewDashboard) {
    if (homeRoute !== '/dashboard') {
      return <DashboardRedirect to={homeRoute} />;
    }
    return <WorkerDashboard />;
  }

  return <DashboardContent />;
}

function DashboardRedirect({ to }: { to: string }) {
  const navigate = useNavigate();
  useEffect(() => { navigate(to, { replace: true }); }, [to, navigate]);
  return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </DashboardLayout>
  );
}

/* ------------------------------------------------------------------ */
/* Content — only mounted after gate passes; safe to query              */
/* ------------------------------------------------------------------ */

function DashboardContent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentProjectId, setCurrentProject } = useCurrentProject();
  const { isPM, isForeman, isAdmin, loading: roleLoading } = useAuthRole(currentProjectId || undefined);
  const { tier, certification } = useCertificationTier();
  const { activeOrganizationId } = useOrganization();
  const { prefetchRoute } = usePrefetchRoute();

  // Warm executive data for PM/Admin
  useEffect(() => {
    if (!roleLoading && (isAdmin || isPM()) && activeOrganizationId) {
      prefetchRoute('/executive');
    }
  }, [roleLoading, isAdmin, isPM, activeOrganizationId, prefetchRoute]);

  // Change feed — canonical key, deduped with AIChangeFeedCard
  const { data: changeFeed, isLoading: feedLoading } = useExecutiveChangeFeed();

  // Modal states
  const [startingModalOpen, setStartingModalOpen] = useState(false);
  const [finishingModalOpen, setFinishingModalOpen] = useState(false);
  const [tradesPopoverOpen, setTradesPopoverOpen] = useState(false);
  const [weatherPopoverOpen, setWeatherPopoverOpen] = useState(false);
  const [crewPopoverOpen, setCrewPopoverOpen] = useState(false);
  const [blockersModalOpen, setBlockersModalOpen] = useState(false);
  const [quickAddModalOpen, setQuickAddModalOpen] = useState(false);

  const today = startOfDay(new Date());

  // ── Data queries ────────────────────────────────────────────────────

  const { data: userProjects } = useQuery({
    queryKey: ["user-projects", user?.id, activeOrganizationId],
    queryFn: async () => {
      if (!user?.id || !activeOrganizationId) return [];
      const { data, error } = await supabase
        .from("project_members")
        .select(`project_id,projects (id,name,location,status,organization_id)`)
        .eq("user_id", user.id);
      if (error) throw error;
      const projects = (data as unknown as Array<{ projects: { id: string; name: string; location: string; status: string; organization_id: string } | null }>)
        ?.map((pm) => pm.projects)
        .filter((p): p is { id: string; name: string; location: string; status: string; organization_id: string } => !!p && p.organization_id === activeOrganizationId) || [];
      const projectsWithProgress = await Promise.all(
        projects.map(async (project) => {
          const { data: tasks } = await supabase
            .from("tasks")
            .select("id,status")
            .eq("project_id", project.id)
            .eq("is_deleted", false);
          const totalTasks = tasks?.length || 0;
          const completedTasks = tasks?.filter(t => t.status === "done").length || 0;
          const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
          return { ...project, progress, totalTasks, completedTasks };
        })
      );
      return projectsWithProgress;
    },
    enabled: !!user?.id && !!activeOrganizationId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  useEffect(() => {
    if (!currentProjectId && userProjects && userProjects.length > 0) {
      setCurrentProject(userProjects[0].id);
    }
  }, [currentProjectId, userProjects, setCurrentProject]);

  // Tasks — expanded to include blocker detail, replaces standalone dashboard-blockers query
  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["dashboard-tasks", user?.id, activeOrganizationId, currentProjectId],
    queryFn: async () => {
      if (!user || !currentProjectId) return [];
      const { data, error } = await supabase
        .from("tasks")
        .select(`*,assigned_trade:trades(name),task_assignments(user_id),blockers(id,is_resolved,reason,created_at)`)
        .eq("project_id", currentProjectId)
        .eq("is_deleted", false);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!currentProjectId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const { data: recentLog, isLoading: logLoading } = useQuery({
    queryKey: ["dashboard-daily-log-recent", activeOrganizationId, currentProjectId],
    queryFn: async () => {
      if (!currentProjectId) return null;
      const { data, error } = await supabase
        .from("daily_logs")
        .select("*")
        .eq("project_id", currentProjectId)
        .order("log_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentProjectId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const todayLog = recentLog;
  const logIsStale = recentLog && recentLog.log_date !== format(today, "yyyy-MM-dd");

  const { data: activeTradesData = [] } = useQuery({
    queryKey: ["dashboard-active-trades-detail", activeOrganizationId, currentProjectId],
    queryFn: async () => {
      if (!currentProjectId) return [];
      const { data, error } = await supabase
        .from("tasks")
        .select("assigned_trade_id,assigned_trade:trades(id,name,trade_type)")
        .eq("project_id", currentProjectId)
        .eq("is_deleted", false)
        .in("status", ["in_progress", "not_started"])
        .not("assigned_trade_id", "is", null);
      if (error) throw error;
      const tradeMap = new Map<string, SnapshotTrade>();
      (data as unknown as Array<{ assigned_trade: SnapshotTrade | null }>)?.forEach((t) => {
        if (t.assigned_trade) {
          const existing = tradeMap.get(t.assigned_trade.id);
          if (existing) {
            existing.taskCount++;
          } else {
            tradeMap.set(t.assigned_trade.id, {
              id: t.assigned_trade.id, name: t.assigned_trade.name, trade_type: t.assigned_trade.trade_type, taskCount: 1,
            });
          }
        }
      });
      return Array.from(tradeMap.values()).sort((a, b) => b.taskCount - a.taskCount);
    },
    enabled: !!currentProjectId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const activeTrades = activeTradesData.length;

  // Team members — deferred until crew modal opens
  const [crewModalOpened, setCrewModalOpened] = useState(false);
  const { data: teamMembers = [] } = useQuery({
    queryKey: ["dashboard-team-members", activeOrganizationId, currentProjectId],
    queryFn: async () => {
      if (!currentProjectId) return [];
      const { data, error } = await supabase
        .from("project_members")
        .select(`id,user_id,role,trade:trades(name),profile:profiles(id,full_name,email)`)
        .eq("project_id", currentProjectId);
      if (error) throw error;
      interface RawMember {
        user_id: string;
        role: string;
        trade: { name: string } | null;
        profile: { id: string; full_name: string | null; email: string } | null;
      }
      return (data as unknown as RawMember[] || []).map((m) => ({
        id: m.user_id, full_name: m.profile?.full_name || null,
        email: m.profile?.email || "", role: m.role, trade_name: m.trade?.name || null,
      }));
    },
    enabled: !!currentProjectId && crewModalOpened,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // ── Derived metrics ─────────────────────────────────────────────────

  const blockedTasks = useMemo(() => tasks.filter(t => t.status === "blocked").length, [tasks]);

  const tasksStartingTodayList: SnapshotTask[] = useMemo(() => tasks
    .filter(t => t.start_date && format(new Date(t.start_date), "yyyy-MM-dd") === format(today, "yyyy-MM-dd"))
    .map(t => ({ id: t.id, title: t.title, status: t.status, due_date: t.due_date, start_date: t.start_date, location: t.location, assigned_trade: t.assigned_trade })),
  [tasks, today]);

  const tasksFinishingTodayList: SnapshotTask[] = useMemo(() => tasks
    .filter(t => t.due_date && format(new Date(t.due_date), "yyyy-MM-dd") === format(today, "yyyy-MM-dd"))
    .map(t => ({ id: t.id, title: t.title, status: t.status, due_date: t.due_date, start_date: t.start_date, location: t.location, assigned_trade: t.assigned_trade })),
  [tasks, today]);

  const priorityTasks = useMemo(() => tasks
    .filter(t => t.status !== "done" && (t.priority === 1 || (t.due_date && isBefore(new Date(t.due_date), addDays(today, 3)))))
    .slice(0, 5),
  [tasks, today]);

  // Blockers derived from tasks — eliminates the standalone dashboard-blockers query
  const unresolvedBlockers = useMemo(() =>
    tasks.flatMap(task =>
      ((task.blockers as Array<{ id: string; is_resolved: boolean; reason: string; created_at?: string }> | undefined) || [])
        .filter(b => !b.is_resolved)
        .map(b => ({
          id: b.id,
          reason: b.reason,
          created_at: b.created_at,
          task: { id: task.id, title: task.title, assigned_trade: task.assigned_trade },
        }))
    ),
  [tasks]);

  // ── Guard ────────────────────────────────────────────────────────────

  if (!userProjects || userProjects.length === 0) {
    return (
      <DashboardLayout>
        <NewUserWelcome />
      </DashboardLayout>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <HealthContextBanner />
      <SmartChecklist />

      {/* ── Zone 1: Right Now ────────────────────────────────────────── */}
      <DashboardHeader
        title={isForeman() ? "Site Operations" : "Today on Site"}
        subtitle={isForeman() ? "Your crew, tasks, and blockers" : "Operational clarity — project status and priorities"}
        badge={tier !== "none" ? <CertificationBadge tier={tier} reasons={certification?.reasons} /> : undefined}
        actions={
          <>
            <Button onClick={() => navigate(`/projects/${currentProjectId}`)} size="sm" variant="outline" className="px-3 w-fit" disabled={!currentProjectId}>
              <Building2 className="h-4 w-4 mr-1" /> Project
            </Button>
            <Button onClick={() => setQuickAddModalOpen(true)} size="icon" variant="ghost" className="h-8 w-8 border border-white/10 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors duration-150">
              <Plus className="h-4 w-4" />
            </Button>
            <Button onClick={() => navigate("/tasks")} size="sm" variant="outline" className="px-3 w-fit">
              <ArrowRight className="h-4 w-4 mr-1" /> Tasks
            </Button>
          </>
        }
      />

      {(isPM() || isAdmin) && (changeFeed?.attention_ranked_projects?.length ?? 0) > 0 && (
        <SectionErrorBoundary title="Attention Needed">
          <AttentionInbox
            attentionProjects={changeFeed!.attention_ranked_projects.slice(0, 3)}
            topChanges={changeFeed!.top_changes ?? []}
            compact
            loading={feedLoading}
          />
        </SectionErrorBoundary>
      )}

      <SectionErrorBoundary title="Right Now">
        <DashboardGrid columns={2} gap="lg">
          <MyDayTaskList tasks={priorityTasks} loading={tasksLoading} />
          <BlockersCard blockers={unresolvedBlockers} loading={tasksLoading} />
        </DashboardGrid>
      </SectionErrorBoundary>

      {/* ── Zone 2: Project Pulse ─────────────────────────────────────── */}
      <SectionErrorBoundary title="Project Pulse">
        <DashboardSection
          title="Project Pulse"
          helpText="Today's site status, project health, and open change orders."
        >
          <DailySnapshotStrip
            weather={todayLog?.weather || null}
            crewCount={todayLog?.crew_count || 0}
            activeTrades={activeTrades}
            tasksStarting={tasksStartingTodayList.length}
            tasksFinishing={tasksFinishingTodayList.length}
            blockedCount={blockedTasks}
            staleLogDate={logIsStale ? recentLog?.log_date : null}
            onWeatherClick={() => setWeatherPopoverOpen(true)}
            onCrewClick={() => { setCrewModalOpened(true); setCrewPopoverOpen(true); }}
            onTradesClick={() => setTradesPopoverOpen(true)}
            onStartingClick={() => setStartingModalOpen(true)}
            onFinishingClick={() => setFinishingModalOpen(true)}
            onBlockersClick={() => setBlockersModalOpen(true)}
          />
          <DashboardGrid columns={2} gap="lg">
            <ProjectHealthSignalCard projectId={currentProjectId} />
            {(isPM() || isAdmin) && <OpenChangeOrdersCard projectId={currentProjectId} />}
          </DashboardGrid>
        </DashboardSection>
      </SectionErrorBoundary>

      {/* ── Zone 3: This Week (lazy, below fold) ──────────────────────── */}
      <DashboardSection
        title="This Week"
        helpText="Upcoming tasks and what changed since the last snapshot."
        lazy
        skeletonHeight="h-48"
        skeletonCount={2}
      >
        <DashboardGrid columns={2} gap="lg">
          <LookaheadPreview projectId={currentProjectId} />
          <div className="space-y-4">
            <AIChangeFeedCard />
            <AIMarginSignalCard projectId={currentProjectId} />
          </div>
        </DashboardGrid>
      </DashboardSection>

      {/* ── Modals ───────────────────────────────────────────────────── */}
      <WeatherInfoModal todayLog={todayLog} open={weatherPopoverOpen} onOpenChange={setWeatherPopoverOpen} projectId={currentProjectId} />
      <CrewInfoModal crewCount={todayLog?.crew_count || 0} teamMembers={teamMembers} open={crewPopoverOpen} onOpenChange={setCrewPopoverOpen} />
      <ActiveTradesModal trades={activeTradesData} open={tradesPopoverOpen} onOpenChange={setTradesPopoverOpen} />
      <SnapshotDetailModal open={startingModalOpen} onOpenChange={setStartingModalOpen} title="Tasks Starting Today" tasks={tasksStartingTodayList} filterParam="dateRange=today" />
      <SnapshotDetailModal open={finishingModalOpen} onOpenChange={setFinishingModalOpen} title="Tasks Due Today" tasks={tasksFinishingTodayList} filterParam="dateRange=today" />
      <BlockersPreviewModal open={blockersModalOpen} onOpenChange={setBlockersModalOpen} blockers={unresolvedBlockers} />
      <QuickAddModal open={quickAddModalOpen} onOpenChange={setQuickAddModalOpen} currentProjectId={currentProjectId} />
    </DashboardLayout>
  );
}
