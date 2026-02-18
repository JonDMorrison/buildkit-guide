import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { Quote, QuoteLineItem } from '@/types/quotes';

const logQuoteEvent = async (quoteId: string, eventType: string, metadata: Record<string, any> = {}) => {
  try {
    await supabase.rpc('rpc_log_quote_event', {
      p_quote_id: quoteId,
      p_event_type: eventType,
      p_metadata: metadata,
    });
  } catch {
    // Non-blocking — don't fail the main operation
    console.warn('Failed to log quote event', eventType);
  }
};

export const useQuotes = () => {
  const { activeOrganizationId } = useOrganization();
  const { user } = useAuth();
  const { toast } = useToast();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQuotes = useCallback(async () => {
    if (!activeOrganizationId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('quotes')
      .select('*, projects(name, job_number), clients!quotes_client_id_fkey(name)')
      .eq('organization_id', activeOrganizationId)
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Error loading quotes', description: error.message, variant: 'destructive' });
    }
    const mapped = ((data as any[]) || []).map((q: any) => ({
      ...q,
      project: q.projects || null,
      client: q.clients || null,
    }));
    setQuotes(mapped);
    setLoading(false);
  }, [activeOrganizationId]);

  useEffect(() => { fetchQuotes(); }, [fetchQuotes]);

  const createQuote = async (
    quote: Partial<Quote>,
    lineItems: Partial<QuoteLineItem>[]
  ) => {
    if (!activeOrganizationId || !user) return null;

    const { data: qteNum } = await supabase.rpc('get_next_quote_number', { p_org_id: activeOrganizationId });

    const computed = lineItems.map((li, i) => {
      const qty = Number(li.quantity) || 0;
      const rate = Number(li.rate) || 0;
      const amount = Math.round(qty * rate * 100) / 100;
      const taxRate = Number(li.sales_tax_rate) || 0;
      const taxAmount = Math.round(amount * (taxRate / 100) * 100) / 100;
      return { ...li, sort_order: i, amount, sales_tax_amount: taxAmount };
    });

    const subtotal = computed.reduce((s, li) => s + (li.amount || 0), 0);
    const gst = Number(quote.gst) || 0;
    const pst = Number(quote.pst) || 0;
    const total = Math.round((subtotal + gst + pst) * 100) / 100;

    const { data, error } = await supabase
      .from('quotes')
      .insert({
        ...quote,
        organization_id: activeOrganizationId,
        created_by: user.id,
        quote_number: qteNum || 'QTE-0001',
        subtotal,
        gst,
        pst,
        total,
      } as any)
      .select()
      .single();

    if (error) {
      toast({ title: 'Error creating quote', description: error.message, variant: 'destructive' });
      return null;
    }

    if (computed.length > 0 && data) {
      const rows = computed.map(li => ({
        ...li,
        quote_id: (data as any).id,
        organization_id: activeOrganizationId,
      }));
      const { error: liError } = await supabase.from('quote_line_items').insert(rows as any);
      if (liError) {
        console.warn('Failed to insert line items', liError.message);
      }
    }

    if (data) {
      await logQuoteEvent((data as any).id, 'created', {
        quote_number: (data as any).quote_number,
        line_item_count: computed.length,
        total,
      });
    }

    await fetchQuotes();
    return data;
  };

  const updateQuote = async (id: string, updates: Partial<Quote>) => {
    const { error } = await supabase
      .from('quotes')
      .update(updates as any)
      .eq('id', id);
    if (error) {
      toast({ title: 'Error updating quote', description: error.message, variant: 'destructive' });
      return false;
    }

    const changedFields = Object.keys(updates).filter(k => k !== 'updated_at');
    await logQuoteEvent(id, 'updated', { changed_fields: changedFields });

    await fetchQuotes();
    return true;
  };

  const approveQuote = async (id: string) => {
    const { error } = await supabase
      .from('quotes')
      .update({ status: 'approved', approved_at: new Date().toISOString() } as any)
      .eq('id', id);
    if (error) {
      toast({ title: 'Error approving quote', description: error.message, variant: 'destructive' });
      return false;
    }
    await logQuoteEvent(id, 'approved');
    toast({ title: 'Quote approved' });
    await fetchQuotes();
    return true;
  };

  const markSent = async (id: string) => {
    const { error } = await supabase
      .from('quotes')
      .update({ status: 'sent' } as any)
      .eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    await logQuoteEvent(id, 'sent');
    await fetchQuotes();
    return true;
  };

  const rejectQuote = async (id: string, reason?: string) => {
    const { error } = await supabase
      .from('quotes')
      .update({ status: 'rejected' } as any)
      .eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    await logQuoteEvent(id, 'rejected', { reason: reason || 'No reason provided' });
    await fetchQuotes();
    return true;
  };

  const archiveQuote = async (id: string) => {
    const { error } = await supabase
      .from('quotes')
      .update({ status: 'archived' } as any)
      .eq('id', id);
    if (error) {
      toast({ title: 'Error archiving quote', description: error.message, variant: 'destructive' });
      return false;
    }
    await logQuoteEvent(id, 'archived');
    await fetchQuotes();
    return true;
  };

  const deleteQuote = async (id: string) => {
    // Log before deleting (event references the quote)
    await logQuoteEvent(id, 'deleted');

    await supabase.from('quote_line_items').delete().eq('quote_id', id);
    const { error } = await supabase.from('quotes').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error deleting quote', description: error.message, variant: 'destructive' });
      return false;
    }
    await fetchQuotes();
    return true;
  };

  const fetchLineItems = async (quoteId: string): Promise<QuoteLineItem[]> => {
    const { data } = await supabase
      .from('quote_line_items')
      .select('*')
      .eq('quote_id', quoteId)
      .order('sort_order');
    return (data as any[]) || [];
  };

  const addLineItem = async (quoteId: string, lineItem: Partial<QuoteLineItem>) => {
    const qty = Number(lineItem.quantity) || 0;
    const rate = Number(lineItem.rate) || 0;
    const amount = Math.round(qty * rate * 100) / 100;
    const taxRate = Number(lineItem.sales_tax_rate) || 0;
    const taxAmount = Math.round(amount * (taxRate / 100) * 100) / 100;

    const { data, error } = await supabase
      .from('quote_line_items')
      .insert({
        ...lineItem,
        quote_id: quoteId,
        organization_id: activeOrganizationId,
        amount,
        sales_tax_amount: taxAmount,
      } as any)
      .select()
      .single();

    if (error) {
      toast({ title: 'Error adding line item', description: error.message, variant: 'destructive' });
      return null;
    }
    await logQuoteEvent(quoteId, 'line_item_added', {
      line_item_id: (data as any)?.id,
      product: lineItem.product_or_service,
      amount,
    });
    return data;
  };

  const updateLineItem = async (quoteId: string, lineItemId: string, updates: Partial<QuoteLineItem>) => {
    const qty = Number(updates.quantity) || 0;
    const rate = Number(updates.rate) || 0;
    const amount = Math.round(qty * rate * 100) / 100;
    const taxRate = Number(updates.sales_tax_rate) || 0;
    const taxAmount = Math.round(amount * (taxRate / 100) * 100) / 100;

    const { error } = await supabase
      .from('quote_line_items')
      .update({ ...updates, amount, sales_tax_amount: taxAmount } as any)
      .eq('id', lineItemId);

    if (error) {
      toast({ title: 'Error updating line item', description: error.message, variant: 'destructive' });
      return false;
    }
    await logQuoteEvent(quoteId, 'line_item_updated', {
      line_item_id: lineItemId,
      changed_fields: Object.keys(updates),
    });
    return true;
  };

  const deleteLineItem = async (quoteId: string, lineItemId: string) => {
    const { error } = await supabase
      .from('quote_line_items')
      .delete()
      .eq('id', lineItemId);

    if (error) {
      toast({ title: 'Error deleting line item', description: error.message, variant: 'destructive' });
      return false;
    }
    await logQuoteEvent(quoteId, 'line_item_deleted', { line_item_id: lineItemId });
    return true;
  };

  const convertToInvoice = async (quoteId: string): Promise<string | null> => {
    if (!user) return null;
    const { data, error } = await supabase.rpc('convert_quote_to_invoice', {
      p_quote_id: quoteId,
      p_actor_id: user.id,
    });
    if (error) {
      toast({ title: 'Conversion failed', description: error.message, variant: 'destructive' });
      return null;
    }
    await logQuoteEvent(quoteId, 'converted', { invoice_id: data });
    toast({ title: 'Quote converted to invoice' });
    await fetchQuotes();
    return data as string;
  };

  /** Canonical conversion check via quotes.converted_invoice_id */
  const getConvertedInvoiceId = (quote: Quote): string | null => {
    return (quote as any).converted_invoice_id || null;
  };

  return {
    quotes, loading,
    fetchQuotes, createQuote, updateQuote,
    approveQuote, markSent, rejectQuote, archiveQuote, deleteQuote,
    fetchLineItems, addLineItem, updateLineItem, deleteLineItem,
    convertToInvoice, getConvertedInvoiceId,
  };
};
