import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEstimates } from "@/hooks/useEstimates";
import { useClients } from "@/hooks/useClients";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2 } from "lucide-react";
import { formatCurrency as sharedFmtCurrency } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";

interface Props {
  projectId: string;
  onClose: () => void;
  onCreated: () => void;
}

interface LineItemDraft {
  item_type: string;
  name: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  sales_tax_rate: number;
}

const emptyLine = (): LineItemDraft => ({
  item_type: "labor",
  name: "",
  description: "",
  quantity: 1,
  unit: "hours",
  rate: 0,
  sales_tax_rate: 0,
});

const ITEM_TYPES = [
  { value: "labor", label: "Labor" },
  { value: "material", label: "Material" },
  { value: "machine", label: "Machine" },
  { value: "other", label: "Other" },
];

export const CreateEstimateModal = ({ projectId, onClose, onCreated }: Props) => {
  const { createEstimate, updateEstimateHeader, upsertLineItem } = useEstimates(projectId);
  const { clients } = useClients();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Header fields
  const [clientId, setClientId] = useState<string>("");
  const [contractValue, setContractValue] = useState("");
  const [customerPo, setCustomerPo] = useState("");
  const [customerPmName, setCustomerPmName] = useState("");
  const [customerPmEmail, setCustomerPmEmail] = useState("");
  const [customerPmPhone, setCustomerPmPhone] = useState("");
  const [noteCustomer, setNoteCustomer] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  // Address snapshots
  const [billToName, setBillToName] = useState("");
  const [billToAddress, setBillToAddress] = useState("");
  const [billToApEmail, setBillToApEmail] = useState("");
  const [shipToName, setShipToName] = useState("");
  const [shipToAddress, setShipToAddress] = useState("");

  // Line items
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([emptyLine()]);

  // Auto-populate addresses when client selected
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

  // Auto-populate ship-to from project + get currency
  const [projectCurrency, setProjectCurrency] = useState("CAD");
  useEffect(() => {
    const loadProject = async () => {
      interface ProjectData {
        name: string;
        location: string | null;
        billing_address: string | null;
        currency: string | null;
      }
    
      const { data } = await supabase
        .from('projects')
        .select('name,location,billing_address,currency')
        .eq('id', projectId)
        .single();
      if (data) {
        const pd = data as unknown as ProjectData;
        setShipToName(pd.name || "");
        setShipToAddress(pd.location || pd.billing_address || "");
        setProjectCurrency(pd.currency || "CAD");
      }
    };
    loadProject();
  }, [projectId]);

  const updateLine = (idx: number, field: keyof LineItemDraft, value: string | number) => {
    setLineItems(prev => prev.map((li, i) => i === idx ? { ...li, [field]: value } : li));
  };

  const addLine = () => setLineItems(prev => [...prev, emptyLine()]);
  const removeLine = (idx: number) => setLineItems(prev => prev.filter((_, i) => i !== idx));

  const subtotal = lineItems.reduce((s, li) => s + (Number(li.quantity) || 0) * (Number(li.rate) || 0), 0);
  const totalTax = lineItems.reduce((s, li) => {
    const amt = (Number(li.quantity) || 0) * (Number(li.rate) || 0);
    return s + amt * ((Number(li.sales_tax_rate) || 0) / 100);
  }, 0);

  const handleSave = async () => {
    const validLines = lineItems.filter(li => li.name.trim());
    if (validLines.length === 0) {
      toast({ title: "Add at least one line item", variant: "destructive" });
      return;
    }
    setSaving(true);

    // 1. Create estimate via RPC
    const est = await createEstimate(projectId);
    if (!est) { setSaving(false); return; }
    const estimateId = est.id;

    // 2. Update header fields
    const selectedClient = clients.find(c => c.id === clientId);
    const parentClientId = selectedClient?.parent_client_id || (clientId || null);

    await updateEstimateHeader(estimateId, {
      contract_value: Number(contractValue) || 0,
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
      note_for_customer: noteCustomer || null,
      internal_notes: internalNotes || null,
    });

    // 3. Add line items via RPC
    for (const li of validLines) {
      await upsertLineItem(estimateId, null, {
        item_type: li.item_type,
        name: li.name,
        description: li.description || null,
        quantity: Number(li.quantity) || 0,
        unit: li.unit || null,
        rate: Number(li.rate) || 0,
        sales_tax_rate: Number(li.sales_tax_rate) || 0,
      });
    }

    setSaving(false);
    toast({ title: "Estimate created" });
    onCreated();
  };

  const formatCurrency = (v: number) => sharedFmtCurrency(v, projectCurrency);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle>Create Estimate</DialogTitle>
            <Badge variant="outline" className="text-xs">{projectCurrency}</Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Fields */}
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
              <Label>Contract Value</Label>
              <Input type="number" value={contractValue} onChange={e => setContractValue(e.target.value)} placeholder="0.00" />
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
                    <TableHead className="w-28">Type</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-20">Qty</TableHead>
                    <TableHead className="w-20">Unit</TableHead>
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
                          <Select value={li.item_type} onValueChange={v => updateLine(idx, 'item_type', v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {ITEM_TYPES.map(t => (
                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input className="h-8 text-sm" value={li.name} onChange={e => updateLine(idx, 'name', e.target.value)} placeholder="Item name" />
                        </TableCell>
                        <TableCell>
                          <Input className="h-8 text-sm" type="number" value={li.quantity} onChange={e => updateLine(idx, 'quantity', e.target.value)} />
                        </TableCell>
                        <TableCell>
                          <Input className="h-8 text-sm" value={li.unit} onChange={e => updateLine(idx, 'unit', e.target.value)} />
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
            <div className="flex justify-end mt-2 space-x-6 text-sm">
              <span>Subtotal: <strong>{formatCurrency(subtotal)}</strong></span>
              <span>Tax: <strong>{formatCurrency(totalTax)}</strong></span>
              <span>Total: <strong>{formatCurrency(subtotal + totalTax)}</strong></span>
            </div>
          </div>

          {/* Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Note for Customer</Label>
              <Textarea value={noteCustomer} onChange={e => setNoteCustomer(e.target.value)} rows={3} />
            </div>
            <div>
              <Label>Internal Notes</Label>
              <Textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)} rows={3} />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>Save Draft</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
