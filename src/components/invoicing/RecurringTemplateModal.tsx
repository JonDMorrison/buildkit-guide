import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DatePicker } from "@/components/ui/date-picker";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { format, addMonths } from "date-fns";
import type { Client, RecurringInvoiceTemplate } from "@/types/invoicing";

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
  onSubmit: (template: Partial<RecurringInvoiceTemplate>) => Promise<any>;
  initialData?: RecurringInvoiceTemplate | null;
}

const defaultLine = (): LineItemDraft => ({ description: "", quantity: 1, unit_price: 0, category: "other" });

export const RecurringTemplateModal = ({ open, onOpenChange, clients, projects, onSubmit, initialData }: Props) => {
  const [loading, setLoading] = useState(false);
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [nextIssueDate, setNextIssueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([defaultLine()]);

  useEffect(() => {
    if (open) {
      setClientId(initialData?.client_id || "");
      setProjectId(initialData?.project_id || "");
      setFrequency(initialData?.frequency || "monthly");
      setNextIssueDate(initialData?.next_issue_date || format(addMonths(new Date(), 1), "yyyy-MM-dd"));
      setNotes(initialData?.notes || "");
      setLineItems(
        initialData?.line_items?.length
          ? initialData.line_items.map((li: any) => ({
              description: li.description || "",
              quantity: li.quantity || 1,
              unit_price: li.unit_price || 0,
              category: li.category || "other",
            }))
          : [defaultLine()]
      );
    }
  }, [open, initialData]);

  const addLine = () => setLineItems([...lineItems, defaultLine()]);
  const removeLine = (i: number) => setLineItems(lineItems.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof LineItemDraft, value: any) => {
    const updated = [...lineItems];
    (updated[i] as any)[field] = value;
    setLineItems(updated);
  };

  const subtotal = lineItems.reduce((s, li) => s + li.quantity * li.unit_price, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSubmit({
      client_id: clientId || null,
      project_id: projectId || null,
      frequency,
      next_issue_date: nextIssueDate,
      notes: notes || null,
      line_items: lineItems.filter((li) => li.description),
    });
    setLoading(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? "Edit Recurring Template" : "Create Recurring Invoice"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.filter((c: any) => c.is_active !== false).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Bi-Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Next Issue Date</Label>
              <DatePicker value={nextIssueDate} onChange={setNextIssueDate} />
            </div>
          </div>

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
                      <Input value={li.description} onChange={(e) => updateLine(i, "description", e.target.value)} placeholder="Description" />
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
                      <Input type="number" className="w-16 text-right" value={li.quantity} onChange={(e) => updateLine(i, "quantity", parseFloat(e.target.value) || 0)} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" className="w-24 text-right" value={li.unit_price} onChange={(e) => updateLine(i, "unit_price", parseFloat(e.target.value) || 0)} />
                    </TableCell>
                    <TableCell className="text-right font-medium">${(li.quantity * li.unit_price).toFixed(2)}</TableCell>
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
            <Button type="button" variant="outline" size="sm" onClick={addLine}><Plus className="h-4 w-4 mr-1" /> Add Line</Button>
          </div>

          <div className="flex justify-end text-sm font-medium">
            Subtotal: ${subtotal.toFixed(2)}
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1" disabled={loading}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : initialData ? "Update Template" : "Create Template"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
