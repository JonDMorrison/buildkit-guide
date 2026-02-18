import { useState, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { useProposals } from '@/hooks/useProposals';
import { useAuthRole } from '@/hooks/useAuthRole';
import { useCurrentProject } from '@/hooks/useCurrentProject';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, FileText, Search } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CreateProposalModal } from '@/components/proposals/CreateProposalModal';
import { ProposalDetailModal } from '@/components/proposals/ProposalDetailModal';
import type { Proposal } from '@/types/proposals';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  approved: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  rejected: 'bg-destructive/15 text-destructive',
  archived: 'bg-muted text-muted-foreground',
};

export default function Proposals() {
  const { currentProjectId } = useCurrentProject();
  const { isAdmin, isPM } = useAuthRole(currentProjectId ?? undefined);
  const {
    proposals, loading,
    createProposal, updateProposal, submitProposal,
    approveProposal, rejectProposal, archiveProposal,
    fetchEvents, convertToQuote,
  } = useProposals();

  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Proposal | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const canApprove = isAdmin || isPM();

  const filtered = useMemo(() => {
    return proposals.filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const match = p.title.toLowerCase().includes(q)
          || p.project?.name?.toLowerCase().includes(q)
          || p.project?.job_number?.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [proposals, statusFilter, search]);

  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Proposals</h1>
            <p className="text-sm text-muted-foreground">Internal approval checkpoint before customer-facing quotes</p>
          </div>
          {canApprove && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />New Proposal
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search title or project..."
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <h2 className="text-lg font-semibold text-foreground">No proposals yet</h2>
              <p className="text-sm text-muted-foreground mt-1">Create your first internal proposal to begin the approval process.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Estimate</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(p => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelected(p)}
                  >
                    <TableCell className="font-medium">{p.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.project?.job_number && `${p.project.job_number} – `}
                      {p.project?.name || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn('text-xs', STATUS_STYLES[p.status])} variant="secondary">
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.estimate?.estimate_number || '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(p.updated_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); setSelected(p); }}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        <CreateProposalModal
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSubmit={createProposal}
        />

        <ProposalDetailModal
          proposal={selected}
          open={!!selected}
          onOpenChange={open => { if (!open) setSelected(null); }}
          canApprove={canApprove}
          onSubmitForApproval={submitProposal}
          onApprove={approveProposal}
          onReject={rejectProposal}
          onArchive={archiveProposal}
          onUpdate={updateProposal}
          onConvertToQuote={convertToQuote}
          fetchEvents={fetchEvents}
        />
      </div>
    </Layout>
  );
}
