import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type ReceiptCategory = 'fuel' | 'materials' | 'tools' | 'meals' | 'lodging' | 'other';
export type ReceiptReviewStatus = 'pending' | 'reviewed' | 'processed';

export interface Receipt {
  id: string;
  project_id: string;
  task_id: string | null;
  uploaded_by: string;
  file_path: string;
  amount: number | null;
  currency: string;
  vendor: string | null;
  category: ReceiptCategory;
  notes: string | null;
  uploaded_at: string;
  processed_data_json: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  notified_accounting_at: string | null;
  review_status: ReceiptReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  // Joined data
  uploader?: {
    full_name: string | null;
    email: string;
  };
  task?: {
    title: string;
  } | null;
  project?: {
    name: string;
    job_number: string | null;
  } | null;
  reviewer?: {
    full_name: string | null;
    email: string;
  } | null;
}

interface UseReceiptsOptions {
  projectId: string | null;
  category?: ReceiptCategory | null;
  uploadedBy?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
}

export const useReceipts = (options: UseReceiptsOptions) => {
  const { projectId, category, uploadedBy, startDate, endDate } = options;
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchReceipts = async () => {
    if (!projectId) {
      setReceipts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from('receipts')
        .select(`
          *,
          uploader:profiles!uploaded_by(full_name, email),
          task:tasks(title),
          project:projects(name, job_number)
        `)
        .eq('project_id', projectId)
        .order('uploaded_at', { ascending: false });

      if (category) {
        query = query.eq('category', category);
      }
      if (uploadedBy) {
        query = query.eq('uploaded_by', uploadedBy);
      }
      if (startDate) {
        query = query.gte('uploaded_at', startDate.toISOString());
      }
      if (endDate) {
        query = query.lte('uploaded_at', endDate.toISOString());
      }

      const { data, error } = await query;

      setReceipts((data as unknown as Receipt[]) || []);
    } catch (error: unknown) {
      console.error('Error fetching receipts:', error);
      toast({
        title: 'Error loading receipts',
        description: error instanceof Error ? error.message : 'An error occurred while loading receipts',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, [projectId, category, uploadedBy, startDate?.toISOString(), endDate?.toISOString()]);

  const getSignedUrl = async (filePath: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from('receipts')
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (error) throw error;
      return data.signedUrl;
    } catch (error) {
      console.error('Error getting signed URL:', error);
      return null;
    }
  };

  const deleteReceipt = async (receiptId: string, filePath: string) => {
    try {
      // Delete file from storage
      const { error: storageError } = await supabase.storage
        .from('receipts')
        .remove([filePath]);

      if (storageError) throw storageError;

      // Delete record from database
      const { error: dbError } = await supabase
        .from('receipts')
        .delete()
        .eq('id', receiptId);

      if (dbError) throw dbError;

      setReceipts((prev) => prev.filter((r) => r.id !== receiptId));
      toast({
        title: 'Receipt deleted',
        description: 'The receipt has been removed.',
      });
    } catch (error: unknown) {
      console.error('Error deleting receipt:', error);
      toast({
        title: 'Error deleting receipt',
        description: error instanceof Error ? error.message : 'An error occurred while deleting receipt',
        variant: 'destructive',
      });
    }
  };

  return {
    receipts,
    loading,
    refetch: fetchReceipts,
    getSignedUrl,
    deleteReceipt,
  };
};

export const RECEIPT_CATEGORIES: { value: ReceiptCategory; label: string }[] = [
  { value: 'fuel', label: 'Fuel' },
  { value: 'materials', label: 'Materials' },
  { value: 'tools', label: 'Tools' },
  { value: 'meals', label: 'Meals' },
  { value: 'lodging', label: 'Lodging' },
  { value: 'other', label: 'Other' },
];
