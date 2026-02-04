import { useState, useEffect } from 'react';
import { Layout } from "@/components/Layout";
import { SectionHeader } from "@/components/SectionHeader";
import { EmptyState } from "@/components/EmptyState";
import { NoAccess } from "@/components/NoAccess";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LookaheadTimeline } from "@/components/lookahead/LookaheadTimeline";
import { LookaheadMobileView } from "@/components/lookahead/LookaheadMobileView";
import { CoordinationSummaryDialog } from "@/components/lookahead/CoordinationSummaryDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { DelayForecastModal } from "@/components/lookahead/DelayForecastModal";
import { TaskDetailModal } from "@/components/tasks/TaskDetailModal";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuthRole } from "@/hooks/useAuthRole";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { Calendar as CalendarIcon, Sparkles, ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";

const Lookahead = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { currentProjectId } = useCurrentProject();
  const { can, loading: roleLoading } = useAuthRole(currentProjectId || undefined);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [horizonOnly, setHorizonOnly] = useState(false);
  const [startDate, setStartDate] = useState(new Date());
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(currentProjectId);
  const [forecastModalOpen, setForecastModalOpen] = useState(false);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastData, setForecastData] = useState<any>(null);
  const [delayedTaskIds, setDelayedTaskIds] = useState<string[]>([]);

  // Sync selectedProjectId with currentProjectId from URL
  useEffect(() => {
    if (currentProjectId && currentProjectId !== selectedProjectId) {
      setSelectedProjectId(currentProjectId);
    }
  }, [currentProjectId]);

  useEffect(() => {
    // Fetch projects
    const fetchProjects = async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, name')
        .eq('is_deleted', false)
        .order('name');
      
      setProjects(data || []);
      // Only set default if no project selected and none from URL
      if (!selectedProjectId && data && data.length > 0) {
        setSelectedProjectId(data[0].id);
      }
    };
    fetchProjects();
  }, []);

  // Check if user has permission to view lookahead
  const canViewLookahead = selectedProjectId ? can('view_lookahead', selectedProjectId) : false;

  useEffect(() => {
    if (!selectedProjectId) return;
    fetchTasks();

    // Set up real-time subscription
    const channel = supabase
      .channel('lookahead-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
        },
        () => {
          fetchTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [startDate, horizonOnly, selectedProjectId]);

  const fetchTasks = async () => {
    if (!selectedProjectId) return;

    try {
      setLoading(true);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 13);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      let query = supabase
        .from('tasks')
        .select(`
          *,
          trades(name, trade_type, company_name),
          projects(name)
        `)
        .eq('project_id', selectedProjectId)
        .eq('is_deleted', false);

      // Query tasks that overlap with the 14-day window
      // Use start_date/end_date if available, fallback to due_date
      query = query.or(`and(start_date.lte.${endDateStr},end_date.gte.${startDateStr}),and(start_date.is.null,end_date.is.null,due_date.gte.${startDateStr},due_date.lte.${endDateStr})`);

      const { data, error } = await query;

      if (error) throw error;

      // Fetch blocker counts for each task
      if (data && data.length > 0) {
        const taskIds = data.map(t => t.id);
        const { data: blockers } = await supabase
          .from('blockers')
          .select('task_id')
          .in('task_id', taskIds)
          .eq('is_resolved', false);

        const blockerCounts = blockers?.reduce((acc, b) => {
          acc[b.task_id] = (acc[b.task_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {};

        let tasksWithBlockers = data.map(task => ({
          ...task,
          _blockerCount: blockerCounts[task.id] || 0,
        }));

        // Apply Horizon Only filter
        if (horizonOnly) {
          tasksWithBlockers = tasksWithBlockers.filter(
            task => task.trades?.company_name?.toLowerCase().includes('horizon')
          );
        }

        setTasks(tasksWithBlockers);
      } else {
        setTasks([]);
      }
    } catch (error: any) {
      toast({
        title: 'Error loading tasks',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!selectedProjectId) return;

    setSummaryLoading(true);
    setSummaryOpen(true);
    setSummary(null);

    try {
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 13);

      const { data, error } = await supabase.functions.invoke('coordination-summary', {
        body: {
          projectId: selectedProjectId,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast({
          title: 'AI Summary Error',
          description: data.error,
          variant: 'destructive',
        });
        setSummaryOpen(false);
      } else {
        setSummary(data.summary);
      }
    } catch (error: any) {
      toast({
        title: 'Error generating summary',
        description: error.message,
        variant: 'destructive',
      });
      setSummaryOpen(false);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleForecastDelay = async () => {
    if (!selectedProjectId) return;

    setForecastLoading(true);
    setForecastModalOpen(true);
    setForecastData(null);

    try {
      const { data, error } = await supabase.functions.invoke('forecast-delay', {
        body: {
          projectId: selectedProjectId,
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast({
          title: 'Forecast Error',
          description: data.error,
          variant: 'destructive',
        });
        setForecastModalOpen(false);
      } else {
        setForecastData(data.forecast);
        // Extract delayed task IDs for warning indicators
        if (data.forecast?.delayed_tasks) {
          const ids = data.forecast.delayed_tasks.map((t: any) => t.task_id);
          setDelayedTaskIds(ids);
        }
      }
    } catch (error: any) {
      toast({
        title: 'Error forecasting delays',
        description: error.message,
        variant: 'destructive',
      });
      setForecastModalOpen(false);
    } finally {
      setForecastLoading(false);
    }
  };

  const previousWeek = () => {
    const newDate = new Date(startDate);
    newDate.setDate(newDate.getDate() - 7);
    setStartDate(newDate);
  };

  const nextWeek = () => {
    const newDate = new Date(startDate);
    newDate.setDate(newDate.getDate() + 7);
    setStartDate(newDate);
  };

  const goToToday = () => {
    setStartDate(new Date());
  };

  if (loading && !tasks.length) {
    return (
      <Layout>
        <div className="container max-w-6xl mx-auto px-4 py-6">
          <Skeleton className="h-12 w-64 mb-6" />
          <Skeleton className="h-96" />
        </div>
      </Layout>
    );
  }

  // Show NoAccess for workers
  if (!roleLoading && selectedProjectId && !canViewLookahead) {
    return (
      <Layout>
        <NoAccess 
          title="Lookahead Access Restricted"
          message="Only Project Managers and Foremen can view the 2-Week Lookahead schedule."
          returnPath="/tasks"
          returnLabel="Back to My Tasks"
        />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container max-w-6xl mx-auto px-4 py-6">
        <SectionHeader
          title="2-Week Lookahead"
          subtitle={`${startDate.toLocaleDateString()} - ${new Date(startDate.getTime() + 13 * 24 * 60 * 60 * 1000).toLocaleDateString()}`}
        />

        {/* Controls */}
        <div className="flex flex-col gap-4 mb-6 p-4 bg-card rounded-lg border border-border">
          {/* Top row: Project + Date Nav */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Project Selector */}
            <Select value={selectedProjectId || undefined} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="w-full sm:w-[240px] font-semibold">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date Navigation */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={previousWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={goToToday} className="flex-1 sm:flex-none">
                Today
              </Button>
              <Button variant="outline" size="icon" onClick={nextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Horizon Only Toggle */}
            <div className="flex items-center space-x-2 sm:pl-4 sm:border-l sm:border-border">
              <Switch
                id="horizon-only"
                checked={horizonOnly}
                onCheckedChange={setHorizonOnly}
              />
              <Label htmlFor="horizon-only" className="cursor-pointer font-medium text-sm">
                Horizon Only
              </Label>
            </div>
          </div>

          {/* AI Buttons - Only for PM/Foreman */}
          {canViewLookahead && (
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={handleForecastDelay}
                disabled={tasks.length === 0}
                variant="outline"
                className="font-semibold flex-1 sm:flex-none"
                size="lg"
              >
                <TrendingUp className="h-5 w-5 mr-2" />
                <span className="hidden sm:inline">Forecast Schedule Impact</span>
                <span className="sm:hidden">Forecast</span>
              </Button>
              <Button
                onClick={handleGenerateSummary}
                disabled={tasks.length === 0}
                className="bg-primary hover:bg-primary/90 font-semibold flex-1 sm:flex-none"
                size="lg"
              >
                <Sparkles className="h-5 w-5 mr-2" />
                <span className="hidden sm:inline">Coordination Summary</span>
                <span className="sm:hidden">Summary</span>
              </Button>
            </div>
          )}
        </div>

        {/* Timeline - Desktop vs Mobile */}
        {tasks.length === 0 ? (
          <EmptyState
            icon={<CalendarIcon className="h-8 w-8" />}
            title="No tasks scheduled"
            description="Schedule tasks for the next 2 weeks to view your lookahead."
          />
        ) : isMobile ? (
          <LookaheadMobileView
            tasks={tasks}
            startDate={startDate}
            delayedTaskIds={delayedTaskIds}
            onTaskClick={(taskId) => {
              setSelectedTaskId(taskId);
              setDetailModalOpen(true);
            }}
          />
        ) : (
          <LookaheadTimeline
            tasks={tasks}
            startDate={startDate}
            delayedTaskIds={delayedTaskIds}
            onTaskClick={(taskId) => {
              setSelectedTaskId(taskId);
              setDetailModalOpen(true);
            }}
          />
        )}

        {/* Modals */}
        <CoordinationSummaryDialog
          open={summaryOpen}
          onOpenChange={setSummaryOpen}
          summary={summary}
          loading={summaryLoading}
          onTaskClick={(taskId) => {
            setSelectedTaskId(taskId);
            setDetailModalOpen(true);
            setSummaryOpen(false);
          }}
        />

        <DelayForecastModal
          isOpen={forecastModalOpen}
          onClose={() => setForecastModalOpen(false)}
          forecast={forecastData}
          isLoading={forecastLoading}
        />

        <TaskDetailModal
          taskId={selectedTaskId}
          open={detailModalOpen}
          onOpenChange={setDetailModalOpen}
          onTaskUpdated={fetchTasks}
        />
      </div>
    </Layout>
  );
};

export default Lookahead;
