import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAuthRole } from "@/hooks/useAuthRole";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { useIsMobile } from "@/hooks/use-mobile";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
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
  ChevronRight,
  ChevronDown,
  CloudRain,
  HardHat,
  Wrench,
  Calendar,
  AlertCircle,
  Send,
  Gauge,
  Target,
  TrendingDown,
  FileWarning,
} from "lucide-react";
import { format, isAfter, isBefore, addDays, startOfDay, subDays } from "date-fns";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid } from "recharts";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentProjectId, setCurrentProject } = useCurrentProject();
  const { currentProjectRole, isPM, isForeman, isWorker } = useAuthRole(currentProjectId || undefined);
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const isMobile = useIsMobile();

  const today = startOfDay(new Date());
  const nextWeek = addDays(today, 7);

  // Fetch user's projects
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

  const safetyFormsToday = safetyForms?.filter(f => 
    f.created_at && format(new Date(f.created_at), "yyyy-MM-dd") === format(today, "yyyy-MM-dd")
  ).length || 0;

  const incidentsThisWeek = safetyForms?.filter(f => 
    f.form_type === "incident_report" && 
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
    const isOverdue = dueDate && isBefore(dueDate, today);
    const isDueToday = dueDate && format(dueDate, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");
    return isOverdue || isDueToday || t.priority === 1;
  }).slice(0, 5) || [];

  // Blocked tasks
  const blockerTasks = tasks?.filter(t => 
    t.blockers?.some((b: any) => !b.is_resolved)
  ) || [];

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

  if (!currentProject) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh] p-4">
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
      <div className="max-w-[1200px] mx-auto space-y-6 pb-8">
        {/* Mobile Command Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
          {/* Blueprint Grid Pattern */}
          <div 
            className="absolute inset-0 opacity-[0.06]" 
            style={{
              backgroundImage: `
                linear-gradient(hsl(var(--brand-primary-dark)) 1px, transparent 1px),
                linear-gradient(90deg, hsl(var(--brand-primary-dark)) 1px, transparent 1px)
              `,
              backgroundSize: '20px 20px'
            }}
          />
          
          <div className="relative p-5">
            {/* Project Selector - Full Width Tap Target */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="w-full h-auto p-4 hover:bg-primary/10 rounded-xl mb-4 justify-between"
                >
                  <div className="flex flex-col items-start text-left">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Current Project</span>
                    <span className="text-xl md:text-2xl font-black text-primary mt-1">
                      {currentProject?.name}
                    </span>
                  </div>
                  <ChevronDown className="h-6 w-6 text-primary flex-shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="start" 
                className="w-[calc(100vw-2rem)] max-w-md bg-card border-border shadow-2xl z-50"
              >
                <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">
                  Switch Project
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {userProjects?.map((project: any) => (
                  <DropdownMenuItem
                    key={project.id}
                    onClick={() => setCurrentProject(project.id)}
                    className="cursor-pointer py-4 px-4"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-base">
                        {project.name}
                      </span>
                      {project.id === currentProjectId && (
                        <CheckCircle2 className="h-5 w-5 text-secondary flex-shrink-0" />
                      )}
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Main Title */}
            <div className="space-y-2 mb-4">
              <h1 className="text-3xl md:text-4xl font-black text-primary tracking-tight">
                Today on Site
              </h1>
              <p className="text-sm md:text-base text-foreground/70 font-medium">
                Your tasks, blockers, and project status at a glance
              </p>
            </div>

            {/* Horizontally Scrollable Quick Info Bar */}
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex gap-3 pb-2">
                <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary/10 border border-primary/20">
                  <CloudRain className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-xs font-bold text-primary">Clear</span>
                </div>
                
                <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary/10 border border-primary/20">
                  <HardHat className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-xs font-bold text-primary">12 Crew</span>
                </div>
                
                <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary/10 border border-primary/20">
                  <Wrench className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-xs font-bold text-primary">4 Trades</span>
                </div>
                
                <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary/10 border border-primary/20">
                  <Calendar className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-xs font-bold text-primary">{upcomingTasks} Due</span>
                </div>
                
                <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-accent/10 border border-accent/20">
                  <AlertTriangle className="h-4 w-4 text-accent flex-shrink-0" />
                  <span className="text-xs font-bold text-accent">{blockedTasks} Blocked</span>
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Metrics Stack - Full Width Cards */}
        <div className="space-y-4">
          {/* Open Tasks */}
          <Card 
            className="hover:shadow-lg active:scale-[0.98] transition-all cursor-pointer border-l-4 border-l-primary"
            onClick={() => navigate("/tasks")}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Open Tasks
                  </p>
                  <p className="text-5xl font-black text-primary tabular-nums">
                    {openTasks}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-primary/10">
                  <Clock className="h-8 w-8 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Blocked Tasks */}
          <Card 
            className="hover:shadow-lg active:scale-[0.98] transition-all cursor-pointer border-l-4 border-l-accent bg-accent/5"
            onClick={() => navigate("/tasks?filter=blocked")}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Blocked Tasks
                  </p>
                  <p className="text-5xl font-black text-accent tabular-nums">
                    {blockedTasks}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-accent/20">
                  <AlertTriangle className="h-8 w-8 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Due This Week */}
          <Card 
            className="hover:shadow-lg active:scale-[0.98] transition-all cursor-pointer border-l-4 border-l-secondary"
            onClick={() => navigate("/tasks")}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Due This Week
                  </p>
                  <p className="text-5xl font-black text-secondary tabular-nums">
                    {upcomingTasks}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-secondary/10">
                  <Calendar className="h-8 w-8 text-secondary" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Safety Forms */}
          <Card 
            className="hover:shadow-lg active:scale-[0.98] transition-all cursor-pointer border-l-4 border-l-secondary bg-secondary/5"
            onClick={() => navigate("/safety")}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Safety Forms
                  </p>
                  <p className="text-5xl font-black text-secondary tabular-nums">
                    {safetyFormsThisWeek}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-secondary/20">
                  <Shield className="h-8 w-8 text-secondary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Task Activity - Compact for Mobile */}
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl font-black text-primary flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-secondary" />
              Task Activity
            </CardTitle>
            <CardDescription className="text-sm">
              Created vs completed this week
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
              className="h-[200px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={completionTrendData}>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke="hsl(var(--brand-primary-dark))" 
                    opacity={0.15}
                  />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--brand-primary-dark))"
                    tick={{ fill: "hsl(var(--brand-primary-dark))", fontSize: 11, fontWeight: 600 }}
                  />
                  <YAxis 
                    stroke="hsl(var(--brand-primary-dark))"
                    tick={{ fill: "hsl(var(--brand-primary-dark))", fontSize: 11, fontWeight: 600 }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line 
                    type="monotone" 
                    dataKey="completed" 
                    stroke="hsl(var(--brand-primary-light))" 
                    strokeWidth={3}
                    dot={{ fill: "hsl(var(--brand-primary-light))", r: 4 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="created" 
                    stroke="hsl(var(--brand-muted-grey))" 
                    strokeWidth={3}
                    strokeDasharray="5 5"
                    dot={{ fill: "hsl(var(--brand-muted-grey))", r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Project Health */}
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl font-black text-primary flex items-center gap-2">
              <Gauge className="h-5 w-5 text-secondary" />
              Project Health
            </CardTitle>
            <CardDescription className="text-sm">
              Key risk indicators
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-center">
              <div className="relative w-40 h-40">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="80"
                    cy="80"
                    r="72"
                    stroke="hsl(var(--brand-muted-grey))"
                    strokeWidth="10"
                    fill="none"
                    opacity="0.2"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r="72"
                    stroke={healthScore > 70 ? "hsl(var(--brand-primary-light))" : healthScore > 40 ? "hsl(var(--brand-accent-orange))" : "hsl(var(--destructive))"}
                    strokeWidth="10"
                    fill="none"
                    strokeDasharray={`${(healthScore / 100) * 452} 452`}
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-black text-primary">{Math.round(healthScore)}</span>
                  <span className="text-xs font-bold text-muted-foreground uppercase">Health</span>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
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

        {/* Task Status Distribution - Horizontal Bars */}
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl font-black text-primary">Task Status Distribution</CardTitle>
            <CardDescription className="text-sm">
              Your current workload distribution
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {statusDistribution.map((item) => (
                <div key={item.status} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-foreground">{item.status}</span>
                    <span className="text-sm font-black text-primary">{item.count}</span>
                  </div>
                  <div className="h-8 bg-muted rounded-lg overflow-hidden">
                    <div 
                      className="h-full rounded-lg transition-all duration-1000" 
                      style={{ width: `${item.percentage}%`, backgroundColor: item.fill }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* My Day Section */}
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl font-black text-primary flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-secondary" />
              My Day
            </CardTitle>
            <CardDescription className="text-sm">
              Priority tasks that need your attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            {myDayTasks.length > 0 ? (
              <div className="space-y-3">
                {myDayTasks.map((task: any) => (
                  <div 
                    key={task.id}
                    className="flex items-center gap-4 p-4 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-primary/5 active:scale-[0.98] transition-all cursor-pointer"
                    onClick={() => navigate(`/tasks?task=${task.id}`)}
                  >
                    <div className={`w-4 h-4 rounded-md flex-shrink-0 ${
                      task.priority === 1 ? 'bg-destructive' : 
                      task.priority === 2 ? 'bg-accent' : 'bg-muted-foreground'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground truncate">
                        {task.title}
                      </p>
                      {task.assigned_trade && (
                        <p className="text-xs font-semibold text-muted-foreground truncate">
                          {task.assigned_trade.name}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="p-4 rounded-full bg-secondary/20 mb-3">
                  <CheckCircle2 className="h-10 w-10 text-secondary" />
                </div>
                <p className="text-lg font-bold text-primary mb-1">You are all caught up</p>
                <p className="text-sm text-muted-foreground">
                  No urgent tasks today
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Safety and Compliance */}
        <Card className="bg-secondary/5 border-secondary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl font-black text-primary flex items-center gap-2">
              <Shield className="h-5 w-5 text-secondary" />
              Safety & Compliance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-4 rounded-xl bg-card border-2 border-border">
              <span className="text-sm font-bold text-muted-foreground">Forms Due Today</span>
              <span className="text-2xl font-black text-secondary">{safetyFormsToday}</span>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-card border-2 border-border">
              <span className="text-sm font-bold text-muted-foreground">Total This Week</span>
              <span className="text-2xl font-black text-secondary">{safetyFormsThisWeek}</span>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-card border-2 border-border">
              <span className="text-sm font-bold text-muted-foreground">Incidents</span>
              <span className="text-2xl font-black text-destructive">{incidentsThisWeek}</span>
            </div>
            <Button 
              onClick={() => navigate("/safety")} 
              className="w-full h-12 text-base font-bold bg-secondary hover:bg-secondary/90"
            >
              Open Safety Dashboard
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </CardContent>
        </Card>

        {/* Blockers and Risks */}
        <Card className="bg-accent/5 border-accent/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl font-black text-primary flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-accent" />
              Blockers and Risks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {blockerTasks.length > 0 ? (
              <div className="space-y-3">
                {blockerTasks.slice(0, 5).map((task: any) => (
                  <div 
                    key={task.id}
                    className="flex items-center gap-3 p-4 rounded-xl bg-card border-2 border-border hover:border-accent/50 active:scale-[0.98] transition-all cursor-pointer"
                    onClick={() => navigate(`/tasks?task=${task.id}`)}
                  >
                    <div className="w-3 h-3 rounded-full bg-accent flex-shrink-0 animate-pulse" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground truncate">{task.title}</p>
                      {task.assigned_trade && (
                        <p className="text-xs font-semibold text-muted-foreground truncate">
                          {task.assigned_trade.name}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-accent border-accent/50 flex-shrink-0">
                      Blocked
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="p-4 rounded-full bg-secondary/20 mb-3">
                  <CheckCircle2 className="h-10 w-10 text-secondary" />
                </div>
                <p className="text-lg font-bold text-primary mb-1">No blockers right now</p>
                <p className="text-sm text-muted-foreground">
                  Great work keeping things moving
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Assistant Panel - Mobile First */}
        <Card className="bg-primary border-primary shadow-xl overflow-hidden">
          <div className="relative">
            {/* Inner glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary-foreground/5 to-transparent rounded-lg" />
            
            <CardHeader className="relative pb-3">
              <CardTitle className="text-xl font-black text-primary-foreground flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Ask AI About This Project
              </CardTitle>
              <CardDescription className="text-primary-foreground/70 text-sm">
                Get intelligent insights and answers
              </CardDescription>
            </CardHeader>
            
            <CardContent className="relative space-y-4">
              <div className="flex gap-2">
                <Textarea
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  placeholder="Ask a question about tasks, blockers, safety, or schedule"
                  className="flex-1 min-h-[48px] bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50 focus:bg-primary-foreground/15 text-base"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleAskAI(aiQuery);
                    }
                  }}
                />
                <Button
                  onClick={() => handleAskAI(aiQuery)}
                  disabled={aiLoading || !aiQuery.trim()}
                  size="icon"
                  className="h-12 w-12 rounded-full bg-accent hover:bg-accent/90 flex-shrink-0"
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>

              <ScrollArea className="w-full">
                <div className="flex gap-2 pb-2">
                  {quickPrompts.map((prompt) => (
                    <Button
                      key={prompt}
                      onClick={() => {
                        setAiQuery(prompt);
                        handleAskAI(prompt);
                      }}
                      variant="secondary"
                      size="sm"
                      className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 whitespace-nowrap text-xs font-bold rounded-full px-4 h-9"
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
              </ScrollArea>

              {aiLoading && (
                <div className="flex items-center gap-2 p-4 rounded-xl bg-primary-foreground/10">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-primary-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 rounded-full bg-primary-foreground/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 rounded-full bg-primary-foreground/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <span className="text-sm text-primary-foreground/70">Thinking...</span>
                </div>
              )}

              {aiResponse && !aiLoading && (
                <div className="p-4 rounded-xl bg-primary-foreground/10 border border-primary-foreground/20">
                  <p className="text-sm text-primary-foreground whitespace-pre-wrap leading-relaxed">
                    {aiResponse}
                  </p>
                </div>
              )}
            </CardContent>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
