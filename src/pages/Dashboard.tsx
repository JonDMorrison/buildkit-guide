import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDefaultHomeRoute } from "@/hooks/useDefaultHomeRoute";
import { useRouteAccess } from "@/hooks/useRouteAccess";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAuthRole } from "@/hooks/useAuthRole";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import { Button } from "@/components/ui/button";
import { DashboardCustomizer } from "@/components/dashboard/DashboardCustomizer";
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
import { EconomicPulseStrip } from "@/components/dashboard/EconomicPulseStrip";
import { QuickAddModal } from "@/components/dashboard/QuickAddModal";
import { format, isAfter, isBefore, addDays, startOfDay, subDays } from "date-fns";
import { WorkerDashboard } from "@/components/dashboard/worker/WorkerDashboard";

// Shared dashboard system
import { DashboardLayout } from "@/components/dashboard/shared/DashboardLayout";
import { DashboardHeader } from "@/components/dashboard/shared/DashboardHeader";
import { DashboardSection } from "@/components/dashboard/shared/DashboardSection";
import { DashboardGrid } from "@/components/dashboard/shared/DashboardGrid";

// PM card components
import {
  TodayTasksCard,
  BlockedTasksCard,
  CrewAssignedCard,
  ActiveProjectsCard,
  OpenChangeOrdersCard,
  ProjectHealthSignalCard,
  MyDayTaskList,
  BlockersCard,
  LookaheadPreview,
  ManpowerOverview,
} from "@/components/dashboard/pm";

import { AIInsightsSection } from "@/components/ai-insights";
import { DashboardMissionControl } from "@/components/dashboard/DashboardMissionControl";
import { AttentionInbox } from "@/components/executive/AttentionInbox";
import { useOrganization } from "@/hooks/useOrganization";
import { useQuery as useRQQuery } from "@tanstack/react-query";
import { usePrefetchRoute } from "@/hooks/usePrefetchRoute";

/* ------------------------------------------------------------------ */
/* Gate — resolves role before mounting content or firing queries       */
/* ------------------------------------------------------------------ */

