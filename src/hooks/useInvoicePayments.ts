import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { InvoicePayment } from '@/types/invoicing';

export const useInvoicePayments = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPayments = useCallback(async (invoiceId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('invoice_payments')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('payment_date', { ascending: false });
    if (error) {
      toast({ title: 'Error loading payments', description: error.message, variant: 'destructive' });
    }
    setPayments((data as any[]) || []);
    setLoading(false);
    return (data as any[]) || [];
  }, []);

  const addPayment = async (invoiceId: string, payment: Partial<InvoicePayment>) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('invoice_payments')
      .insert({ ...payment, invoice_id: invoiceId, created_by: user.id } as any)
      .select()
      .single();
    if (error) {
      toast({ title: 'Error adding payment', description: error.message, variant: 'destructive' });
      return null;
    }
    await fetchPayments(invoiceId);
    return data;
  };

  const deletePayment = async (paymentId: string, invoiceId: string) => {
    const { error } = await supabase
      .from('invoice_payments')
      .delete()
      .eq('id', paymentId);
    if (error) {
      toast({ title: 'Error deleting payment', description: error.message, variant: 'destructive' });
      return false;
    }
    await fetchPayments(invoiceId);
    return true;
  };

  return { payments, loading, fetchPayments, addPayment, deletePayment };
};
