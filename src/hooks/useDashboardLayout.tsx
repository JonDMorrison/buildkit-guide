import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

// Desktop layout (lg: 1200px+, 12 cols) — PM default
const LAYOUT_LG: DashboardWidget[] = [
  { i: 'metrics', x: 0, y: 0, w: 12, h: 2, minH: 2, maxH: 3, minW: 8 },
  { i: 'activity', x: 0, y: 2, w: 6, h: 4, minH: 3, maxH: 5, minW: 4 },
  { i: 'health', x: 6, y: 2, w: 3, h: 4, minH: 3, maxH: 5, minW: 3 },
  { i: 'econhealth', x: 9, y: 2, w: 3, h: 4, minH: 3, maxH: 5, minW: 3 },
  { i: 'distribution', x: 0, y: 6, w: 3, h: 4, minH: 3, maxH: 5, minW: 3 },
  { i: 'myday', x: 3, y: 6, w: 3, h: 4, minH: 3, maxH: 5, minW: 3 },
  { i: 'blockers', x: 6, y: 6, w: 3, h: 4, minH: 3, maxH: 5, minW: 3 },
  { i: 'safety', x: 9, y: 6, w: 3, h: 4, minH: 3, maxH: 5, minW: 3 },
  { i: 'econdrift', x: 0, y: 10, w: 4, h: 4, minH: 3, maxH: 5, minW: 3 },
];

// Tablet layout (md: 768-1199px, 8 cols)
const LAYOUT_MD: DashboardWidget[] = [
  { i: 'metrics', x: 0, y: 0, w: 8, h: 3, minH: 2, maxH: 4, minW: 6 },
  { i: 'activity', x: 0, y: 3, w: 4, h: 4, minH: 3, maxH: 5, minW: 4 },
  { i: 'health', x: 4, y: 3, w: 4, h: 4, minH: 3, maxH: 5, minW: 4 },
  { i: 'econhealth', x: 0, y: 7, w: 4, h: 4, minH: 3, maxH: 5, minW: 3 },
  { i: 'distribution', x: 4, y: 7, w: 4, h: 4, minH: 3, maxH: 5, minW: 3 },
  { i: 'myday', x: 0, y: 11, w: 4, h: 4, minH: 3, maxH: 5, minW: 4 },
  { i: 'blockers', x: 4, y: 11, w: 4, h: 4, minH: 3, maxH: 5, minW: 4 },
  { i: 'safety', x: 0, y: 15, w: 4, h: 4, minH: 3, maxH: 5, minW: 4 },
  { i: 'econdrift', x: 4, y: 15, w: 4, h: 4, minH: 3, maxH: 5, minW: 3 },
];

// Mobile layout (sm: <768px, 1 col stacked)
const LAYOUT_SM: DashboardWidget[] = [
  { i: 'metrics', x: 0, y: 0, w: 4, h: 6, minH: 5, maxH: 7, minW: 4 },
  { i: 'econhealth', x: 0, y: 6, w: 4, h: 4, minH: 3, maxH: 5, minW: 4 },
  { i: 'econdrift', x: 0, y: 10, w: 4, h: 4, minH: 3, maxH: 5, minW: 4 },
  { i: 'health', x: 0, y: 14, w: 4, h: 4, minH: 3, maxH: 5, minW: 4 },
  { i: 'myday', x: 0, y: 18, w: 4, h: 4, minH: 3, maxH: 5, minW: 4 },
  { i: 'blockers', x: 0, y: 22, w: 4, h: 4, minH: 3, maxH: 5, minW: 4 },
  { i: 'safety', x: 0, y: 26, w: 4, h: 4, minH: 3, maxH: 5, minW: 4 },
  { i: 'activity', x: 0, y: 30, w: 4, h: 4, minH: 3, maxH: 5, minW: 4 },
  { i: 'distribution', x: 0, y: 34, w: 4, h: 4, minH: 3, maxH: 5, minW: 4 },
];

const DEFAULT_LAYOUTS: ResponsiveLayouts = {
  lg: LAYOUT_LG,
  md: LAYOUT_MD,
  sm: LAYOUT_SM,
};

