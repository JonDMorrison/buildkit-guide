import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAuthRole } from "@/hooks/useAuthRole";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { EmptyState } from "@/components/EmptyState";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardCustomizer } from "@/components/dashboard/DashboardCustomizer";
import { NewUserWelcome } from "@/components/dashboard/NewUserWelcome";
import {
  MetricsWidget,
  ActivityWidget,
  HealthWidget,
  DistributionWidget,
  MyDayWidget,
  SafetyWidget,
  BlockersWidget,
  DailySnapshotStrip,
  SnapshotDetailModal,
  ActiveTradesModal,
  WeatherInfoModal,
  CrewInfoModal,
  BlockersPreviewModal,
} from "@/components/dashboard/widgets";
import type { SnapshotTask, SnapshotTrade } from "@/components/dashboard/widgets";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2,
  ArrowRight,
  Building2,
  ChevronDown,
  MoveIcon,
  Plus,
  Search,
} from "lucide-react";
import { QuickAddModal } from "@/components/dashboard/QuickAddModal";
import { format, isAfter, isBefore, addDays, startOfDay, subDays } from "date-fns";
import { Responsive, WidthProvider, Layout as GridLayout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const ResponsiveGridLayout = WidthProvider(Responsive);

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentProjectId, setCurrentProject } = useCurrentProject();
  const { isPM, isForeman } = useAuthRole(currentProjectId || undefined);
  const [currentBreakpoint, setCurrentBreakpoint] = useState("lg");
  const [projectSearchOpen, setProjectSearchOpen] = useState(false);
  const [projectSearchQuery, setProjectSearchQuery] = useState("");
  
  // Modal/popover states for snapshot strip
  const [startingModalOpen, setStartingModalOpen] = useState(false);
  const [finishingModalOpen, setFinishingModalOpen] = useState(false);
  const [tradesPopoverOpen, setTradesPopoverOpen] = useState(false);
  const [weatherPopoverOpen, setWeatherPopoverOpen] = useState(false);
  const [crewPopoverOpen, setCrewPopoverOpen] = useState(false);
  const [blockersModalOpen, setBlockersModalOpen] = useState(false);
  const [quickAddModalOpen, setQuickAddModalOpen] = useState(false);

  const {
    layouts,
    hiddenWidgets,
    isLoading: layoutLoading,
    isEditMode,
    setIsEditMode,
    saveLayout,
    resetLayout,
    toggleWidget,
    updateLayouts,
  } = useDashboardLayout(currentProjectId);

  const today = startOfDay(new Date());
  const nextWeek = addDays(today, 7);

  // Fetch user's projects with task completion stats
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
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });

  useEffect(() => {
    if (!currentProjectId && userProjects && userProjects.length > 0) {
      setCurrentProject(userProjects[0].id);
    }
  }, [currentProjectId, userProjects, setCurrentProject]);

  const { data: currentProject } = useQuery({
    queryKey: ["current-project", currentProjectId],
    queryFn: async () => {
      if (!currentProjectId) return null;
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", currentProjectId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentProjectId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

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
    enabled: !!(currentProjectId && (isPM || isForeman)),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const { data: todayLog } = useQuery({
    queryKey: ["dashboard-daily-log", currentProjectId, format(today, "yyyy-MM-dd")],
    queryFn: async () => {
      if (!currentProjectId) return null;
      const { data, error } = await supabase
        .from("daily_logs")
        .select("*")
        .eq("project_id", currentProjectId)
        .eq("log_date", format(today, "yyyy-MM-dd"))
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentProjectId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Fetch active trades with names and task counts
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
      
      // Group by trade and count tasks
      const tradeMap = new Map<string, SnapshotTrade>();
      data?.forEach((t: any) => {
        if (t.trades) {
          const existing = tradeMap.get(t.trades.id);
          if (existing) {
            existing.taskCount++;
          } else {
            tradeMap.set(t.trades.id, {
              id: t.trades.id,
              name: t.trades.name,
              trade_type: t.trades.trade_type,
              taskCount: 1,
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

  // Fetch project team members
  const { data: teamMembers = [] } = useQuery({
    queryKey: ["dashboard-team-members", currentProjectId],
    queryFn: async () => {
      if (!currentProjectId) return [];
      const { data, error } = await supabase
        .from("project_members")
        .select(`
          id,
          user_id,
          role,
          trade:trades(name),
          profile:profiles(id, full_name, email)
        `)
        .eq("project_id", currentProjectId);
      if (error) throw error;
      return (data || []).map((m: any) => ({
        id: m.user_id,
        full_name: m.profile?.full_name || null,
        email: m.profile?.email || "",
        role: m.role,
        trade_name: m.trade?.name || null,
      }));
    },
    enabled: !!currentProjectId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Memoized metrics calculations to prevent unnecessary recalculations
  const openTasks = useMemo(() => tasks.filter(t => t.status !== "done").length, [tasks]);
  const blockedTasks = useMemo(() => tasks.filter(t => t.status === "blocked").length, [tasks]);
  const upcomingTasks = useMemo(() => tasks.filter(t => 
    t.due_date && isAfter(new Date(t.due_date), today) && isBefore(new Date(t.due_date), nextWeek)
  ).length, [tasks, today, nextWeek]);
  const safetyFormsThisWeek = safetyForms.length;

  const completionTrendData = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const date = subDays(today, 6 - i);
    const dateStr = format(date, "yyyy-MM-dd");
    return {
      date: format(date, "MMM dd"),
      completed: tasks.filter(t => t.status === "done" && t.updated_at && format(new Date(t.updated_at), "yyyy-MM-dd") === dateStr).length,
      created: tasks.filter(t => t.created_at && format(new Date(t.created_at), "yyyy-MM-dd") === dateStr).length,
    };
  }), [tasks, today]);

  const statusDistribution = useMemo(() => [
    { status: "Not Started", count: tasks.filter(t => t.status === "not_started").length, color: "hsl(var(--muted))" },
    { status: "In Progress", count: tasks.filter(t => t.status === "in_progress").length, color: "hsl(var(--secondary))" },
    { status: "Blocked", count: tasks.filter(t => t.status === "blocked").length, color: "hsl(var(--accent))" },
  ], [tasks]);

  const totalTasks = tasks.length || 1;
  const atRiskTasks = useMemo(() => tasks.filter(t => t.due_date && isBefore(new Date(t.due_date), addDays(today, 3)) && t.status !== "done").length, [tasks, today]);
  const overdueTasks = useMemo(() => tasks.filter(t => t.due_date && isBefore(new Date(t.due_date), today) && t.status !== "done").length, [tasks, today]);
  const healthScore = useMemo(() => Math.max(0, Math.min(100, 100 - (blockedTasks * 10) - (atRiskTasks * 5) - (overdueTasks * 15))), [blockedTasks, atRiskTasks, overdueTasks]);

  const priorityTasks = useMemo(() => tasks
    .filter(t => t.status !== "done" && (t.priority === 1 || (t.due_date && isBefore(new Date(t.due_date), addDays(today, 3)))))
    .slice(0, 5), [tasks, today]);

  const formsToday = useMemo(() => safetyForms.filter(f => format(new Date(f.created_at), "yyyy-MM-dd") === format(today, "yyyy-MM-dd")).length, [safetyForms, today]);
  const incidents = useMemo(() => safetyForms.filter(f => f.form_type === "incident").length, [safetyForms]);

  // Get full task objects for starting/finishing today - memoized
  const tasksStartingTodayList: SnapshotTask[] = useMemo(() => tasks
    .filter(t => t.start_date && format(new Date(t.start_date), "yyyy-MM-dd") === format(today, "yyyy-MM-dd"))
    .map(t => ({
      id: t.id,
      title: t.title,
      status: t.status,
      due_date: t.due_date,
      start_date: t.start_date,
      location: t.location,
      assigned_trade: t.assigned_trade,
    })), [tasks, today]);
  
  const tasksFinishingTodayList: SnapshotTask[] = useMemo(() => tasks
    .filter(t => t.due_date && format(new Date(t.due_date), "yyyy-MM-dd") === format(today, "yyyy-MM-dd"))
    .map(t => ({
      id: t.id,
      title: t.title,
      status: t.status,
      due_date: t.due_date,
      start_date: t.start_date,
      location: t.location,
      assigned_trade: t.assigned_trade,
    })), [tasks, today]);

  const tasksStartingToday = tasksStartingTodayList.length;
  const tasksFinishingToday = tasksFinishingTodayList.length;

  // Blockers with created_at for modal - memoized
  const blockersForModal = useMemo(() => blockers.filter(b => !b.is_resolved).map(b => ({
    id: b.id,
    reason: b.reason,
    created_at: b.created_at,
    task: b.task,
  })), [blockers]);

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "completed": return "default";
      case "in_progress": return "secondary";
      case "planning": return "outline";
      case "on_hold": return "destructive";
      default: return "outline";
    }
  };

  const formatStatus = (status: string) => status.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");

  const handleLayoutChange = useCallback((currentLayout: GridLayout[], allLayouts: { [key: string]: GridLayout[] }) => {
    if (isEditMode) {
      Object.entries(allLayouts).forEach(([breakpoint, layout]) => {
        updateLayouts(breakpoint, layout.map(item => ({
          i: item.i, x: item.x, y: item.y, w: item.w, h: item.h,
          minW: item.minW, minH: item.minH, maxW: item.maxW, maxH: item.maxH,
        })));
      });
    }
  }, [isEditMode, updateLayouts]);

  const handleBreakpointChange = useCallback((newBreakpoint: string) => setCurrentBreakpoint(newBreakpoint), []);
  const handleSaveLayout = useCallback(() => saveLayout(layouts), [saveLayout, layouts]);
  
  // Memoize handlers that are passed as props
  const handleSetCurrentProject = useCallback((projectId: string) => setCurrentProject(projectId), [setCurrentProject]);

  // Only show loading spinner on initial load, not on tab refocus
  if (layoutLoading && !layouts) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent"></div>
        </div>
      </Layout>
    );
  }

  // Show empty state for users with no projects
  if (!userProjects || userProjects.length === 0) {
    return (
      <Layout>
        <NewUserWelcome />
      </Layout>
    );
  }

  const renderWidget = (widgetId: string) => {
    switch (widgetId) {
      case 'metrics': return <MetricsWidget openTasks={openTasks} blockedTasks={blockedTasks} upcomingTasks={upcomingTasks} safetyFormsThisWeek={safetyFormsThisWeek} />;
      case 'activity': return <ActivityWidget completionTrendData={completionTrendData} />;
      case 'health': return <HealthWidget healthScore={healthScore} atRiskTasks={atRiskTasks} blockedTasks={blockedTasks} overdueTasks={overdueTasks} />;
      case 'distribution': return <DistributionWidget statusDistribution={statusDistribution} totalTasks={totalTasks} />;
      case 'myday': return <MyDayWidget priorityTasks={priorityTasks} />;
      case 'safety': return <SafetyWidget formsToday={formsToday} formsThisWeek={safetyFormsThisWeek} incidents={incidents} />;
      case 'blockers': return <BlockersWidget blockers={blockers.filter(b => !b.is_resolved)} />;
      default: return null;
    }
  };

  const widgetIds = ['metrics', 'activity', 'health', 'distribution', 'myday', 'safety', 'blockers'];

  return (
    <Layout>
      {/* Dashboard Settings removed from fixed positioning */}
      
      <div className="dashboard-container py-6 pb-24 md:pb-8">
        <div className="dashboard-section">
          {/* Header */}
          <div className="widget-card !bg-gradient-to-br !from-card !via-primary/5 !to-secondary/5">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="space-y-3">
                <Popover open={projectSearchOpen} onOpenChange={(open) => {
                  setProjectSearchOpen(open);
                  if (!open) setProjectSearchQuery("");
                }}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="justify-start gap-2 h-auto py-2 px-3 border-border hover:border-primary/50 hover:bg-muted hover:text-foreground"
                      role="combobox"
                      aria-expanded={projectSearchOpen}
                    >
                      <Building2 className="h-4 w-4 text-primary" />
                      <div className="text-left">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Project</p>
                        <p className="text-sm font-semibold text-foreground truncate max-w-[200px]">
                          {currentProject?.name || "Select Project"}
                        </p>
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[300px] p-0" sideOffset={4}>
                    <div className="p-2 border-b border-border">
                      <Input
                        placeholder="Search projects..."
                        value={projectSearchQuery}
                        onChange={(e) => setProjectSearchQuery(e.target.value)}
                        className="h-8 text-sm"
                        autoFocus
                      />
                    </div>
                    <div className="max-h-[250px] overflow-y-auto p-1">
                      {(userProjects || [])
                        .filter((p: any) => 
                          !projectSearchQuery || 
                          p.name.toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
                          p.location?.toLowerCase().includes(projectSearchQuery.toLowerCase())
                        )
                        .map((project: any) => (
                        <button
                          key={project.id}
                          onClick={() => {
                            handleSetCurrentProject(project.id);
                            setProjectSearchOpen(false);
                            setProjectSearchQuery("");
                          }}
                          className="flex items-center gap-3 p-3 cursor-pointer w-full text-left rounded-md hover:bg-muted transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {project.id === currentProjectId && <CheckCircle2 className="h-3 w-3 text-status-complete" />}
                              <p className="font-medium text-sm truncate">{project.name}</p>
                            </div>
                            {project.totalTasks > 0 && (
                              <div className="flex items-center gap-2 mt-1.5">
                                <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                                  <div className="h-full bg-status-complete rounded-full transition-all" style={{ width: `${project.progress}%` }} />
                                </div>
                                <span className="text-xs font-medium text-muted-foreground">{project.progress}%</span>
                              </div>
                            )}
                          </div>
                          <Badge variant={getStatusBadgeVariant(project.status)} className="text-[10px]">
                            {formatStatus(project.status)}
                          </Badge>
                        </button>
                      ))}
                      {(userProjects || []).filter((p: any) => 
                        !projectSearchQuery || 
                        p.name.toLowerCase().includes(projectSearchQuery.toLowerCase())
                      ).length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">No projects found</p>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>

                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground">Today on Site</h1>
                  <p className="text-sm text-muted-foreground">Project status and priorities</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isEditMode && (
                  <DashboardCustomizer
                    isEditMode={isEditMode}
                    setIsEditMode={setIsEditMode}
                    hiddenWidgets={hiddenWidgets}
                    onToggleWidget={toggleWidget}
                    onSave={handleSaveLayout}
                    onReset={resetLayout}
                  />
                )}
                <Button 
                  onClick={() => navigate(`/projects/${currentProjectId}`)} 
                  size="sm" 
                  variant="outline"
                  className="border-primary text-primary hover:bg-primary/10 px-3 w-fit"
                  disabled={!currentProjectId}
                >
                  <Building2 className="h-4 w-4 mr-1" /> Project
                </Button>
                <Button 
                  onClick={() => setQuickAddModalOpen(true)} 
                  size="sm" 
                  className="bg-secondary hover:bg-secondary/90 text-secondary-foreground px-3 w-fit"
                >
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
                <Button onClick={() => navigate("/tasks")} size="sm" className="bg-primary hover:bg-primary/90 px-3 w-fit">
                  <ArrowRight className="h-4 w-4 mr-1" /> Tasks
                </Button>
              </div>

              {/* Settings gear - fixed near top nav bar */}
              {!isEditMode && (
                <div className="fixed top-3 right-[120px] sm:right-[160px] z-40">
                  <DashboardCustomizer
                    isEditMode={isEditMode}
                    setIsEditMode={setIsEditMode}
                    hiddenWidgets={hiddenWidgets}
                    onToggleWidget={toggleWidget}
                    onSave={handleSaveLayout}
                    onReset={resetLayout}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Daily Snapshot Strip */}
          <DailySnapshotStrip
            weather={todayLog?.weather || null}
            crewCount={todayLog?.crew_count || 0}
            activeTrades={activeTrades}
            tasksStarting={tasksStartingToday}
            tasksFinishing={tasksFinishingToday}
            blockedCount={blockedTasks}
            onWeatherClick={() => setWeatherPopoverOpen(true)}
            onCrewClick={() => setCrewPopoverOpen(true)}
            onTradesClick={() => setTradesPopoverOpen(true)}
            onStartingClick={() => setStartingModalOpen(true)}
            onFinishingClick={() => setFinishingModalOpen(true)}
            onBlockersClick={() => setBlockersModalOpen(true)}
          />

          {/* All Modals - rendered flat, not nested */}
          <WeatherInfoModal
            todayLog={todayLog}
            open={weatherPopoverOpen}
            onOpenChange={setWeatherPopoverOpen}
            projectId={currentProjectId}
          />
          <CrewInfoModal
            crewCount={todayLog?.crew_count || 0}
            teamMembers={teamMembers}
            open={crewPopoverOpen}
            onOpenChange={setCrewPopoverOpen}
          />
          <ActiveTradesModal
            trades={activeTradesData}
            open={tradesPopoverOpen}
            onOpenChange={setTradesPopoverOpen}
          />
          <SnapshotDetailModal
            open={startingModalOpen}
            onOpenChange={setStartingModalOpen}
            title="Tasks Starting Today"
            tasks={tasksStartingTodayList}
            filterParam="dateRange=today"
          />
          <SnapshotDetailModal
            open={finishingModalOpen}
            onOpenChange={setFinishingModalOpen}
            title="Tasks Due Today"
            tasks={tasksFinishingTodayList}
            filterParam="dateRange=today"
          />
          <BlockersPreviewModal
            open={blockersModalOpen}
            onOpenChange={setBlockersModalOpen}
            blockers={blockersForModal}
          />
          <QuickAddModal
            open={quickAddModalOpen}
            onOpenChange={setQuickAddModalOpen}
            currentProjectId={currentProjectId}
          />

          {/* Widget Grid */}
          <div className={isEditMode ? "rounded-xl border-2 border-dashed border-primary/40 p-3 bg-primary/5" : ""}>
            {isEditMode && (
              <div className="bg-primary text-primary-foreground px-4 py-2.5 rounded-lg flex items-center gap-2 mb-4">
                <MoveIcon className="h-4 w-4" />
                <span className="text-sm font-medium">Drag to rearrange • Resize from corners</span>
              </div>
            )}
            
            <ResponsiveGridLayout
              className="layout"
              layouts={{
                lg: layouts.lg,
                md: layouts.md,
                sm: layouts.sm,
                xs: layouts.sm,
                xxs: layouts.sm,
              }}
              breakpoints={{ lg: 1200, md: 768, sm: 480, xs: 0, xxs: 0 }}
              cols={{ lg: 12, md: 8, sm: 4, xs: 4, xxs: 4 }}
              rowHeight={78}
              isDraggable={isEditMode}
              isResizable={isEditMode}
              compactType="vertical"
              onLayoutChange={handleLayoutChange}
              onBreakpointChange={handleBreakpointChange}
              draggableHandle=".drag-handle"
              margin={[16, 16]}
              containerPadding={[0, 0]}
              useCSSTransforms={true}
            >
              {widgetIds.filter(id => !hiddenWidgets.includes(id)).map(widgetId => (
                <div key={widgetId} className={`widget-wrapper ${isEditMode ? "ring-1 ring-primary/20" : ""}`}>
                  {isEditMode && (
                    <div className="drag-handle absolute top-2 right-2 cursor-move z-10 bg-primary text-primary-foreground p-1.5 rounded-md shadow-sm">
                      <MoveIcon className="h-3 w-3" />
                    </div>
                  )}
                  {renderWidget(widgetId)}
                </div>
              ))}
            </ResponsiveGridLayout>
          </div>
        </div>
      </div>
    </Layout>
  );
}
