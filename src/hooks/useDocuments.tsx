import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useDocuments = (projectId?: string, documentType?: string) => {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = async () => {
    try {
      let query = supabase
        .from('attachments')
        .select('*')
        .is('task_id', null)
        .is('deficiency_id', null)
        .is('safety_form_id', null)
        .order('created_at', { ascending: false });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      if (documentType) {
        query = query.eq('document_type', documentType);
      }

      const [docResult, profilesResult] = await Promise.all([
        query,
        supabase.from('profiles').select('id,full_name,email')
      ]);

      if (docResult.error) throw docResult.error;
      if (profilesResult.error) throw profilesResult.error;

      const profileMap = new Map(profilesResult.data?.map(p => [p.id, p]));
      
      const docsWithProfiles = (docResult.data || []).map(doc => ({
        ...doc,
        profiles: profileMap.get(doc.uploaded_by) || null
      }));

      setDocuments(docsWithProfiles);
    } catch (error: any) {
      toast({
        title: 'Error loading documents',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();

    // Set up realtime subscription
    const channel = supabase
      .channel('attachments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attachments',
        },
        () => {
          fetchDocuments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, documentType]);

  return {
    documents,
    loading,
    refetch: fetchDocuments,
  };
};
