import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAuthRole } from "@/hooks/useAuthRole";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardCustomizer } from "@/components/dashboard/DashboardCustomizer";
import {
  MetricsWidget,
  ActivityWidget,
  HealthWidget,
  DistributionWidget,
  MyDayWidget,
  SafetyWidget,
  BlockersWidget,
  WorkloadWidget,
  DailySnapshotStrip,
  SnapshotDetailModal,
  ActiveTradesModal,
  WeatherInfoModal,
  CrewInfoModal,
  BlockersPreviewModal,
} from "@/components/dashboard/widgets";
import type { SnapshotTask, SnapshotTrade } from "@/components/dashboard/widgets";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CheckCircle2,
  ArrowRight,
  Building2,
  ChevronDown,
  MoveIcon,
  Plus,
  FileText,
} from "lucide-react";
import { QuickAddModal } from "@/components/dashboard/QuickAddModal";
import { EODReportModal } from "@/components/ai-assist/EODReportModal";
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
  
  // Modal/popover states for snapshot strip
  const [startingModalOpen, setStartingModalOpen] = useState(false);
  const [finishingModalOpen, setFinishingModalOpen] = useState(false);
  const [tradesPopoverOpen, setTradesPopoverOpen] = useState(false);
  const [weatherPopoverOpen, setWeatherPopoverOpen] = useState(false);
  const [crewPopoverOpen, setCrewPopoverOpen] = useState(false);
  const [blockersModalOpen, setBlockersModalOpen] = useState(false);
  const [quickAddModalOpen, setQuickAddModalOpen] = useState(false);
  const [eodReportModalOpen, setEodReportModalOpen] = useState(false);

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
  });

  // Calculate metrics
  const openTasks = tasks.filter(t => t.status !== "done").length;
  const blockedTasks = tasks.filter(t => t.status === "blocked").length;
  const upcomingTasks = tasks.filter(t => 
    t.due_date && isAfter(new Date(t.due_date), today) && isBefore(new Date(t.due_date), nextWeek)
  ).length;
  const safetyFormsThisWeek = safetyForms.length;

  const completionTrendData = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(today, 6 - i);
    const dateStr = format(date, "yyyy-MM-dd");
    return {
      date: format(date, "MMM dd"),
      completed: tasks.filter(t => t.status === "done" && t.updated_at && format(new Date(t.updated_at), "yyyy-MM-dd") === dateStr).length,
      created: tasks.filter(t => t.created_at && format(new Date(t.created_at), "yyyy-MM-dd") === dateStr).length,
    };
  });

  const statusDistribution = [
    { status: "Not Started", count: tasks.filter(t => t.status === "not_started").length, color: "hsl(var(--muted))" },
    { status: "In Progress", count: tasks.filter(t => t.status === "in_progress").length, color: "hsl(var(--secondary))" },
    { status: "Blocked", count: tasks.filter(t => t.status === "blocked").length, color: "hsl(var(--accent))" },
  ];

  const totalTasks = tasks.length || 1;
  const atRiskTasks = tasks.filter(t => t.due_date && isBefore(new Date(t.due_date), addDays(today, 3)) && t.status !== "done").length;
  const overdueTasks = tasks.filter(t => t.due_date && isBefore(new Date(t.due_date), today) && t.status !== "done").length;
  const healthScore = Math.max(0, Math.min(100, 100 - (blockedTasks * 10) - (atRiskTasks * 5) - (overdueTasks * 15)));

  const priorityTasks = tasks
    .filter(t => t.status !== "done" && (t.priority === 1 || (t.due_date && isBefore(new Date(t.due_date), addDays(today, 3)))))
    .slice(0, 5);

  const formsToday = safetyForms.filter(f => format(new Date(f.created_at), "yyyy-MM-dd") === format(today, "yyyy-MM-dd")).length;
  const incidents = safetyForms.filter(f => f.form_type === "incident").length;

  // Get full task objects for starting/finishing today
  const tasksStartingTodayList: SnapshotTask[] = tasks
    .filter(t => t.start_date && format(new Date(t.start_date), "yyyy-MM-dd") === format(today, "yyyy-MM-dd"))
    .map(t => ({
      id: t.id,
      title: t.title,
      status: t.status,
      due_date: t.due_date,
      start_date: t.start_date,
      location: t.location,
      assigned_trade: t.assigned_trade,
    }));
  
  const tasksFinishingTodayList: SnapshotTask[] = tasks
    .filter(t => t.due_date && format(new Date(t.due_date), "yyyy-MM-dd") === format(today, "yyyy-MM-dd"))
    .map(t => ({
      id: t.id,
      title: t.title,
      status: t.status,
      due_date: t.due_date,
      start_date: t.start_date,
      location: t.location,
      assigned_trade: t.assigned_trade,
    }));

  const tasksStartingToday = tasksStartingTodayList.length;
  const tasksFinishingToday = tasksFinishingTodayList.length;

  // Blockers with created_at for modal
  const blockersForModal = blockers.filter(b => !b.is_resolved).map(b => ({
    id: b.id,
    reason: b.reason,
    created_at: b.created_at,
    task: b.task,
  }));

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

  const handleLayoutChange = (currentLayout: GridLayout[], allLayouts: { [key: string]: GridLayout[] }) => {
    if (isEditMode) {
      Object.entries(allLayouts).forEach(([breakpoint, layout]) => {
        updateLayouts(breakpoint, layout.map(item => ({
          i: item.i, x: item.x, y: item.y, w: item.w, h: item.h,
          minW: item.minW, minH: item.minH, maxW: item.maxW, maxH: item.maxH,
        })));
      });
    }
  };

  const handleBreakpointChange = (newBreakpoint: string) => setCurrentBreakpoint(newBreakpoint);
  const handleSaveLayout = () => saveLayout(layouts);

  if (layoutLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent"></div>
        </div>
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
      case 'workload': return <WorkloadWidget projectId={currentProjectId} />;
      default: return null;
    }
  };

  const widgetIds = ['metrics', 'activity', 'health', 'distribution', 'myday', 'safety', 'blockers', 'workload'];

  return (
    <Layout>
      {/* Dashboard Settings in TopNav area */}
      <div className="fixed top-0 right-[140px] z-50 h-nav flex items-center">
        <DashboardCustomizer
          isEditMode={isEditMode}
          setIsEditMode={setIsEditMode}
          hiddenWidgets={hiddenWidgets}
          onToggleWidget={toggleWidget}
          onSave={handleSaveLayout}
          onReset={resetLayout}
        />
      </div>
      
      <div className="dashboard-container py-6 pb-24 md:pb-8">
        <div className="dashboard-section">
          {/* Header */}
          <div className="widget-card !bg-gradient-to-br !from-card !via-primary/5 !to-secondary/5">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="space-y-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="justify-start gap-2 h-auto py-2 px-3 border-border hover:border-primary/50">
                      <Building2 className="h-4 w-4 text-primary" />
                      <div className="text-left">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Project</p>
                        <p className="text-sm font-semibold text-foreground truncate max-w-[200px]">
                          {currentProject?.name || "Select Project"}
                        </p>
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[300px]">
                    <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">Switch Project</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {userProjects?.map((project: any) => (
                      <DropdownMenuItem
                        key={project.id}
                        onClick={() => setCurrentProject(project.id)}
                        className="flex items-center gap-3 p-3 cursor-pointer"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {project.id === currentProjectId && <CheckCircle2 className="h-3 w-3 text-secondary" />}
                            <p className="font-medium text-sm truncate">{project.name}</p>
                          </div>
                          {project.totalTasks > 0 && (
                            <div className="flex items-center gap-2 mt-1.5">
                              <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                                <div className="h-full bg-secondary rounded-full transition-all" style={{ width: `${project.progress}%` }} />
                              </div>
                              <span className="text-xs font-medium text-muted-foreground">{project.progress}%</span>
                            </div>
                          )}
                        </div>
                        <Badge variant={getStatusBadgeVariant(project.status)} className="text-[10px]">
                          {formatStatus(project.status)}
                        </Badge>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground">Today on Site</h1>
                  <p className="text-sm text-muted-foreground">Project status and priorities</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => setEodReportModalOpen(true)} 
                  className="gap-1.5 px-2"
                >
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline text-xs">EOD Report</span>
                </Button>
                <Button 
                  onClick={() => setQuickAddModalOpen(true)} 
                  size="sm" 
                  className="bg-[#DC8644] hover:bg-[#DC8644]/90 text-white px-3 w-fit"
                >
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
                <Button onClick={() => navigate("/tasks")} size="sm" className="bg-primary hover:bg-primary/90 px-3 w-fit">
                  <ArrowRight className="h-4 w-4 mr-1" /> Tasks
                </Button>
              </div>
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
          <EODReportModal
            open={eodReportModalOpen}
            onOpenChange={setEodReportModalOpen}
            projectId={currentProjectId || ''}
            projectName={currentProject?.name || ''}
            jobNumber={currentProject?.job_number}
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
              onLayoutChange={handleLayoutChange}
              onBreakpointChange={handleBreakpointChange}
              draggableHandle=".drag-handle"
              margin={[16, 16]}
              containerPadding={[0, 0]}
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

      {/* Mobile Floating Action Button */}
      <Button
        onClick={() => setQuickAddModalOpen(true)}
        className="md:hidden fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full shadow-lg bg-accent hover:bg-accent/90 text-accent-foreground"
        size="icon"
      >
        <Plus className="h-6 w-6" />
      </Button>
    </Layout>
  );
}
