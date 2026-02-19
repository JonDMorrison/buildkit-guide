import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { NoAccess } from "@/components/NoAccess";
import { useProjectRole } from "@/hooks/useProjectRole";
import { useOrganizationRole } from "@/hooks/useOrganizationRole";
import {
  useChangeOrder,
  useChangeOrderLineItems,
  useChangeOrderMutations,
} from "@/hooks/useChangeOrders";
import { useProfitRisk } from "@/hooks/useIntelligenceDashboard";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { ConfirmDialog } from "@/components/ConfirmDialog";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle, ArrowLeft, Check, X, Send, Plus, Trash2, Sparkles, ShieldAlert,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Draft", variant: "secondary" },
  sent: { label: "Sent", variant: "outline" },
  approved: { label: "Approved", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
};

const ChangeOrderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isGlobalAdmin, loading: roleLoading } = useProjectRole();
  const { role: orgRole, isLoading: orgRoleLoading } = useOrganizationRole();

  const { data: co, isLoading: coLoading } = useChangeOrder(id ?? null);
  const { data: lineItems, isLoading: liLoading } = useChangeOrderLineItems(id ?? null);
  const { data: risk, isLoading: riskLoading } = useProfitRisk(co?.project_id ?? null);
  const { update, send, approve, addLineItem, updateLineItem, deleteLineItem, suggest } = useChangeOrderMutations();

  const canWrite = isGlobalAdmin || orgRole === 'admin' || orgRole === 'pm';
  const isDraft = co?.status === 'draft';
  const isSent = co?.status === 'sent';

  // Editable fields
  const [editTitle, setEditTitle] = useState<string | null>(null);
  const [editReason, setEditReason] = useState<string | null>(null);

  // New line item
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newQty, setNewQty] = useState("1");
  const [newRate, setNewRate] = useState("0");

  // Confirm dialogs
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState<boolean | null>(null);

  // Suggestion state
  const [suggestionData, setSuggestionData] = useState<any>(null);

  const handleSaveTitle = useCallback(async () => {
    if (!id || editTitle === null) return;
    await update.mutateAsync({ id, payload: { title: editTitle } });
    setEditTitle(null);
  }, [id, editTitle, update]);

  const handleSaveReason = useCallback(async () => {
    if (!id || editReason === null) return;
    await update.mutateAsync({ id, payload: { reason: editReason } });
    setEditReason(null);
  }, [id, editReason, update]);

  const handleAddLine = useCallback(async () => {
    if (!id || !newName) return;
    await addLineItem.mutateAsync({
      changeOrderId: id,
      name: newName,
      description: newDesc,
      quantity: parseFloat(newQty) || 1,
      rate: parseFloat(newRate) || 0,
    });
    setNewName("");
    setNewDesc("");
    setNewQty("1");
    setNewRate("0");
  }, [id, newName, newDesc, newQty, newRate, addLineItem]);

  const handleSuggest = useCallback(async () => {
    if (!co?.project_id) return;
    const result = await suggest.mutateAsync(co.project_id);
    setSuggestionData(result);
  }, [co?.project_id, suggest]);

  const handleApplySuggestion = useCallback(async () => {
    if (!id || !suggestionData?.suggest) return;
    // Update CO fields
    await update.mutateAsync({
      id,
      payload: { title: suggestionData.title, reason: suggestionData.reason },
    });
    // Add suggested line items
    const items = suggestionData.line_items ?? [];
    for (const item of items) {
      await addLineItem.mutateAsync({
        changeOrderId: id,
        name: item.name,
        description: item.description ?? '',
        quantity: item.quantity ?? 1,
        rate: item.rate ?? 0,
      });
    }
    setSuggestionData(null);
  }, [id, suggestionData, update, addLineItem]);

  if (!roleLoading && !orgRoleLoading && !isGlobalAdmin && !orgRole) {
    return <Layout><NoAccess /></Layout>;
  }

  if (coLoading) {
    return (
      <Layout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Layout>
    );
  }

  if (!co) {
    return (
      <Layout>
        <div className="text-center py-12 text-muted-foreground">Change order not found.</div>
      </Layout>
    );
  }

  const cfg = statusConfig[co.status] ?? statusConfig.draft;
  const currency = co.currency;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Back + Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/change-orders")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            {editTitle !== null && isDraft && canWrite ? (
              <div className="flex items-center gap-2">
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="text-lg font-semibold" />
                <Button size="sm" onClick={handleSaveTitle} disabled={update.isPending}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditTitle(null)}>Cancel</Button>
              </div>
            ) : (
              <h1
                className={cn("text-2xl font-bold truncate", isDraft && canWrite && "cursor-pointer hover:text-primary")}
                onClick={() => isDraft && canWrite && setEditTitle(co.title)}
              >
                {co.title}
              </h1>
            )}
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <span>{co.project?.name}</span>
              <span>·</span>
              <Badge variant={cfg.variant}>{cfg.label}</Badge>
              <span>·</span>
              <span>{format(new Date(co.updated_at), "MMM d, yyyy")}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Reason */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Reason</CardTitle>
              </CardHeader>
              <CardContent>
                {editReason !== null && isDraft && canWrite ? (
                  <div className="space-y-2">
                    <Textarea value={editReason} onChange={(e) => setEditReason(e.target.value)} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveReason} disabled={update.isPending}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditReason(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <p
                    className={cn("text-sm whitespace-pre-wrap", isDraft && canWrite && "cursor-pointer hover:text-primary", !co.reason && "text-muted-foreground italic")}
                    onClick={() => isDraft && canWrite && setEditReason(co.reason || '')}
                  >
                    {co.reason || "Click to add a reason…"}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Total */}
            <Card>
              <CardContent className="py-4 flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Total Amount</span>
                <span className="text-2xl font-bold">{formatCurrency(co.amount, currency)}</span>
              </CardContent>
            </Card>

            {/* Line Items */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">Line Items</CardTitle>
                {isDraft && canWrite && (
                  <Button variant="outline" size="sm" onClick={handleSuggest} disabled={suggest.isPending}>
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    {suggest.isPending ? "Analyzing…" : "Generate Suggestion"}
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {/* Suggestion banner */}
                {suggestionData && suggestionData.suggest && (
                  <div className="mx-4 mb-4 p-4 rounded-lg border border-primary/30 bg-primary/5">
                    <div className="flex items-start gap-2 mb-2">
                      <Sparkles className="h-4 w-4 text-primary mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Suggested Change Order</p>
                        <p className="text-xs text-muted-foreground mt-1">{suggestionData.reason}</p>
                        {suggestionData.line_items?.length > 0 && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            {suggestionData.line_items.length} line item(s) · Total: {formatCurrency(
                              suggestionData.line_items.reduce((s: number, li: any) => s + (li.quantity ?? 1) * (li.rate ?? 0), 0),
                              currency
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" onClick={handleApplySuggestion} disabled={update.isPending}>
                        Apply to Draft
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setSuggestionData(null)}>Dismiss</Button>
                    </div>
                  </div>
                )}
                {suggestionData && !suggestionData.suggest && (
                  <div className="mx-4 mb-4 p-3 rounded-lg border bg-muted/50 text-sm text-muted-foreground">
                    No suggestion: {suggestionData.reason}
                  </div>
                )}

                {liLoading ? (
                  <div className="p-4"><Skeleton className="h-20 w-full" /></div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        {isDraft && canWrite && <TableHead className="w-10" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(lineItems ?? []).map((li) => (
                        <TableRow key={li.id}>
                          <TableCell>
                            <div className="font-medium">{li.name}</div>
                            {li.description && <div className="text-xs text-muted-foreground">{li.description}</div>}
                          </TableCell>
                          <TableCell className="text-right font-mono">{li.quantity}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(li.rate, currency)}</TableCell>
                          <TableCell className="text-right font-mono font-medium">{formatCurrency(li.amount, currency)}</TableCell>
                          {isDraft && canWrite && (
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => deleteLineItem.mutate(li.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                      {(lineItems ?? []).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={isDraft && canWrite ? 5 : 4} className="text-center text-muted-foreground py-8">
                            No line items yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}

                {/* Add line item */}
                {isDraft && canWrite && (
                  <>
                    <Separator />
                    <div className="p-4 grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                      <div className="col-span-2 md:col-span-1 space-y-1">
                        <Label className="text-xs">Name</Label>
                        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Item name" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Description</Label>
                        <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Optional" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Qty</Label>
                        <Input type="number" value={newQty} onChange={(e) => setNewQty(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Rate</Label>
                        <Input type="number" value={newRate} onChange={(e) => setNewRate(e.target.value)} />
                      </div>
                      <Button onClick={handleAddLine} disabled={!newName || addLineItem.isPending} className="h-11">
                        <Plus className="h-4 w-4 mr-1" /> Add
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Status Actions */}
            {canWrite && (
              <div className="flex gap-3">
                {isDraft && (
                  <Button onClick={() => setConfirmSend(true)} disabled={send.isPending}>
                    <Send className="h-4 w-4 mr-2" /> Send for Review
                  </Button>
                )}
                {isSent && (
                  <>
                    <Button onClick={() => setConfirmApprove(true)}>
                      <Check className="h-4 w-4 mr-2" /> Approve
                    </Button>
                    <Button variant="destructive" onClick={() => setConfirmApprove(false)}>
                      <X className="h-4 w-4 mr-2" /> Reject
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right sidebar: Risk Evidence */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  Risk Evidence
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {riskLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-5 w-1/2" />
                  </div>
                ) : !risk ? (
                  <p className="text-sm text-muted-foreground">No risk data available for this project.</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Risk Score</span>
                      <Badge variant={risk.risk_level === 'high' ? 'destructive' : risk.risk_level === 'medium' ? 'secondary' : 'outline'}>
                        {risk.risk_score}/100 — {risk.risk_level}
                      </Badge>
                    </div>
                    {risk.projected_margin != null && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Projected Margin</span>
                        <span className={risk.projected_margin < 0 ? 'text-destructive' : ''}>{formatPercent(risk.projected_margin)}</span>
                      </div>
                    )}
                    {risk.projected_final_cost != null && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Projected Final</span>
                        <span>{formatCurrency(risk.projected_final_cost, currency)}</span>
                      </div>
                    )}
                    {risk.estimate_total_cost != null && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Estimate Total</span>
                        <span>{formatCurrency(risk.estimate_total_cost, currency)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Actual Cost</span>
                      <span>{formatCurrency(risk.actual_total_cost, currency)}</span>
                    </div>
                    {risk.drivers.length > 0 && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <span className="text-xs font-medium text-muted-foreground">Risk Drivers</span>
                          {risk.drivers.map((d) => (
                            <div key={d.key} className="flex items-start gap-2 text-xs">
                              <ShieldAlert className={cn(
                                "h-3 w-3 mt-0.5 shrink-0",
                                d.severity === 'high' ? 'text-destructive' : 'text-muted-foreground'
                              )} />
                              <div>
                                <span className="font-medium">{d.label}</span>
                                {d.evidence && <p className="text-muted-foreground">{d.evidence}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Confirm Send */}
      <ConfirmDialog
        open={confirmSend}
        onCancel={() => setConfirmSend(false)}
        title="Send Change Order?"
        description="This will notify project managers for review. You won't be able to edit after sending."
        confirmLabel="Send"
        onConfirm={async () => {
          await send.mutateAsync(id!);
          setConfirmSend(false);
        }}
      />

      {/* Confirm Approve/Reject */}
      <ConfirmDialog
        open={confirmApprove !== null}
        onCancel={() => setConfirmApprove(null)}
        title={confirmApprove ? "Approve Change Order?" : "Reject Change Order?"}
        description={confirmApprove ? "This will mark the change order as approved." : "This will reject the change order."}
        confirmLabel={confirmApprove ? "Approve" : "Reject"}
        variant={confirmApprove ? "default" : "destructive"}
        onConfirm={async () => {
          await approve.mutateAsync({ id: id!, approved: confirmApprove! });
          setConfirmApprove(null);
        }}
      />
    </Layout>
  );
};

export default ChangeOrderDetail;
