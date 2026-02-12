import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { RecurringInvoiceTemplate } from '@/types/invoicing';

export const useRecurringInvoices = () => {
  const { activeOrganizationId } = useOrganization();
  const { user } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<RecurringInvoiceTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    if (!activeOrganizationId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('recurring_invoice_templates')
      .select('*, clients(name), projects(name)')
      .eq('organization_id', activeOrganizationId)
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Error loading templates', description: error.message, variant: 'destructive' });
    }
    const mapped = ((data as any[]) || []).map((t: any) => ({
      ...t,
      client: t.clients || null,
      project: t.projects || null,
    }));
    setTemplates(mapped);
    setLoading(false);
  }, [activeOrganizationId]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const createTemplate = async (template: Partial<RecurringInvoiceTemplate>) => {
    if (!activeOrganizationId || !user) return null;
    const { data, error } = await supabase
      .from('recurring_invoice_templates')
      .insert({
        ...template,
        organization_id: activeOrganizationId,
        created_by: user.id,
      } as any)
      .select()
      .single();
    if (error) {
      toast({ title: 'Error creating template', description: error.message, variant: 'destructive' });
      return null;
    }
    await fetchTemplates();
    return data;
  };

  const updateTemplate = async (id: string, updates: Partial<RecurringInvoiceTemplate>) => {
    const { error } = await supabase
      .from('recurring_invoice_templates')
      .update(updates as any)
      .eq('id', id);
    if (error) {
      toast({ title: 'Error updating template', description: error.message, variant: 'destructive' });
      return false;
    }
    await fetchTemplates();
    return true;
  };

  const deleteTemplate = async (id: string) => {
    const { error } = await supabase
      .from('recurring_invoice_templates')
      .delete()
      .eq('id', id);
    if (error) {
      toast({ title: 'Error deleting template', description: error.message, variant: 'destructive' });
      return false;
    }
    await fetchTemplates();
    return true;
  };

  return { templates, loading, fetchTemplates, createTemplate, updateTemplate, deleteTemplate };
};
