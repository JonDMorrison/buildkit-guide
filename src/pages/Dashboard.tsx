import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAuthRole } from "@/hooks/useAuthRole";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DashboardCustomizer } from "@/components/dashboard/DashboardCustomizer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Shield,
  TrendingUp,
  ArrowRight,
  Sparkles,
  Users,
  AlertCircle,
  ChevronRight,
  Building2,
  ChevronDown,
  CloudRain,
  HardHat,
  Wrench,
  Calendar,
  PlayCircle,
  CheckSquare,
  Send,
  Gauge,
  Target,
  TrendingDown,
  MoveIcon,
} from "lucide-react";
import { format, isAfter, isBefore, addDays, startOfDay, subDays } from "date-fns";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Responsive, WidthProvider, Layout as GridLayout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const ResponsiveGridLayout = WidthProvider(Responsive);

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentProjectId, setCurrentProject } = useCurrentProject();
  const { currentProjectRole, isPM, isForeman, isWorker } = useAuthRole(currentProjectId || undefined);
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const {
    layout,
    hiddenWidgets,
    isLoading: layoutLoading,
    isEditMode,
    setIsEditMode,
    saveLayout,
    resetLayout,
    toggleWidget,
    updateLayout,
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
        .select(`
          project_id,
          projects (
            id,
            name,
            location,
            status
          )
        `)
        .eq("user_id", user.id);

      if (error) throw error;
      
      const projects = data?.map((pm: any) => pm.projects).filter(Boolean) || [];
      
      // Fetch task counts for each project to calculate progress
      const projectsWithProgress = await Promise.all(
        projects.map(async (project: any) => {
          const { data: tasks, error: tasksError } = await supabase
            .from("tasks")
            .select("id, status", { count: "exact" })
            .eq("project_id", project.id)
            .eq("is_deleted", false);
          
          if (tasksError) {
            console.error("Error fetching tasks:", tasksError);
            return { ...project, progress: 0 };
          }
          
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

  // Auto-select first project if none selected
  useEffect(() => {
    if (!currentProjectId && userProjects && userProjects.length > 0) {
      setCurrentProject(userProjects[0].id);
    }
  }, [currentProjectId, userProjects, setCurrentProject]);

  // Fetch current project
  const { data: currentProject } = useQuery({
    queryKey: ["current-project", currentProjectId],
    queryFn: async () => {
      if (!currentProjectId) return null;
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", currentProjectId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!currentProjectId,
  });

  // Fetch tasks based on role
  const { data: tasks } = useQuery({
    queryKey: ["dashboard-tasks", user?.id, currentProjectId, currentProjectRole],
    queryFn: async () => {
      if (!user || !currentProjectId) return [];
      
      let query = supabase
        .from("tasks")
        .select(`
          *,
          assigned_trade:trades(name),
          task_assignments(user_id),
          blockers(id, is_resolved)
        `)
        .eq("project_id", currentProjectId)
        .eq("is_deleted", false);

      // Filter based on role
      if (isWorker) {
        query = query.or(`task_assignments.user_id.eq.${user.id}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!currentProjectId,
  });

  // Fetch blockers
  const { data: blockers } = useQuery({
    queryKey: ["dashboard-blockers", currentProjectId],
    queryFn: async () => {
      if (!currentProjectId) return [];
      const { data, error } = await supabase
        .from("blockers")
        .select(`
          *,
          task:tasks(id, title, assigned_trade:trades(name))
        `)
        .eq("is_resolved", false);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentProjectId,
  });

  // Fetch safety forms
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

  // Calculate metrics
  const openTasks = tasks?.filter(t => t.status !== "done").length || 0;
  const blockedTasks = tasks?.filter(t => t.status === "blocked").length || 0;
  const upcomingTasks = tasks?.filter(t => 
    t.due_date && 
    isAfter(new Date(t.due_date), today) && 
    isBefore(new Date(t.due_date), nextWeek)
  ).length || 0;
  const safetyFormsThisWeek = safetyForms?.length || 0;

  // Prepare chart data
  const completionTrendData = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(today, 6 - i);
    const completed = tasks?.filter(t => 
      t.status === "done" && 
      t.updated_at &&
      format(new Date(t.updated_at), "yyyy-MM-dd") === format(date, "yyyy-MM-dd")
    ).length || 0;
    const created = tasks?.filter(t => 
      t.created_at &&
      format(new Date(t.created_at), "yyyy-MM-dd") === format(date, "yyyy-MM-dd")
    ).length || 0;
    
    return {
      date: format(date, "MMM dd"),
      completed,
      created,
    };
  });

  const statusDistribution = [
    { status: "Not Started", count: tasks?.filter(t => t.status === "not_started").length || 0, color: "hsl(var(--muted))" },
    { status: "In Progress", count: tasks?.filter(t => t.status === "in_progress").length || 0, color: "hsl(var(--secondary))" },
    { status: "Blocked", count: tasks?.filter(t => t.status === "blocked").length || 0, color: "hsl(var(--accent))" },
  ];

  // Calculate health score
  const totalTasks = tasks?.length || 1;
  const completedTasks = tasks?.filter(t => t.status === "done").length || 0;
  const atRiskTasks = tasks?.filter(t => 
    t.due_date && 
    isBefore(new Date(t.due_date), addDays(today, 3)) && 
    t.status !== "done"
  ).length || 0;
  const overdueTasks = tasks?.filter(t => 
    t.due_date && 
    isBefore(new Date(t.due_date), today) && 
    t.status !== "done"
  ).length || 0;

  const healthScore = Math.max(0, Math.min(100, 
    100 - (blockedTasks * 10) - (atRiskTasks * 5) - (overdueTasks * 15)
  ));

  // AI Assistant
  const handleAskAI = async (question: string) => {
    if (!question.trim() || !currentProjectId) return;

    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ask-ai", {
        body: {
          query: question,
          projectId: currentProjectId,
          context: {
            tasks: tasks?.slice(0, 20),
            blockers: blockers?.slice(0, 10),
            safetyForms: safetyForms?.slice(0, 10),
          },
        },
      });

      if (error) throw error;
      setAiResponse(data.response);
    } catch (error) {
      console.error("Error asking AI:", error);
      setAiResponse("Sorry, I encountered an error processing your question.");
    } finally {
      setAiLoading(false);
    }
  };

  const quickPrompts = [
    "What is most at risk this week",
    "Which tasks are blocking progress",
    "Summarize safety issues from last 7 days",
    "What should I focus on today",
  ];

  // Helper functions
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "completed": return "default";
      case "in_progress": return "secondary";
      case "planning": return "outline";
      case "on_hold": return "destructive";
      default: return "outline";
    }
  };

  const formatStatus = (status: string) => {
    return status.split("_").map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(" ");
  };

  const handleLayoutChange = (newLayout: GridLayout[]) => {
    if (isEditMode) {
      updateLayout(newLayout.map(item => ({
        i: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        minW: item.minW,
        minH: item.minH,
        maxW: item.maxW,
        maxH: item.maxH,
      })));
    }
  };

  const handleSaveLayout = () => {
    saveLayout(layout);
  };

  const handleResetLayout = () => {
    resetLayout();
  };

  // Widget components
  const renderMetricsWidget = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 h-full">
      <Card 
        className="group hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer border-primary/20 overflow-hidden relative" 
        onClick={() => navigate("/tasks")}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <CardContent className="p-6 relative">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <Clock className="h-6 w-6 text-primary" />
            </div>
          </div>
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Open Tasks</p>
          <p className="text-5xl font-black text-primary tabular-nums">{openTasks}</p>
        </CardContent>
      </Card>

      <Card 
        className="group hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer bg-accent/5 border-accent/30 overflow-hidden relative" 
        onClick={() => navigate("/tasks?filter=blocked")}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <CardContent className="p-6 relative">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-xl bg-accent/20 group-hover:bg-accent/30 transition-colors">
              <AlertTriangle className="h-6 w-6 text-accent" />
            </div>
          </div>
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Blocked Tasks</p>
          <p className="text-5xl font-black text-accent tabular-nums">{blockedTasks}</p>
        </CardContent>
      </Card>

      <Card 
        className="group hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer border-primary/20 overflow-hidden relative" 
        onClick={() => navigate("/tasks")}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <CardContent className="p-6 relative">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
          </div>
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Due This Week</p>
          <p className="text-5xl font-black text-primary tabular-nums">{upcomingTasks}</p>
        </CardContent>
      </Card>

      <Card 
        className="group hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer bg-secondary/5 border-secondary/30 overflow-hidden relative" 
        onClick={() => navigate("/safety")}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <CardContent className="p-6 relative">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-xl bg-secondary/20 group-hover:bg-secondary/30 transition-colors">
              <Shield className="h-6 w-6 text-secondary" />
            </div>
          </div>
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Safety Forms</p>
          <p className="text-5xl font-black text-secondary tabular-nums">{safetyFormsThisWeek}</p>
        </CardContent>
      </Card>
    </div>
  );

  const renderActivityWidget = () => (
    <Card className="border-primary/20 shadow-lg h-full">
      <CardHeader>
        <CardTitle className="text-2xl font-black text-primary flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-secondary" />
          Task Activity
        </CardTitle>
        <CardDescription className="text-base font-medium">
          7 day performance at a glance
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{
            completed: { label: "Completed", color: "hsl(var(--secondary))" },
            created: { label: "Created", color: "hsl(var(--muted))" },
          }}
          className="h-[250px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={completionTrendData}>
              <defs>
                <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--secondary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line 
                type="monotone" 
                dataKey="completed" 
                stroke="hsl(var(--secondary))" 
                strokeWidth={3}
                dot={{ fill: "hsl(var(--secondary))", r: 4 }}
                fill="url(#colorCompleted)"
              />
              <Line 
                type="monotone" 
                dataKey="created" 
                stroke="hsl(var(--muted))" 
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: "hsl(var(--muted))", r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );

  const renderHealthWidget = () => (
    <Card className="border-primary/20 shadow-lg h-full">
      <CardHeader>
        <CardTitle className="text-2xl font-black text-primary flex items-center gap-2">
          <Gauge className="h-6 w-6 text-accent" />
          Project Health
        </CardTitle>
        <CardDescription className="text-base font-medium">
          Key risk indicators
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center space-y-6">
        <div className="relative w-48 h-48">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="96"
              cy="96"
              r="80"
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="16"
              opacity="0.2"
            />
            <circle
              cx="96"
              cy="96"
              r="80"
              fill="none"
              stroke={healthScore > 70 ? "hsl(var(--secondary))" : healthScore > 40 ? "hsl(var(--accent))" : "hsl(var(--destructive))"}
              strokeWidth="16"
              strokeDasharray={`${(healthScore / 100) * 502.4} 502.4`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-black text-primary">{healthScore}</span>
            <span className="text-sm text-muted-foreground font-bold">Health Score</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 w-full">
          <div className="text-center">
            <p className="text-2xl font-black text-accent">{atRiskTasks}</p>
            <p className="text-xs text-muted-foreground font-semibold">At Risk</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-accent">{blockedTasks}</p>
            <p className="text-xs text-muted-foreground font-semibold">Blocked</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-destructive">{overdueTasks}</p>
            <p className="text-xs text-muted-foreground font-semibold">Overdue</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderDistributionWidget = () => (
    <Card className="border-primary/20 shadow-lg h-full">
      <CardHeader>
        <CardTitle className="text-2xl font-black text-primary flex items-center gap-2">
          <Target className="h-6 w-6 text-secondary" />
          Task Status Distribution
        </CardTitle>
        <CardDescription className="text-base font-medium">
          Current workflow breakdown
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {statusDistribution.map((item) => (
          <div key={item.status} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">{item.status}</span>
              <span className="text-lg font-black text-primary">{item.count}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-4 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: totalTasks > 0 ? `${(item.count / totalTasks) * 100}%` : "0%",
                  backgroundColor: item.color,
                }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );

  const renderMyDayWidget = () => {
    const priorityTasks = tasks
      ?.filter(t => t.status !== "done" && (t.priority === 1 || t.due_date && isBefore(new Date(t.due_date), addDays(today, 3))))
      .slice(0, 5) || [];

    return (
      <Card className="border-primary/20 shadow-lg h-full">
        <CardHeader>
          <CardTitle className="text-2xl font-black text-primary flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-secondary" />
            My Day
          </CardTitle>
          <CardDescription className="text-base font-medium">
            Priority tasks that need attention
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {priorityTasks.length > 0 ? (
            priorityTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => navigate("/tasks")}
              >
                <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                  task.status === "blocked" ? "bg-accent animate-pulse" : "bg-primary"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-foreground truncate">{task.title}</p>
                  {task.due_date && (
                    <p className="text-xs text-muted-foreground">
                      Due: {format(new Date(task.due_date), "MMM dd")}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </div>
            ))
          ) : (
            <div className="text-center py-8 space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-secondary/20 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-secondary" />
              </div>
              <div>
                <p className="font-bold text-foreground">No urgent tasks today</p>
                <p className="text-sm text-muted-foreground">You're all caught up!</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderSafetyWidget = () => (
    <Card className="bg-secondary/5 border-secondary/30 shadow-lg h-full">
      <CardHeader>
        <CardTitle className="text-xl font-black text-primary flex items-center gap-2">
          <Shield className="h-5 w-5 text-secondary" />
          Safety & Compliance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-muted-foreground">Forms Today</span>
            <span className="text-2xl font-black text-primary">{safetyForms?.filter(f => 
              format(new Date(f.created_at), "yyyy-MM-dd") === format(today, "yyyy-MM-dd")
            ).length || 0}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-muted-foreground">Total This Week</span>
            <span className="text-2xl font-black text-secondary">{safetyFormsThisWeek}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-muted-foreground">Incidents</span>
            <span className="text-2xl font-black text-accent">{safetyForms?.filter(f => f.form_type === "incident").length || 0}</span>
          </div>
        </div>

        <Button
          onClick={() => navigate("/safety")}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
        >
          Open Safety Dashboard
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );

  const renderBlockersWidget = () => {
    const activeBlockers = blockers?.filter(b => !b.is_resolved) || [];

    return (
      <Card className="bg-accent/5 border-accent/30 shadow-lg h-full">
        <CardHeader>
          <CardTitle className="text-2xl font-black text-primary flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-accent animate-pulse" />
            Blockers and Risks
          </CardTitle>
          <CardDescription className="text-base font-medium">
            Active issues requiring attention
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeBlockers.length > 0 ? (
            activeBlockers.slice(0, 5).map((blocker: any) => (
              <div
                key={blocker.id}
                className="p-4 rounded-lg border border-accent/30 bg-background hover:bg-accent/5 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-foreground">{blocker.task?.title || "Unknown Task"}</p>
                    <p className="text-xs text-muted-foreground mt-1">{blocker.reason}</p>
                    {blocker.task?.assigned_trade?.name && (
                      <Badge variant="outline" className="mt-2 text-xs">
                        {blocker.task.assigned_trade.name}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-secondary/20 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-secondary" />
              </div>
              <div>
                <p className="font-bold text-foreground">No blocked tasks</p>
                <p className="text-sm text-muted-foreground">Great work keeping things moving</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderAIWidget = () => (
    <Card className="bg-primary text-primary-foreground shadow-2xl border-none overflow-hidden h-full">
      <div className="absolute inset-0 opacity-10" 
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px'
        }}
      />
      <CardHeader className="relative">
        <CardTitle className="text-2xl font-black flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-accent" />
          Ask AI About This Project
        </CardTitle>
        <CardDescription className="text-primary-foreground/70 font-medium">
          Get intelligent insights and answers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 relative">
        <div className="flex gap-2">
          <Input
            placeholder="Ask a question about tasks, blockers, safety, or schedule"
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAskAI(aiQuery)}
            className="flex-1 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50 focus-visible:ring-accent font-medium"
            disabled={aiLoading}
          />
          <Button
            onClick={() => handleAskAI(aiQuery)}
            disabled={aiLoading || !aiQuery.trim()}
            size="icon"
            className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-full h-12 w-12 flex-shrink-0"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {quickPrompts.map((prompt) => (
            <Button
              key={prompt}
              variant="outline"
              size="sm"
              onClick={() => {
                setAiQuery(prompt);
                handleAskAI(prompt);
              }}
              className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-accent hover:text-accent-foreground hover:border-accent font-semibold"
              disabled={aiLoading}
            >
              {prompt}
            </Button>
          ))}
        </div>

        {aiResponse && (
          <div className="p-4 rounded-lg bg-primary-foreground/10 border border-primary-foreground/20">
            <p className="text-sm text-primary-foreground whitespace-pre-wrap font-medium leading-relaxed">
              {aiResponse}
            </p>
          </div>
        )}

        {aiLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (layoutLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 pb-16 md:pb-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-background via-primary/5 to-secondary/10 border-2 border-primary/20 shadow-2xl">
          <div 
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: `
                linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px'
            }}
          />
          <div className="relative p-6 md:p-8">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
              {/* Left: Project Selector + Title */}
              <div className="space-y-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="w-full sm:w-auto justify-start gap-2 h-auto py-2 px-4 border-2 border-primary/30 hover:border-primary hover:bg-primary/10 font-bold transition-all"
                    >
                      <Building2 className="h-5 w-5 text-primary flex-shrink-0" />
                      <div className="text-left flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Current Project</p>
                        <p className="text-base font-black text-primary truncate">
                          {currentProject?.name || "Select Project"}
                        </p>
                      </div>
                      <ChevronDown className="h-5 w-5 text-primary flex-shrink-0" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[320px] sm:w-[400px]">
                    <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wider">
                      Switch Project
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {userProjects?.map((project: any) => (
                      <DropdownMenuItem
                        key={project.id}
                        onClick={() => setCurrentProject(project.id)}
                        className="flex items-center gap-3 p-3 cursor-pointer"
                      >
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            {project.id === currentProjectId && (
                              <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                            )}
                            <p className="font-bold text-foreground truncate">{project.name}</p>
                          </div>
                          {project.totalTasks > 0 && (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full transition-all"
                                  style={{ width: `${project.progress}%` }}
                                />
                              </div>
                              <span className="text-xs font-bold text-primary whitespace-nowrap">
                                {project.progress}%
                              </span>
                            </div>
                          )}
                        </div>
                        <Badge 
                          variant={getStatusBadgeVariant(project.status)}
                          className="flex-shrink-0 text-xs font-semibold"
                        >
                          {formatStatus(project.status)}
                        </Badge>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="space-y-2 max-w-2xl">
                  <h1 className="text-4xl md:text-6xl font-black text-primary tracking-tight">
                    Today on Site
                  </h1>
                  <p className="text-base md:text-lg text-foreground/70 font-medium">
                    See the status of your project, what needs attention, and where progress is blocked
                  </p>
                </div>
              </div>

              {/* Right: Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 lg:pt-12">
                <DashboardCustomizer
                  isEditMode={isEditMode}
                  setIsEditMode={setIsEditMode}
                  hiddenWidgets={hiddenWidgets}
                  onToggleWidget={toggleWidget}
                  onSave={handleSaveLayout}
                  onReset={handleResetLayout}
                />
                <Button 
                  onClick={() => navigate("/projects")} 
                  size="lg"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg hover:shadow-xl transition-all"
                >
                  View Projects
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button 
                  onClick={() => navigate("/tasks")} 
                  variant="outline" 
                  size="lg"
                  className="border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground font-bold transition-all"
                >
                  Go to Tasks
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Daily Snapshot Strip */}
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="p-4 md:p-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <CloudRain className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Weather</p>
                  <p className="text-sm font-bold text-primary">Clear</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <HardHat className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Crew</p>
                  <p className="text-sm font-bold text-primary">12</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Wrench className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Trades</p>
                  <p className="text-sm font-bold text-primary">4 Active</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <PlayCircle className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Starting</p>
                  <p className="text-sm font-bold text-primary">{tasks?.filter(t => t.start_date && format(new Date(t.start_date), "yyyy-MM-dd") === format(today, "yyyy-MM-dd")).length || 0}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <CheckSquare className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Finishing</p>
                  <p className="text-sm font-bold text-primary">{tasks?.filter(t => t.due_date && format(new Date(t.due_date), "yyyy-MM-dd") === format(today, "yyyy-MM-dd")).length || 0}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <AlertTriangle className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Blockers</p>
                  <p className="text-sm font-bold text-accent">{blockedTasks}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customizable Grid */}
        <div className={isEditMode ? "relative border-2 border-dashed border-primary/50 rounded-lg p-2 bg-primary/5" : ""}>
          {isEditMode && (
            <div className="absolute top-0 left-0 right-0 bg-primary/90 text-primary-foreground px-4 py-2 rounded-t-lg flex items-center gap-2 z-10">
              <MoveIcon className="h-4 w-4" />
              <span className="text-sm font-bold">Drag widgets to rearrange • Resize by dragging corners</span>
            </div>
          )}
          
          <ResponsiveGridLayout
            className="layout"
            layouts={{ lg: layout, md: layout, sm: layout, xs: layout, xxs: layout }}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 12, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={60}
            isDraggable={isEditMode}
            isResizable={isEditMode}
            onLayoutChange={handleLayoutChange}
            draggableHandle=".drag-handle"
          >
            {!hiddenWidgets.includes('metrics') && (
              <div key="metrics" className={isEditMode ? "border-2 border-primary/50 rounded-lg" : ""}>
                {isEditMode && <div className="drag-handle absolute top-2 right-2 cursor-move z-10 bg-primary/90 text-primary-foreground p-2 rounded"><MoveIcon className="h-4 w-4" /></div>}
                {renderMetricsWidget()}
              </div>
            )}
            {!hiddenWidgets.includes('activity') && (
              <div key="activity" className={isEditMode ? "border-2 border-primary/50 rounded-lg" : ""}>
                {isEditMode && <div className="drag-handle absolute top-2 right-2 cursor-move z-10 bg-primary/90 text-primary-foreground p-2 rounded"><MoveIcon className="h-4 w-4" /></div>}
                {renderActivityWidget()}
              </div>
            )}
            {!hiddenWidgets.includes('health') && (
              <div key="health" className={isEditMode ? "border-2 border-primary/50 rounded-lg" : ""}>
                {isEditMode && <div className="drag-handle absolute top-2 right-2 cursor-move z-10 bg-primary/90 text-primary-foreground p-2 rounded"><MoveIcon className="h-4 w-4" /></div>}
                {renderHealthWidget()}
              </div>
            )}
            {!hiddenWidgets.includes('distribution') && (
              <div key="distribution" className={isEditMode ? "border-2 border-primary/50 rounded-lg" : ""}>
                {isEditMode && <div className="drag-handle absolute top-2 right-2 cursor-move z-10 bg-primary/90 text-primary-foreground p-2 rounded"><MoveIcon className="h-4 w-4" /></div>}
                {renderDistributionWidget()}
              </div>
            )}
            {!hiddenWidgets.includes('myday') && (
              <div key="myday" className={isEditMode ? "border-2 border-primary/50 rounded-lg" : ""}>
                {isEditMode && <div className="drag-handle absolute top-2 right-2 cursor-move z-10 bg-primary/90 text-primary-foreground p-2 rounded"><MoveIcon className="h-4 w-4" /></div>}
                {renderMyDayWidget()}
              </div>
            )}
            {!hiddenWidgets.includes('safety') && (
              <div key="safety" className={isEditMode ? "border-2 border-primary/50 rounded-lg" : ""}>
                {isEditMode && <div className="drag-handle absolute top-2 right-2 cursor-move z-10 bg-primary/90 text-primary-foreground p-2 rounded"><MoveIcon className="h-4 w-4" /></div>}
                {renderSafetyWidget()}
              </div>
            )}
            {!hiddenWidgets.includes('blockers') && (
              <div key="blockers" className={isEditMode ? "border-2 border-primary/50 rounded-lg" : ""}>
                {isEditMode && <div className="drag-handle absolute top-2 right-2 cursor-move z-10 bg-primary/90 text-primary-foreground p-2 rounded"><MoveIcon className="h-4 w-4" /></div>}
                {renderBlockersWidget()}
              </div>
            )}
            {!hiddenWidgets.includes('ai') && (
              <div key="ai" className={isEditMode ? "border-2 border-primary/50 rounded-lg" : ""}>
                {isEditMode && <div className="drag-handle absolute top-2 right-2 cursor-move z-10 bg-primary/90 text-primary-foreground p-2 rounded"><MoveIcon className="h-4 w-4" /></div>}
                {renderAIWidget()}
              </div>
            )}
          </ResponsiveGridLayout>
        </div>
      </div>
    </Layout>
  );
}
