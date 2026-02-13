import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Plus, Trash2, UserPlus, Info, AlertTriangle } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { ProgressBillingFields } from "@/components/invoicing/ProgressBillingFields";
import type { Invoice, InvoiceLineItem, Client } from "@/types/invoicing";
import { format, addDays } from "date-fns";

interface LineItemDraft {
  description: string;
  quantity: number;
  unit_price: number;
  category: string;
}

interface ProjectWithClient {
  id: string;
  name: string;
  client_id?: string | null;
  location?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  projects: ProjectWithClient[];
  taxRate: number;
  taxLabel: string;
  defaultPaymentTerms: string;
  notesTemplate: string;
  paymentInstructions: string;
  onSubmit: (invoice: Partial<Invoice>, lineItems: Partial<InvoiceLineItem>[]) => Promise<any>;
  onAddClient?: () => void;
  initialLineItems?: LineItemDraft[];
  initialProjectId?: string;
}

const defaultLine = (): LineItemDraft => ({ description: "", quantity: 1, unit_price: 0, category: "other" });

export const CreateInvoiceModal = ({
  open, onOpenChange, clients, projects, taxRate, taxLabel,
  defaultPaymentTerms, notesTemplate, paymentInstructions, onSubmit, onAddClient, initialLineItems, initialProjectId,
}: Props) => {
  const [loading, setLoading] = useState(false);
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([defaultLine()]);
  const [invoiceType, setInvoiceType] = useState("standard");
  const [poNumber, setPoNumber] = useState("");
  const [contractTotal, setContractTotal] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);
  const [retainagePercent, setRetainagePercent] = useState(0);

  useEffect(() => {
    if (open) {
      setClientId("");
      setProjectId(initialProjectId || "");
      setIssueDate(format(new Date(), "yyyy-MM-dd"));
      setDueDate(format(addDays(new Date(), 30), "yyyy-MM-dd"));
      setNotes(notesTemplate || "");
      setLineItems(initialLineItems && initialLineItems.length > 0 ? initialLineItems : [defaultLine()]);
      setInvoiceType("standard");
      setPoNumber("");
      setContractTotal(0);
      setProgressPercent(0);
      setRetainagePercent(0);
    }
  }, [open, initialLineItems, initialProjectId]);

  // Auto-populate client when project is selected
  useEffect(() => {
    if (projectId) {
      const proj = projects.find(p => p.id === projectId) as ProjectWithClient | undefined;
      if (proj?.client_id) {
        const directClient = clients.find(c => c.id === proj.client_id);
        if (directClient) {
          // Use parent (billing customer) if exists, else direct client
          const billingClientId = directClient.parent_client_id || directClient.id;
          setClientId(billingClientId);
        }
      }
    }
  }, [projectId, projects, clients]);

  // Derive billing/shipping info
  const billingInfo = useMemo(() => {
    const selectedClient = clients.find(c => c.id === clientId);
    if (!selectedClient) return null;

    const proj = projects.find(p => p.id === projectId) as ProjectWithClient | undefined;
    const apEmail = selectedClient.ap_email || selectedClient.email;

    return {
      billTo: selectedClient.name,
      billAddress: [selectedClient.billing_address, selectedClient.city, selectedClient.province, selectedClient.postal_code].filter(Boolean).join(", "),
      shipTo: proj?.location || null,
      apEmail,
      isArchived: !selectedClient.is_active,
    };
  }, [clientId, projectId, clients, projects]);

  const subtotal = invoiceType === "progress"
    ? contractTotal * (progressPercent / 100)
    : lineItems.reduce((s, li) => s + li.quantity * li.unit_price, 0);

  const retainageAmount = invoiceType === "progress" ? subtotal * (retainagePercent / 100) : 0;
  const taxableAmount = subtotal - retainageAmount;
  const taxAmount = Math.round(taxableAmount * (taxRate / 100) * 100) / 100;
  const total = Math.round((taxableAmount + taxAmount) * 100) / 100;

  const addLine = () => setLineItems([...lineItems, defaultLine()]);
  const removeLine = (i: number) => setLineItems(lineItems.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof LineItemDraft, value: any) => {
    const updated = [...lineItems];
    (updated[i] as any)[field] = value;
    setLineItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const invoiceData: Partial<Invoice> = {
      client_id: clientId || null,
      project_id: projectId || null,
      issue_date: issueDate,
      due_date: dueDate || null,
      subtotal: taxableAmount,
      tax_amount: taxAmount,
      total,
      notes: notes || null,
      invoice_type: invoiceType as any,
      po_number: poNumber || null,
      retainage_percent: retainagePercent,
      retainage_amount: retainageAmount,
      progress_percent: progressPercent,
      contract_total: contractTotal,
      // Snapshot fields
      bill_to_client_id: clientId || null,
      bill_to_name: billingInfo?.billTo || null,
      bill_to_address: billingInfo?.billAddress || null,
      ship_to_address: billingInfo?.shipTo || null,
      send_to_emails: billingInfo?.apEmail || null,
    };

    const finalLineItems = invoiceType === "progress"
      ? [{ description: `Progress billing - ${progressPercent}% complete`, quantity: 1, unit_price: taxableAmount, amount: taxableAmount, category: "labor" }]
      : lineItems.filter((li) => li.description).map((li) => ({
          description: li.description,
          quantity: li.quantity,
          unit_price: li.unit_price,
          amount: li.quantity * li.unit_price,
          category: li.category,
        }));

    await onSubmit(invoiceData, finalLineItems);
    setLoading(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Invoice</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Invoice Type</Label>
              <Select value={invoiceType} onValueChange={setInvoiceType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard Invoice</SelectItem>
                  <SelectItem value="progress">Progress Billing</SelectItem>
                  <SelectItem value="deposit">Deposit Invoice</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>PO Number</Label>
              <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="Optional PO #" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Bill-To Client</Label>
              <div className="flex gap-2">
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select client (auto from project)" /></SelectTrigger>
                  <SelectContent>
                    {clients.filter(c => c.is_active).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        {c.parent_client_id ? " (child)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {onAddClient && (
                  <Button type="button" variant="outline" size="icon" onClick={onAddClient} title="Add new client">
                    <UserPlus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Billing/Shipping info card */}
          {billingInfo && (
            <Card>
              <CardContent className="py-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bill To</span>
                  <span className="font-medium">{billingInfo.billTo}</span>
                </div>
                {billingInfo.billAddress && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Billing Address</span>
                    <span>{billingInfo.billAddress}</span>
                  </div>
                )}
                {billingInfo.shipTo && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ship To / Job Site</span>
                    <span>{billingInfo.shipTo}</span>
                  </div>
                )}
                {billingInfo.apEmail && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">A/P Email (default send-to)</span>
                    <span>{billingInfo.apEmail}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Archived billing customer warning */}
          {billingInfo?.isArchived && (
            <Alert variant="destructive" className="py-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                The billing customer "{billingInfo.billTo}" is archived. Creating this invoice will reference an inactive client.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Issue Date</Label>
              <DatePicker value={issueDate} onChange={setIssueDate} />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <DatePicker value={dueDate} onChange={setDueDate} />
            </div>
          </div>

          {invoiceType === "progress" && (
            <ProgressBillingFields
              contractTotal={contractTotal}
              progressPercent={progressPercent}
              retainagePercent={retainagePercent}
              onContractTotalChange={setContractTotal}
              onProgressPercentChange={setProgressPercent}
              onRetainagePercentChange={setRetainagePercent}
            />
          )}

          {invoiceType !== "progress" && (
            <div className="space-y-2">
              <Label>Line Items</Label>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((li, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Input value={li.description} onChange={(e) => updateLine(i, "description", e.target.value)} placeholder={invoiceType === "deposit" ? "Deposit for project" : "Description"} />
                      </TableCell>
                      <TableCell>
                        <Select value={li.category} onValueChange={(v) => updateLine(i, "category", v)}>
                          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="labor">Labor</SelectItem>
                            <SelectItem value="material">Material</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input type="number" min={0} step="0.5" className="w-16 text-right" value={li.quantity} onChange={(e) => updateLine(i, "quantity", parseFloat(e.target.value) || 0)} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" min={0} step="0.01" className="w-24 text-right" value={li.unit_price} onChange={(e) => updateLine(i, "unit_price", parseFloat(e.target.value) || 0)} />
                      </TableCell>
                      <TableCell className="text-right font-medium">${(li.quantity * li.unit_price).toFixed(2)}</TableCell>
                      <TableCell>
                        {lineItems.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(i)}><Trash2 className="h-4 w-4" /></Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="h-4 w-4 mr-1" /> Add Line
              </Button>
            </div>
          )}

          {/* Totals */}
          <div className="flex flex-col items-end gap-1 text-sm">
            <div className="flex gap-8">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">${subtotal.toFixed(2)}</span>
            </div>
            {retainageAmount > 0 && (
              <div className="flex gap-8">
                <span className="text-muted-foreground">Holdback ({retainagePercent}%)</span>
                <span className="font-medium text-amber-600">-${retainageAmount.toFixed(2)}</span>
              </div>
            )}
            {taxRate > 0 && (
              <div className="flex gap-8">
                <span className="text-muted-foreground">{taxLabel} ({taxRate}%)</span>
                <span className="font-medium">${taxAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex gap-8 text-base font-bold border-t pt-1 mt-1">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Payment instructions, thank you message, etc." />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1" disabled={loading}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : "Create Invoice"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