export default function Dashboard() {
  const { loading: routeAccessLoading, isAdmin, isPM, isForeman } = useRouteAccess();
  const { homeRoute, loading: homeRouteLoading } = useDefaultHomeRoute();
  const navigate = useNavigate();

  const loading = routeAccessLoading || homeRouteLoading;

  // While roles are resolving, show skeleton frame — no content mounts, no queries fire
  if (loading) {
    return (
      <DashboardLayout>
        {/* Reserve space for Mission Control + Focus + KPI strip to prevent layout shift */}
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-muted/20 h-24 animate-pulse" />
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-muted/20 h-48 animate-pulse" />
            <div className="rounded-xl border border-border bg-muted/20 h-48 animate-pulse" />
          </div>
          <div className="grid grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-muted/20 h-24 animate-pulse" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Worker-tier users should not be on /dashboard — redirect to their home route
  const canViewDashboard = isAdmin || isPM || isForeman;
  if (!canViewDashboard) {
    // If their home is /dashboard we'd loop, so fall through; otherwise redirect
    if (homeRoute !== '/dashboard') {
      return <DashboardRedirect to={homeRoute} />;
    }
    // Fallback: show worker dashboard if they somehow belong here
    return <WorkerDashboard />;
  }

  return <DashboardContent />;
}

/** Tiny component so the redirect runs as an effect, not during render */
function DashboardRedirect({ to }: { to: string }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to, { replace: true });
  }, [to, navigate]);
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
  const { isPM, isForeman, isAdmin, isInternalWorker, isExternalTrade, loading: roleLoading } = useAuthRole(currentProjectId || undefined);
  const { tier, certification } = useCertificationTier();
  const { activeOrganizationId } = useOrganization();
  const { prefetchRoute } = usePrefetchRoute();

  // Cross-page warming: PM on /dashboard warms /executive data if they have access
  useEffect(() => {
    if (!roleLoading && (isAdmin || isPM()) && activeOrganizationId) {
      prefetchRoute('/executive');
    }
  }, [roleLoading, isAdmin, isPM, activeOrganizationId, prefetchRoute]);

  // Reuse existing change feed for attention inbox (PM compact preview)
  const { data: changeFeed, isLoading: feedLoading } = useRQQuery({
    queryKey: ['pm-attention-feed', activeOrganizationId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        'rpc_executive_change_feed',
        { p_org_id: activeOrganizationId },
      );
      if (error) throw error;
      return data?.latest_snapshot_date ? data : null;
    },
    enabled: !!activeOrganizationId && (isPM() || isAdmin),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Modal states (preserved)
  const [startingModalOpen, setStartingModalOpen] = useState(false);
  const [finishingModalOpen, setFinishingModalOpen] = useState(false);
  const [tradesPopoverOpen, setTradesPopoverOpen] = useState(false);
  const [weatherPopoverOpen, setWeatherPopoverOpen] = useState(false);
  const [crewPopoverOpen, setCrewPopoverOpen] = useState(false);
  const [blockersModalOpen, setBlockersModalOpen] = useState(false);
  const [quickAddModalOpen, setQuickAddModalOpen] = useState(false);

  const roleHint = isForeman() ? 'foreman' as const : isPM() ? 'pm' as const : isAdmin ? 'admin' as const : 'other' as const;
  const {
    isLoading: layoutLoading,
    layouts,
  } = useDashboardLayout(currentProjectId, roleHint);

  const today = startOfDay(new Date());
  const nextWeek = addDays(today, 7);

  // ── All existing queries (preserved) ──────────────────────────────────

  const { data: userProjects } = useQuery({
    queryKey: ["user-projects", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("project_members")
        .select(`project_id, projects (id, name, location, status)`)
        .eq("user_id", user.id);
      if (error) throw error;
      const projects = data?.map((pm: any) => pm.projects).filter(Boolean) || [];
      const projectsWithProgress = await Promise.all(
        projects.map(async (project: any) => {
          const { data: tasks } = await supabase
            .from("tasks")
            .select("id, status")
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
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  useEffect(() => {
    if (!currentProjectId && userProjects && userProjects.length > 0) {
      setCurrentProject(userProjects[0].id);
    }
  }, [currentProjectId, userProjects, setCurrentProject]);

  const { data: tasks = [] } = useQuery({
    queryKey: ["dashboard-tasks", user?.id, currentProjectId],
    queryFn: async () => {
      if (!user || !currentProjectId) return [];
      const { data, error } = await supabase
        .from("tasks")
        .select(`*, assigned_trade:trades(name), task_assignments(user_id), blockers(id, is_resolved)`)
        .eq("project_id", currentProjectId)
        .eq("is_deleted", false);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!currentProjectId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const { data: blockers = [] } = useQuery({
    queryKey: ["dashboard-blockers", currentProjectId],
    queryFn: async () => {
      if (!currentProjectId) return [];
      const { data, error } = await supabase
        .from("blockers")
        .select(`*, task:tasks(id, title, assigned_trade:trades(name))`)
        .eq("is_resolved", false);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentProjectId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Safety forms — deferred, not needed for top fold
  const { data: safetyForms = [] } = useQuery({
    queryKey: ["dashboard-safety", currentProjectId],
    queryFn: async () => {
      if (!currentProjectId) return [];
      const { data, error } = await supabase
        .from("safety_forms")
        .select("*")
        .eq("project_id", currentProjectId)
        .eq("is_deleted", false)
        .gte("created_at", subDays(today, 7).toISOString());
      if (error) throw error;
      return data || [];
    },
    enabled: false, // deferred — not used on page, only by modals if needed
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const { data: recentLog } = useQuery({
    queryKey: ["dashboard-daily-log-recent", currentProjectId],
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
    queryKey: ["dashboard-active-trades-detail", currentProjectId],
    queryFn: async () => {
      if (!currentProjectId) return [];
      const { data, error } = await supabase
        .from("tasks")
        .select("assigned_trade_id, trades(id, name, trade_type)")
        .eq("project_id", currentProjectId)
        .eq("is_deleted", false)
        .in("status", ["in_progress", "not_started"])
        .not("assigned_trade_id", "is", null);
      if (error) throw error;
      const tradeMap = new Map<string, SnapshotTrade>();
      data?.forEach((t: any) => {
        if (t.trades) {
          const existing = tradeMap.get(t.trades.id);
          if (existing) {
            existing.taskCount++;
          } else {
            tradeMap.set(t.trades.id, {
              id: t.trades.id, name: t.trades.name, trade_type: t.trades.trade_type, taskCount: 1,
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

  // Team members — only needed when crew modal opens, defer initial load
  const [crewModalOpened, setCrewModalOpened] = useState(false);
  const { data: teamMembers = [] } = useQuery({
    queryKey: ["dashboard-team-members", currentProjectId],
    queryFn: async () => {
      if (!currentProjectId) return [];
      const { data, error } = await supabase
        .from("project_members")
        .select(`id, user_id, role, trade:trades(name), profile:profiles(id, full_name, email)`)
        .eq("project_id", currentProjectId);
      if (error) throw error;
      return (data || []).map((m: any) => ({
        id: m.user_id, full_name: m.profile?.full_name || null,
        email: m.profile?.email || "", role: m.role, trade_name: m.trade?.name || null,
      }));
    },
    enabled: !!currentProjectId && crewModalOpened,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // ── Memoized metrics ──────────────────────────────────────────────────

  const openTasks = useMemo(() => tasks.filter(t => t.status !== "done").length, [tasks]);
  const blockedTasks = useMemo(() => tasks.filter(t => t.status === "blocked").length, [tasks]);

  const tasksStartingTodayList: SnapshotTask[] = useMemo(() => tasks
    .filter(t => t.start_date && format(new Date(t.start_date), "yyyy-MM-dd") === format(today, "yyyy-MM-dd"))
    .map(t => ({ id: t.id, title: t.title, status: t.status, due_date: t.due_date, start_date: t.start_date, location: t.location, assigned_trade: t.assigned_trade })), [tasks, today]);

  const tasksFinishingTodayList: SnapshotTask[] = useMemo(() => tasks
    .filter(t => t.due_date && format(new Date(t.due_date), "yyyy-MM-dd") === format(today, "yyyy-MM-dd"))
    .map(t => ({ id: t.id, title: t.title, status: t.status, due_date: t.due_date, start_date: t.start_date, location: t.location, assigned_trade: t.assigned_trade })), [tasks, today]);

  const tasksStartingToday = tasksStartingTodayList.length;
  const tasksFinishingToday = tasksFinishingTodayList.length;

  const priorityTasks = useMemo(() => tasks
    .filter(t => t.status !== "done" && (t.priority === 1 || (t.due_date && isBefore(new Date(t.due_date), addDays(today, 3)))))
    .slice(0, 8), [tasks, today]);

  const blockersForModal = useMemo(() => blockers.filter(b => !b.is_resolved).map(b => ({
    id: b.id, reason: b.reason, created_at: b.created_at, task: b.task,
  })), [blockers]);

  const unresolvedBlockers = useMemo(() => blockers.filter(b => !b.is_resolved), [blockers]);

  // ── Guards ────────────────────────────────────────────────────────────

  if ((layoutLoading && !layouts) || roleLoading) {
    return (
      <DashboardLayout>
        {/* Reserve consistent frame while queries load */}
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-muted/20 h-24 animate-pulse" />
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-muted/20 h-48 animate-pulse" />
            <div className="rounded-xl border border-border bg-muted/20 h-48 animate-pulse" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!userProjects || userProjects.length === 0) {
    return (
      <DashboardLayout>
        <NewUserWelcome />
      </DashboardLayout>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      {/* Mission Control — Admin/PM only, gate+content pattern */}
      {(isPM() || isAdmin) && <DashboardMissionControl />}

      {/* Header */}
      <DashboardHeader
        title={isForeman() ? "Site Operations" : "Today on Site"}
        subtitle={isForeman() ? "Your crew, tasks, and blockers" : "Operational clarity — project status and priorities"}
        badge={tier !== "none" ? <CertificationBadge tier={tier} reasons={certification?.reasons} /> : undefined}
        actions={
          <>
            <Button onClick={() => navigate(`/projects/${currentProjectId}`)} size="sm" variant="outline" className="px-3 w-fit" disabled={!currentProjectId}>
              <Building2 className="h-4 w-4 mr-1" /> Project
            </Button>
            <Button onClick={() => setQuickAddModalOpen(true)} size="sm" variant="outline" className="px-3 w-fit">
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
            <Button onClick={() => navigate("/tasks")} size="sm" variant="outline" className="px-3 w-fit">
              <ArrowRight className="h-4 w-4 mr-1" /> Tasks
            </Button>
          </>
        }
      />

      {/* Economic Pulse Strip — PM only */}
      {isPM() && <EconomicPulseStrip projectId={currentProjectId} />}

      {/* ── Focus: My Day + Blockers (decisions first) ───────────── */}
      <DashboardSection title="Focus">
        <DashboardGrid columns={2}>
          <MyDayTaskList tasks={priorityTasks} />
          <BlockersCard blockers={unresolvedBlockers} />
        </DashboardGrid>
      </DashboardSection>

      {/* ── My Attention: compact inbox (PM/Admin only) ──────────── */}
      {(isPM() || isAdmin) && changeFeed?.attention_ranked_projects?.length > 0 && (
        <DashboardSection title="My Attention">
          <AttentionInbox
            attentionProjects={changeFeed.attention_ranked_projects}
            topChanges={changeFeed.top_changes ?? []}
            compact
            loading={feedLoading}
          />
        </DashboardSection>
      )}

      {/* ── At a Glance: KPI strip ──────────────────────────────── */}
      <DashboardSection title="At a Glance">
        <DashboardGrid columns={5} className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          <TodayTasksCard todayCount={tasksFinishingToday} totalOpen={openTasks} />
          <BlockedTasksCard blockedCount={blockedTasks} />
          <CrewAssignedCard crewCount={todayLog?.crew_count || 0} activeTrades={activeTrades} />
          <ActiveProjectsCard projects={userProjects || []} />
          {(isPM() || isAdmin) && <OpenChangeOrdersCard projectId={currentProjectId} />}
        </DashboardGrid>
      </DashboardSection>

      {/* ── Site Status — always visible (foreman primary, PM in tabs) ─── */}
      {isForeman() ? (
        <DashboardSection title="Site Status">
          <DailySnapshotStrip
            weather={todayLog?.weather || null}
            crewCount={todayLog?.crew_count || 0}
            activeTrades={activeTrades}
            tasksStarting={tasksStartingToday}
            tasksFinishing={tasksFinishingToday}
            blockedCount={blockedTasks}
            staleLogDate={logIsStale ? recentLog?.log_date : null}
            onWeatherClick={() => setWeatherPopoverOpen(true)}
            onCrewClick={() => { setCrewModalOpened(true); setCrewPopoverOpen(true); }}
            onTradesClick={() => setTradesPopoverOpen(true)}
            onStartingClick={() => setStartingModalOpen(true)}
            onFinishingClick={() => setFinishingModalOpen(true)}
            onBlockersClick={() => setBlockersModalOpen(true)}
          />
        </DashboardSection>
      ) : (
        <DashboardSection title="Operations">
          <Tabs defaultValue="site" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="site">Site Status</TabsTrigger>
              <TabsTrigger value="health">Project Health</TabsTrigger>
              <TabsTrigger value="planning">Planning</TabsTrigger>
            </TabsList>

            <TabsContent value="site" className="mt-0 space-y-4">
              <DailySnapshotStrip
                weather={todayLog?.weather || null}
                crewCount={todayLog?.crew_count || 0}
                activeTrades={activeTrades}
                tasksStarting={tasksStartingToday}
                tasksFinishing={tasksFinishingToday}
                blockedCount={blockedTasks}
                staleLogDate={logIsStale ? recentLog?.log_date : null}
                onWeatherClick={() => setWeatherPopoverOpen(true)}
                onCrewClick={() => { setCrewModalOpened(true); setCrewPopoverOpen(true); }}
                onTradesClick={() => setTradesPopoverOpen(true)}
                onStartingClick={() => setStartingModalOpen(true)}
                onFinishingClick={() => setFinishingModalOpen(true)}
                onBlockersClick={() => setBlockersModalOpen(true)}
              />
            </TabsContent>

            <TabsContent value="health" className="mt-0">
              <ProjectHealthSignalCard projectId={currentProjectId} />
            </TabsContent>

            <TabsContent value="planning" className="mt-0">
              <DashboardGrid columns={2}>
                <LookaheadPreview projectId={currentProjectId} />
                <ManpowerOverview projectId={currentProjectId} />
              </DashboardGrid>
            </TabsContent>
          </Tabs>
        </DashboardSection>
      )}

      {/* ── AI Insights (lazy, below fold) ──────────────────────── */}
      <AIInsightsSection showChangeFeed projectId={currentProjectId} />

      {/* ── All Modals (preserved) ───────────────────────────────── */}
      <WeatherInfoModal todayLog={todayLog} open={weatherPopoverOpen} onOpenChange={setWeatherPopoverOpen} projectId={currentProjectId} />
      <CrewInfoModal crewCount={todayLog?.crew_count || 0} teamMembers={teamMembers} open={crewPopoverOpen} onOpenChange={setCrewPopoverOpen} />
      <ActiveTradesModal trades={activeTradesData} open={tradesPopoverOpen} onOpenChange={setTradesPopoverOpen} />
      <SnapshotDetailModal open={startingModalOpen} onOpenChange={setStartingModalOpen} title="Tasks Starting Today" tasks={tasksStartingTodayList} filterParam="dateRange=today" />
      <SnapshotDetailModal open={finishingModalOpen} onOpenChange={setFinishingModalOpen} title="Tasks Due Today" tasks={tasksFinishingTodayList} filterParam="dateRange=today" />
      <BlockersPreviewModal open={blockersModalOpen} onOpenChange={setBlockersModalOpen} blockers={blockersForModal} />
      <QuickAddModal open={quickAddModalOpen} onOpenChange={setQuickAddModalOpen} currentProjectId={currentProjectId} />
    </DashboardLayout>
  );
}
