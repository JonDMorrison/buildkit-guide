import { supabase } from '@/integrations/supabase/client';

export interface PreviewItem {
  scope_item_id: string;
  scope_item_name: string;
  action: 'create' | 'update' | 'skip';
}

export interface GenerationResult {
  created: number;
  updated: number;
  skipped: number;
}

export async function previewScopeTaskGeneration(
  projectId: string,
  mode: 'create_missing' | 'sync_existing'
): Promise<PreviewItem[]> {
  const { data, error } = await supabase.rpc('preview_tasks_from_scope', {
    p_project_id: projectId,
    p_mode: mode,
  });
  if (error) throw error;
  return (data as unknown as PreviewItem[]) || [];
}

export async function generateTasksFromScope(
  projectId: string,
  mode: 'create_missing' | 'sync_existing'
): Promise<GenerationResult> {
  const { data, error } = await supabase.rpc('generate_tasks_from_scope', {
    p_project_id: projectId,
    p_mode: mode,
  });
  if (error) throw error;
  return data as unknown as GenerationResult;
}
