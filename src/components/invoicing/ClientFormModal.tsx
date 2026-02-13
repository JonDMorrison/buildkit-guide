import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import type { Client } from "@/types/invoicing";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (client: Partial<Client>) => Promise<any>;
  initialData?: Client | null;
  allClients?: Client[];
}

const emptyForm = {
  name: "",
  contact_name: "",
  email: "",
  phone: "",
  billing_address: "",
  city: "",
  province: "",
  postal_code: "",
  notes: "",
  gst_number: "",
  parent_client_id: "",
  ap_contact_name: "",
  ap_email: "",
  ap_phone: "",
  pm_contact_name: "",
  pm_email: "",
  pm_phone: "",
  site_contact_name: "",
  site_contact_email: "",
  site_contact_phone: "",
  zones: "1",
};

export const ClientFormModal = ({ open, onOpenChange, onSubmit, initialData, allClients }: Props) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (open) {
      setForm({
        name: initialData?.name || "",
        contact_name: initialData?.contact_name || "",
        email: initialData?.email || "",
        phone: initialData?.phone || "",
        billing_address: initialData?.billing_address || "",
        city: initialData?.city || "",
        province: initialData?.province || "",
        postal_code: initialData?.postal_code || "",
        notes: initialData?.notes || "",
        gst_number: initialData?.gst_number || "",
        parent_client_id: initialData?.parent_client_id || "",
        ap_contact_name: initialData?.ap_contact_name || "",
        ap_email: initialData?.ap_email || "",
        ap_phone: initialData?.ap_phone || "",
        pm_contact_name: initialData?.pm_contact_name || "",
        pm_email: initialData?.pm_email || "",
        pm_phone: initialData?.pm_phone || "",
        site_contact_name: initialData?.site_contact_name || "",
        site_contact_email: initialData?.site_contact_email || "",
        site_contact_phone: initialData?.site_contact_phone || "",
        zones: String(initialData?.zones ?? 1),
      });
    }
  }, [open, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSubmit({
      name: form.name,
      contact_name: form.contact_name || null,
      email: form.email || null,
      phone: form.phone || null,
      billing_address: form.billing_address || null,
      city: form.city || null,
      province: form.province || null,
      postal_code: form.postal_code || null,
      notes: form.notes || null,
      gst_number: form.gst_number || null,
      parent_client_id: form.parent_client_id || null,
      ap_contact_name: form.ap_contact_name || null,
      ap_email: form.ap_email || null,
      ap_phone: form.ap_phone || null,
      pm_contact_name: form.pm_contact_name || null,
      pm_email: form.pm_email || null,
      pm_phone: form.pm_phone || null,
      site_contact_name: form.site_contact_name || null,
      site_contact_email: form.site_contact_email || null,
      site_contact_phone: form.site_contact_phone || null,
      zones: parseInt(form.zones) || 1,
    });
    setLoading(false);
    onOpenChange(false);
  };

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  // Filter out self and children to prevent circular references
  const parentOptions = (allClients || []).filter(
    (c) => c.id !== initialData?.id && c.is_active && !c.parent_client_id
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? "Edit Client" : "Add Client"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Info */}
          <div className="space-y-2">
            <Label>Company / Client Name *</Label>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Parent Customer</Label>
              <Select value={form.parent_client_id} onValueChange={(v) => update("parent_client_id", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="None (top-level)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (top-level)</SelectItem>
                  {parentOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>GST / Tax #</Label>
              <Input value={form.gst_number} onChange={(e) => update("gst_number", e.target.value)} placeholder="GST #" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Primary Contact</Label>
              <Input value={form.contact_name} onChange={(e) => update("contact_name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Primary Email</Label>
              <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Zones</Label>
              <Input type="number" min={1} value={form.zones} onChange={(e) => update("zones", e.target.value)} />
            </div>
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label>Billing Address</Label>
            <Input value={form.billing_address} onChange={(e) => update("billing_address", e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => update("city", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Province</Label>
              <Input value={form.province} onChange={(e) => update("province", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Postal Code</Label>
              <Input value={form.postal_code} onChange={(e) => update("postal_code", e.target.value)} />
            </div>
          </div>

          <Separator />

          {/* A/P Contact */}
          <p className="text-sm font-medium text-muted-foreground">Accounts Payable Contact</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>A/P Name</Label>
              <Input value={form.ap_contact_name} onChange={(e) => update("ap_contact_name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>A/P Email</Label>
              <Input type="email" value={form.ap_email} onChange={(e) => update("ap_email", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>A/P Phone</Label>
              <Input value={form.ap_phone} onChange={(e) => update("ap_phone", e.target.value)} />
            </div>
          </div>

          {/* PM Contact */}
          <p className="text-sm font-medium text-muted-foreground">Project Manager Contact</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>PM Name</Label>
              <Input value={form.pm_contact_name} onChange={(e) => update("pm_contact_name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>PM Email</Label>
              <Input type="email" value={form.pm_email} onChange={(e) => update("pm_email", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>PM Phone</Label>
              <Input value={form.pm_phone} onChange={(e) => update("pm_phone", e.target.value)} />
            </div>
          </div>

          {/* Site Contact */}
          <p className="text-sm font-medium text-muted-foreground">Site Contact</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Site Name</Label>
              <Input value={form.site_contact_name} onChange={(e) => update("site_contact_name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Site Email</Label>
              <Input type="email" value={form.site_contact_email} onChange={(e) => update("site_contact_email", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Site Phone</Label>
              <Input value={form.site_contact_phone} onChange={(e) => update("site_contact_phone", e.target.value)} />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={2} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1" disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading || !form.name}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Save Client"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
