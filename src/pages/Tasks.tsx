import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from "@/components/Layout";
import { SectionHeader } from "@/components/SectionHeader";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { TaskFilters, TaskFilters as TaskFiltersType } from "@/components/tasks/TaskFilters";
import { TaskListView } from "@/components/tasks/TaskListView";
import { TaskKanbanView } from "@/components/tasks/TaskKanbanView";
import { TaskCalendarView } from "@/components/tasks/TaskCalendarView";
import { TaskDetailView } from "@/components/tasks/TaskDetailView";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { VoiceToTaskModal } from "@/components/tasks/VoiceToTaskModal";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuthRole } from "@/hooks/useAuthRole";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { Plus, LayoutList, LayoutGrid, Calendar as CalendarIcon, CheckSquare, Mic } from "lucide-react";

type ViewMode = 'list' | 'kanban' | 'calendar';

const Tasks = () => {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentProjectId } = useCurrentProject();
  const { can, isWorker, loading: roleLoading } = useAuthRole(currentProjectId || undefined);
  const [tasks, setTasks] = useState<any[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [initialFilters, setInitialFilters] = useState<TaskFiltersType | null>(null);

  // Permission checks - allow task creation if user can create in current project or is PM/Admin globally
  const canCreateTasks = can('create_tasks', currentProjectId || undefined);
  const showLimitedView = isWorker(currentProjectId || undefined);

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          trades(name, trade_type, company_name),
          projects(name),
          task_assignments(id, user_id, profiles(id, full_name, avatar_url, email))
        `)
        .eq('is_deleted', false)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
      setFilteredTasks(data || []);
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

  // Read URL params for initial filters and task detail
  useEffect(() => {
    const statusParam = searchParams.get('status');
    const dateRangeParam = searchParams.get('dateRange') as 'all' | 'today' | 'week' | 'overdue' | null;
    const tradeIdParam = searchParams.get('tradeId');
    const taskIdParam = searchParams.get('taskId');

    // Set initial filters from URL
    if (statusParam || dateRangeParam || tradeIdParam) {
      setInitialFilters({
        status: statusParam || undefined,
        dateRange: dateRangeParam || undefined,
        tradeId: tradeIdParam || undefined,
      });
    }

    // Open task detail modal if taskId is in URL
    if (taskIdParam) {
      setSelectedTaskId(taskIdParam);
      setDetailModalOpen(true);
      // Clear taskId from URL after opening modal
      searchParams.delete('taskId');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams]);

  useEffect(() => {
    fetchTasks();

    // Set up real-time subscription
    const channel = supabase
      .channel('tasks-changes')
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
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_assignments',
        },
        () => {
          fetchTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Apply initial filters once tasks are loaded
  useEffect(() => {
    if (tasks.length > 0 && initialFilters) {
      handleFilterChange(initialFilters);
      setInitialFilters(null);
    }
  }, [tasks, initialFilters]);

  const handleFilterChange = (filters: TaskFiltersType) => {
    let filtered = [...tasks];

    // Filter by status
    if (filters.status) {
      filtered = filtered.filter(task => task.status === filters.status);
    }

    // Filter by date range
    if (filters.dateRange && filters.dateRange !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (filters.dateRange === 'today') {
        filtered = filtered.filter(task => {
          if (!task.due_date) return false;
          const dueDate = new Date(task.due_date);
          dueDate.setHours(0, 0, 0, 0);
          return dueDate.getTime() === today.getTime();
        });
      } else if (filters.dateRange === 'week') {
        const weekFromNow = new Date(today);
        weekFromNow.setDate(weekFromNow.getDate() + 7);
        filtered = filtered.filter(task => {
          if (!task.due_date) return false;
          const dueDate = new Date(task.due_date);
          return dueDate >= today && dueDate <= weekFromNow;
        });
      } else if (filters.dateRange === 'overdue') {
        filtered = filtered.filter(task => {
          if (!task.due_date || task.status === 'done') return false;
          return new Date(task.due_date) < today;
        });
      }
    }

    setFilteredTasks(filtered);
  };

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId);
    setDetailModalOpen(true);
  };

  if (loading || roleLoading) {
    return (
      <Layout>
        <div className="container max-w-6xl mx-auto px-4 py-6">
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-5 w-64 mb-6" />
          <div className="space-y-3">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container max-w-6xl mx-auto px-4 py-6">
        <SectionHeader
          title={showLimitedView ? "My Tasks" : "Tasks"}
          count={filteredTasks.length}
          action={canCreateTasks ? {
            label: "Add Task",
            icon: <Plus className="h-6 w-6" />,
            onClick: () => setCreateModalOpen(true),
          } : undefined}
          secondaryAction={canCreateTasks ? {
            label: "Voice to Task",
            icon: <Mic className="h-6 w-6" />,
            onClick: () => {
              if (tasks.length > 0) {
                setSelectedProjectId(tasks[0].project_id);
                setVoiceModalOpen(true);
              } else {
                toast({
                  title: "No project available",
                  description: "Please create a project first.",
                  variant: "destructive",
                });
              }
            },
          } : undefined}
        />

        {tasks.length === 0 ? (
          <EmptyState
            icon={<CheckSquare className="h-8 w-8" />}
            title="No tasks yet"
            description={showLimitedView ? "You have no assigned tasks yet." : "Create your first task to start coordinating work."}
            action={canCreateTasks ? {
              label: "Create Task",
              onClick: () => setCreateModalOpen(true),
            } : undefined}
          />
        ) : (
          <>
            {/* View Switcher */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-1 sm:gap-2">
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="px-2 sm:px-3"
                >
                  <LayoutList className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">List</span>
                </Button>
                <Button
                  variant={viewMode === 'kanban' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('kanban')}
                  className="px-2 sm:px-3"
                >
                  <LayoutGrid className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Kanban</span>
                </Button>
                <Button
                  variant={viewMode === 'calendar' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('calendar')}
                  className="px-2 sm:px-3"
                >
                  <CalendarIcon className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Calendar</span>
                </Button>
              </div>
            </div>

            {/* Filters (only show for list and kanban views) */}
            {viewMode !== 'calendar' && (
              <TaskFilters onFilterChange={handleFilterChange} />
            )}

            {/* Task Views */}
            <div className="mt-6">
              {viewMode === 'list' && (
                <TaskListView 
                  tasks={filteredTasks} 
                  onTaskClick={handleTaskClick} 
                  canReorder={canCreateTasks}
                  onTasksReordered={() => fetchTasks()}
                  onTaskStatusChanged={() => fetchTasks()}
                />
              )}
              {viewMode === 'kanban' && (
                <TaskKanbanView tasks={filteredTasks} onTaskClick={handleTaskClick} />
              )}
              {viewMode === 'calendar' && (
                <TaskCalendarView tasks={tasks} onTaskClick={handleTaskClick} />
              )}
            </div>

            {filteredTasks.length === 0 && viewMode !== 'calendar' && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No tasks match your filters</p>
              </div>
            )}
          </>
        )}

        <CreateTaskModal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
          onSuccess={fetchTasks}
        />

        <VoiceToTaskModal
          isOpen={voiceModalOpen}
          onClose={() => setVoiceModalOpen(false)}
          onTaskCreated={fetchTasks}
          projectId={selectedProjectId}
        />

        <TaskDetailView
          taskId={selectedTaskId}
          open={detailModalOpen}
          onOpenChange={setDetailModalOpen}
          onTaskUpdated={fetchTasks}
        />
      </div>
    </Layout>
  );
};

export default Tasks;
