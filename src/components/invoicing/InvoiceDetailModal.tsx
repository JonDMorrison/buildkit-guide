import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Trash2, FileText, Pencil, Save, X, Clock, RefreshCw, MapPin, Mail } from "lucide-react";
import { format } from "date-fns";
import { useInvoicePayments } from "@/hooks/useInvoicePayments";
import { InvoiceActivityTimeline } from "@/components/invoicing/InvoiceActivityTimeline";
import { InvoiceApprovalActions } from "@/components/invoicing/InvoiceApprovalActions";
import type { Invoice, InvoiceLineItem, InvoiceSettings, Client } from "@/types/invoicing";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Draft", variant: "secondary" },
  sent: { label: "Sent", variant: "default" },
  paid: { label: "Paid", variant: "outline" },
  overdue: { label: "Overdue", variant: "destructive" },
  void: { label: "Void", variant: "secondary" },
};

const invoiceTypeLabels: Record<string, string> = {
  standard: "Standard",
  progress: "Progress",
  deposit: "Deposit",
  retainage_release: "Holdback Release",
};

interface ProjectWithClient {
  id: string;
  name: string;
  client_id?: string | null;
  location?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  lineItems: InvoiceLineItem[];
  settings: InvoiceSettings | null;
  client: Client | null;
  clients?: Client[];
  projects?: ProjectWithClient[];
  onSaveLineItems?: (invoiceId: string, items: Partial<InvoiceLineItem>[]) => Promise<void>;
  onUpdateInvoice?: (id: string, updates: Partial<Invoice>) => Promise<boolean>;
  onExportPDF?: (invoice: Invoice) => void;
  onSaved?: () => Promise<void>;
  currencySymbol?: string;
}

