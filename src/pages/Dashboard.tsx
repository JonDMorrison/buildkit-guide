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
import { Progress } from "@/components/ui/progress";
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
} from "lucide-react";
import { format, isAfter, isBefore, addDays, startOfDay, subDays } from "date-fns";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";

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
  
  const safetyFormsThisWeek = safetyForms?.filter(f => 
    f.created_at && 
    isAfter(new Date(f.created_at), subDays(today, 7))
  ).length || 0;

  // Task status distribution
  const notStartedCount = tasks?.filter(t => t.status === "not_started").length || 0;
  const inProgressCount = tasks?.filter(t => t.status === "in_progress").length || 0;
  const blockedCount = tasks?.filter(t => t.status === "blocked").length || 0;
  const doneCount = tasks?.filter(t => t.status === "done").length || 0;
  const totalTasks = tasks?.length || 1;

  const statusDistribution = [
    { status: "Not Started", count: notStartedCount, percentage: (notStartedCount / totalTasks) * 100, fill: "hsl(var(--brand-muted-grey))" },
    { status: "In Progress", count: inProgressCount, percentage: (inProgressCount / totalTasks) * 100, fill: "hsl(var(--brand-primary-light))" },
    { status: "Blocked", count: blockedCount, percentage: (blockedCount / totalTasks) * 100, fill: "hsl(var(--brand-accent-orange))" },
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

  // Project health score
  const completionRate = (doneCount / totalTasks) * 100;
  const blockerImpact = (blockedCount / totalTasks) * 100;
  const overdueTasks = tasks?.filter(t => 
    t.due_date && 
    isBefore(new Date(t.due_date), today) && 
    t.status !== "done"
  ).length || 0;
  const overdueImpact = (overdueTasks / totalTasks) * 100;
  const healthScore = Math.max(0, Math.min(100, completionRate - blockerImpact - overdueImpact));

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
    "What is most at risk this week",
    "Which tasks are blocking progress",
    "Summarize safety issues from last 7 days",
    "What should I focus on today",
  ];

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "in_progress":
        return "default";
      case "completed":
        return "secondary";
      case "planning":
        return "outline";
      case "on_hold":
        return "destructive";
      default:
        return "outline";
    }
  };

  const formatStatus = (status: string) => {
    return status.split("_").map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(" ");
  };

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
      <div className="max-w-[1600px] mx-auto space-y-6 md:space-y-8 pb-8">
        {/* Hero Header with Blueprint Pattern */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
          {/* Blueprint Grid Pattern */}
          <div 
            className="absolute inset-0 opacity-[0.08]" 
            style={{
              backgroundImage: `
                linear-gradient(hsl(var(--brand-primary-dark)) 1px, transparent 1px),
                linear-gradient(90deg, hsl(var(--brand-primary-dark)) 1px, transparent 1px)
              `,
              backgroundSize: '24px 24px'
            }}
          />
          
          <div className="relative p-6 md:p-10">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              {/* Left: Project Selector */}
              <div className="space-y-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className="h-auto p-0 hover:bg-transparent group"
                    >
                      <div className="flex items-center gap-3 text-left">
                        <Building2 className="h-6 w-6 text-primary group-hover:text-secondary transition-colors" />
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current Project</span>
                          <span className="text-2xl md:text-3xl font-black text-primary group-hover:text-secondary transition-colors">
                            {currentProject?.name}
                          </span>
                        </div>
                        <ChevronDown className="h-5 w-5 text-primary group-hover:text-secondary transition-colors ml-1" />
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="start" 
                    className="w-[320px] bg-card border-border shadow-2xl z-50"
                  >
                    <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">
                      Switch Project
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {userProjects?.map((project: any) => (
                      <DropdownMenuItem
                        key={project.id}
                        onClick={() => setCurrentProject(project.id)}
                        className="cursor-pointer py-3 focus:bg-accent focus:text-accent-foreground"
                      >
                        <div className="flex items-start justify-between gap-3 w-full">
                          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold truncate">
                                {project.name}
                              </span>
                              {project.id === currentProjectId && (
                                <CheckCircle2 className="h-4 w-4 text-secondary flex-shrink-0" />
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground truncate">
                              {project.location}
                            </span>
                            {project.totalTasks > 0 && (
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-secondary transition-all duration-300"
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
                        </div>
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

        {/* Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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

        {/* Activity + Health Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-primary/20 shadow-lg">
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
                  completed: {
                    label: "Completed",
                    color: "hsl(var(--brand-primary-light))",
                  },
                  created: {
                    label: "Created",
                    color: "hsl(var(--brand-muted-grey))",
                  },
                }}
                className="h-[250px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={completionTrendData}>
                    <CartesianGrid 
                      strokeDasharray="3 3" 
                      stroke="hsl(var(--brand-primary-dark))" 
                      opacity={0.15}
                      strokeWidth={1.5}
                    />
                    <XAxis 
                      dataKey="date" 
                      stroke="hsl(var(--brand-primary-dark))"
                      tick={{ fill: "hsl(var(--brand-primary-dark))", fontSize: 12, fontWeight: 600 }}
                    />
                    <YAxis 
                      stroke="hsl(var(--brand-primary-dark))"
                      tick={{ fill: "hsl(var(--brand-primary-dark))", fontSize: 12, fontWeight: 600 }}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line 
                      type="monotone" 
                      dataKey="completed" 
                      stroke="hsl(var(--brand-primary-light))" 
                      strokeWidth={3}
                      dot={{ fill: "hsl(var(--brand-primary-light))", r: 5 }}
                      activeDot={{ r: 7 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="created" 
                      stroke="hsl(var(--brand-muted-grey))" 
                      strokeWidth={3}
                      strokeDasharray="5 5"
                      dot={{ fill: "hsl(var(--brand-muted-grey))", r: 5 }}
                      activeDot={{ r: 7 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className="border-primary/20 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl font-black text-primary flex items-center gap-2">
                <Gauge className="h-6 w-6 text-secondary" />
                Project Health
              </CardTitle>
              <CardDescription className="text-base font-medium">
                Key risk indicators
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-center">
                <div className="relative w-48 h-48">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="96"
                      cy="96"
                      r="88"
                      stroke="hsl(var(--brand-muted-grey))"
                      strokeWidth="12"
                      fill="none"
                      opacity="0.2"
                    />
                    <circle
                      cx="96"
                      cy="96"
                      r="88"
                      stroke={healthScore > 70 ? "hsl(var(--brand-primary-light))" : healthScore > 40 ? "hsl(var(--brand-accent-orange))" : "hsl(var(--destructive))"}
                      strokeWidth="12"
                      fill="none"
                      strokeDasharray={`${(healthScore / 100) * 553} 553`}
                      strokeLinecap="round"
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-5xl font-black text-primary">{Math.round(healthScore)}</span>
                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Health Score</span>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 rounded-lg bg-secondary/10">
                  <Target className="h-5 w-5 text-secondary mx-auto mb-1" />
                  <p className="text-2xl font-black text-secondary">{overdueTasks}</p>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">At Risk</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-accent/10">
                  <AlertTriangle className="h-5 w-5 text-accent mx-auto mb-1" />
                  <p className="text-2xl font-black text-accent">{blockedCount}</p>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Blocked</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-destructive/10">
                  <TrendingDown className="h-5 w-5 text-destructive mx-auto mb-1" />
                  <p className="text-2xl font-black text-destructive">{overdueTasks}</p>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Overdue</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Task Status Distribution */}
        <Card className="border-primary/20 shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-black text-primary">Task Status Distribution</CardTitle>
            <CardDescription className="text-base font-medium">
              Current breakdown of all project tasks shows {inProgressCount} tasks actively moving forward
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {statusDistribution.map((item) => (
                <div key={item.status} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-foreground">{item.status}</span>
                    <span className="text-sm font-black text-primary">{item.count} ({Math.round(item.percentage)}%)</span>
                  </div>
                  <div className="h-4 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-1000" 
                      style={{ width: `${item.percentage}%`, backgroundColor: item.fill }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* My Day + Safety Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card className="lg:col-span-8 border-primary/20 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl font-black text-primary flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-secondary" />
                My Day
              </CardTitle>
              <CardDescription className="text-base font-medium">
                Priority tasks that need your attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              {myDayTasks.length > 0 ? (
                <div className="space-y-3">
                  {myDayTasks.map((task: any) => (
                    <div 
                      key={task.id}
                      className="flex items-start gap-4 p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group"
                      onClick={() => navigate(`/tasks?task=${task.id}`)}
                    >
                      <div className={`mt-1 p-1.5 rounded-md ${
                        task.priority === 1 ? 'bg-destructive/10' : 
                        task.priority === 2 ? 'bg-accent/10' : 'bg-muted'
                      }`}>
                        <div className={`w-3 h-3 rounded-sm ${
                          task.priority === 1 ? 'bg-destructive' : 
                          task.priority === 2 ? 'bg-accent' : 'bg-muted-foreground'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground group-hover:text-primary transition-colors">
                          {task.title}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          {task.assigned_trade && (
                            <span className="text-xs font-semibold text-muted-foreground">
                              {task.assigned_trade.name}
                            </span>
                          )}
                          {task.due_date && (
                            <span className="text-xs font-semibold text-muted-foreground">
                              Due: {format(new Date(task.due_date), "MMM d")}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="p-4 rounded-full bg-secondary/20 mb-4">
                    <CheckCircle2 className="h-12 w-12 text-secondary" />
                  </div>
                  <p className="text-lg font-bold text-primary mb-2">All Caught Up!</p>
                  <p className="text-sm text-muted-foreground">
                    No urgent tasks for today
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-4 bg-secondary/5 border-secondary/30 shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl font-black text-primary flex items-center gap-2">
                <Shield className="h-5 w-5 text-secondary" />
                Safety & Compliance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
                <span className="text-sm font-semibold text-muted-foreground">Forms Today</span>
                <span className="text-2xl font-black text-secondary">
                  {safetyForms?.filter(f => 
                    f.created_at && format(new Date(f.created_at), "yyyy-MM-dd") === format(today, "yyyy-MM-dd")
                  ).length || 0}
                </span>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
                <span className="text-sm font-semibold text-muted-foreground">This Week</span>
                <span className="text-2xl font-black text-secondary">{safetyFormsThisWeek}</span>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
                <span className="text-sm font-semibold text-muted-foreground">Incidents</span>
                <span className="text-2xl font-black text-primary">0</span>
              </div>
              
              <Button 
                onClick={() => navigate("/safety")}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
              >
                Open Safety Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Blockers and Risks */}
        <Card className="bg-accent/5 border-accent/30 shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-black text-primary flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-accent animate-pulse" />
              Blockers and Risks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {blockerTasks.length > 0 ? (
              <div className="space-y-3">
                {blockerTasks.map((task: any) => (
                  <div 
                    key={task.id}
                    className="flex items-start gap-4 p-4 rounded-lg border border-accent/30 bg-card hover:border-accent hover:bg-accent/5 transition-all cursor-pointer group"
                    onClick={() => navigate(`/tasks?task=${task.id}`)}
                  >
                    <div className="mt-1 p-1.5 rounded-md bg-accent/20">
                      <AlertCircle className="h-5 w-5 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground group-hover:text-accent transition-colors">
                        {task.title}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        {task.assigned_trade && (
                          <span className="text-xs font-semibold text-muted-foreground">
                            {task.assigned_trade.name}
                          </span>
                        )}
                        <Badge variant="outline" className="text-xs font-semibold border-accent text-accent">
                          Blocked
                        </Badge>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-accent transition-colors" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 rounded-full bg-secondary/20 mb-4">
                  <CheckCircle2 className="h-12 w-12 text-secondary" />
                </div>
                <p className="text-lg font-bold text-primary mb-2">No Blocked Tasks</p>
                <p className="text-sm text-muted-foreground">
                  Great work keeping things moving
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Assistant Panel */}
        <Card className="bg-primary text-primary-foreground shadow-2xl border-none overflow-hidden">
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
      </div>
    </Layout>
  );
}
