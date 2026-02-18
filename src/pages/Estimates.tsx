import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { SectionHeader } from "@/components/SectionHeader";
import { useEstimates } from "@/hooks/useEstimates";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { useOrganizationRole } from "@/hooks/useOrganizationRole";
import { useToast } from "@/hooks/use-toast";
import { NoAccess } from "@/components/NoAccess";
import { CreateEstimateModal } from "@/components/estimates/CreateEstimateModal";
import { EstimateDetailModal } from "@/components/estimates/EstimateDetailModal";
import { EstimateVarianceView } from "@/components/estimates/EstimateVarianceView";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, FileText, CheckCircle2, Copy, Trash2, BarChart3,
} from "lucide-react";
import { format } from "date-fns";
import type { Estimate } from "@/types/estimates";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Draft", variant: "secondary" },
  approved: { label: "Approved", variant: "default" },
  archived: { label: "Archived", variant: "outline" },
};

const fmtCurrency = (v: number, currency = "CAD") =>
  `${new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(v)} ${currency}`;

const Estimates = () => {
  const { currentProjectId } = useCurrentProject();
  const { role: orgRole, isLoading: orgRoleLoading } = useOrganizationRole();
  const { toast } = useToast();

  const {
    estimates, loading, fetchEstimates,
    approveEstimate, duplicateEstimate, deleteEstimate,
  } = useEstimates(currentProjectId);

  const canEdit = orgRole === 'admin' || orgRole === 'pm';
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedEstimate, setSelectedEstimate] = useState<Estimate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Estimate | null>(null);
  const [tab, setTab] = useState("all");
  const [varianceProjectId, setVarianceProjectId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (tab === "all") return estimates;
    return estimates.filter(e => e.status === tab);
  }, [estimates, tab]);

  const approvedEstimate = estimates.find(e => e.status === 'approved');

  if (orgRoleLoading) {
    return (
      <Layout>
        <div className="p-6 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      </Layout>
    );
  }

  if (!canEdit && orgRole !== 'foreman') {
    return <Layout><NoAccess /></Layout>;
  }

  const handleApprove = async (est: Estimate) => {
    await approveEstimate(est.id);
  };

  const handleDuplicate = async (est: Estimate) => {
    const result = await duplicateEstimate(est.id);
    if (result) {
      toast({ title: "Estimate duplicated", description: "A new draft has been created." });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteEstimate(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <SectionHeader title="Estimates" subtitle="Internal job cost planning" />
          <div className="flex gap-2">
            {currentProjectId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVarianceProjectId(currentProjectId)}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Variance Report
              </Button>
            )}
            {canEdit && (
              <Button size="sm" onClick={() => setCreateOpen(true)} disabled={!currentProjectId}>
                <Plus className="h-4 w-4 mr-2" />
                Create Estimate
              </Button>
            )}
          </div>
        </div>

        {!currentProjectId && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p className="text-lg font-medium">Select a project</p>
              <p className="text-sm mt-1">Choose a project from the sidebar to view estimates.</p>
            </CardContent>
          </Card>
        )}

        {currentProjectId && (
          <>
            {approvedEstimate && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card><CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Contract Value</p>
                  <p className="text-lg font-bold">{fmtCurrency(approvedEstimate.contract_value, (approvedEstimate as any).currency)}</p>
                </CardContent></Card>
                <Card><CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Planned Cost</p>
                  <p className="text-lg font-bold">{fmtCurrency(approvedEstimate.planned_total_cost, (approvedEstimate as any).currency)}</p>
                </CardContent></Card>
                <Card><CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Planned Profit</p>
                  <p className="text-lg font-bold">{fmtCurrency(approvedEstimate.planned_profit, (approvedEstimate as any).currency)}</p>
                </CardContent></Card>
                <Card><CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Margin</p>
                  <p className="text-lg font-bold">{approvedEstimate.planned_margin_percent}%</p>
                </CardContent></Card>
              </div>
            )}

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="all">All ({estimates.length})</TabsTrigger>
                <TabsTrigger value="draft">Draft</TabsTrigger>
                <TabsTrigger value="approved">Approved</TabsTrigger>
                <TabsTrigger value="archived">Archived</TabsTrigger>
              </TabsList>

              <TabsContent value={tab} className="mt-4">
                {loading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : filtered.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                      <p>No estimates found.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Number</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Contract</TableHead>
                          <TableHead className="text-right">Planned Cost</TableHead>
                          <TableHead className="text-right">Margin</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((est) => {
                          const sc = statusConfig[est.status] || statusConfig.draft;
                          return (
                            <TableRow
                              key={est.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => setSelectedEstimate(est)}
                            >
                              <TableCell className="font-medium">{est.estimate_number}</TableCell>
                              <TableCell><Badge variant={sc.variant}>{sc.label}</Badge></TableCell>
                              <TableCell className="text-right">{fmtCurrency(est.contract_value, (est as any).currency)}</TableCell>
                              <TableCell className="text-right">{fmtCurrency(est.planned_total_cost, (est as any).currency)}</TableCell>
                              <TableCell className="text-right">{est.planned_margin_percent}%</TableCell>
                              <TableCell>{format(new Date(est.created_at), "MMM d, yyyy")}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                  {est.status === 'draft' && canEdit && (
                                    <Button variant="ghost" size="icon" onClick={() => handleApprove(est)} title="Approve">
                                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="icon" onClick={() => handleDuplicate(est)} title="Duplicate">
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                  {est.status === 'draft' && canEdit && (
                                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(est)} title="Delete">
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      {createOpen && currentProjectId && (
        <CreateEstimateModal
          projectId={currentProjectId}
          onClose={() => setCreateOpen(false)}
          onCreated={() => { setCreateOpen(false); fetchEstimates(); }}
        />
      )}

      {selectedEstimate && (
        <EstimateDetailModal
          estimate={selectedEstimate}
          canEdit={canEdit}
          onClose={() => setSelectedEstimate(null)}
          onUpdated={() => { setSelectedEstimate(null); fetchEstimates(); }}
        />
      )}

      {varianceProjectId && (
        <EstimateVarianceView
          projectId={varianceProjectId}
          onClose={() => setVarianceProjectId(null)}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Estimate?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {deleteTarget?.estimate_number} and all its line items.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default Estimates;
