import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { Proposal, ProposalSection, ProposalEvent } from '@/types/proposals';

export const useProposals = () => {
  const { activeOrganizationId } = useOrganization();
  const { user } = useAuth();
  const { toast } = useToast();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProposals = useCallback(async () => {
    if (!activeOrganizationId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('proposals')
      .select('*,projects(name,job_number),estimates(estimate_number)')
      .eq('organization_id', activeOrganizationId)
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Error loading proposals', description: error.message, variant: 'destructive' });
    }
    const mapped = ((data as unknown as (Proposal & { projects: any; estimates: any })[]) || []).map((p) => ({
      ...p,
      project: p.projects || null,
      estimate: p.estimates || null,
    }));
    setProposals(mapped);
    setLoading(false);
  }, [activeOrganizationId]);

  useEffect(() => { fetchProposals(); }, [fetchProposals]);

  const createProposal = async (proposal: Partial<Proposal>) => {
    if (!activeOrganizationId || !user) return null;
    
    // Omit joined fields and other extra properties
    const { project, estimate, ...cleanProposal } = proposal;
    
    const { data, error } = await supabase
      .from('proposals')
      .insert({
        ...cleanProposal,
        organization_id: activeOrganizationId,
        created_by: user.id,
      } as any) // We use 'as any' here because Supabase generated types are very strict with required fields which Partial<Proposal> might not satisfy at compile-time, but UI ensures they are present.
      .select()
      .single();
      
    if (error) {
      toast({ title: 'Error creating proposal', description: error.message, variant: 'destructive' });
      return null;
    }
    // Log event
    if (data) {
      await supabase.from('proposal_events').insert({
        proposal_id: data.id,
        actor_user_id: user.id,
        event_type: 'created',
        message: 'Proposal created',
      });
    }
    await fetchProposals();
    return data;
  };

  const updateProposal = async (id: string, updates: Partial<Proposal>) => {
    const { project, estimate, ...cleanUpdates } = updates;
    const { error } = await supabase
      .from('proposals')
      .update(cleanUpdates as any)
      .eq('id', id);
    if (error) {
      toast({ title: 'Error updating proposal', description: error.message, variant: 'destructive' });
      return false;
    }
    if (user) {
      await supabase.from('proposal_events').insert({
        proposal_id: id,
        actor_user_id: user.id,
        event_type: 'updated',
        message: 'Proposal updated',
      });
    }
    await fetchProposals();
    return true;
  };

  const submitProposal = async (id: string) => {
    if (!user) return false;
    const { error } = await supabase
      .from('proposals')
      .update({ status: 'submitted', submitted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      toast({ title: 'Error submitting proposal', description: error.message, variant: 'destructive' });
      return false;
    }
    await supabase.from('proposal_events').insert({
      proposal_id: id,
      actor_user_id: user.id,
      event_type: 'submitted',
      message: 'Proposal submitted for approval',
    });

    // Create notifications for approvers (PM/Admin on the project)
    const proposal = proposals.find((p) => p.id === id);
    if (proposal) {
      const { data: members } = await supabase
        .from('project_members')
        .select('user_id,role')
        .eq('project_id', proposal.project_id)
        .in('role', ['project_manager', 'admin']);
      if (members) {
        const notifs = members
          .filter(m => m.user_id !== user.id)
          .map(m => ({
            user_id: m.user_id,
            project_id: proposal.project_id,
            type: 'general' as const,
            title: 'Proposal Submitted for Approval',
            message: `"${proposal.title}" needs your review.`,
            link_url: '/proposals',
          }));
        if (notifs.length > 0) {
          await supabase.from('notifications').insert(notifs as any[]);
        }
      }
    }

    toast({ title: 'Proposal submitted for approval' });
    await fetchProposals();
    return true;
  };

  const approveProposal = async (id: string) => {
    if (!user) return false;
    const { error } = await supabase
      .from('proposals')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: user.id,
      })
      .eq('id', id);
    if (error) {
      toast({ title: 'Error approving proposal', description: error.message, variant: 'destructive' });
      return false;
    }
    await supabase.from('proposal_events').insert({
      proposal_id: id,
      actor_user_id: user.id,
      event_type: 'approved',
      message: 'Proposal approved',
    });

    // Notify creator
    const proposal = proposals.find(p => p.id === id);
    if (proposal && proposal.created_by !== user.id) {
      await supabase.from('notifications').insert({
        user_id: proposal.created_by,
        project_id: proposal.project_id,
        type: 'general',
        title: 'Proposal Approved',
        message: `"${proposal.title}" has been approved. Create a Quote or proceed to Scope.`,
        link_url: '/proposals',
      });
    }

    toast({ title: 'Proposal approved' });
    await fetchProposals();
    return true;
  };

  const rejectProposal = async (id: string, reason: string) => {
    if (!user) return false;
    const { error } = await supabase
      .from('proposals')
      .update({
        status: 'rejected',
        rejected_reason: reason,
      })
      .eq('id', id);
    if (error) {
      toast({ title: 'Error rejecting proposal', description: error.message, variant: 'destructive' });
      return false;
    }
    await supabase.from('proposal_events').insert({
      proposal_id: id,
      actor_user_id: user.id,
      event_type: 'rejected',
      message: reason ? `Rejected: ${reason}` : 'Proposal rejected',
    });

    // Notify creator
    const proposal = proposals.find(p => p.id === id);
    if (proposal && proposal.created_by !== user.id) {
      await supabase.from('notifications').insert({
        user_id: proposal.created_by,
        project_id: proposal.project_id,
        type: 'general',
        title: 'Proposal Rejected',
        message: reason || 'Your proposal was rejected.',
        link_url: '/proposals',
      });
    }

    toast({ title: 'Proposal rejected' });
    await fetchProposals();
    return true;
  };

  const archiveProposal = async (id: string) => {
    if (!user) return false;
    const { error } = await supabase
      .from('proposals')
      .update({ status: 'archived' })
      .eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    await supabase.from('proposal_events').insert({
      proposal_id: id,
      actor_user_id: user.id,
      event_type: 'archived',
      message: 'Proposal archived',
    });
    await fetchProposals();
    return true;
  };

  const deleteProposal = async (id: string) => {
    const { error } = await supabase.from('proposals').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error deleting proposal', description: error.message, variant: 'destructive' });
      return false;
    }
    await fetchProposals();
    return true;
  };

  const fetchSections = async (proposalId: string): Promise<ProposalSection[]> => {
    const { data } = await supabase
      .from('proposal_sections')
      .select('*')
      .eq('proposal_id', proposalId)
      .order('sort_order');
    return (data as any[]) || [];
  };

  const fetchEvents = async (proposalId: string): Promise<ProposalEvent[]> => {
    const { data } = await supabase
      .from('proposal_events')
      .select('*,profiles!proposal_events_actor_user_id_fkey(full_name)')
      .eq('proposal_id', proposalId)
      .order('created_at', { ascending: true });
    return ((data as unknown as (ProposalEvent & { profiles: any })[]) || []).map((e) => ({
      ...e,
      actor: e.profiles || null,
    }));
  };

  const convertToQuote = async (proposalId: string, includeEstimateLines: boolean = false): Promise<string | null> => {
    if (!user) return null;
    const { data, error } = await supabase.rpc('rpc_convert_proposal_to_quote', {
      p_proposal_id: proposalId,
      p_include_estimate_lines: includeEstimateLines,
    });
    if (error) {
      toast({ title: 'Conversion failed', description: error.message, variant: 'destructive' });
      return null;
    }
    toast({ title: 'Proposal converted to draft quote' });
    await fetchProposals();
    return data as string;
  };

  return {
    proposals, loading,
    fetchProposals, createProposal, updateProposal,
    submitProposal, approveProposal, rejectProposal,
    archiveProposal, deleteProposal,
    fetchSections, fetchEvents, convertToQuote,
  };
};
