import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SectionHeader } from "@/components/SectionHeader";
import { NoAccess } from "@/components/NoAccess";
import { useOrganization } from "@/hooks/useOrganization";
import { useFinancialAccess } from "@/hooks/useFinancialAccess";
import { useChangeOrders, useChangeOrderMutations } from "@/hooks/useChangeOrders";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { formatCurrency } from "@/lib/formatters";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Search, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Draft", variant: "secondary" },
  sent: { label: "Sent", variant: "outline" },
  approved: { label: "Approved", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
};

function useOrgProjects(orgId: string | null) {
  return useQuery({
    queryKey: ['co-projects', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .eq('organization_id', orgId!)
        .neq('status', 'deleted')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId,
  });
}

/** Admin/PM/Foreman-only: change order list page. */
const ChangeOrders = () => {
  const { canView, loading: accessLoading } = useFinancialAccess();

  if (accessLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!canView) {
    return <Layout><NoAccess message="Admin, PM, or Foreman access required." /></Layout>;
  }

  return <ChangeOrdersContent />;
};

function ChangeOrdersContent() {
  const navigate = useNavigate();
  const { activeOrganizationId } = useOrganization();
  const { canWrite } = useFinancialAccess();
  const { data: orders, isLoading } = useChangeOrders(activeOrganizationId ?? null);
  const { data: projects } = useOrgProjects(activeOrganizationId);
  const { create } = useChangeOrderMutations();
  const { currentProjectId } = useCurrentProject();

  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newReason, setNewReason] = useState("");
  const [newProjectId, setNewProjectId] = useState(currentProjectId || "");

  const filtered = (orders ?? []).filter((co) =>
    co.title.toLowerCase().includes(search.toLowerCase()) ||
    co.project?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    if (!newProjectId || !newTitle) return;
    const result = await create.mutateAsync({
      projectId: newProjectId,
      payload: { title: newTitle, reason: newReason },
    });
    setCreateOpen(false);
    setNewTitle("");
    setNewReason("");
    setNewProjectId("");
    if (result?.id) navigate(`/change-orders/${result.id}`);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <SectionHeader title="Change Orders" subtitle="Track and manage project change orders" />
          {canWrite && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> New Change Order
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title or project…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No change orders found.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((co) => {
                    const cfg = statusConfig[co.status] ?? statusConfig.draft;
                    return (
                      <TableRow
                        key={co.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/change-orders/${co.id}`)}
                      >
                        <TableCell className="font-medium">{co.title}</TableCell>
                        <TableCell className="text-muted-foreground">{co.project?.name ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant={cfg.variant}>{cfg.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(co.amount, co.currency)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(co.updated_at), "MMM d, yyyy")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Change Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={newProjectId} onValueChange={setNewProjectId}>
                <SelectTrigger><SelectValue placeholder="Select project…" /></SelectTrigger>
                <SelectContent>
                  {(projects ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Change order title" />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea value={newReason} onChange={(e) => setNewReason(e.target.value)} placeholder="Describe the reason…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newProjectId || !newTitle || create.isPending}>
              {create.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default ChangeOrders;
