import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { useToast } from '@/hooks/use-toast';
import type { Client } from '@/types/invoicing';

export const useClients = () => {
  const { activeOrganizationId } = useOrganization();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchClients = useCallback(async () => {
    if (!activeOrganizationId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('organization_id', activeOrganizationId)
      .order('name');
    if (error) {
      toast({ title: 'Error loading clients', description: error.message, variant: 'destructive' });
    }
    setClients((data as any[]) || []);
    setLoading(false);
  }, [activeOrganizationId]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const createClient = async (client: Partial<Client>) => {
    if (!activeOrganizationId) return null;
    const { data, error } = await supabase
      .from('clients')
      .insert({ ...client, organization_id: activeOrganizationId } as any)
      .select()
      .single();
    if (error) {
      toast({ title: 'Error creating client', description: error.message, variant: 'destructive' });
      return null;
    }
    await fetchClients();
    return data;
  };

  const updateClient = async (id: string, updates: Partial<Client>) => {
    const { error } = await supabase
      .from('clients')
      .update(updates as any)
      .eq('id', id);
    if (error) {
      toast({ title: 'Error updating client', description: error.message, variant: 'destructive' });
      return false;
    }
    await fetchClients();
    return true;
  };

  return { clients, loading, fetchClients, createClient, updateClient };
};
