import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  CheckCircle2, Send, ThumbsDown, Archive, FileText, Clock, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { Proposal, ProposalEvent } from '@/types/proposals';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  approved: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  rejected: 'bg-destructive/15 text-destructive',
  archived: 'bg-muted text-muted-foreground',
};

interface Props {
  proposal: Proposal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canApprove: boolean;
  onSubmitForApproval: (id: string) => Promise<boolean>;
  onApprove: (id: string) => Promise<boolean>;
  onReject: (id: string, reason: string) => Promise<boolean>;
  onArchive: (id: string) => Promise<boolean>;
  onUpdate: (id: string, updates: Partial<Proposal>) => Promise<boolean>;
  onConvertToQuote: (id: string, includeLines: boolean) => Promise<string | null>;
  fetchEvents: (id: string) => Promise<ProposalEvent[]>;
}

export function ProposalDetailModal({
  proposal, open, onOpenChange, canApprove,
  onSubmitForApproval, onApprove, onReject, onArchive, onUpdate,
  onConvertToQuote, fetchEvents,
}: Props) {
  const [events, setEvents] = useState<ProposalEvent[]>([]);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [includeEstimateLines, setIncludeEstimateLines] = useState(false);
  const [acting, setActing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ summary: '', assumptions: '', exclusions: '', timeline_text: '', title: '' });

  useEffect(() => {
    if (proposal && open) {
      fetchEvents(proposal.id).then(setEvents);
      setEditForm({
        title: proposal.title,
        summary: proposal.summary,
        assumptions: proposal.assumptions,
        exclusions: proposal.exclusions,
        timeline_text: proposal.timeline_text,
      });
    }
  }, [proposal?.id, open]);

  if (!proposal) return null;

  const isDraft = proposal.status === 'draft';
  const isSubmitted = proposal.status === 'submitted';
  const isApproved = proposal.status === 'approved';

  const act = async (fn: () => Promise<any>) => {
    setActing(true);
    await fn();
    setActing(false);
    if (proposal) fetchEvents(proposal.id).then(setEvents);
  };

  const handleSaveEdit = async () => {
    setActing(true);
    await onUpdate(proposal.id, editForm);
    setEditing(false);
    setActing(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-lg">{proposal.title}</DialogTitle>
            <Badge className={cn('text-xs', STATUS_STYLES[proposal.status])} variant="secondary">
              {proposal.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {proposal.project?.name}
            {proposal.project?.job_number && ` (${proposal.project.job_number})`}
            {proposal.estimate?.estimate_number && ` · Est: ${proposal.estimate.estimate_number}`}
          </p>
        </DialogHeader>

        {editing && isDraft ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Summary</Label>
              <Textarea value={editForm.summary} onChange={e => setEditForm(f => ({ ...f, summary: e.target.value }))} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Assumptions</Label>
                <Textarea value={editForm.assumptions} onChange={e => setEditForm(f => ({ ...f, assumptions: e.target.value }))} rows={3} />
              </div>
              <div className="space-y-1.5">
                <Label>Exclusions</Label>
                <Textarea value={editForm.exclusions} onChange={e => setEditForm(f => ({ ...f, exclusions: e.target.value }))} rows={3} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Timeline</Label>
              <Textarea value={editForm.timeline_text} onChange={e => setEditForm(f => ({ ...f, timeline_text: e.target.value }))} rows={2} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSaveEdit} disabled={acting}>Save</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {proposal.summary && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Summary</p>
                <p className="text-sm whitespace-pre-wrap">{proposal.summary}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              {proposal.assumptions && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Assumptions</p>
                  <p className="text-sm whitespace-pre-wrap">{proposal.assumptions}</p>
                </div>
              )}
              {proposal.exclusions && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Exclusions</p>
                  <p className="text-sm whitespace-pre-wrap">{proposal.exclusions}</p>
                </div>
              )}
            </div>
            {proposal.timeline_text && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Timeline</p>
                <p className="text-sm whitespace-pre-wrap">{proposal.timeline_text}</p>
              </div>
            )}
            {proposal.customer_po_or_contract_number && (
              <p className="text-sm text-muted-foreground">PO/Contract: {proposal.customer_po_or_contract_number}</p>
            )}
          </div>
        )}

        <Separator />

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {isDraft && !editing && (
            <>
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
              <Button size="sm" onClick={() => act(() => onSubmitForApproval(proposal.id))} disabled={acting}>
                <Send className="h-4 w-4 mr-1.5" />Submit for Approval
              </Button>
            </>
          )}
          {isSubmitted && canApprove && (
            <>
              <Button size="sm" onClick={() => act(() => onApprove(proposal.id))} disabled={acting}>
                <CheckCircle2 className="h-4 w-4 mr-1.5" />Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowReject(!showReject)} disabled={acting}>
                <ThumbsDown className="h-4 w-4 mr-1.5" />Reject
              </Button>
            </>
          )}
          {isApproved && (
            <Button size="sm" onClick={() => setShowConvert(!showConvert)} disabled={acting}>
              <FileText className="h-4 w-4 mr-1.5" />Create Quote
            </Button>
          )}
          {(isDraft || isSubmitted || isApproved) && (
            <Button size="sm" variant="ghost" onClick={() => act(() => onArchive(proposal.id))} disabled={acting}>
              <Archive className="h-4 w-4 mr-1.5" />Archive
            </Button>
          )}
        </div>

        {/* Reject panel */}
        {showReject && (
          <div className="space-y-2 p-3 rounded-md bg-destructive/5 border border-destructive/20">
            <Textarea placeholder="Reason for rejection..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={2} />
            <Button size="sm" variant="destructive" disabled={acting || !rejectReason.trim()} onClick={() => act(async () => {
              await onReject(proposal.id, rejectReason);
              setShowReject(false);
              setRejectReason('');
            })}>Confirm Reject</Button>
          </div>
        )}

        {/* Convert to quote panel */}
        {showConvert && (
          <div className="space-y-3 p-3 rounded-md bg-primary/5 border border-primary/20">
            <p className="text-sm font-medium">Convert to Draft Quote</p>
            {proposal.estimate_id && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="include-lines"
                  checked={includeEstimateLines}
                  onCheckedChange={(v) => setIncludeEstimateLines(!!v)}
                />
                <label htmlFor="include-lines" className="text-sm cursor-pointer">
                  Include estimate line items in quote
                </label>
              </div>
            )}
            <Button size="sm" disabled={acting} onClick={() => act(async () => {
              const quoteId = await onConvertToQuote(proposal.id, includeEstimateLines);
              if (quoteId) {
                setShowConvert(false);
                onOpenChange(false);
              }
            })}>Create Quote</Button>
          </div>
        )}

        {proposal.rejected_reason && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/5 border border-destructive/20">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-destructive">Rejection Reason</p>
              <p className="text-sm">{proposal.rejected_reason}</p>
            </div>
          </div>
        )}

        <Separator />

        {/* Audit timeline */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Activity</p>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events yet.</p>
          ) : (
            <div className="space-y-2">
              {events.map(ev => (
                <div key={ev.id} className="flex items-start gap-2 text-sm">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium">{ev.actor?.full_name || 'System'}</span>
                    <span className="text-muted-foreground"> · {ev.event_type}</span>
                    {ev.message && <span className="text-muted-foreground"> — {ev.message}</span>}
                    <p className="text-xs text-muted-foreground">{format(new Date(ev.created_at), 'MMM d, yyyy h:mm a')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
