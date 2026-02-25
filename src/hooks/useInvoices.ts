import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { Invoice, InvoiceLineItem, InvoiceSettings } from '@/types/invoicing';

export const useInvoices = () => {
  const { activeOrganizationId } = useOrganization();
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);
  const { toast } = useToast();

  const fetchInvoices = useCallback(async () => {
    if (!activeOrganizationId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('invoices')
      .select('*, clients:clients!invoices_client_id_fkey(name, contact_name, email, billing_address, city, province, postal_code), projects(name, job_number)')
      .eq('organization_id', activeOrganizationId)
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Error loading invoices', description: error.message, variant: 'destructive' });
    }
    const mapped = ((data as any[]) || []).map((inv: any) => ({
      ...inv,
      client: inv.clients || null,
      project: inv.projects || null,
    }));
    setInvoices(mapped);
    setLoading(false);
  }, [activeOrganizationId]);

  const fetchSettings = useCallback(async () => {
    if (!activeOrganizationId) return;
    await supabase.from('invoice_settings').upsert(
      { organization_id: activeOrganizationId } as any,
      { onConflict: 'organization_id' }
    );
    const { data } = await supabase
      .from('invoice_settings')
      .select('*')
      .eq('organization_id', activeOrganizationId)
      .single();
    setSettings(data as any);
  }, [activeOrganizationId]);

  useEffect(() => { fetchInvoices(); fetchSettings(); }, [fetchInvoices, fetchSettings]);

  const updateSettings = async (updates: Partial<InvoiceSettings>) => {
    if (!activeOrganizationId) return false;
    const { error } = await supabase
      .from('invoice_settings')
      .update(updates as any)
      .eq('organization_id', activeOrganizationId);
    if (error) {
      toast({ title: 'Error updating settings', description: error.message, variant: 'destructive' });
      return false;
    }
    await fetchSettings();
    return true;
  };

  const createInvoice = async (invoice: Partial<Invoice>, lineItems: Partial<InvoiceLineItem>[]) => {
    if (!activeOrganizationId || !user) return null;
    const { data: invNum } = await supabase.rpc('get_next_invoice_number', { org_id: activeOrganizationId });
    const { data, error } = await supabase
      .from('invoices')
      .insert({
        ...invoice,
        organization_id: activeOrganizationId,
        created_by: user.id,
        invoice_number: invNum || 'INV-0001',
      } as any)
      .select()
      .single();
    if (error) {
      toast({ title: 'Error creating invoice', description: error.message, variant: 'destructive' });
      return null;
    }
    if (lineItems.length > 0 && data) {
      const items = lineItems.map((li, i) => ({
        ...li,
        invoice_id: (data as any).id,
        sort_order: i,
        amount: (Number(li.quantity) || 0) * (Number(li.unit_price) || 0),
      }));
      await supabase.from('invoice_line_items').insert(items as any);
    }
    await fetchInvoices();
    return data;
  };

  const updateInvoice = async (id: string, updates: Partial<Invoice>) => {
    const { error } = await supabase
      .from('invoices')
      .update(updates as any)
      .eq('id', id);
    if (error) {
      toast({ title: 'Error updating invoice', description: error.message, variant: 'destructive' });
      return false;
    }
    await fetchInvoices();
    return true;
  };

  const deleteInvoice = async (id: string) => {
    // Delete line items first, then the invoice
    await supabase.from('invoice_line_items').delete().eq('invoice_id', id);
    await supabase.from('invoice_payments').delete().eq('invoice_id', id);
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error deleting invoice', description: error.message, variant: 'destructive' });
      return false;
    }
    await fetchInvoices();
    return true;
  };

  const fetchLineItems = async (invoiceId: string): Promise<InvoiceLineItem[]> => {
    const { data } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('sort_order');
    return (data as any[]) || [];
  };

  const saveLineItems = async (invoiceId: string, items: Partial<InvoiceLineItem>[]) => {
    await supabase.from('invoice_line_items').delete().eq('invoice_id', invoiceId);
    if (items.length > 0) {
      const rows = items.map((li, i) => ({
        ...li,
        invoice_id: invoiceId,
        sort_order: i,
        amount: (Number(li.quantity) || 0) * (Number(li.unit_price) || 0),
      }));
      await supabase.from('invoice_line_items').insert(rows as any);
    }
  };

  return {
    invoices, loading, settings,
    fetchInvoices, fetchSettings, updateSettings,
    createInvoice, updateInvoice, deleteInvoice,
    fetchLineItems, saveLineItems,
  };
};
