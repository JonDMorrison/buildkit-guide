import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { useCurrentProject } from '@/hooks/useCurrentProject';

import type { Proposal } from '@/types/proposals';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Partial<Proposal>) => Promise<any>;
}

export function CreateProposalModal({ open, onOpenChange, onSubmit }: Props) {
  const { activeOrganizationId } = useOrganization();
  const { currentProjectId } = useCurrentProject();
  const [projects, setProjects] = useState<{ id: string; name: string; job_number: string | null }[]>([]);
  const [estimates, setEstimates] = useState<{ id: string; estimate_number: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    project_id: currentProjectId || '',
    estimate_id: '',
    title: '',
    customer_po_or_contract_number: '',
    summary: '',
    assumptions: '',
    exclusions: '',
    timeline_text: '',
  });

  useEffect(() => {
    if (!activeOrganizationId || !open) return;
    supabase
      .from('projects')
      .select('id,name,job_number')
      .eq('organization_id', activeOrganizationId)
      .then(({ data }) => setProjects(data || []));
  }, [activeOrganizationId, open]);

  useEffect(() => {
    if (!form.project_id) { setEstimates([]); return; }
    supabase
      .from('estimates')
      .select('id,estimate_number')
      .eq('project_id', form.project_id)
      .then(({ data }) => setEstimates(data || []));
  }, [form.project_id]);

  const handleSubmit = async () => {
    if (!form.project_id || !form.title.trim()) return;
    setSubmitting(true);
    const payload: Partial<Proposal> = {
      project_id: form.project_id,
      title: form.title,
      summary: form.summary,
      assumptions: form.assumptions,
      exclusions: form.exclusions,
      timeline_text: form.timeline_text,
    };
    if (form.customer_po_or_contract_number) payload.customer_po_or_contract_number = form.customer_po_or_contract_number;
    if (form.estimate_id) payload.estimate_id = form.estimate_id;

    const result = await onSubmit(payload);
    setSubmitting(false);
    if (result) {
      setForm({ project_id: currentProjectId || '', estimate_id: '', title: '', customer_po_or_contract_number: '', summary: '', assumptions: '', exclusions: '', timeline_text: '' });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Proposal</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Project *</Label>
              <Select value={form.project_id} onValueChange={v => setForm(f => ({ ...f, project_id: v, estimate_id: '' }))}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.job_number ? `${p.job_number} – ` : ''}{p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Link Estimate (optional)</Label>
              <Select value={form.estimate_id} onValueChange={v => setForm(f => ({ ...f, estimate_id: v }))}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {estimates.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.estimate_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Phase 1 Electrical Proposal" />
          </div>

          <div className="space-y-1.5">
            <Label>Customer PO / Contract #</Label>
            <Input value={form.customer_po_or_contract_number} onChange={e => setForm(f => ({ ...f, customer_po_or_contract_number: e.target.value }))} />
          </div>

          <div className="space-y-1.5">
            <Label>Summary</Label>
            <Textarea value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} placeholder="High-level scope summary..." rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Assumptions</Label>
              <Textarea value={form.assumptions} onChange={e => setForm(f => ({ ...f, assumptions: e.target.value }))} placeholder="Key assumptions..." rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label>Exclusions</Label>
              <Textarea value={form.exclusions} onChange={e => setForm(f => ({ ...f, exclusions: e.target.value }))} placeholder="What's excluded..." rows={3} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Timeline</Label>
            <Textarea value={form.timeline_text} onChange={e => setForm(f => ({ ...f, timeline_text: e.target.value }))} placeholder="Expected timeline and milestones..." rows={2} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting || !form.project_id || !form.title.trim()}>
              {submitting ? 'Creating...' : 'Create Draft'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
