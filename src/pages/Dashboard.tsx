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
} from "lucide-react";
import { format, isAfter, isBefore, addDays, startOfDay } from "date-fns";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentProjectId } = useCurrentProject();
  const { currentProjectRole, isPM, isForeman, isWorker } = useAuthRole(currentProjectId || undefined);
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const today = startOfDay(new Date());
  const nextWeek = addDays(today, 7);

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
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
              Today on Site
            </h1>
            <p className="text-base md:text-lg text-muted-foreground mt-1">
              See what needs attention, where you are blocked, and how your project is trending
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={() => navigate("/projects")} variant="default" className="w-full sm:w-auto">
              View Projects
            </Button>
            <Button onClick={() => navigate("/tasks")} variant="outline" className="w-full sm:w-auto">
              Go to Tasks
            </Button>
          </div>
        </div>

        {/* Key Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate("/tasks")}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Open Tasks</p>
                  <p className="text-3xl md:text-4xl font-bold text-foreground mt-2">{openTasks}</p>
                </div>
                <Clock className="h-10 w-10 text-primary opacity-20" />
              </div>
              <div className="flex items-center gap-1 mt-3">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Active</span>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:border-destructive/50 transition-colors cursor-pointer border-destructive/20" onClick={() => navigate("/tasks?filter=blocked")}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Blocked Tasks</p>
                  <p className="text-3xl md:text-4xl font-bold text-destructive mt-2">{blockedTasks}</p>
                </div>
                <AlertTriangle className="h-10 w-10 text-destructive opacity-20" />
              </div>
              <div className="flex items-center gap-1 mt-3">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-xs text-destructive">Needs attention</span>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate("/tasks")}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Upcoming This Week</p>
                  <p className="text-3xl md:text-4xl font-bold text-foreground mt-2">{upcomingTasks}</p>
                </div>
                <Calendar className="h-10 w-10 text-primary opacity-20" />
              </div>
              <div className="flex items-center gap-1 mt-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Next 7 days</span>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate("/safety")}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Safety Forms Today</p>
                  <p className="text-3xl md:text-4xl font-bold text-foreground mt-2">{safetyFormsToday}</p>
                </div>
                <Shield className="h-10 w-10 text-primary opacity-20" />
              </div>
              <div className="flex items-center gap-1 mt-3">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-xs text-muted-foreground">Submitted</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Spans 2 cols on desktop */}
          <div className="lg:col-span-2 space-y-6">
            {/* My Day Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>My Day</span>
                  <Badge variant="secondary">{myDayTasks.length}</Badge>
                </CardTitle>
                <CardDescription>
                  Most important items for today
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {myDayTasks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
                    <p className="text-sm">All caught up! No urgent tasks today.</p>
                  </div>
                ) : (
                  <>
                    {myDayTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-start justify-between p-4 rounded-lg border hover:border-primary/50 transition-colors cursor-pointer"
                        onClick={() => navigate("/tasks")}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-foreground truncate">{task.title}</p>
                            {task.blockers?.some((b: any) => !b.is_resolved) && (
                              <Badge variant="destructive" className="text-xs">Blocked</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
                            {task.assigned_trade && (
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {task.assigned_trade.name}
                              </span>
                            )}
                            {task.due_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(task.due_date), "MMM d")}
                              </span>
                            )}
                            <Badge variant={task.status === "in_progress" ? "default" : "secondary"} className="text-xs">
                              {task.status.replace("_", " ")}
                            </Badge>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 ml-2" />
                      </div>
                    ))}
                    <Button variant="link" onClick={() => navigate("/tasks")} className="w-full">
                      View all tasks <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Blockers and Risks */}
            <Card className="border-destructive/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Blockers and Risks
                </CardTitle>
                <CardDescription>
                  Tasks that need immediate attention
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {blockerTasks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
                    <p className="text-sm">No blocked tasks. Great work!</p>
                  </div>
                ) : (
                  <>
                    {blockerTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-start justify-between p-4 rounded-lg border border-destructive/20 bg-destructive/5 hover:border-destructive/50 transition-colors cursor-pointer"
                        onClick={() => navigate("/tasks")}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground">{task.title}</p>
                          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
                            {task.assigned_trade && (
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {task.assigned_trade.name}
                              </span>
                            )}
                            <Badge variant="destructive" className="text-xs">
                              Blocked
                            </Badge>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 ml-2" />
                      </div>
                    ))}
                    <Button variant="link" onClick={() => navigate("/tasks?filter=blocked")} className="w-full text-destructive">
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
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Safety & Compliance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Forms Today</span>
                      <span className="text-2xl font-bold text-foreground">{safetyFormsToday}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total This Week</span>
                      <span className="text-lg font-semibold text-foreground">{safetyForms?.length || 0}</span>
                    </div>
                  </div>
                  {manpowerRequests && manpowerRequests.length > 0 && (
                    <div className="pt-3 border-t">
                      <p className="text-sm font-medium text-foreground mb-2">Pending Requests</p>
                      <Badge variant="secondary">{manpowerRequests.length} manpower requests</Badge>
                    </div>
                  )}
                  <Button onClick={() => navigate("/safety")} variant="outline" className="w-full mt-4">
                    Open Safety
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* AI Assistant Panel */}
            <Card className="border-primary/20 bg-gradient-to-br from-background to-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Ask AI About This Project
                </CardTitle>
                <CardDescription>
                  Get intelligent insights and answers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
                    className="flex-1"
                  />
                  <Button 
                    onClick={() => handleAskAI(aiQuery)} 
                    disabled={aiLoading || !aiQuery.trim()}
                    size="icon"
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
                      className="text-xs"
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>

                {aiResponse && (
                  <div className="p-4 rounded-lg bg-muted/50 border">
                    <p className="text-sm text-foreground whitespace-pre-wrap">{aiResponse}</p>
                  </div>
                )}

                {aiLoading && (
                  <div className="p-4 rounded-lg bg-muted/50 border text-center">
                    <div className="animate-pulse text-sm text-muted-foreground">
                      Analyzing project data...
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