// Foreman default: prioritize My Day, Blockers, Safety — hide economic widgets
const FOREMAN_LAYOUT_LG: DashboardWidget[] = [
  { i: 'metrics', x: 0, y: 0, w: 12, h: 2, minH: 2, maxH: 3, minW: 8 },
  { i: 'myday', x: 0, y: 2, w: 6, h: 4, minH: 3, maxH: 5, minW: 4 },
  { i: 'blockers', x: 6, y: 2, w: 6, h: 4, minH: 3, maxH: 5, minW: 4 },
  { i: 'safety', x: 0, y: 6, w: 4, h: 4, minH: 3, maxH: 5, minW: 3 },
  { i: 'health', x: 4, y: 6, w: 4, h: 4, minH: 3, maxH: 5, minW: 3 },
  { i: 'activity', x: 8, y: 6, w: 4, h: 4, minH: 3, maxH: 5, minW: 3 },
  { i: 'distribution', x: 0, y: 10, w: 4, h: 4, minH: 3, maxH: 5, minW: 3 },
];

const FOREMAN_LAYOUT_MD: DashboardWidget[] = [
  { i: 'metrics', x: 0, y: 0, w: 8, h: 3, minH: 2, maxH: 4, minW: 6 },
  { i: 'myday', x: 0, y: 3, w: 4, h: 4, minH: 3, maxH: 5, minW: 4 },
  { i: 'blockers', x: 4, y: 3, w: 4, h: 4, minH: 3, maxH: 5, minW: 4 },
  { i: 'safety', x: 0, y: 7, w: 4, h: 4, minH: 3, maxH: 5, minW: 4 },
  { i: 'health', x: 4, y: 7, w: 4, h: 4, minH: 3, maxH: 5, minW: 4 },
  { i: 'activity', x: 0, y: 11, w: 4, h: 4, minH: 3, maxH: 5, minW: 4 },
  { i: 'distribution', x: 4, y: 11, w: 4, h: 4, minH: 3, maxH: 5, minW: 3 },
];

const FOREMAN_LAYOUT_SM: DashboardWidget[] = [
  { i: 'metrics', x: 0, y: 0, w: 4, h: 6, minH: 5, maxH: 7, minW: 4 },
  { i: 'myday', x: 0, y: 6, w: 4, h: 4, minH: 3, maxH: 5, minW: 4 },
  { i: 'blockers', x: 0, y: 10, w: 4, h: 4, minH: 3, maxH: 5, minW: 4 },
  { i: 'safety', x: 0, y: 14, w: 4, h: 4, minH: 3, maxH: 5, minW: 4 },
  { i: 'health', x: 0, y: 18, w: 4, h: 4, minH: 3, maxH: 5, minW: 4 },
  { i: 'activity', x: 0, y: 22, w: 4, h: 4, minH: 3, maxH: 5, minW: 4 },
  { i: 'distribution', x: 0, y: 26, w: 4, h: 4, minH: 3, maxH: 5, minW: 4 },
];

const FOREMAN_DEFAULTS: ResponsiveLayouts = {
  lg: FOREMAN_LAYOUT_LG,
  md: FOREMAN_LAYOUT_MD,
  sm: FOREMAN_LAYOUT_SM,
};

const FOREMAN_HIDDEN_WIDGETS = ['econhealth', 'econdrift'];

export function getDefaultLayoutsForRole(role: 'foreman' | 'pm' | 'admin' | 'other'): {
  layouts: ResponsiveLayouts;
  hiddenWidgets: string[];
} {
  if (role === 'foreman') {
    return { layouts: FOREMAN_DEFAULTS, hiddenWidgets: FOREMAN_HIDDEN_WIDGETS };
  }
  return { layouts: DEFAULT_LAYOUTS, hiddenWidgets: [] };
}

interface LayoutData {
  layouts: ResponsiveLayouts;
  hiddenWidgets: string[];
}

