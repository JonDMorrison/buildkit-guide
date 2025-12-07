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

export interface ResponsiveLayouts {
  lg: DashboardWidget[];
  md: DashboardWidget[];
  sm: DashboardWidget[];
}

// Desktop layout (lg: 1200px+, 12 cols)
const LAYOUT_LG: DashboardWidget[] = [
  { i: 'metrics', x: 0, y: 0, w: 12, h: 2, minH: 2, maxH: 3, minW: 8 },
  { i: 'activity', x: 0, y: 2, w: 6, h: 4, minH: 3, maxH: 5, minW: 4 },
  { i: 'health', x: 6, y: 2, w: 3, h: 4, minH: 3, maxH: 5, minW: 3 },
  { i: 'distribution', x: 9, y: 2, w: 3, h: 4, minH: 3, maxH: 5, minW: 3 },
  { i: 'myday', x: 0, y: 6, w: 4, h: 4, minH: 3, maxH: 5, minW: 3 },
  { i: 'blockers', x: 4, y: 6, w: 4, h: 4, minH: 3, maxH: 5, minW: 3 },
  { i: 'safety', x: 8, y: 6, w: 4, h: 4, minH: 3, maxH: 5, minW: 3 },
  { i: 'workload', x: 0, y: 10, w: 4, h: 4, minH: 3, maxH: 5, minW: 3 },
  { i: 'ai', x: 4, y: 10, w: 8, h: 4, minH: 3, maxH: 6, minW: 6 },
];

// Tablet layout (md: 768-1199px, 8 cols)
const LAYOUT_MD: DashboardWidget[] = [
  { i: 'metrics', x: 0, y: 0, w: 8, h: 3, minH: 2, maxH: 4, minW: 6 },
  { i: 'activity', x: 0, y: 3, w: 4, h: 4, minH: 3, maxH: 5, minW: 4 },
  { i: 'health', x: 4, y: 3, w: 4, h: 4, minH: 3, maxH: 5, minW: 4 },
  { i: 'distribution', x: 0, y: 7, w: 4, h: 4, minH: 3, maxH: 5, minW: 3 },
  { i: 'myday', x: 4, y: 7, w: 4, h: 4, minH: 3, maxH: 5, minW: 4 },
  { i: 'blockers', x: 0, y: 11, w: 4, h: 4, minH: 3, maxH: 5, minW: 4 },
  { i: 'safety', x: 4, y: 11, w: 4, h: 4, minH: 3, maxH: 5, minW: 4 },
  { i: 'workload', x: 0, y: 15, w: 4, h: 4, minH: 3, maxH: 5, minW: 4 },
  { i: 'ai', x: 4, y: 15, w: 4, h: 4, minH: 3, maxH: 6, minW: 4 },
];

// Mobile layout (sm: <768px, 1 col stacked)
const LAYOUT_SM: DashboardWidget[] = [
  { i: 'metrics', x: 0, y: 0, w: 4, h: 6, minH: 5, maxH: 7, minW: 4 },
  { i: 'health', x: 0, y: 6, w: 4, h: 4, minH: 3, maxH: 5, minW: 4 },
  { i: 'myday', x: 0, y: 10, w: 4, h: 4, minH: 3, maxH: 5, minW: 4 },
  { i: 'blockers', x: 0, y: 14, w: 4, h: 4, minH: 3, maxH: 5, minW: 4 },
  { i: 'safety', x: 0, y: 18, w: 4, h: 4, minH: 3, maxH: 5, minW: 4 },
  { i: 'workload', x: 0, y: 22, w: 4, h: 4, minH: 3, maxH: 5, minW: 4 },
  { i: 'activity', x: 0, y: 26, w: 4, h: 4, minH: 3, maxH: 5, minW: 4 },
  { i: 'distribution', x: 0, y: 30, w: 4, h: 4, minH: 3, maxH: 5, minW: 4 },
  { i: 'ai', x: 0, y: 34, w: 4, h: 5, minH: 4, maxH: 6, minW: 4 },
];

const DEFAULT_LAYOUTS: ResponsiveLayouts = {
  lg: LAYOUT_LG,
  md: LAYOUT_MD,
  sm: LAYOUT_SM,
};

export const useDashboardLayout = (projectId: string | null) => {
  const { user } = useAuth();
  const [layouts, setLayouts] = useState<ResponsiveLayouts>(DEFAULT_LAYOUTS);
  const [hiddenWidgets, setHiddenWidgets] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    if (user?.id && projectId) {
      loadLayout();
    } else {
      setLayouts(DEFAULT_LAYOUTS);
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
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data) {
        const savedLayout = data.layout as any;
        if (savedLayout.lg) {
          setLayouts(savedLayout as ResponsiveLayouts);
        } else if (Array.isArray(savedLayout)) {
          setLayouts({
            lg: savedLayout as DashboardWidget[],
            md: LAYOUT_MD,
            sm: LAYOUT_SM,
          });
        } else {
          setLayouts(DEFAULT_LAYOUTS);
        }
        setHiddenWidgets(data.hidden_widgets || []);
      } else {
        setLayouts(DEFAULT_LAYOUTS);
        setHiddenWidgets([]);
      }
    } catch (error) {
      console.error('Error loading dashboard layout:', error);
      setLayouts(DEFAULT_LAYOUTS);
      setHiddenWidgets([]);
    } finally {
      setIsLoading(false);
    }
  };

  const saveLayout = async (newLayouts: ResponsiveLayouts, newHiddenWidgets?: string[]) => {
    if (!user?.id || !projectId) return;

    try {
      const { error } = await supabase
        .from('dashboard_layouts')
        .upsert({
          user_id: user.id,
          project_id: projectId,
          layout: JSON.parse(JSON.stringify(newLayouts)),
          hidden_widgets: newHiddenWidgets || hiddenWidgets,
          updated_at: new Date().toISOString(),
        } as any);

      if (error) throw error;

      setLayouts(newLayouts);
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

      setLayouts(DEFAULT_LAYOUTS);
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
    saveLayout(layouts, newHiddenWidgets);
  };

  const updateLayouts = (breakpoint: string, newLayout: DashboardWidget[]) => {
    setLayouts(prev => ({
      ...prev,
      [breakpoint]: newLayout.map(item => ({
        i: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        minW: item.minW,
        minH: item.minH,
        maxW: item.maxW,
        maxH: item.maxH,
      })),
    }));
  };

  const layout = layouts.lg;

  return {
    layout,
    layouts,
    hiddenWidgets,
    isLoading,
    isEditMode,
    setIsEditMode,
    saveLayout,
    resetLayout,
    toggleWidget,
    updateLayouts,
    updateLayout: (newLayout: DashboardWidget[]) => updateLayouts('lg', newLayout),
  };
};
