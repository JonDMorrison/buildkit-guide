import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import type { Invoice, InvoiceLineItem, Client } from "@/types/invoicing";
import { format, addDays } from "date-fns";

interface LineItemDraft {
  description: string;
  quantity: number;
  unit_price: number;
  category: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  projects: { id: string; name: string }[];
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

  // Reset form fully when modal opens
  useEffect(() => {
    if (open) {
      setClientId("");
      setProjectId(initialProjectId || "");
      setIssueDate(format(new Date(), "yyyy-MM-dd"));
      setDueDate(format(addDays(new Date(), 30), "yyyy-MM-dd"));
      setNotes(notesTemplate || "");
      setLineItems(initialLineItems && initialLineItems.length > 0 ? initialLineItems : [defaultLine()]);
    }
  }, [open, initialLineItems, initialProjectId]);

  const subtotal = lineItems.reduce((s, li) => s + li.quantity * li.unit_price, 0);
  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;

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
    await onSubmit(
      {
        client_id: clientId || null,
        project_id: projectId || null,
        issue_date: issueDate,
        due_date: dueDate || null,
        subtotal,
        tax_amount: taxAmount,
        total,
        notes: notes || null,
      },
      lineItems.filter((li) => li.description).map((li) => ({
        description: li.description,
        quantity: li.quantity,
        unit_price: li.unit_price,
        amount: li.quantity * li.unit_price,
        category: li.category,
      }))
    );
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
              <Label>Client</Label>
              <div className="flex gap-2">
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
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
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

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

          {/* Line items */}
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
                      <Input
                        value={li.description}
                        onChange={(e) => updateLine(i, "description", e.target.value)}
                        placeholder="Description"
                      />
                    </TableCell>
                    <TableCell>
                      <Select value={li.category} onValueChange={(v) => updateLine(i, "category", v)}>
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="labor">Labor</SelectItem>
                          <SelectItem value="material">Material</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number" min={0} step="0.5"
                        className="w-16 text-right"
                        value={li.quantity}
                        onChange={(e) => updateLine(i, "quantity", parseFloat(e.target.value) || 0)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number" min={0} step="0.01"
                        className="w-24 text-right"
                        value={li.unit_price}
                        onChange={(e) => updateLine(i, "unit_price", parseFloat(e.target.value) || 0)}
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${(li.quantity * li.unit_price).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {lineItems.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(i)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
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

          {/* Totals */}
          <div className="flex flex-col items-end gap-1 text-sm">
            <div className="flex gap-8">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">${subtotal.toFixed(2)}</span>
            </div>
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1" disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : "Create Invoice"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
