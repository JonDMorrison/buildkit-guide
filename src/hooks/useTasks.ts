import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useTasks(projectId?: string | null) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = async () => {
    try {
      let query = supabase
        .from('tasks')
        .select('*')
        .eq('is_deleted', false);

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      setTasks(data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();

    const channel = supabase
      .channel('task-assignments-sync')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'task_assignments'
      }, () => {
        fetchTasks();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [projectId]);

  return { tasks, loading, refetch: fetchTasks };
}
