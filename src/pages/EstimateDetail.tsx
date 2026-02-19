import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useEstimates } from "@/hooks/useEstimates";
import { useOrganizationRole } from "@/hooks/useOrganizationRole";
import { useToast } from "@/hooks/use-toast";
import { NoAccess } from "@/components/NoAccess";
import { EstimateVarianceView } from "@/components/estimates/EstimateVarianceView";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, CheckCircle2, Copy, Lock, Plus, Trash2, Wand2, Save, Loader2, BarChart3,
} from "lucide-react";
import { format } from "date-fns";
import type { Estimate, EstimateLineItem } from "@/types/estimates";

const ITEM_TYPES = [
  { value: "labor", label: "Labor" },
  { value: "material", label: "Material" },
  { value: "machine", label: "Machine" },
  { value: "other", label: "Other" },
];

import { formatCurrency } from "@/lib/formatters";

const fmtCurrency = (v: number, currency = "CAD") => formatCurrency(v, currency);

const EstimateDetail = () => {
  const { estimateId } = useParams<{ estimateId: string }>();
  const navigate = useNavigate();
  const { role: orgRole, isLoading: orgRoleLoading } = useOrganizationRole();
  const { toast } = useToast();

  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [lineItems, setLineItems] = useState<EstimateLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showVariance, setShowVariance] = useState(false);
  const [varianceKey, setVarianceKey] = useState(0);
  const refreshVariance = () => setVarianceKey(k => k + 1);

  // Editable header fields
  const [contractValue, setContractValue] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [noteCustomer, setNoteCustomer] = useState("");

  // New line item drafts
  const [newLines, setNewLines] = useState<Array<{
    item_type: string; name: string; description: string;
    quantity: number; unit: string; rate: number; sales_tax_rate: number;
  }>>([]);

  const {
    estimates, fetchEstimates, fetchLineItems,
    approveEstimate, duplicateEstimate,
    updateEstimateHeader, upsertLineItem, deleteLineItem,
    generateTasksFromEstimate, fetchVariance,
  } = useEstimates(estimate?.project_id);

  const canEdit = orgRole === "admin" || orgRole === "pm";

  // Load estimate from the list or by fetching
  useEffect(() => {
    if (!estimateId) return;
    const found = estimates.find(e => e.id === estimateId);
    if (found) {
      setEstimate(found);
      setContractValue(String(found.contract_value));
      setInternalNotes(found.internal_notes || "");
      setNoteCustomer(found.note_for_customer || "");
    }
  }, [estimateId, estimates]);

  // Load line items
  const loadLineItems = useCallback(async () => {
    if (!estimateId) return;
    setLoading(true);
    const items = await fetchLineItems(estimateId);
    setLineItems(items);
    setLoading(false);
  }, [estimateId, fetchLineItems]);

  useEffect(() => { loadLineItems(); }, [loadLineItems]);

  if (orgRoleLoading || (loading && !estimate)) {
    return (
      <Layout>
        <div className="p-6 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      </Layout>
    );
  }

  if (!canEdit && orgRole !== "foreman") {
    return <Layout><NoAccess /></Layout>;
  }

  if (!estimate) {
    return (
      <Layout>
        <div className="p-6 text-center text-muted-foreground">
          <p>Estimate not found.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/estimates")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Estimates
          </Button>
        </div>
      </Layout>
    );
  }

  const isDraft = estimate.status === "draft";
  const subtotal = lineItems.reduce((s, li) => s + li.amount, 0);
  const totalTax = lineItems.reduce((s, li) => s + li.sales_tax_amount, 0);
  const laborCount = lineItems.filter(li => li.item_type === "labor").length;
  const cur = estimate.currency || "CAD";


  const handleSaveHeader = async () => {
    setSaving(true);
    await updateEstimateHeader(estimate.id, {
      contract_value: Number(contractValue) || 0,
      internal_notes: internalNotes || null,
      note_for_customer: noteCustomer || null,
    });
    setSaving(false);
    toast({ title: "Estimate saved" });
    await fetchEstimates();
    refreshVariance();
  };

  const handleAddLine = () => {
    setNewLines(prev => [...prev, {
      item_type: "labor", name: "", description: "",
      quantity: 1, unit: "hours", rate: 0, sales_tax_rate: 0,
    }]);
  };

  const handleSaveNewLine = async (idx: number) => {
    const li = newLines[idx];
    if (!li.name.trim()) return;
    setSaving(true);
    await upsertLineItem(estimate.id, null, {
      item_type: li.item_type, name: li.name,
      description: li.description || null,
      quantity: li.quantity, unit: li.unit || null,
      rate: li.rate, sales_tax_rate: li.sales_tax_rate,
    });
    setNewLines(prev => prev.filter((_, i) => i !== idx));
    await loadLineItems();
    setSaving(false);
    refreshVariance();
  };

  const handleDeleteLine = async (id: string) => {
    await deleteLineItem(id);
    await loadLineItems();
    refreshVariance();
  };

  const handleGenerate = async () => {
    setGenerating(true);
    await generateTasksFromEstimate(estimate.id);
    setGenerating(false);
  };

  return (
    <Layout>
      <div className="p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/estimates")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold">{estimate.estimate_number}</h1>
              <Badge variant={estimate.status === "approved" ? "default" : "secondary"}>
                {estimate.status === "approved" && <Lock className="h-3 w-3 mr-1" />}
                {estimate.status.charAt(0).toUpperCase() + estimate.status.slice(1)}
              </Badge>
              <Badge variant="outline" className="text-xs">{cur}</Badge>
            </div>
            {estimate.project && (
              <p className="text-sm text-muted-foreground mt-0.5">{estimate.project.name}</p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowVariance(true)}>
            <BarChart3 className="h-4 w-4 mr-2" /> Variance
          </Button>
        </div>

        {/* Side-by-side layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: Estimate Editor */}
          <div className="space-y-6">
            {/* Header info */}
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Contract Value</p>
                    {isDraft && canEdit ? (
                      <Input type="number" value={contractValue} onChange={e => setContractValue(e.target.value)} className="h-8 text-sm" />
                    ) : (
                      <p className="font-semibold">{fmtCurrency(estimate.contract_value, cur)}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Planned Total Cost</p>
                    <p className="font-semibold">{fmtCurrency(estimate.planned_total_cost, cur)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Planned Margin</p>
                    <p className="font-semibold">{estimate.planned_margin_percent}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Labor Hours</p>
                    <p className="font-semibold">{estimate.planned_labor_hours}h @ {fmtCurrency(estimate.planned_labor_bill_rate, cur)}/hr</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Material Cost</p>
                    <p className="font-semibold">{fmtCurrency(estimate.planned_material_cost, cur)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Machine Cost</p>
                    <p className="font-semibold">{fmtCurrency(estimate.planned_machine_cost, cur)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Addresses */}
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Bill To</p>
                    <p>{estimate.bill_to_name || "—"}</p>
                    <p className="text-muted-foreground">{estimate.bill_to_address || ""}</p>
                    <p className="text-muted-foreground">{estimate.bill_to_ap_email || ""}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Ship To</p>
                    <p>{estimate.ship_to_name || "—"}</p>
                    <p className="text-muted-foreground">{estimate.ship_to_address || ""}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Line Items */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold">Line Items</p>
                  {isDraft && canEdit && (
                    <Button variant="outline" size="sm" onClick={handleAddLine}>
                      <Plus className="h-3 w-3 mr-1" /> Add Row
                    </Button>
                  )}
                </div>
                {loading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : (
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead className="text-right">Rate</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">Tax</TableHead>
                          {isDraft && canEdit && <TableHead className="w-10"></TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lineItems.map(li => (
                          <TableRow key={li.id}>
                            <TableCell><Badge variant="outline" className="text-xs">{li.item_type}</Badge></TableCell>
                            <TableCell>{li.name}</TableCell>
                            <TableCell className="text-right">{li.quantity}</TableCell>
                            <TableCell>{li.unit || "—"}</TableCell>
                            <TableCell className="text-right">{fmtCurrency(li.rate, cur)}</TableCell>
                            <TableCell className="text-right font-medium">{fmtCurrency(li.amount, cur)}</TableCell>
                            <TableCell className="text-right">{fmtCurrency(li.sales_tax_amount, cur)}</TableCell>
                            {isDraft && canEdit && (
                              <TableCell>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteLine(li.id)}>
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                        {newLines.map((nl, idx) => (
                          <TableRow key={`new-${idx}`} className="bg-muted/30">
                            <TableCell>
                              <Select value={nl.item_type} onValueChange={v => setNewLines(prev => prev.map((l, i) => i === idx ? { ...l, item_type: v } : l))}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {ITEM_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input className="h-8 text-sm" value={nl.name} onChange={e => setNewLines(prev => prev.map((l, i) => i === idx ? { ...l, name: e.target.value } : l))} placeholder="Item name" />
                            </TableCell>
                            <TableCell>
                              <Input className="h-8 text-sm w-16" type="number" value={nl.quantity} onChange={e => setNewLines(prev => prev.map((l, i) => i === idx ? { ...l, quantity: Number(e.target.value) } : l))} />
                            </TableCell>
                            <TableCell>
                              <Input className="h-8 text-sm w-16" value={nl.unit} onChange={e => setNewLines(prev => prev.map((l, i) => i === idx ? { ...l, unit: e.target.value } : l))} />
                            </TableCell>
                            <TableCell>
                              <Input className="h-8 text-sm w-20" type="number" value={nl.rate} onChange={e => setNewLines(prev => prev.map((l, i) => i === idx ? { ...l, rate: Number(e.target.value) } : l))} />
                            </TableCell>
                            <TableCell className="text-right text-sm">{fmtCurrency(nl.quantity * nl.rate, cur)}</TableCell>
                            <TableCell>
                              <Input className="h-8 text-sm w-16" type="number" value={nl.sales_tax_rate} onChange={e => setNewLines(prev => prev.map((l, i) => i === idx ? { ...l, sales_tax_rate: Number(e.target.value) } : l))} />
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSaveNewLine(idx)} disabled={saving}>
                                <Save className="h-3 w-3 text-primary" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                <div className="flex justify-end mt-2 space-x-6 text-sm">
                  <span>Subtotal: <strong>{fmtCurrency(subtotal, cur)}</strong></span>
                  <span>Tax: <strong>{fmtCurrency(totalTax, cur)}</strong></span>
                  <span>Total: <strong>{fmtCurrency(subtotal + totalTax, cur)}</strong></span>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            {isDraft && canEdit ? (
              <Card>
                <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Note for Customer</Label>
                    <Textarea value={noteCustomer} onChange={e => setNoteCustomer(e.target.value)} rows={3} />
                  </div>
                  <div>
                    <Label className="text-xs">Internal Notes</Label>
                    <Textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)} rows={3} />
                  </div>
                </CardContent>
              </Card>
            ) : (
              (estimate.note_for_customer || estimate.internal_notes) && (
                <Card>
                  <CardContent className="p-4 grid grid-cols-2 gap-4 text-sm">
                    {estimate.note_for_customer && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground">Note for Customer</p>
                        <p className="whitespace-pre-wrap">{estimate.note_for_customer}</p>
                      </div>
                    )}
                    {estimate.internal_notes && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground">Internal Notes</p>
                        <p className="whitespace-pre-wrap">{estimate.internal_notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            )}

            {/* Generate Tasks */}
            {canEdit && laborCount > 0 && (
              <Card>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Generate Tasks from Estimate</p>
                    <p className="text-xs text-muted-foreground">{laborCount} labor line items → scope items → tasks (idempotent)</p>
                  </div>
                  <Button size="sm" onClick={handleGenerate} disabled={generating}>
                    {generating ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Wand2 className="h-4 w-4 mr-1.5" />}
                    Generate Tasks
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">
              {isDraft && canEdit && (
                <>
                  <Button variant="outline" onClick={handleSaveHeader} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <Save className="h-4 w-4 mr-2" /> Save
                  </Button>
                  <Button
                    variant="default"
                    onClick={async () => {
                      await approveEstimate(estimate.id);
                      await fetchEstimates();
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" /> Approve & Lock
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                onClick={async () => {
                  await duplicateEstimate(estimate.id);
                }}
              >
                <Copy className="h-4 w-4 mr-2" /> Duplicate
              </Button>
            </div>
          </div>

          {/* RIGHT: Variance Panel (always visible) */}
          <div>
            <VariancePanel
              projectId={estimate.project_id}
              fetchVariance={fetchVariance}
              key={`variance-${varianceKey}`}
            />
          </div>
        </div>
      </div>

      {showVariance && (
        <EstimateVarianceView
          projectId={estimate.project_id}
          onClose={() => setShowVariance(false)}
        />
      )}
    </Layout>
  );
};

// Inline variance panel (embedded, not a dialog)
import type { EstimateVarianceSummary } from "@/types/estimates";
import { TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const VariancePanel = ({ projectId, fetchVariance }: {
  projectId: string;
  fetchVariance: (projId: string) => Promise<EstimateVarianceSummary | null>;
}) => {
  const [data, setData] = useState<EstimateVarianceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const result = await fetchVariance(projectId);
      setData(result);
      setLoading(false);
    };
    load();
  }, [projectId, fetchVariance]);

  const cur = data?.currency || "CAD";
  const fmt = (v: number) => formatCurrency(v, cur);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-semibold">Variance Report</p>
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  if (!data?.has_estimate) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <p className="text-sm">No variance data available yet.</p>
        </CardContent>
      </Card>
    );
  }

  const DeltaCell = ({ value }: { value: number }) => {
    const isNeg = value < 0;
    const isPos = value > 0;
    return (
      <span className={isPos ? "text-destructive font-medium" : isNeg ? "text-status-complete font-medium" : ""}>
        {isPos && "+"}{fmt(value)}
        {isPos && <TrendingUp className="inline h-3 w-3 ml-1" />}
        {isNeg && <TrendingDown className="inline h-3 w-3 ml-1" />}
      </span>
    );
  };

  return (
    <div className="space-y-4 sticky top-6">
      <Card>
        <CardContent className="p-4 space-y-4">
          <p className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Real-Time Variance
            <Badge variant="outline" className="text-xs ml-auto">{cur}</Badge>
          </p>

          {/* Margin KPIs */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Contract</p>
              <p className="text-sm font-bold">{fmt(data.margin.contract_value)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Actual Profit</p>
              <p className={`text-sm font-bold ${data.margin.actual_profit < 0 ? "text-destructive" : "text-status-complete"}`}>
                {fmt(data.margin.actual_profit)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Margin</p>
              <p className={`text-sm font-bold ${data.margin.actual_margin_percent < 0 ? "text-destructive" : ""}`}>
                {data.margin.actual_margin_percent}%
              </p>
              <p className="text-xs text-muted-foreground">Plan: {data.planned.margin_percent}%</p>
            </div>
          </div>

          <Separator />

          {/* Breakdown */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Category</TableHead>
                <TableHead className="text-right text-xs">Planned</TableHead>
                <TableHead className="text-right text-xs">Actual</TableHead>
                <TableHead className="text-right text-xs">Delta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { label: "Labor Hours", p: `${data.planned.labor_hours}h`, a: `${data.actual.labor_hours}h`, d: data.deltas.labor_hours, isCur: false },
                { label: "Labor Cost", p: fmt(data.planned.labor_bill_amount), a: fmt(data.actual.labor_cost), d: data.deltas.labor_cost, isCur: true },
                { label: "Materials", p: fmt(data.planned.material_cost), a: fmt(data.actual.material_cost), d: data.deltas.material, isCur: true },
                { label: "Machine", p: fmt(data.planned.machine_cost), a: fmt(data.actual.machine_cost), d: data.deltas.machine, isCur: true },
                { label: "Other", p: fmt(data.planned.other_cost), a: fmt(data.actual.other_cost), d: data.deltas.other, isCur: true },
              ].map(row => (
                <TableRow key={row.label}>
                  <TableCell className="text-xs font-medium">{row.label}</TableCell>
                  <TableCell className="text-right text-xs">{row.p}</TableCell>
                  <TableCell className="text-right text-xs">{row.a}</TableCell>
                  <TableCell className="text-right text-xs">
                    {row.isCur ? <DeltaCell value={row.d} /> : (
                      <span className={row.d > 0 ? "text-destructive" : row.d < 0 ? "text-status-complete" : ""}>
                        {row.d > 0 && "+"}{row.d}h
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold border-t-2">
                <TableCell className="text-xs">Total</TableCell>
                <TableCell className="text-right text-xs">{fmt(data.planned.total_cost)}</TableCell>
                <TableCell className="text-right text-xs">{fmt(data.actual.total_cost)}</TableCell>
                <TableCell className="text-right text-xs"><DeltaCell value={data.deltas.total_cost} /></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Diagnostics */}
      {(data.diagnostics.missing_cost_rates_hours > 0 || data.diagnostics.currency_mismatch_detected) && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-semibold flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 text-status-warning" /> Data Quality
            </p>
            {data.diagnostics.missing_cost_rates_hours > 0 && (
              <Alert variant="default" className="text-xs">
                <AlertTitle className="text-xs">Unrated Labor</AlertTitle>
                <AlertDescription className="text-xs">
                  {data.diagnostics.missing_cost_rates_hours}h ({data.diagnostics.missing_cost_rates_count} entries) missing cost rates.
                </AlertDescription>
              </Alert>
            )}
            {data.diagnostics.currency_mismatch_detected && (
              <Alert variant="destructive" className="text-xs">
                <AlertTitle className="text-xs">Currency Mismatch</AlertTitle>
                <AlertDescription className="text-xs">
                  {data.diagnostics.currency_mismatch_hours}h excluded.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default EstimateDetail;