export const useDashboardLayout = (projectId: string | null, roleHint?: 'foreman' | 'pm' | 'admin' | 'other') => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isEditMode, setIsEditMode] = useState(false);
  const [localLayouts, setLocalLayouts] = useState<ResponsiveLayouts | null>(null);

  const roleDefaults = getDefaultLayoutsForRole(roleHint || 'other');

  const queryKey = ['dashboard-layout', user?.id, projectId];

  // Use React Query for caching layout data
  const { data, isLoading } = useQuery<LayoutData>({
    queryKey,
    queryFn: async () => {
      if (!user?.id || !projectId) {
        return roleDefaults;
      }

      const { data, error } = await supabase
        .from('dashboard_layouts')
        .select('layout,hidden_widgets')
        .eq('user_id', user.id)
        .eq('project_id', projectId)
        .maybeSingle();

      if (error) {
        console.error('Error loading dashboard layout:', error);
        return roleDefaults;
      }

      if (data) {
        const savedLayout = data.layout as any;
        let layouts: ResponsiveLayouts;
        
        if (savedLayout.lg) {
          layouts = savedLayout as ResponsiveLayouts;
        } else if (Array.isArray(savedLayout)) {
          layouts = {
            lg: savedLayout as DashboardWidget[],
            md: LAYOUT_MD,
            sm: LAYOUT_SM,
          };
        } else {
          layouts = roleDefaults.layouts;
        }
        
        return {
          layouts,
          hiddenWidgets: data.hidden_widgets || [],
        };
      }

      return roleDefaults;
    },
    enabled: !!user?.id && !!projectId,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    placeholderData: roleDefaults,
  });

  // Mutation for saving layout
  const saveMutation = useMutation({
    mutationFn: async ({ newLayouts, newHiddenWidgets }: { newLayouts: ResponsiveLayouts; newHiddenWidgets: string[] }) => {
      if (!user?.id || !projectId) throw new Error('Missing user or project');

      const { error } = await supabase
        .from('dashboard_layouts')
        .upsert(
          {
            user_id: user.id,
            project_id: projectId,
            layout: JSON.parse(JSON.stringify(newLayouts)),
            hidden_widgets: newHiddenWidgets,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: 'user_id,project_id' }
        );

      if (error) throw error;
      return { layouts: newLayouts, hiddenWidgets: newHiddenWidgets };
    },
    onSuccess: (newData) => {
      queryClient.setQueryData(queryKey, newData);
      setLocalLayouts(null);
      toast.success('Dashboard layout saved');
    },
    onError: (error) => {
      console.error('Error saving dashboard layout:', error);
      toast.error('Failed to save dashboard layout');
    },
  });

  // Mutation for resetting layout
  const resetMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !projectId) throw new Error('Missing user or project');

      const { error } = await supabase
        .from('dashboard_layouts')
        .delete()
        .eq('user_id', user.id)
        .eq('project_id', projectId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.setQueryData(queryKey, { layouts: DEFAULT_LAYOUTS, hiddenWidgets: [] });
      setLocalLayouts(null);
      toast.success('Dashboard layout reset to default');
    },
    onError: (error) => {
      console.error('Error resetting dashboard layout:', error);
      toast.error('Failed to reset dashboard layout');
    },
  });

  const layouts = localLayouts || data?.layouts || DEFAULT_LAYOUTS;
  const hiddenWidgets = data?.hiddenWidgets || [];

  const saveLayout = useCallback((newLayouts: ResponsiveLayouts, newHiddenWidgets?: string[]) => {
    saveMutation.mutate({ 
      newLayouts, 
      newHiddenWidgets: newHiddenWidgets || hiddenWidgets 
    });
  }, [saveMutation, hiddenWidgets]);

  const resetLayout = useCallback(() => {
    resetMutation.mutate();
  }, [resetMutation]);

  const toggleWidget = useCallback((widgetId: string) => {
    const newHiddenWidgets = hiddenWidgets.includes(widgetId)
      ? hiddenWidgets.filter(id => id !== widgetId)
      : [...hiddenWidgets, widgetId];
    
    saveLayout(layouts, newHiddenWidgets);
  }, [hiddenWidgets, layouts, saveLayout]);

  const updateLayouts = useCallback((breakpoint: string, newLayout: DashboardWidget[]) => {
    setLocalLayouts(prev => {
      const current = prev || layouts;
      return {
        ...current,
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
      };
    });
  }, [layouts]);

  const layout = layouts.lg;

  return {
    layout,
    layouts,
    hiddenWidgets,
    isLoading: isLoading && !data, // Only show loading on initial fetch
    isEditMode,
    setIsEditMode,
    saveLayout,
    resetLayout,
    toggleWidget,
    updateLayouts,
    updateLayout: (newLayout: DashboardWidget[]) => updateLayouts('lg', newLayout),
  };
};