export const InvoiceDetailModal = ({
  open, onOpenChange, invoice, lineItems, settings, client, clients, projects,
  onSaveLineItems, onUpdateInvoice, onExportPDF, onSaved, currencySymbol = "$",
}: Props) => {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editItems, setEditItems] = useState<Partial<InvoiceLineItem>[]>([]);
  const [editNotes, setEditNotes] = useState("");
  const { payments, loading: paymentsLoading, fetchPayments } = useInvoicePayments();

  useEffect(() => {
    if (open && invoice) {
      setEditing(false);
      setEditItems(lineItems.map((li) => ({ ...li })));
      setEditNotes(invoice.notes || "");
      fetchPayments(invoice.id);
    }
  }, [open, invoice, lineItems, fetchPayments]);

  if (!invoice) return null;

  const extInvoice = invoice as Invoice & {
    invoice_type?: string;
    contract_total?: number;
    progress_percent?: number;
    retainage_amount?: number;
    retainage_percent?: number;
    retainage_released?: boolean;
  };

  const sc = statusConfig[invoice.status] || statusConfig.draft;
  const canEdit = invoice.status === "draft";
  const isCreditNote = !!invoice.credit_note_for;
  const invType = extInvoice.invoice_type || "standard";

  const subtotal = editItems.reduce((s, li) => s + (Number(li.quantity) || 0) * (Number(li.unit_price) || 0), 0);
  const taxAmount = Math.round(subtotal * ((settings?.tax_rate || 0) / 100) * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;
  const balance = Number(invoice.total) - Number(invoice.amount_paid || 0);

  const fmt = (n: number) => `${currencySymbol}${n.toFixed(2)}`;

  const addLine = () => setEditItems([...editItems, { description: "", quantity: 1, unit_price: 0, category: "other" }]);
  const removeLine = (i: number) => setEditItems(editItems.filter((_, idx) => idx !== i));
  const updateLine = <K extends keyof InvoiceLineItem>(i: number, field: K, value: Partial<InvoiceLineItem>[K]) => {
    const updated = [...editItems];
    updated[i][field] = value;
    setEditItems(updated);
  };

  const handleSave = async () => {
    if (!onSaveLineItems || !onUpdateInvoice) return;
    setSaving(true);
    await onSaveLineItems(invoice.id, editItems);
    await onUpdateInvoice(invoice.id, { notes: editNotes || null, subtotal, tax_amount: taxAmount, total });
    setSaving(false);
    setEditing(false);
    onSaved?.();
  };

  // Resolve current billing info from client/project for snapshot refresh
  const resolveCurrentSnapshot = () => {
    if (!onUpdateInvoice || !invoice) return;
    const billingClient = (() => {
      if (!invoice.project_id || !projects || !clients) return client;
      const proj = projects.find(p => p.id === invoice.project_id);
      if (!proj?.client_id) return client;
      const directClient = clients.find(c => c.id === proj.client_id);
      if (!directClient) return client;
      const parentId = directClient.parent_client_id;
      return parentId ? clients.find(c => c.id === parentId) || directClient : directClient;
    })();

    const proj = projects?.find(p => p.id === invoice.project_id);
    const billAddress = billingClient
      ? [billingClient.billing_address, billingClient.city, billingClient.province, billingClient.postal_code].filter(Boolean).join(", ")
      : null;

    const updates: Partial<Invoice> = {
      bill_to_client_id: billingClient?.id || null,
      bill_to_name: billingClient?.name || null,
      bill_to_address: billAddress || null,
      ship_to_address: proj?.location || null,
      send_to_emails: billingClient?.ap_email || billingClient?.email || null,
    };
    onUpdateInvoice(invoice.id, updates).then(() => onSaved?.());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 flex-wrap">
            {isCreditNote ? "Credit Note" : "Invoice"} {invoice.invoice_number}
            <Badge variant={sc.variant}>{sc.label}</Badge>
            {isCreditNote && <Badge variant="outline">Credit Note</Badge>}
            {invType !== "standard" && <Badge variant="outline">{invoiceTypeLabels[invType]}</Badge>}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details" className="space-y-3">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="activity"><Clock className="h-3.5 w-3.5 mr-1" />Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
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
              {invoice.po_number && (
                <div>
                  <p className="text-muted-foreground">PO Number</p>
                  <p className="font-medium">{invoice.po_number}</p>
                </div>
              )}
              {settings?.default_payment_terms && (
                <div>
                  <p className="text-muted-foreground">Payment Terms</p>
                  <p className="font-medium">{settings.default_payment_terms}</p>
                </div>
              )}
            </div>

            {/* Billing/Shipping Snapshot */}
            {(invoice.bill_to_name || invoice.bill_to_address || invoice.ship_to_address || invoice.send_to_emails) && (
              <div className="bg-muted/50 rounded-xl p-4 text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Billing & Shipping Snapshot</Label>
                  {canEdit && onUpdateInvoice && (
                    <Button type="button" variant="outline" size="sm" onClick={resolveCurrentSnapshot}>
                      <RefreshCw className="h-3.5 w-3.5 mr-1" />
                      Update from Customer/Project
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {invoice.bill_to_name && (
                    <div>
                      <p className="text-muted-foreground text-xs">Bill To</p>
                      <p className="font-medium">{invoice.bill_to_name}</p>
                    </div>
                  )}
                  {invoice.bill_to_address && (
                    <div>
                      <p className="text-muted-foreground text-xs flex items-center gap-1"><MapPin className="h-3 w-3" />Billing Address</p>
                      <p>{invoice.bill_to_address}</p>
                    </div>
                  )}
                  {invoice.ship_to_address && (
                    <div>
                      <p className="text-muted-foreground text-xs flex items-center gap-1"><MapPin className="h-3 w-3" />Ship To / Job Site</p>
                      <p>{invoice.ship_to_address}</p>
                    </div>
                  )}
                  {invoice.send_to_emails && (
                    <div>
                      <p className="text-muted-foreground text-xs flex items-center gap-1"><Mail className="h-3 w-3" />Send To</p>
                      <p>{invoice.send_to_emails}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* No snapshot warning for older invoices */}
            {!invoice.bill_to_name && client && canEdit && onUpdateInvoice && (
              <Alert>
                <AlertDescription className="flex items-center justify-between">
                  <span className="text-sm">This invoice has no billing snapshot. Click to populate from current customer data.</span>
                  <Button type="button" variant="outline" size="sm" className="ml-3 shrink-0" onClick={resolveCurrentSnapshot}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    Populate Snapshot
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {invType === "progress" && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <Label className="text-sm font-semibold">Progress Billing</Label>
                <div className="grid grid-cols-3 gap-2">
                  <div><span className="text-muted-foreground">Contract: </span><span className="font-medium">{fmt(Number(extInvoice.contract_total))}</span></div>
                  <div><span className="text-muted-foreground">Progress: </span><span className="font-medium">{extInvoice.progress_percent}%</span></div>
                  <div><span className="text-muted-foreground">Holdback: </span><span className="font-medium">{fmt(Number(extInvoice.retainage_amount))}</span></div>
                </div>
                {extInvoice.retainage_released && (
                  <Badge variant="outline" className="mt-1">Holdback Released</Badge>
                )}
              </div>
            )}

            {/* Approval status */}
            {invoice.approval_status && invoice.approval_status !== "none" && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-2">
                <Label className="text-sm font-semibold">Approval</Label>
                <InvoiceApprovalActions
                  invoice={invoice}
                  canApprove={false}
                  onSubmitForApproval={async () => {}}
                  onApprove={async () => {}}
                  onReject={async () => {}}
                />
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mt-1">
                  {invoice.approved_at && (
                    <div>
                      <span className="font-medium text-foreground">
                        {invoice.approval_status === "approved" ? "Approved" : "Reviewed"}:
                      </span>{" "}
                      {format(new Date(invoice.approved_at), "MMM d, yyyy h:mm a")}
                    </div>
                  )}
                  {invoice.approval_status === "rejected" && invoice.rejection_reason && (
                    <div className="col-span-2">
                      <span className="font-medium text-destructive">Reason:</span> {invoice.rejection_reason}
                    </div>
                  )}
                </div>
              </div>
            )}

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
                        {editing ? <Input type="number" className="w-24 text-right" value={li.unit_price} onChange={(e) => updateLine(i, "unit_price", parseFloat(e.target.value) || 0)} /> : fmt(Number(li.unit_price))}
                      </TableCell>
                      <TableCell className="text-right font-medium">{fmt((Number(li.quantity) || 0) * (Number(li.unit_price) || 0))}</TableCell>
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
                <span className="font-medium">{fmt(editing ? subtotal : Number(invoice.subtotal))}</span>
              </div>
              {Number(extInvoice.retainage_amount) > 0 && !editing && (
                <div className="flex gap-8">
                  <span className="text-muted-foreground">Holdback ({extInvoice.retainage_percent}%)</span>
                  <span className="font-medium text-amber-600">-{fmt(Number(extInvoice.retainage_amount))}</span>
                </div>
              )}
              {Number(editing ? taxAmount : invoice.tax_amount) > 0 && (
                <div className="flex gap-8">
                  <span className="text-muted-foreground">{settings?.tax_label || "Tax"}</span>
                  <span className="font-medium">{fmt(editing ? taxAmount : Number(invoice.tax_amount))}</span>
                </div>
              )}
              <div className="flex gap-8 text-base font-bold border-t pt-1 mt-1">
                <span>Total</span>
                <span>{fmt(editing ? total : Number(invoice.total))}</span>
              </div>
              {Number(invoice.amount_paid || 0) > 0 && !editing && (
                <>
                  <div className="flex gap-8 text-sm">
                    <span className="text-muted-foreground">Paid</span>
                    <span className="text-primary font-medium">{fmt(Number(invoice.amount_paid))}</span>
                  </div>
                  <div className="flex gap-8 text-base font-bold">
                    <span>Balance Due</span>
                    <span>{fmt(balance)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Payment History */}
            {!editing && payments.length > 0 && (
              <div>
                <Label className="text-sm font-semibold">Payment History</Label>
                <div className="mt-1 space-y-1">
                  {payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-sm bg-muted/50 rounded px-3 py-2">
                      <div>
                        <span className="font-medium">{fmt(Number(p.amount))}</span>
                        <span className="text-muted-foreground ml-2">
                          {p.payment_method && <span className="capitalize">{p.payment_method}</span>}
                          {p.reference_number && <span> · #{p.reference_number}</span>}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">{format(new Date(p.payment_date), "MMM d, yyyy")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Payment Instructions */}
            {settings?.payment_instructions && (
              <div>
                <Label className="text-sm font-semibold">Payment Instructions</Label>
                <div className="text-sm text-muted-foreground mt-1 whitespace-pre-line bg-muted/50 p-3 rounded-md">
                  {settings.payment_instructions}
                </div>
              </div>
            )}

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
          </TabsContent>

          <TabsContent value="activity">
            <InvoiceActivityTimeline invoiceId={invoice.id} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
