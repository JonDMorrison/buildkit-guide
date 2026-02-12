import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Trash2, FileText, Pencil, Save, X, DollarSign, Mail } from "lucide-react";
import { format } from "date-fns";
import type { Invoice, InvoiceLineItem, InvoiceSettings, Client } from "@/types/invoicing";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Draft", variant: "secondary" },
  sent: { label: "Sent", variant: "default" },
  paid: { label: "Paid", variant: "outline" },
  overdue: { label: "Overdue", variant: "destructive" },
  void: { label: "Void", variant: "secondary" },
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  lineItems: InvoiceLineItem[];
  settings: InvoiceSettings | null;
  client: Client | null;
  onSaveLineItems?: (invoiceId: string, items: Partial<InvoiceLineItem>[]) => Promise<void>;
  onUpdateInvoice?: (id: string, updates: Partial<Invoice>) => Promise<boolean>;
  onExportPDF?: (invoice: Invoice) => void;
}

export const InvoiceDetailModal = ({
  open, onOpenChange, invoice, lineItems, settings, client,
  onSaveLineItems, onUpdateInvoice, onExportPDF,
}: Props) => {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editItems, setEditItems] = useState<Partial<InvoiceLineItem>[]>([]);
  const [editNotes, setEditNotes] = useState("");

  useEffect(() => {
    if (open && invoice) {
      setEditing(false);
      setEditItems(lineItems.map((li) => ({ ...li })));
      setEditNotes(invoice.notes || "");
    }
  }, [open, invoice, lineItems]);

  if (!invoice) return null;

  const sc = statusConfig[invoice.status] || statusConfig.draft;
  const canEdit = invoice.status === "draft";
  const isCreditNote = !!invoice.credit_note_for;

  const subtotal = editItems.reduce((s, li) => s + (Number(li.quantity) || 0) * (Number(li.unit_price) || 0), 0);
  const taxAmount = Math.round(subtotal * ((settings?.tax_rate || 0) / 100) * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;
  const balance = Number(invoice.total) - Number(invoice.amount_paid || 0);

  const addLine = () => setEditItems([...editItems, { description: "", quantity: 1, unit_price: 0, category: "other" }]);
  const removeLine = (i: number) => setEditItems(editItems.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: string, value: any) => {
    const updated = [...editItems];
    (updated[i] as any)[field] = value;
    setEditItems(updated);
  };

  const handleSave = async () => {
    if (!onSaveLineItems || !onUpdateInvoice) return;
    setSaving(true);
    await onSaveLineItems(invoice.id, editItems);
    await onUpdateInvoice(invoice.id, { notes: editNotes || null, subtotal, tax_amount: taxAmount, total });
    setSaving(false);
    setEditing(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {isCreditNote ? "Credit Note" : "Invoice"} {invoice.invoice_number}
            <Badge variant={sc.variant}>{sc.label}</Badge>
            {isCreditNote && <Badge variant="outline">Credit Note</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Issue Date</p>
              <p className="font-medium">{format(new Date(invoice.issue_date), "MMM d, yyyy")}</p>
            </div>
            {invoice.due_date && (
              <div>
                <p className="text-muted-foreground">Due Date</p>
                <p className="font-medium">{format(new Date(invoice.due_date), "MMM d, yyyy")}</p>
              </div>
            )}
            {client && (
              <div>
                <p className="text-muted-foreground">Client</p>
                <p className="font-medium">{client.name}</p>
                {client.contact_name && <p className="text-xs text-muted-foreground">{client.contact_name}</p>}
              </div>
            )}
            {invoice.project?.name && (
              <div>
                <p className="text-muted-foreground">Project</p>
                <p className="font-medium">{invoice.project.name}</p>
              </div>
            )}
            {settings?.default_payment_terms && (
              <div>
                <p className="text-muted-foreground">Payment Terms</p>
                <p className="font-medium">{settings.default_payment_terms}</p>
              </div>
            )}
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-semibold">Line Items</Label>
              {canEdit && !editing && (
                <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[45%]">Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  {editing && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(editing ? editItems : lineItems).map((li, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      {editing ? <Input value={li.description || ""} onChange={(e) => updateLine(i, "description", e.target.value)} /> : li.description}
                    </TableCell>
                    <TableCell className="capitalize">{li.category || "other"}</TableCell>
                    <TableCell className="text-right">
                      {editing ? <Input type="number" className="w-16 text-right" value={li.quantity} onChange={(e) => updateLine(i, "quantity", parseFloat(e.target.value) || 0)} /> : li.quantity}
                    </TableCell>
                    <TableCell className="text-right">
                      {editing ? <Input type="number" className="w-24 text-right" value={li.unit_price} onChange={(e) => updateLine(i, "unit_price", parseFloat(e.target.value) || 0)} /> : `$${Number(li.unit_price).toFixed(2)}`}
                    </TableCell>
                    <TableCell className="text-right font-medium">${((Number(li.quantity) || 0) * (Number(li.unit_price) || 0)).toFixed(2)}</TableCell>
                    {editing && (
                      <TableCell>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(i)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {editing && (
              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addLine}>
                <Plus className="h-4 w-4 mr-1" /> Add Line
              </Button>
            )}
          </div>

          {/* Totals */}
          <div className="flex flex-col items-end gap-1 text-sm">
            <div className="flex gap-8">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">${(editing ? subtotal : Number(invoice.subtotal)).toFixed(2)}</span>
            </div>
            {Number(editing ? taxAmount : invoice.tax_amount) > 0 && (
              <div className="flex gap-8">
                <span className="text-muted-foreground">{settings?.tax_label || "Tax"}</span>
                <span className="font-medium">${(editing ? taxAmount : Number(invoice.tax_amount)).toFixed(2)}</span>
              </div>
            )}
            <div className="flex gap-8 text-base font-bold border-t pt-1 mt-1">
              <span>Total</span>
              <span>${(editing ? total : Number(invoice.total)).toFixed(2)}</span>
            </div>
            {Number(invoice.amount_paid || 0) > 0 && !editing && (
              <>
                <div className="flex gap-8 text-sm">
                  <span className="text-muted-foreground">Paid</span>
                  <span className="text-primary font-medium">${Number(invoice.amount_paid).toFixed(2)}</span>
                </div>
                <div className="flex gap-8 text-base font-bold">
                  <span>Balance Due</span>
                  <span>${balance.toFixed(2)}</span>
                </div>
              </>
            )}
          </div>

          {/* Notes */}
          <div>
            <Label className="text-sm font-semibold">Notes</Label>
            {editing ? (
              <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} className="mt-1" />
            ) : (
              <p className="text-sm text-muted-foreground mt-1">{invoice.notes || "—"}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-2">
            {editing ? (
              <>
                <Button variant="outline" onClick={() => { setEditing(false); setEditItems(lineItems.map((li) => ({ ...li }))); setEditNotes(invoice.notes || ""); }} disabled={saving}>
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                  Save Changes
                </Button>
              </>
            ) : (
              <>
                {onExportPDF && (
                  <Button variant="outline" onClick={() => onExportPDF(invoice)}>
                    <FileText className="h-4 w-4 mr-1" /> Download PDF
                  </Button>
                )}
                <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
