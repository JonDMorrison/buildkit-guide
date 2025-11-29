import { useState, useEffect } from 'react';
import { Layout } from "@/components/Layout";
import { SectionHeader } from "@/components/SectionHeader";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { LookaheadTimeline } from "@/components/lookahead/LookaheadTimeline";
import { CoordinationSummaryDialog } from "@/components/lookahead/CoordinationSummaryDialog";
import { DelayForecastModal } from "@/components/lookahead/DelayForecastModal";
import { TaskDetailModal } from "@/components/tasks/TaskDetailModal";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Calendar as CalendarIcon, Sparkles, ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";

const Lookahead = () => {
  const { toast } = useToast();
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
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [forecastModalOpen, setForecastModalOpen] = useState(false);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastData, setForecastData] = useState<any>(null);

  useEffect(() => {
    // Fetch projects
    const fetchProjects = async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, name')
        .eq('is_deleted', false)
        .order('name');
      
      setProjects(data || []);
      if (data && data.length > 0) {
        setSelectedProjectId(data[0].id);
      }
    };
    fetchProjects();
  }, []);

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

      let query = supabase
        .from('tasks')
        .select(`
          *,
          trades(name, trade_type, company_name),
          projects(name)
        `)
        .eq('project_id', selectedProjectId)
        .eq('is_deleted', false)
        .gte('due_date', startDate.toISOString().split('T')[0])
        .lte('due_date', endDate.toISOString().split('T')[0])
        .order('due_date');

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

        const tasksWithBlockers = data.map(task => ({
          ...task,
          _blockerCount: blockerCounts[task.id] || 0,
        }));

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

  return (
    <Layout>
      <div className="container max-w-6xl mx-auto px-4 py-6">
        <SectionHeader
          title="2-Week Lookahead"
          subtitle={`${startDate.toLocaleDateString()} - ${new Date(startDate.getTime() + 13 * 24 * 60 * 60 * 1000).toLocaleDateString()}`}
        />

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 p-4 bg-card rounded-lg border border-border">
          <div className="flex items-center gap-4">
            {/* Date Navigation */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={previousWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={goToToday}>
                Today
              </Button>
              <Button variant="outline" size="icon" onClick={nextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Horizon Only Toggle */}
            <div className="flex items-center space-x-2 pl-4 border-l border-border">
              <Switch
                id="horizon-only"
                checked={horizonOnly}
                onCheckedChange={setHorizonOnly}
              />
              <Label htmlFor="horizon-only" className="cursor-pointer font-medium">
                Horizon Only
              </Label>
            </div>
          </div>

          {/* AI Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleForecastDelay}
              disabled={tasks.length === 0}
              variant="outline"
              className="font-semibold"
              size="lg"
            >
              <TrendingUp className="h-5 w-5 mr-2" />
              Forecast Schedule Impact
            </Button>
            <Button
              onClick={handleGenerateSummary}
              disabled={tasks.length === 0}
              className="bg-primary hover:bg-primary/90 font-semibold"
              size="lg"
            >
              <Sparkles className="h-5 w-5 mr-2" />
              Coordination Summary
            </Button>
          </div>
        </div>

        {/* Timeline */}
        {tasks.length === 0 ? (
          <EmptyState
            icon={<CalendarIcon className="h-8 w-8" />}
            title="No tasks scheduled"
            description="Schedule tasks for the next 2 weeks to view your lookahead."
          />
        ) : (
          <LookaheadTimeline
            tasks={tasks}
            startDate={startDate}
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
