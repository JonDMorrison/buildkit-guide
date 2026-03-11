import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ChangeOrder {
  id: string;
  organization_id: string;
  project_id: string;
  estimate_id: string | null;
  status: string;
  currency: string;
  title: string;
  reason: string;
  amount: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  project?: { name: string; currency: string } | null;
}

export interface ChangeOrderLineItem {
  id: string;
  change_order_id: string;
  name: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function useChangeOrders(orgId: string | null) {
  return useQuery({
    queryKey: ['change-orders', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('change_orders')
        .select('*,project:projects(name,currency)')
        .eq('organization_id', orgId!)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ChangeOrder[];
    },
    enabled: !!orgId,
  });
}

export function useChangeOrder(id: string | null) {
  return useQuery({
    queryKey: ['change-order', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('change_orders')
        .select('*,project:projects(name,currency)')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as unknown as ChangeOrder;
    },
    enabled: !!id,
  });
}

export function useChangeOrderLineItems(changeOrderId: string | null) {
  return useQuery({
    queryKey: ['change-order-line-items', changeOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('change_order_line_items')
        .select('*')
        .eq('change_order_id', changeOrderId!)
        .order('sort_order');
      if (error) throw error;
      return (data ?? []) as ChangeOrderLineItem[];
    },
    enabled: !!changeOrderId,
  });
}

export function useChangeOrderMutations() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['change-orders'] });
    qc.invalidateQueries({ queryKey: ['change-order'] });
    qc.invalidateQueries({ queryKey: ['change-order-line-items'] });
  };

  const create = useMutation({
    mutationFn: async (args: { projectId: string; payload: Record<string, unknown> }) => {
      const { data, error } = await supabase.rpc('rpc_create_change_order', {
        p_project_id: args.projectId,
        p_payload_json: args.payload as any,
      });
      if (error) throw error;
      return data as { id: string; status: string };
    },
    onSuccess: () => { invalidate(); toast({ title: 'Change order created' }); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const update = useMutation({
    mutationFn: async (args: { id: string; payload: Record<string, unknown> }) => {
      const { data, error } = await supabase.rpc('rpc_update_change_order', {
        p_change_order_id: args.id,
        p_payload_json: args.payload as any,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { invalidate(); toast({ title: 'Change order updated' }); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const send = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc('rpc_send_change_order', {
        p_change_order_id: id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { invalidate(); toast({ title: 'Change order sent for review' }); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const approve = useMutation({
    mutationFn: async (args: { id: string; approved: boolean }) => {
      const { data, error } = await supabase.rpc('rpc_approve_change_order', {
        p_change_order_id: args.id,
        p_approved: args.approved,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      invalidate();
      toast({ title: vars.approved ? 'Change order approved' : 'Change order rejected' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const addLineItem = useMutation({
    mutationFn: async (args: { changeOrderId: string; name: string; description?: string; quantity: number; rate: number; sortOrder?: number }) => {
      const { data, error } = await supabase.rpc('rpc_add_change_order_line_item', {
        p_change_order_id: args.changeOrderId,
        p_name: args.name,
        p_description: args.description ?? '',
        p_quantity: args.quantity,
        p_rate: args.rate,
        p_sort_order: args.sortOrder ?? 0,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateLineItem = useMutation({
    mutationFn: async (args: { id: string; payload: Record<string, unknown> }) => {
      const { data, error } = await supabase.rpc('rpc_update_change_order_line_item', {
        p_line_item_id: args.id,
        p_payload_json: args.payload as any,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteLineItem = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc('rpc_delete_change_order_line_item', {
        p_line_item_id: id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const suggest = useMutation({
    mutationFn: async (projectId: string) => {
      const { data, error } = await supabase.rpc('rpc_suggest_change_order_from_risk', {
        p_project_id: projectId,
      });
      if (error) throw error;
      return data as any;
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return { create, update, send, approve, addLineItem, updateLineItem, deleteLineItem, suggest };
}
