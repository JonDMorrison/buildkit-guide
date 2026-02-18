import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuotes } from "@/hooks/useQuotes";
import { useClients } from "@/hooks/useClients";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2 } from "lucide-react";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

interface LineDraft {
  product_or_service: string;
  description: string;
  quantity: number;
  rate: number;
  sales_tax_rate: number;
}

const emptyLine = (): LineDraft => ({
  product_or_service: "",
  description: "",
  quantity: 1,
  rate: 0,
  sales_tax_rate: 0,
});

export const CreateQuoteModal = ({ onClose, onCreated }: Props) => {
  const { createQuote } = useQuotes();
  const { clients } = useClients();
  const { currentProjectId } = useCurrentProject();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Header
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState(currentProjectId || "");
  const [customerPo, setCustomerPo] = useState("");
  const [customerPmName, setCustomerPmName] = useState("");
  const [customerPmEmail, setCustomerPmEmail] = useState("");
  const [customerPmPhone, setCustomerPmPhone] = useState("");
  const [gst, setGst] = useState("0");
  const [pst, setPst] = useState("0");
  const [noteCustomer, setNoteCustomer] = useState("");
  const [memoStatement, setMemoStatement] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  // Snapshots
  const [billToName, setBillToName] = useState("");
  const [billToAddress, setBillToAddress] = useState("");
  const [billToApEmail, setBillToApEmail] = useState("");
  const [shipToName, setShipToName] = useState("");
  const [shipToAddress, setShipToAddress] = useState("");

  // Projects list
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  // Line items
  const [lineItems, setLineItems] = useState<LineDraft[]>([emptyLine()]);

  // Load projects
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, name')
        .eq('is_deleted', false)
        .order('name');
      setProjects((data as any[]) || []);
    };
    load();
  }, []);

  // Auto-populate from client
  useEffect(() => {
    if (!clientId) return;
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    const parentId = client.parent_client_id;
    if (parentId) {
      const parent = clients.find(c => c.id === parentId);
      if (parent) {
        setBillToName(parent.name);
        setBillToAddress([parent.billing_address, parent.city, parent.province, parent.postal_code].filter(Boolean).join(", "));
        setBillToApEmail(parent.ap_email || parent.email || "");
      }
    } else {
      setBillToName(client.name);
      setBillToAddress([client.billing_address, client.city, client.province, client.postal_code].filter(Boolean).join(", "));
      setBillToApEmail(client.ap_email || client.email || "");
    }

    setCustomerPmName(client.pm_contact_name || client.contact_name || "");
    setCustomerPmEmail(client.pm_email || "");
    setCustomerPmPhone(client.pm_phone || "");
  }, [clientId, clients]);

  // Auto-populate ship-to from project + PM override
  useEffect(() => {
    if (!projectId) return;
    const load = async () => {
      const { data } = await supabase
        .from('projects')
        .select('name, location, billing_address, pm_contact_name, pm_email, pm_phone')
        .eq('id', projectId)
        .single();
      if (data) {
        setShipToName((data as any).name || "");
        setShipToAddress((data as any).location || (data as any).billing_address || "");
        // Project-level PM override takes precedence over client PM
        if ((data as any).pm_email) {
          setCustomerPmEmail((data as any).pm_email);
        }
        if ((data as any).pm_contact_name) {
          setCustomerPmName((data as any).pm_contact_name);
        }
        if ((data as any).pm_phone) {
          setCustomerPmPhone((data as any).pm_phone);
        }
      }
    };
    load();
  }, [projectId]);

  const updateLine = (idx: number, field: string, value: any) => {
    setLineItems(prev => prev.map((li, i) => i === idx ? { ...li, [field]: value } : li));
  };

  const addLine = () => setLineItems(prev => [...prev, emptyLine()]);
  const removeLine = (idx: number) => setLineItems(prev => prev.filter((_, i) => i !== idx));

  const subtotal = lineItems.reduce((s, li) => s + (Number(li.quantity) || 0) * (Number(li.rate) || 0), 0);
  const totalAmount = Math.round((subtotal + (Number(gst) || 0) + (Number(pst) || 0)) * 100) / 100;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(v);

  const handleSave = async () => {
    if (lineItems.every(li => !li.product_or_service.trim())) {
      toast({ title: "Add at least one line item", variant: "destructive" });
      return;
    }
    setSaving(true);

    const selectedClient = clients.find(c => c.id === clientId);
    const parentClientId = selectedClient?.parent_client_id || (clientId || null);

    await createQuote(
      {
        project_id: projectId || null,
        client_id: clientId || null,
        parent_client_id: parentClientId,
        customer_po_number: customerPo || null,
        customer_pm_name: customerPmName || null,
        customer_pm_email: customerPmEmail || null,
        customer_pm_phone: customerPmPhone || null,
        bill_to_name: billToName || null,
        bill_to_address: billToAddress || null,
        bill_to_ap_email: billToApEmail || null,
        ship_to_name: shipToName || null,
        ship_to_address: shipToAddress || null,
        gst: Number(gst) || 0,
        pst: Number(pst) || 0,
        note_for_customer: noteCustomer || null,
        memo_on_statement: memoStatement || null,
        internal_notes: internalNotes || null,
      } as any,
      lineItems.filter(li => li.product_or_service.trim()).map(li => ({
        product_or_service: li.product_or_service,
        description: li.description || null,
        quantity: Number(li.quantity) || 0,
        rate: Number(li.rate) || 0,
        sales_tax_rate: Number(li.sales_tax_rate) || 0,
      }))
    );

    setSaving(false);
    onCreated();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Quote</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Customer</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {clients.filter(c => c.is_active).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Project (optional)</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Customer PO #</Label>
              <Input value={customerPo} onChange={e => setCustomerPo(e.target.value)} />
            </div>
            <div>
              <Label>Customer PM Name</Label>
              <Input value={customerPmName} onChange={e => setCustomerPmName(e.target.value)} />
            </div>
            <div>
              <Label>Customer PM Email</Label>
              <Input type="email" value={customerPmEmail} onChange={e => setCustomerPmEmail(e.target.value)} />
            </div>
            <div>
              <Label>Customer PM Phone</Label>
              <Input value={customerPmPhone} onChange={e => setCustomerPmPhone(e.target.value)} />
            </div>
          </div>

          {/* Addresses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bill To (from parent customer)</p>
              <Input value={billToName} onChange={e => setBillToName(e.target.value)} placeholder="Name" />
              <Input value={billToAddress} onChange={e => setBillToAddress(e.target.value)} placeholder="Address" />
              <Input value={billToApEmail} onChange={e => setBillToApEmail(e.target.value)} placeholder="A/P Email" />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ship To (from project)</p>
              <Input value={shipToName} onChange={e => setShipToName(e.target.value)} placeholder="Site name" />
              <Input value={shipToAddress} onChange={e => setShipToAddress(e.target.value)} placeholder="Site address" />
            </div>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold">Line Items</p>
              <Button variant="outline" size="sm" onClick={addLine}>
                <Plus className="h-3 w-3 mr-1" /> Add Row
              </Button>
            </div>
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product / Service</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-20">Qty</TableHead>
                    <TableHead className="w-24">Rate</TableHead>
                    <TableHead className="w-24 text-right">Amount</TableHead>
                    <TableHead className="w-20">Tax %</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((li, idx) => {
                    const amt = (Number(li.quantity) || 0) * (Number(li.rate) || 0);
                    return (
                      <TableRow key={idx}>
                        <TableCell>
                          <Input className="h-8 text-sm" value={li.product_or_service} onChange={e => updateLine(idx, 'product_or_service', e.target.value)} placeholder="Item name" />
                        </TableCell>
                        <TableCell>
                          <Input className="h-8 text-sm" value={li.description} onChange={e => updateLine(idx, 'description', e.target.value)} placeholder="Description" />
                        </TableCell>
                        <TableCell>
                          <Input className="h-8 text-sm" type="number" value={li.quantity} onChange={e => updateLine(idx, 'quantity', e.target.value)} />
                        </TableCell>
                        <TableCell>
                          <Input className="h-8 text-sm" type="number" value={li.rate} onChange={e => updateLine(idx, 'rate', e.target.value)} />
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {formatCurrency(amt)}
                        </TableCell>
                        <TableCell>
                          <Input className="h-8 text-sm" type="number" value={li.sales_tax_rate} onChange={e => updateLine(idx, 'sales_tax_rate', e.target.value)} />
                        </TableCell>
                        <TableCell>
                          {lineItems.length > 1 && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeLine(idx)}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end mt-3 gap-6 text-sm">
              <div>Subtotal: <strong>{formatCurrency(subtotal)}</strong></div>
              <div className="flex items-center gap-2">
                <Label className="text-xs">GST</Label>
                <Input className="h-7 w-24 text-sm" type="number" value={gst} onChange={e => setGst(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs">PST</Label>
                <Input className="h-7 w-24 text-sm" type="number" value={pst} onChange={e => setPst(e.target.value)} />
              </div>
              <div>Total: <strong>{formatCurrency(totalAmount)}</strong></div>
            </div>
          </div>

          {/* Notes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Note for Customer</Label>
              <Textarea value={noteCustomer} onChange={e => setNoteCustomer(e.target.value)} rows={3} />
            </div>
            <div>
              <Label>Memo on Statement</Label>
              <Textarea value={memoStatement} onChange={e => setMemoStatement(e.target.value)} rows={3} />
            </div>
            <div>
              <Label>Internal Notes</Label>
              <Textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)} rows={3} />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Draft"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
