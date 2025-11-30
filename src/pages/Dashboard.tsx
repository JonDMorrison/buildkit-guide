import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAuthRole } from "@/hooks/useAuthRole";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Shield,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Sparkles,
  Calendar,
  Users,
  AlertCircle,
  ChevronRight,
  BarChart3,
} from "lucide-react";
import { format, isAfter, isBefore, addDays, startOfDay, subDays, startOfWeek, endOfWeek } from "date-fns";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, XAxis, YAxis } from "recharts";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentProjectId, setCurrentProject } = useCurrentProject();
  const { currentProjectRole, isPM, isForeman, isWorker } = useAuthRole(currentProjectId || undefined);
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const today = startOfDay(new Date());
  const nextWeek = addDays(today, 7);

  // Fetch user's projects to auto-select first one if none selected
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
      return data?.map((pm: any) => pm.projects).filter(Boolean) || [];
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

      // Role-based filtering
      if (isWorker(currentProjectId)) {
        query = query.or(`task_assignments.user_id.eq.${user.id}`);
      }

      const { data, error } = await query.order("due_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!currentProjectId,
  });

  // Fetch safety forms
  const { data: safetyForms } = useQuery({
    queryKey: ["dashboard-safety", currentProjectId],
    queryFn: async () => {
      if (!currentProjectId) return [];
      if (!isPM(currentProjectId) && !isForeman(currentProjectId)) return [];

      const { data, error } = await supabase
        .from("safety_forms")
        .select("*")
        .eq("project_id", currentProjectId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentProjectId,
  });

  // Fetch manpower requests
  const { data: manpowerRequests } = useQuery({
    queryKey: ["dashboard-manpower", currentProjectId],
    queryFn: async () => {
      if (!currentProjectId) return [];
      if (!isPM(currentProjectId) && !isForeman(currentProjectId)) return [];

      const { data, error } = await supabase
        .from("manpower_requests")
        .select(`
          *,
          trade:trades(name)
        `)
        .eq("project_id", currentProjectId)
        .eq("is_deleted", false)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentProjectId,
  });

  // Calculate metrics
  const openTasks = tasks?.filter(t => t.status !== "done").length || 0;
  const blockedTasks = tasks?.filter(t => 
    t.blockers?.some((b: any) => !b.is_resolved)
  ).length || 0;
  const upcomingTasks = tasks?.filter(t => 
    t.due_date && 
    isAfter(new Date(t.due_date), today) &&
    isBefore(new Date(t.due_date), nextWeek) &&
    t.status !== "done"
  ).length || 0;
  const safetyFormsToday = safetyForms?.filter(f => 
    f.created_at && format(new Date(f.created_at), "yyyy-MM-dd") === format(today, "yyyy-MM-dd")
  ).length || 0;

  // Chart data calculations
  const taskStatusData = [
    { status: "Not Started", count: tasks?.filter(t => t.status === "not_started").length || 0, fill: "hsl(var(--muted))" },
    { status: "In Progress", count: tasks?.filter(t => t.status === "in_progress").length || 0, fill: "hsl(var(--primary))" },
    { status: "Blocked", count: tasks?.filter(t => t.status === "blocked").length || 0, fill: "hsl(var(--destructive))" },
    { status: "Done", count: tasks?.filter(t => t.status === "done").length || 0, fill: "hsl(var(--chart-2))" },
  ];

  // Task completion trend (last 7 days)
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
      date: format(date, "EEE"),
      completed,
      created,
    };
  });

  // Project health score (0-100)
  const totalTasks = tasks?.length || 1;
  const doneTasks = tasks?.filter(t => t.status === "done").length || 0;
  const blockedTasksCount = tasks?.filter(t => t.blockers?.some((b: any) => !b.is_resolved)).length || 0;
  const overdueTasks = tasks?.filter(t => 
    t.due_date && 
    isBefore(new Date(t.due_date), today) && 
    t.status !== "done"
  ).length || 0;
  
  const completionRate = (doneTasks / totalTasks) * 100;
  const blockerImpact = (blockedTasksCount / totalTasks) * 100;
  const overdueImpact = (overdueTasks / totalTasks) * 100;
  const healthScore = Math.max(0, Math.min(100, completionRate - blockerImpact - overdueImpact));

  const projectHealthData = [
    { metric: "Completion", value: Math.round(completionRate), fill: "hsl(var(--chart-2))" },
    { metric: "At Risk", value: Math.round(overdueImpact), fill: "hsl(var(--chart-3))" },
    { metric: "Blocked", value: Math.round(blockerImpact), fill: "hsl(var(--destructive))" },
  ];

  // My Day tasks
  const myDayTasks = tasks?.filter(t => {
    if (t.status === "done") return false;
    const dueDate = t.due_date ? new Date(t.due_date) : null;
    return !dueDate || isBefore(dueDate, addDays(today, 1)) || isAfter(today, dueDate);
  }).slice(0, 5) || [];

  // Blocked tasks
  const blockerTasks = tasks?.filter(t => 
    t.blockers?.some((b: any) => !b.is_resolved)
  ).slice(0, 5) || [];

  const handleAskAI = async (query: string) => {
    if (!query.trim() || !currentProjectId) return;
    
    setAiLoading(true);
    setAiResponse("");
    
    try {
      const { data, error } = await supabase.functions.invoke("ask-ai", {
        body: {
          query,
          projectId: currentProjectId,
        },
      });

      if (error) throw error;
      setAiResponse(data.response || "No response received");
    } catch (error: any) {
      setAiResponse(`Error: ${error.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  const quickPrompts = [
    "What is most at risk this week?",
    "Which tasks are blocking progress?",
    "Summarize safety issues from the last 7 days",
    "What should I focus on today?",
  ];

  if (!currentProject) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle>No Project Selected</CardTitle>
              <CardDescription>
                Please select or create a project to view your dashboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/projects")} className="w-full">
                View All Projects
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-8 md:space-y-10 pb-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 pt-2">
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight">
              Today on Site
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              See what needs attention, where you are blocked, and how your project is trending
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={() => navigate("/projects")} 
              variant="default" 
              size="lg"
              className="w-full sm:w-auto shadow-lg hover:shadow-xl transition-all"
            >
              View Projects
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button 
              onClick={() => navigate("/tasks")} 
              variant="outline" 
              size="lg"
              className="w-full sm:w-auto"
            >
              Go to Tasks
            </Button>
          </div>
        </div>

        {/* Key Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          <Card 
            className="group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer border-border/60 bg-gradient-to-br from-card to-card/50 overflow-hidden relative" 
            onClick={() => navigate("/tasks")}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-6 relative">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground font-medium uppercase tracking-wide">Open Tasks</p>
                  <p className="text-4xl md:text-5xl font-bold text-foreground tabular-nums">{openTasks}</p>
                </div>
                <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-4 pt-4 border-t border-border/50">
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">Active work items</span>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer border-destructive/30 bg-gradient-to-br from-card to-card/50 overflow-hidden relative" 
            onClick={() => navigate("/tasks?filter=blocked")}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-destructive/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-6 relative">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground font-medium uppercase tracking-wide">Blocked Tasks</p>
                  <p className="text-4xl md:text-5xl font-bold text-destructive tabular-nums">{blockedTasks}</p>
                </div>
                <div className="p-3 rounded-xl bg-destructive/10 group-hover:bg-destructive/20 transition-colors">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-4 pt-4 border-t border-border/50">
                <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                <span className="text-xs text-destructive font-medium">Requires immediate action</span>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer border-border/60 bg-gradient-to-br from-card to-card/50 overflow-hidden relative" 
            onClick={() => navigate("/tasks")}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-6 relative">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground font-medium uppercase tracking-wide">Due This Week</p>
                  <p className="text-4xl md:text-5xl font-bold text-foreground tabular-nums">{upcomingTasks}</p>
                </div>
                <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-4 pt-4 border-t border-border/50">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">Next 7 days</span>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer border-border/60 bg-gradient-to-br from-card to-card/50 overflow-hidden relative" 
            onClick={() => navigate("/safety")}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-status-complete/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-6 relative">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground font-medium uppercase tracking-wide">Safety Forms</p>
                  <p className="text-4xl md:text-5xl font-bold text-foreground tabular-nums">{safetyFormsToday}</p>
                </div>
                <div className="p-3 rounded-xl bg-status-complete/10 group-hover:bg-status-complete/20 transition-colors">
                  <Shield className="h-6 w-6 text-status-complete" />
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-4 pt-4 border-t border-border/50">
                <CheckCircle2 className="h-3.5 w-3.5 text-status-complete" />
                <span className="text-xs text-muted-foreground font-medium">Submitted today</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Task Completion Trend */}
          <Card className="border-border/60 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <div className="p-2 rounded-lg bg-primary/10">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                Task Activity
              </CardTitle>
              <CardDescription className="text-base">
                7-day trend of tasks created vs completed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  completed: {
                    label: "Completed",
                    color: "hsl(var(--chart-2))",
                  },
                  created: {
                    label: "Created",
                    color: "hsl(var(--primary))",
                  },
                }}
                className="h-[200px] w-full"
              >
                <AreaChart data={completionTrendData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="completed"
                    stackId="1"
                    stroke="hsl(var(--chart-2))"
                    fill="hsl(var(--chart-2))"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="created"
                    stackId="2"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.4}
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Project Health Score */}
          <Card className="border-border/60 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center justify-between text-xl">
                <span className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  Project Health
                </span>
                <Badge 
                  variant={healthScore >= 70 ? "default" : healthScore >= 40 ? "secondary" : "destructive"}
                  className="text-xl font-bold px-4 py-1.5 shadow-sm"
                >
                  {Math.round(healthScore)}%
                </Badge>
              </CardTitle>
              <CardDescription className="text-base">
                Real-time performance indicators
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  value: {
                    label: "Percentage",
                    color: "hsl(var(--primary))",
                  },
                }}
                className="h-[200px] w-full"
              >
                <BarChart data={projectHealthData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" domain={[0, 100]} className="text-xs" />
                  <YAxis dataKey="metric" type="category" width={80} className="text-xs" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {projectHealthData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Task Status Distribution */}
        <Card className="border-border/60 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Task Status Distribution</CardTitle>
            <CardDescription className="text-base">
              Complete breakdown of all tasks by current status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ChartContainer
                config={{
                  count: {
                    label: "Tasks",
                    color: "hsl(var(--primary))",
                  },
                }}
                className="h-[250px] w-full"
              >
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Pie
                    data={taskStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="count"
                  >
                    {taskStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="flex flex-col justify-center space-y-3">
                {taskStatusData.map((item) => (
                  <div key={item.status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="h-3 w-3 rounded-full" 
                        style={{ backgroundColor: item.fill }}
                      />
                      <span className="text-sm font-medium">{item.status}</span>
                    </div>
                    <span className="text-2xl font-bold">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Spans 2 cols on desktop */}
          <div className="lg:col-span-2 space-y-6">
            {/* My Day Section */}
            <Card className="border-border/60 shadow-lg">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Clock className="h-5 w-5 text-primary" />
                      </div>
                      My Day
                    </CardTitle>
                    <CardDescription className="text-base">
                      Priority work items requiring your attention
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="text-base px-3 py-1">{myDayTasks.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {myDayTasks.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <div className="p-4 rounded-full bg-status-complete/10 w-fit mx-auto mb-4">
                      <CheckCircle2 className="h-12 w-12 text-status-complete" />
                    </div>
                    <p className="text-base font-medium">All caught up!</p>
                    <p className="text-sm mt-1">No urgent tasks today.</p>
                  </div>
                ) : (
                  <>
                    {myDayTasks.map((task, idx) => (
                      <div
                        key={task.id}
                        className="group p-5 rounded-xl border border-border/60 hover:border-primary/50 hover:shadow-md transition-all duration-200 cursor-pointer bg-gradient-to-br from-card to-card/50"
                        onClick={() => navigate("/tasks")}
                        style={{ animationDelay: `${idx * 50}ms` }}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-foreground group-hover:text-primary transition-colors">{task.title}</p>
                              {task.blockers?.some((b: any) => !b.is_resolved) && (
                                <Badge variant="destructive" className="text-xs shadow-sm">Blocked</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                              {task.assigned_trade && (
                                <span className="flex items-center gap-1 font-medium">
                                  <Users className="h-3.5 w-3.5" />
                                  {task.assigned_trade.name}
                                </span>
                              )}
                              {task.due_date && (
                                <span className="flex items-center gap-1 font-medium">
                                  <Calendar className="h-3.5 w-3.5" />
                                  {format(new Date(task.due_date), "MMM d")}
                                </span>
                              )}
                              <Badge variant={task.status === "in_progress" ? "default" : "secondary"} className="text-xs">
                                {task.status.replace("_", " ")}
                              </Badge>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                        </div>
                      </div>
                    ))}
                    <Button variant="link" onClick={() => navigate("/tasks")} className="w-full text-base">
                      View all tasks <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Blockers and Risks */}
            <Card className="border-destructive/30 shadow-lg bg-gradient-to-br from-card to-destructive/5">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-destructive text-xl">
                      <div className="p-2 rounded-lg bg-destructive/10">
                        <AlertTriangle className="h-5 w-5" />
                      </div>
                      Blockers and Risks
                    </CardTitle>
                    <CardDescription className="text-base">
                      Tasks blocked and requiring immediate resolution
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {blockerTasks.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <div className="p-4 rounded-full bg-status-complete/10 w-fit mx-auto mb-4">
                      <CheckCircle2 className="h-12 w-12 text-status-complete" />
                    </div>
                    <p className="text-base font-medium">No blocked tasks</p>
                    <p className="text-sm mt-1">Great work keeping things moving!</p>
                  </div>
                ) : (
                  <>
                    {blockerTasks.map((task, idx) => (
                      <div
                        key={task.id}
                        className="group p-5 rounded-xl border border-destructive/30 hover:border-destructive/60 hover:shadow-md transition-all duration-200 cursor-pointer bg-gradient-to-br from-card to-destructive/5"
                        onClick={() => navigate("/tasks")}
                        style={{ animationDelay: `${idx * 50}ms` }}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-3">
                              <div className="p-1.5 rounded-lg bg-destructive/10 shrink-0 mt-0.5">
                                <AlertCircle className="h-4 w-4 text-destructive" />
                              </div>
                              <div className="flex-1 min-w-0 space-y-2">
                                <p className="font-semibold text-foreground group-hover:text-destructive transition-colors">{task.title}</p>
                                <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                                  {task.assigned_trade && (
                                    <span className="flex items-center gap-1 font-medium">
                                      <Users className="h-3.5 w-3.5" />
                                      {task.assigned_trade.name}
                                    </span>
                                  )}
                                  <Badge variant="destructive" className="text-xs shadow-sm">
                                    {task.blockers?.length || 0} blocker{task.blockers?.length !== 1 ? 's' : ''}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-destructive transition-colors flex-shrink-0" />
                        </div>
                      </div>
                    ))}
                    <Button variant="link" onClick={() => navigate("/tasks?filter=blocked")} className="w-full text-destructive text-base">
                      View all blockers <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Safety and Compliance */}
            {currentProjectId && (isPM(currentProjectId) || isForeman(currentProjectId)) && (
              <Card className="border-status-complete/30 shadow-lg bg-gradient-to-br from-card to-status-complete/5">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <div className="p-2 rounded-lg bg-status-complete/10">
                      <Shield className="h-5 w-5 text-status-complete" />
                    </div>
                    Safety & Compliance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gradient-to-br from-muted/50 to-muted/20 rounded-xl border border-border/40">
                      <span className="text-sm text-muted-foreground font-medium">Forms Today</span>
                      <span className="text-3xl font-bold text-foreground tabular-nums">{safetyFormsToday}</span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gradient-to-br from-muted/50 to-muted/20 rounded-xl border border-border/40">
                      <span className="text-sm text-muted-foreground font-medium">Total This Week</span>
                      <span className="text-2xl font-bold text-foreground tabular-nums">{safetyForms?.length || 0}</span>
                    </div>
                  </div>
                  {manpowerRequests && manpowerRequests.length > 0 && (
                    <div className="pt-4 border-t border-border/50">
                      <p className="text-sm font-medium text-foreground mb-3">Pending Requests</p>
                      <Badge variant="secondary" className="text-sm px-3 py-1.5">
                        {manpowerRequests.length} manpower request{manpowerRequests.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  )}
                  <Button 
                    onClick={() => navigate("/safety")} 
                    variant="outline" 
                    className="w-full mt-2 hover:bg-status-complete/10 hover:border-status-complete/30"
                  >
                    Open Safety Dashboard
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* AI Assistant Panel */}
            <Card className="border-primary/30 shadow-xl bg-gradient-to-br from-primary/10 via-primary/5 to-card overflow-hidden relative sticky top-4">
              <div className="absolute inset-0 bg-grid-white/5 [mask-image:radial-gradient(white,transparent_85%)]" />
              <CardHeader className="pb-4 relative">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <div className="p-2 rounded-lg bg-primary/20">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  Ask AI About This Project
                </CardTitle>
                <CardDescription className="text-base">
                  Get intelligent insights and answers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 relative">
                <div className="flex gap-2">
                  <Input
                    placeholder="Ask a question..."
                    value={aiQuery}
                    onChange={(e) => setAiQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !aiLoading) {
                        handleAskAI(aiQuery);
                      }
                    }}
                    className="flex-1 border-primary/30 focus-visible:ring-primary/30"
                  />
                  <Button 
                    onClick={() => handleAskAI(aiQuery)} 
                    disabled={aiLoading || !aiQuery.trim()}
                    className="shadow-lg"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {quickPrompts.map((prompt, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      onClick={() => handleAskAI(prompt)}
                      disabled={aiLoading}
                      className="text-xs hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-colors"
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>

                {aiResponse && (
                  <div className="p-5 bg-gradient-to-br from-muted to-muted/50 rounded-xl border border-border/60 shadow-inner">
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{aiResponse}</p>
                  </div>
                )}

                {aiLoading && (
                  <div className="p-5 rounded-xl bg-gradient-to-br from-muted to-muted/50 border border-border/60 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                      <span className="text-sm text-muted-foreground font-medium">
                        Analyzing project data...
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
