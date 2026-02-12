import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SectionHeader } from "@/components/SectionHeader";
import { useClients } from "@/hooks/useClients";
import { useInvoices } from "@/hooks/useInvoices";
import { ClientFormModal } from "@/components/invoicing/ClientFormModal";
import { CreateInvoiceModal } from "@/components/invoicing/CreateInvoiceModal";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Users, FileText, Settings, DollarSign, Send, CheckCircle2, Ban,
} from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useProjectRole } from "@/hooks/useProjectRole";
import { NoAccess } from "@/components/NoAccess";
import type { Invoice, InvoiceLineItem, Client } from "@/types/invoicing";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Draft", variant: "secondary" },
  sent: { label: "Sent", variant: "default" },
  paid: { label: "Paid", variant: "outline" },
  overdue: { label: "Overdue", variant: "destructive" },
  void: { label: "Void", variant: "secondary" },
};

const Invoicing = () => {
  const location = useLocation();
  const { isGlobalAdmin } = useProjectRole();
  const { clients, loading: clientsLoading, createClient, updateClient } = useClients();
  const {
    invoices, loading: invoicesLoading, settings,
    createInvoice, updateInvoice, updateSettings,
    fetchLineItems,
  } = useInvoices();
  const { toast } = useToast();

  // Prefill from Job Cost Report navigation
  const prefillData = location.state as { prefillLineItems?: any[]; prefillProjectId?: string } | null;

  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [showCreateInvoice, setShowCreateInvoice] = useState(!!prefillData?.prefillLineItems);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [lineItemsCache, setLineItemsCache] = useState<Record<string, InvoiceLineItem[]>>({});

  // Settings form
  const [settingsForm, setSettingsForm] = useState({
    company_name: "",
    company_address: "",
    invoice_prefix: "INV-",
    tax_rate: "0",
    tax_label: "Tax",
    default_payment_terms: "Net 30",
    notes_template: "",
  });

  useEffect(() => {
    const fetchProjects = async () => {
      const { data } = await supabase
        .from("projects").select("id, name").eq("is_deleted", false).order("name");
      setProjects(data || []);
    };
    fetchProjects();
  }, []);

  useEffect(() => {
    if (settings) {
      setSettingsForm({
        company_name: settings.company_name || "",
        company_address: settings.company_address || "",
        invoice_prefix: settings.invoice_prefix || "INV-",
        tax_rate: String(settings.tax_rate || 0),
        tax_label: settings.tax_label || "Tax",
        default_payment_terms: settings.default_payment_terms || "Net 30",
        notes_template: settings.notes_template || "",
      });
    }
  }, [settings]);

  const filteredInvoices = invoices.filter(
    (inv) => statusFilter === "all" || inv.status === statusFilter
  );

  const handleStatusChange = async (invoice: Invoice, newStatus: string) => {
    const updates: Partial<Invoice> = { status: newStatus as any };
    if (newStatus === "sent") updates.sent_at = new Date().toISOString();
    if (newStatus === "paid") updates.paid_at = new Date().toISOString();
    await updateInvoice(invoice.id, updates);
    toast({ title: `Invoice marked as ${newStatus}` });
  };

  const handleSaveSettings = async () => {
    await updateSettings({
      company_name: settingsForm.company_name || null,
      company_address: settingsForm.company_address || null,
      invoice_prefix: settingsForm.invoice_prefix,
      tax_rate: parseFloat(settingsForm.tax_rate) || 0,
      tax_label: settingsForm.tax_label,
      default_payment_terms: settingsForm.default_payment_terms,
      notes_template: settingsForm.notes_template || null,
    } as any);
    toast({ title: "Settings saved" });
  };

  const loadLineItems = async (invoiceId: string) => {
    if (lineItemsCache[invoiceId]) return lineItemsCache[invoiceId];
    const items = await fetchLineItems(invoiceId);
    setLineItemsCache((c) => ({ ...c, [invoiceId]: items }));
    return items;
  };

  const triggerPDF = async (invoice: Invoice) => {
    const items = await loadLineItems(invoice.id);
    const client = clients.find((c) => c.id === invoice.client_id) || null;
    // Directly generate PDF using jsPDF
    const jsPDF = (await import("jspdf")).default;
    const doc = new jsPDF();
    const m = 14;
    let y = 20;
    doc.setFontSize(18);
    doc.text(settings?.company_name || "Invoice", m, y); y += 7;
    if (settings?.company_address) { doc.setFontSize(9); doc.text(settings.company_address, m, y); y += 5; }
    y += 5;
    doc.setFontSize(12);
    doc.text(`Invoice #${invoice.invoice_number}`, m, y); y += 6;
    doc.setFontSize(9);
    doc.text(`Issue Date: ${format(new Date(invoice.issue_date), "MMM d, yyyy")}`, m, y); y += 5;
    if (invoice.due_date) { doc.text(`Due Date: ${format(new Date(invoice.due_date), "MMM d, yyyy")}`, m, y); y += 5; }
    doc.text(`Status: ${invoice.status.toUpperCase()}`, m, y); y += 8;
    if (client) {
      doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("Bill To:", m, y); y += 5;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      doc.text(client.name, m, y); y += 4;
      if (client.contact_name) { doc.text(client.contact_name, m, y); y += 4; }
      if (client.billing_address) { doc.text(client.billing_address, m, y); y += 4; }
      const cityLine = [client.city, client.province, client.postal_code].filter(Boolean).join(", ");
      if (cityLine) { doc.text(cityLine, m, y); y += 4; }
      y += 4;
    }
    doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text("Description", m, y); doc.text("Qty", 110, y, { align: "right" });
    doc.text("Price", 140, y, { align: "right" }); doc.text("Amount", 180, y, { align: "right" }); y += 5;
    doc.setFont("helvetica", "normal");
    for (const li of items) {
      if (y > 265) { doc.addPage(); y = 20; }
      doc.text(li.description, m, y);
      doc.text(String(li.quantity), 110, y, { align: "right" });
      doc.text(`$${Number(li.unit_price).toFixed(2)}`, 140, y, { align: "right" });
      doc.text(`$${Number(li.amount).toFixed(2)}`, 180, y, { align: "right" }); y += 5;
    }
    y += 3;
    doc.text("Subtotal", 140, y, { align: "right" });
    doc.text(`$${Number(invoice.subtotal).toFixed(2)}`, 180, y, { align: "right" }); y += 5;
    if (Number(invoice.tax_amount) > 0) {
      doc.text(settings?.tax_label || "Tax", 140, y, { align: "right" });
      doc.text(`$${Number(invoice.tax_amount).toFixed(2)}`, 180, y, { align: "right" }); y += 5;
    }
    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text("Total", 140, y, { align: "right" });
    doc.text(`$${Number(invoice.total).toFixed(2)}`, 180, y, { align: "right" }); y += 8;
    if (invoice.notes) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      doc.text("Notes:", m, y); y += 4; doc.text(invoice.notes, m, y);
    }
    doc.save(`${invoice.invoice_number}.pdf`);
  };

  return (
    <Layout>
      <div className="container max-w-6xl mx-auto px-4 py-6">
        <SectionHeader title="Invoicing" />

        <Tabs defaultValue="invoices" className="space-y-4">
          <TabsList>
            <TabsTrigger value="invoices"><FileText className="h-4 w-4 mr-1" />Invoices</TabsTrigger>
            <TabsTrigger value="clients"><Users className="h-4 w-4 mr-1" />Clients</TabsTrigger>
            <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-1" />Settings</TabsTrigger>
          </TabsList>

          {/* INVOICES TAB */}
          <TabsContent value="invoices" className="space-y-4">
            <div className="flex justify-between items-center">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="void">Void</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => setShowCreateInvoice(true)}>
                <Plus className="h-4 w-4 mr-1" /> New Invoice
              </Button>
            </div>

            {invoicesLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" />
              </div>
            ) : filteredInvoices.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No invoices yet. Create your first invoice to get started.</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInvoices.map((inv) => {
                        const sc = statusConfig[inv.status] || statusConfig.draft;
                        return (
                          <TableRow key={inv.id}>
                            <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                            <TableCell>{inv.client?.name || "—"}</TableCell>
                            <TableCell>{inv.project?.name || "—"}</TableCell>
                            <TableCell>{format(new Date(inv.issue_date), "MMM d, yyyy")}</TableCell>
                            <TableCell>
                              <Badge variant={sc.variant}>{sc.label}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              ${Number(inv.total).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-1 justify-end">
                                {inv.status === "draft" && (
                                  <Button variant="ghost" size="sm" onClick={() => handleStatusChange(inv, "sent")}>
                                    <Send className="h-3.5 w-3.5 mr-1" />Sent
                                  </Button>
                                )}
                                {inv.status === "sent" && (
                                  <Button variant="ghost" size="sm" onClick={() => handleStatusChange(inv, "paid")}>
                                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Paid
                                  </Button>
                                )}
                                {inv.status !== "void" && inv.status !== "paid" && (
                                  <Button variant="ghost" size="sm" onClick={() => handleStatusChange(inv, "void")}>
                                    <Ban className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="sm" onClick={() => triggerPDF(inv)}>
                                  <FileText className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { label: "Draft", filter: "draft" },
                { label: "Sent", filter: "sent" },
                { label: "Paid", filter: "paid" },
                { label: "Overdue", filter: "overdue" },
              ].map(({ label, filter }) => {
                const count = invoices.filter((i) => i.status === filter).length;
                const sum = invoices.filter((i) => i.status === filter).reduce((s, i) => s + Number(i.total), 0);
                return (
                  <Card key={filter}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">{label}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-bold">${sum.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                      <p className="text-xs text-muted-foreground">{count} invoice{count !== 1 ? "s" : ""}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* CLIENTS TAB */}
          <TabsContent value="clients" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => { setEditingClient(null); setShowClientModal(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Add Client
              </Button>
            </div>

            {clientsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12" /><Skeleton className="h-12" />
              </div>
            ) : clients.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No clients yet. Add your first client to start invoicing.</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>City</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clients.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell>{c.contact_name || "—"}</TableCell>
                          <TableCell>{c.email || "—"}</TableCell>
                          <TableCell>{c.phone || "—"}</TableCell>
                          <TableCell>{c.city || "—"}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => { setEditingClient(c); setShowClientModal(true); }}
                            >
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* SETTINGS TAB */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Invoice Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 max-w-lg">
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input
                    value={settingsForm.company_name}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, company_name: e.target.value }))}
                    placeholder="Your Company Inc."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Company Address</Label>
                  <Input
                    value={settingsForm.company_address}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, company_address: e.target.value }))}
                    placeholder="123 Main St, City, Province"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Invoice Prefix</Label>
                    <Input
                      value={settingsForm.invoice_prefix}
                      onChange={(e) => setSettingsForm((f) => ({ ...f, invoice_prefix: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Default Payment Terms</Label>
                    <Input
                      value={settingsForm.default_payment_terms}
                      onChange={(e) => setSettingsForm((f) => ({ ...f, default_payment_terms: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tax Rate (%)</Label>
                    <Input
                      type="number" step="0.01" min="0"
                      value={settingsForm.tax_rate}
                      onChange={(e) => setSettingsForm((f) => ({ ...f, tax_rate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tax Label</Label>
                    <Input
                      value={settingsForm.tax_label}
                      onChange={(e) => setSettingsForm((f) => ({ ...f, tax_label: e.target.value }))}
                      placeholder="GST"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Default Notes / Payment Instructions</Label>
                  <Input
                    value={settingsForm.notes_template}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, notes_template: e.target.value }))}
                    placeholder="Please make cheques payable to..."
                  />
                </div>
                <Button onClick={handleSaveSettings}>Save Settings</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modals */}
        <ClientFormModal
          open={showClientModal}
          onOpenChange={setShowClientModal}
          initialData={editingClient}
          onSubmit={async (data) => {
            if (editingClient) {
              await updateClient(editingClient.id, data);
            } else {
              await createClient(data);
            }
            toast({ title: editingClient ? "Client updated" : "Client created" });
          }}
        />

        <CreateInvoiceModal
          open={showCreateInvoice}
          onOpenChange={setShowCreateInvoice}
          clients={clients}
          projects={projects}
          taxRate={settings?.tax_rate || 0}
          taxLabel={settings?.tax_label || "Tax"}
          defaultPaymentTerms={settings?.default_payment_terms || "Net 30"}
          initialLineItems={prefillData?.prefillLineItems}
          initialProjectId={prefillData?.prefillProjectId}
          onSubmit={async (inv, lines) => {
            await createInvoice(inv, lines);
            toast({ title: "Invoice created" });
          }}
        />

      </div>
    </Layout>
  );
};

export default Invoicing;
