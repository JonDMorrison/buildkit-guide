import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useEstimates } from "@/hooks/useEstimates";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Copy, Lock, Plus, Trash2, Wand2, Save, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { format } from "date-fns";
import type { Estimate, EstimateLineItem } from "@/types/estimates";

interface Props {
  estimate: Estimate;
  canEdit: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

const ITEM_TYPES = [
  { value: "labor", label: "Labor" },
  { value: "material", label: "Material" },
  { value: "machine", label: "Machine" },
  { value: "other", label: "Other" },
];

// formatCurrency imported from @/lib/formatters — currency bound per-estimate via fc() below

export const EstimateDetailModal = ({ estimate, canEdit, onClose, onUpdated }: Props) => {
  const {
    fetchLineItems, approveEstimate, duplicateEstimate,
    updateEstimateHeader, upsertLineItem, deleteLineItem,
    generateTasksFromEstimate,
  } = useEstimates(estimate.project_id);
  const { toast } = useToast();
  const fc = (v: number) => formatCurrency(v, estimate.currency);

  const [lineItems, setLineItems] = useState<EstimateLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Editable header fields
  const [contractValue, setContractValue] = useState(String(estimate.contract_value));
  const [internalNotes, setInternalNotes] = useState(estimate.internal_notes || "");
  const [noteCustomer, setNoteCustomer] = useState(estimate.note_for_customer || "");

  // New line item draft
  const [newLines, setNewLines] = useState<Array<{
    item_type: string; name: string; description: string;
    quantity: number; unit: string; rate: number; sales_tax_rate: number;
  }>>([]);

  useEffect(() => {
    const load = async () => {
      const items = await fetchLineItems(estimate.id);
      setLineItems(items);
      setLoading(false);
    };
    load();
  }, [estimate.id]);

  const isDraft = estimate.status === "draft";
  const subtotal = lineItems.reduce((s, li) => s + li.amount, 0);
  const totalTax = lineItems.reduce((s, li) => s + li.sales_tax_amount, 0);
  const laborCount = lineItems.filter(li => li.item_type === 'labor').length;

  const handleSaveHeader = async () => {
    setSaving(true);
    await updateEstimateHeader(estimate.id, {
      contract_value: Number(contractValue) || 0,
      internal_notes: internalNotes || null,
      note_for_customer: noteCustomer || null,
    });
    setSaving(false);
    toast({ title: "Estimate saved" });
    onUpdated();
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
      item_type: li.item_type,
      name: li.name,
      description: li.description || null,
      quantity: li.quantity,
      unit: li.unit || null,
      rate: li.rate,
      sales_tax_rate: li.sales_tax_rate,
    });
    setNewLines(prev => prev.filter((_, i) => i !== idx));
    const items = await fetchLineItems(estimate.id);
    setLineItems(items);
    setSaving(false);
  };

  const handleDeleteLine = async (id: string) => {
    await deleteLineItem(id);
    const items = await fetchLineItems(estimate.id);
    setLineItems(items);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    await generateTasksFromEstimate(estimate.id);
    setGenerating(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle>{estimate.estimate_number}</DialogTitle>
            <Badge variant={estimate.status === "approved" ? "default" : "secondary"}>
              {estimate.status === "approved" && <Lock className="h-3 w-3 mr-1" />}
              {estimate.status.charAt(0).toUpperCase() + estimate.status.slice(1)}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header info */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Contract Value</p>
              {isDraft && canEdit ? (
                <Input type="number" value={contractValue} onChange={e => setContractValue(e.target.value)} className="h-8 text-sm" />
              ) : (
                <p className="font-semibold">{fc(estimate.contract_value)}</p>
              )}
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Planned Total Cost</p>
              <p className="font-semibold">{fc(estimate.planned_total_cost)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Planned Margin</p>
              <p className="font-semibold">{estimate.planned_margin_percent}%</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Labor Hours</p>
              <p className="font-semibold">{estimate.planned_labor_hours}h @ {fc(estimate.planned_labor_bill_rate)}/hr</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Material Cost</p>
              <p className="font-semibold">{fc(estimate.planned_material_cost)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Machine Cost</p>
              <p className="font-semibold">{fc(estimate.planned_machine_cost)}</p>
            </div>
          </div>

          {/* Addresses */}
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

          {/* Line Items */}
          <div>
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
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{li.item_type}</Badge>
                        </TableCell>
                        <TableCell>{li.name}</TableCell>
                        <TableCell className="text-right">{li.quantity}</TableCell>
                        <TableCell>{li.unit || "—"}</TableCell>
                        <TableCell className="text-right">{fc(li.rate)}</TableCell>
                        <TableCell className="text-right font-medium">{fc(li.amount)}</TableCell>
                        <TableCell className="text-right">{fc(li.sales_tax_amount)}</TableCell>
                        {isDraft && canEdit && (
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteLine(li.id)}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    {/* New unsaved lines */}
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
                        <TableCell className="text-right text-sm">{fc(nl.quantity * nl.rate)}</TableCell>
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
              <span>Subtotal: <strong>{fc(subtotal)}</strong></span>
              <span>Tax: <strong>{fc(totalTax)}</strong></span>
              <span>Total: <strong>{fc(subtotal + totalTax)}</strong></span>
            </div>
          </div>

          {/* Notes */}
          {isDraft && canEdit ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Note for Customer</Label>
                <Textarea value={noteCustomer} onChange={e => setNoteCustomer(e.target.value)} rows={3} />
              </div>
              <div>
                <Label className="text-xs">Internal Notes</Label>
                <Textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)} rows={3} />
              </div>
            </div>
          ) : (
            (estimate.note_for_customer || estimate.internal_notes) && (
              <div className="grid grid-cols-2 gap-4 text-sm">
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
              </div>
            )
          )}

          {/* Generate Tasks CTA */}
          {canEdit && laborCount > 0 && (
            <>
              <Separator />
              <div className="flex items-center justify-between p-3 rounded-md border border-dashed">
                <div>
                  <p className="text-sm font-medium">Generate Tasks from Estimate</p>
                  <p className="text-xs text-muted-foreground">{laborCount} labor line items → scope items → tasks (idempotent)</p>
                </div>
                <Button size="sm" onClick={handleGenerate} disabled={generating}>
                  {generating ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Wand2 className="h-4 w-4 mr-1.5" />}
                  Generate Tasks
                </Button>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            {isDraft && canEdit && (
              <>
                <Button variant="outline" onClick={handleSaveHeader} loading={saving}>
                  <Save className="h-4 w-4 mr-2" /> Save
                </Button>
                <Button
                  variant="default"
                  onClick={async () => {
                    await approveEstimate(estimate.id);
                    onUpdated();
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
                onUpdated();
              }}
            >
              <Copy className="h-4 w-4 mr-2" /> Duplicate as Draft
            </Button>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
