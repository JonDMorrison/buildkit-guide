import { useState } from "react";
import { Layout } from "@/components/Layout";
import { SectionHeader } from "@/components/SectionHeader";
import { useHoursTracking, TaskHours, TradeHours } from "@/hooks/useHoursTracking";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  CheckCircle2,
  BarChart3,
  Users,
  ClipboardList
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

const HoursTracking = () => {
  const { currentProjectId } = useCurrentProject();
  const [selectedProject, setSelectedProject] = useState<string>(currentProjectId || "all");
  const [projects, setProjects] = useState<any[]>([]);

  const { data, isLoading } = useHoursTracking(
    selectedProject === "all" ? undefined : selectedProject
  );

  useEffect(() => {
    const fetchProjects = async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, name')
        .eq('is_deleted', false)
        .order('name');
      setProjects(data || []);
    };
    fetchProjects();
  }, []);

  if (isLoading) {
    return (
      <Layout>
        <div className="container max-w-6xl mx-auto px-4 py-6">
          <Skeleton className="h-12 w-64 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </Layout>
    );
  }

  const stats = data || {
    totalBudgetedHours: 0,
    totalActualHours: 0,
    variance: 0,
    percentComplete: 0,
    byTrade: [],
    byTask: [],
    byScopeItem: [],
  };

  const isOverBudget = stats.variance < 0;
  const isNearBudget = stats.variance >= 0 && stats.percentComplete >= 80;

  return (
    <Layout>
      <div className="container max-w-6xl mx-auto px-4 py-6">
        <SectionHeader title="Hours Tracking" />

        {/* Project Filter */}
        <div className="mb-6">
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-full md:w-[280px]">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          <SummaryCard
            icon={Clock}
            label="Budget"
            value={`${stats.totalBudgetedHours.toFixed(1)}h`}
            variant="default"
          />
          <SummaryCard
            icon={BarChart3}
            label="Actual"
            value={`${stats.totalActualHours.toFixed(1)}h`}
            variant="default"
          />
          <SummaryCard
            icon={isOverBudget ? TrendingDown : TrendingUp}
            label="Variance"
            value={`${isOverBudget ? "" : "+"}${stats.variance.toFixed(1)}h`}
            variant={isOverBudget ? "danger" : "success"}
          />
          <SummaryCard
            icon={isOverBudget ? AlertCircle : CheckCircle2}
            label="% Complete"
            value={`${stats.percentComplete.toFixed(0)}%`}
            variant={isOverBudget ? "danger" : isNearBudget ? "warning" : "success"}
          />
        </div>

        {/* Progress Overview */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Overall Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {stats.totalActualHours.toFixed(1)} of {stats.totalBudgetedHours.toFixed(1)} hours used
                </span>
                <span className={cn(
                  "text-sm font-semibold",
                  isOverBudget ? "text-destructive" : "text-foreground"
                )}>
                  {stats.percentComplete.toFixed(1)}%
                </span>
              </div>
              <Progress 
                value={Math.min(stats.percentComplete, 100)} 
                className={cn(
                  "h-4",
                  isOverBudget && "[&>div]:bg-destructive"
                )}
              />
              {isOverBudget && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  Over budget by {Math.abs(stats.variance).toFixed(1)} hours
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Detailed Breakdown */}
        <Tabs defaultValue="tasks">
          <TabsList className="mb-4">
            <TabsTrigger value="tasks" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              By Task
            </TabsTrigger>
            <TabsTrigger value="trades" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              By Trade
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks">
            <Card>
              <CardContent className="pt-6">
                {stats.byTask.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No tasks with budgeted hours found.</p>
                    <p className="text-sm mt-1">Add budgeted hours to tasks to track progress.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {stats.byTask.map((task: TaskHours) => (
                      <TaskRow key={task.taskId} task={task} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trades">
            <Card>
              <CardContent className="pt-6">
                {stats.byTrade.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No trade data available.</p>
                    <p className="text-sm mt-1">Assign trades to tasks to see breakdown.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {stats.byTrade.map((trade: TradeHours) => (
                      <TradeRow key={trade.tradeId} trade={trade} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

interface SummaryCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  variant: "default" | "success" | "warning" | "danger";
}

function SummaryCard({ icon: Icon, label, value, variant }: SummaryCardProps) {
  const colors = {
    default: "bg-card border-border",
    success: "bg-status-complete/5 border-status-complete/20",
    warning: "bg-accent/5 border-accent/20",
    danger: "bg-destructive/5 border-destructive/20",
  };

  const iconColors = {
    default: "text-primary bg-primary/10",
    success: "text-status-complete bg-status-complete/10",
    warning: "text-accent bg-accent/10",
    danger: "text-destructive bg-destructive/10",
  };

  const valueColors = {
    default: "text-foreground",
    success: "text-status-complete",
    warning: "text-accent",
    danger: "text-destructive",
  };

  return (
    <Card className={cn("border", colors[variant])}>
      <CardContent className="p-4">
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center mb-3", iconColors[variant])}>
          <Icon className="h-5 w-5" />
        </div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
        <p className={cn("text-2xl font-bold tabular-nums", valueColors[variant])}>{value}</p>
      </CardContent>
    </Card>
  );
}

function TaskRow({ task }: { task: TaskHours }) {
  const isOver = task.variance < 0;
  const statusColors: Record<string, string> = {
    not_started: "bg-muted text-muted-foreground",
    in_progress: "bg-primary/10 text-primary",
    in_review: "bg-accent/10 text-accent",
    complete: "bg-status-complete/10 text-status-complete",
  };

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-medium">{task.taskName}</h4>
          <Badge variant="secondary" className={cn("mt-1", statusColors[task.status])}>
            {task.status.replace('_', ' ')}
          </Badge>
        </div>
        <div className="text-right">
          <p className={cn("font-semibold", isOver ? "text-destructive" : "text-foreground")}>
            {task.actual.toFixed(1)} / {task.budgeted.toFixed(1)}h
          </p>
          <p className={cn("text-sm", isOver ? "text-destructive" : "text-muted-foreground")}>
            {isOver ? "" : "+"}{task.variance.toFixed(1)}h remaining
          </p>
        </div>
      </div>
      <Progress 
        value={task.percentComplete} 
        className={cn("h-2", isOver && "[&>div]:bg-destructive")}
      />
    </div>
  );
}

function TradeRow({ trade }: { trade: TradeHours }) {
  const isOver = trade.variance < 0;

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <h4 className="font-medium">{trade.tradeName}</h4>
        <div className="text-right">
          <p className={cn("font-semibold", isOver ? "text-destructive" : "text-foreground")}>
            {trade.actual.toFixed(1)} / {trade.budgeted.toFixed(1)}h
          </p>
          <p className={cn("text-sm", isOver ? "text-destructive" : "text-muted-foreground")}>
            {trade.percentComplete.toFixed(0)}% used
          </p>
        </div>
      </div>
      <Progress 
        value={trade.percentComplete} 
        className={cn("h-2", isOver && "[&>div]:bg-destructive")}
      />
    </div>
  );
}

export default HoursTracking;
