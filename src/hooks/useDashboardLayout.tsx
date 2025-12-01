import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface DashboardWidget {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

const DEFAULT_LAYOUT: DashboardWidget[] = [
  { i: 'metrics', x: 0, y: 0, w: 12, h: 2, minH: 2, minW: 6 },
  { i: 'activity', x: 0, y: 2, w: 6, h: 4, minH: 3, minW: 4 },
  { i: 'health', x: 6, y: 2, w: 6, h: 4, minH: 3, minW: 4 },
  { i: 'distribution', x: 0, y: 6, w: 12, h: 3, minH: 2, minW: 6 },
  { i: 'myday', x: 0, y: 9, w: 8, h: 5, minH: 4, minW: 6 },
  { i: 'safety', x: 8, y: 9, w: 4, h: 5, minH: 4, minW: 3 },
  { i: 'blockers', x: 0, y: 14, w: 12, h: 4, minH: 3, minW: 6 },
  { i: 'ai', x: 0, y: 18, w: 12, h: 5, minH: 4, minW: 6 },
];

export const useDashboardLayout = (projectId: string | null) => {
  const { user } = useAuth();
  const [layout, setLayout] = useState<DashboardWidget[]>(DEFAULT_LAYOUT);
  const [hiddenWidgets, setHiddenWidgets] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    if (user?.id && projectId) {
      loadLayout();
    } else {
      setLayout(DEFAULT_LAYOUT);
      setHiddenWidgets([]);
      setIsLoading(false);
    }
  }, [user?.id, projectId]);

  const loadLayout = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('dashboard_layouts')
        .select('layout, hidden_widgets')
        .eq('user_id', user!.id)
        .eq('project_id', projectId!)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setLayout(JSON.parse(JSON.stringify(data.layout)) as DashboardWidget[]);
        setHiddenWidgets(data.hidden_widgets || []);
      } else {
        setLayout(DEFAULT_LAYOUT);
        setHiddenWidgets([]);
      }
    } catch (error) {
      console.error('Error loading dashboard layout:', error);
      setLayout(DEFAULT_LAYOUT);
      setHiddenWidgets([]);
    } finally {
      setIsLoading(false);
    }
  };

  const saveLayout = async (newLayout: DashboardWidget[], newHiddenWidgets?: string[]) => {
    if (!user?.id || !projectId) return;

    try {
      const { error } = await supabase
        .from('dashboard_layouts')
        .upsert({
          user_id: user.id,
          project_id: projectId,
          layout: JSON.parse(JSON.stringify(newLayout)),
          hidden_widgets: newHiddenWidgets || hiddenWidgets,
          updated_at: new Date().toISOString(),
        } as any);

      if (error) throw error;

      setLayout(newLayout);
      if (newHiddenWidgets) {
        setHiddenWidgets(newHiddenWidgets);
      }
      toast.success('Dashboard layout saved');
    } catch (error) {
      console.error('Error saving dashboard layout:', error);
      toast.error('Failed to save dashboard layout');
    }
  };

  const resetLayout = async () => {
    if (!user?.id || !projectId) return;

    try {
      const { error } = await supabase
        .from('dashboard_layouts')
        .delete()
        .eq('user_id', user.id)
        .eq('project_id', projectId);

      if (error) throw error;

      setLayout(DEFAULT_LAYOUT);
      setHiddenWidgets([]);
      toast.success('Dashboard layout reset to default');
    } catch (error) {
      console.error('Error resetting dashboard layout:', error);
      toast.error('Failed to reset dashboard layout');
    }
  };

  const toggleWidget = (widgetId: string) => {
    const newHiddenWidgets = hiddenWidgets.includes(widgetId)
      ? hiddenWidgets.filter(id => id !== widgetId)
      : [...hiddenWidgets, widgetId];
    
    setHiddenWidgets(newHiddenWidgets);
    saveLayout(layout, newHiddenWidgets);
  };

  const updateLayout = (newLayout: DashboardWidget[]) => {
    setLayout(newLayout);
  };

  return {
    layout,
    hiddenWidgets,
    isLoading,
    isEditMode,
    setIsEditMode,
    saveLayout,
    resetLayout,
    toggleWidget,
    updateLayout,
  };
};
